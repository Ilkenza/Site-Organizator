import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Head from 'next/head';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // Signing indicates we're processing the initial email/password sign-in (no spinner on the Sign In button)
    const [signing, setSigning] = useState(false);

    // Helper: silently log a message and switch to the loading screen so the UI stays in loading state during redirect
    // IMPORTANT: do NOT show a browser alert here — we only want the loading button visible.
    const postAlertLoading = (msg) => {
        try { console.log(msg); } catch (e) { }
        try { setLoading(true); } catch (e) { }
    };

    // Silent notice for user-facing messages where we DO NOT want to show a loading spinner
    const postNotice = (msg) => { try { console.log(msg); } catch (e) { } };

    // Helper to complete login and redirect. If MFA is active, suppress the alert and keep the loading screen.
    const completeLogin = ({ showAlert = false } = {}) => {
        if (typeof window !== 'undefined') {
            if (window.__suppressAlertsDuringMfa) showAlert = false;
            window.__suppressAlertsDuringMfa = false;
        }
        if (showAlert) {
            try { alert('Login successful — redirecting to dashboard'); } catch (e) { }
        }
        try { setLoading(true); } catch (e) { }
        window.location.replace('/dashboard');
    };

    // Ensure any alert shown while on this page results in the loading screen remaining visible (unless suppressed during MFA)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const originalAlert = window.alert;
        window.alert = (msg) => {
            if (window.__suppressAlertsDuringMfa) {
                try { setLoading(true); } catch (e) { }
                return;
            }
            originalAlert(msg);
            try { setLoading(true); } catch (e) { }
        };
        return () => { window.alert = originalAlert; };
    }, [setLoading]);
    const [_verifyDebug, setVerifyDebug] = useState(null);

    // MFA states
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaWaiting, setMfaWaiting] = useState(false); // true while we wait for server to confirm factorId
    const [mfaVerifying, setMfaVerifying] = useState(false); // true while MFA verify is in progress
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState(null);
    const [aal1Token, setAal1Token] = useState(null); // Store AAL1 token from sign-in for MFA verify

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const _origFetch = window.fetch;
        window.fetch = async function (input, init) {
            const res = await _origFetch(input, init);
            try {
                const url = typeof input === 'string' ? input : (input && input.url);
                if (url && url.includes('/auth/v1/factors/') && url.includes('/verify')) {
                    const cloned = res.clone();
                    cloned.text().then(t => {
                        console.log('DEBUG fetch verify response', { url, status: res.status, text: t });
                        try {
                            const payload = { time: Date.now(), url, status: res.status, text: t };
                            localStorage.setItem('debug.supabase.verify', JSON.stringify(payload));
                            window.__debugSupabaseVerify = payload;
                            if (typeof setVerifyDebug === 'function') setVerifyDebug(payload);
                        } catch (e) {
                            console.error('DEBUG save error', e);
                        }
                    }).catch(e => console.error('DEBUG read text error', e));
                }
            } catch (e) { console.error('fetch-override-debug error', e); }
            return res;
        };
        return () => { window.fetch = _origFetch };
    }, []);

    // Safety guard: if a network call hangs, clear loading after a timeout so button isn't stuck
    useEffect(() => {
        if (!loading) return;
        // Use longer timeout during MFA verify (mobile networks can be slow)
        const timeoutMs = mfaVerifying ? 60000 : 30000; // 60s for MFA, 30s otherwise
        const t = setTimeout(() => {
            // Don't clear loading if redirect is in progress or MFA verify still running
            if (typeof window !== 'undefined' && window.__redirecting) {
                console.log('Timeout reached but redirect in progress, keeping loading state');
                return;
            }
            console.warn('Login flow timeout reached; clearing loading state');
            setLoading(false);
            setMfaVerifying(false);
            setError('Request timed out. Please try again.');
            try { window.__debugSupabaseSignInTimeout = { time: Date.now(), email }; } catch (e) { }
        }, timeoutMs);
        return () => clearTimeout(t);
    }, [loading, email, mfaVerifying]);


    const { supabase } = useAuth();

    // Debug presence of Supabase config (do NOT log secrets)
    useEffect(() => {
        console.log('Login: supabase configured?', {
            hasSupabase: !!supabase,
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        });
    }, [supabase]);

    // Timeout constants (increased for mobile/slow networks)
    const MFA_CHECK_TIMEOUT = 15000; // 15 seconds
    const MFA_VERIFY_TIMEOUT = 55000; // 55 seconds (mobile networks can be slow)

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        console.log('Starting sign-in (handleSubmit) for', email ? email : 'no-email');
        // Use a non-spinning signing state so the Sign In button is disabled but does not show a spinner
        setSigning(true);
        // Don't show MFA UI yet - wait for server to confirm credentials first
        setMfaRequired(false);
        setMfaWaiting(false);
        setFactorId(null);
        setError('');

        if (!supabase) {
            console.error('Supabase client not configured - missing NEXT_PUBLIC variables');
            setError('Login is temporarily unavailable. Please contact the site administrator.');
            setSigning(false);
            return;
        }

        try {
            console.log('Login attempt for', email);

            // Sign out locally only (don't clear tokens from other devices)
            try {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => { });
            } catch (e) {
                console.warn('Error clearing local session:', e);
            }

            // Fallback timeout to avoid spinner stuck if something hangs
            const timeoutId = setTimeout(() => {
                console.warn('Login fallback timeout reached');
                setSigning(false);
                // Reset MFA state on timeout
                setMfaRequired(false);
                setMfaWaiting(false);
                setFactorId(null);
                setError('Login timed out, please try again');
            }, 20000);

            // Run signIn with a 20s timeout to avoid hangs
            const signInPromise = supabase.auth.signInWithPassword({ email, password });
            // If the sign-in resolves late (after our timeout), still capture tokens as a fallback
            signInPromise.then(async (result) => {
                try {
                    const sessionFromSignIn = result?.data ?? result;

                    // If the late response indicates the user has MFA factors, trigger the MFA flow instead of storing tokens
                    if (sessionFromSignIn?.user?.factors?.length) {
                        console.log('Late signIn shows user has MFA factors; triggering MFA flow');
                        try { window.__mfaPending = true; } catch (e) { }
                        // Save AAL1 token for MFA verify
                        if (sessionFromSignIn?.session?.access_token) {
                            setAal1Token(sessionFromSignIn.session.access_token);
                        } else if (sessionFromSignIn?.access_token) {
                            setAal1Token(sessionFromSignIn.access_token);
                        }
                        setFactorId(sessionFromSignIn.user.factors[0].id || null);
                        setMfaRequired(true);
                        setMfaWaiting(false);
                        try { window.__debugSupabaseSignInLate = { time: Date.now(), payload: sessionFromSignIn }; } catch (e) { }
                        setSigning(false);
                        return;
                    }

                    if (sessionFromSignIn?.access_token || sessionFromSignIn?.refresh_token || sessionFromSignIn?.user) {
                        // Require MFA: if the user object does not indicate MFA factors, reject login
                        const hasFactors = !!(sessionFromSignIn?.user?.factors?.length);
                        if (!hasFactors) {
                            console.warn('Account does not have MFA factors — blocking login');
                            setSigning(false);
                            setMfaRequired(false);
                            setMfaWaiting(false);
                            setError('Multi-factor authentication is required for this account. Please enable MFA before signing in.');
                            return;
                        }

                        console.log('Late signIn response received — storing tokens as fallback');
                        const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                        const toStore = {
                            access_token: sessionFromSignIn?.access_token,
                            refresh_token: sessionFromSignIn?.refresh_token,
                            expires_at: sessionFromSignIn?.expires_at,
                            expires_in: sessionFromSignIn?.expires_in,
                            token_type: sessionFromSignIn?.token_type,
                            user: sessionFromSignIn?.user || sessionFromSignIn?.user,
                        };
                        try { localStorage.setItem(storageKey, JSON.stringify(toStore)); } catch (e) { console.error('Late store fallback failed', e); }
                        try { window.__debugSupabaseSignInLate = { time: Date.now(), payload: sessionFromSignIn }; } catch (e) { }

                        // If MFA is currently pending, do not auto-establish session yet
                        if (typeof window !== 'undefined' && window.__mfaPending) {
                            console.log('Skipping auto setSession because MFA is pending');
                        } else {
                            // Try to set the session in the Supabase client so the user becomes authenticated immediately
                            try {
                                const setResp = await supabase.auth.setSession({ access_token: sessionFromSignIn.access_token, refresh_token: sessionFromSignIn.refresh_token });
                                console.log('Late setSession result', setResp);
                                if (!setResp?.error) {
                                    try { setSigning(false); } catch (e) { }
                                    try { await supabase.auth.getSession(); } catch (e) { }
                                    completeLogin({ showAlert: false });
                                    window.location.replace('/dashboard');
                                } else {
                                    console.error('Late setSession error', setResp.error);
                                }
                            } catch (e) {
                                console.error('Late setSession thrown', e);
                            }
                        }
                    }
                } catch (e) { console.error('Error processing late signIn response', e); }
            }).catch((e) => console.error('Late signIn promise error', e));

            let data, error;
            try {
                const result = await Promise.race([
                    signInPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('signIn timeout')), 20000)),
                ]);
                // SDK returns { data, error } or similar shape
                data = result?.data ?? result;
                error = result?.error ?? null;
                console.log('signInWithPassword result (wrapped):', { data, error });
            } catch (err) {
                console.error('signInWithPassword failed or timed out', err);
                setError('Sign in failed or timed out. Please try again.');
                setSigning(false);
                // Reset MFA state if sign-in failed
                setMfaRequired(false);
                setMfaWaiting(false);
                setFactorId(null);
                return;
            }

            if (error) {
                clearTimeout(timeoutId);
                // Reset MFA state on sign-in error
                setMfaRequired(false);
                setMfaWaiting(false);
                setFactorId(null);
                throw error;
            }

            // If signIn returned a session or tokens, store them as a fallback and wait for session to appear
            try {
                const sessionFromSignIn = data?.session || data || null;
                if (sessionFromSignIn?.access_token || sessionFromSignIn?.refresh_token || sessionFromSignIn?.user) {
                    console.log('Storing tokens from signIn response as fallback');
                    const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                    const toStore = {
                        access_token: sessionFromSignIn?.access_token,
                        refresh_token: sessionFromSignIn?.refresh_token,
                        expires_at: sessionFromSignIn?.expires_at,
                        expires_in: sessionFromSignIn?.expires_in,
                        token_type: sessionFromSignIn?.token_type,
                        user: sessionFromSignIn?.user || sessionFromSignIn?.user
                    };
                    localStorage.setItem(storageKey, JSON.stringify(toStore));

                    // Poll for session to be visible via SDK
                    let sessionPresent = false;
                    const pollStart = Date.now();
                    const maxPoll = 3000;
                    while (Date.now() - pollStart < maxPoll) {
                        try {
                            const { data: sess } = await supabase.auth.getSession();
                            if (sess?.session) { sessionPresent = true; break; }
                        } catch (e) {
                            // continue
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                    if (sessionPresent) {
                        console.log('Session visible after sign-in, checking MFA before redirect');
                        clearTimeout(timeoutId);
                        setSigning(false);

                        // Check for MFA factors before redirecting — if TOTP is verified, require MFA verification first
                        try {
                            const mfaCheckPromise = Promise.race([
                                supabase.auth.mfa.listFactors(),
                                new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'MFA check timeout' } }), MFA_CHECK_TIMEOUT))
                            ]);
                            const { data: factorsData, error: factorsError } = await mfaCheckPromise;
                            const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');
                            if (totpFactor && !factorsError) {
                                console.log('MFA required after sign-in; showing MFA prompt');
                                // Save AAL1 token for MFA verify
                                const currentSession = (await supabase.auth.getSession()).data?.session;
                                if (currentSession?.access_token) {
                                    setAal1Token(currentSession.access_token);
                                }
                                setFactorId(totpFactor.id);
                                setMfaWaiting(false);
                                postNotice('MFA required — please enter your verification code');
                                try { window.__mfaPending = true; window.__suppressAlertsDuringMfa = true; } catch (e) { }
                                setMfaRequired(true);
                                setSigning(false);
                                console.log('MFA required, showing MFA prompt');
                                return;
                            }
                        } catch (e) {
                            console.warn('MFA check failed during post-signin handling, proceeding with redirect:', e?.message || e);
                        }

                        // IMPORTANT: Do not allow login to proceed if no verified TOTP factor exists
                        console.warn('Blocking login: account does not have verified TOTP MFA factor');
                        setSigning(false);
                        setError('Multi-factor authentication is required for this account. Please enable MFA before signing in.');
                        return;
                    }
                }
            } catch (e) {
                console.warn('Error storing sign-in tokens fallback:', e?.message || e);
            }

            // Check if MFA is required by listing factors directly (with timeout)
            const mfaCheckPromise = Promise.race([
                supabase.auth.mfa.listFactors(),
                new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'MFA check timeout' } }), MFA_CHECK_TIMEOUT))
            ]);

            const { data: factorsData, error: factorsError } = await mfaCheckPromise;
            console.log('MFA factors response:', { factorsData, factorsError });

            // If we have verified TOTP factors, require MFA
            const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');
            if (totpFactor && !factorsError) {
                clearTimeout(timeoutId);
                // Save AAL1 token for MFA verify
                const currentSession = (await supabase.auth.getSession()).data?.session;
                if (currentSession?.access_token) {
                    setAal1Token(currentSession.access_token);
                }
                setFactorId(totpFactor.id);
                setMfaWaiting(false);
                console.log('MFA required; showing MFA form');
                postNotice('MFA required — please enter your verification code');
                try { window.__mfaPending = true; } catch (e) { }
                setMfaRequired(true);
                setSigning(false);
                console.log('MFA required, showing MFA prompt');
                return;
            }

            // If we reached here and there is no verified TOTP factor, block login (MFA required policy)
            if (!totpFactor && !factorsError) {
                clearTimeout(timeoutId);
                console.warn('Blocking login: account does not have verified TOTP MFA factor');
                setSigning(false);
                setMfaWaiting(false);
                setError('Multi-factor authentication is required for this account. Please enable MFA before signing in.');
                return;
            }

            // Log if MFA check failed or timed out
            if (factorsError) {
                console.warn('MFA check failed or timed out, proceeding without MFA:', factorsError.message);
            }

            clearTimeout(timeoutId);
            // No MFA required or already at aal2, proceed to dashboard
            console.log('Login complete, redirecting to /dashboard');
            setSigning(false);
            window.location.replace('/dashboard');
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed');
            setSigning(false);
            // Reset MFA state on any login error
            setMfaRequired(false);
            setMfaWaiting(false);
            setFactorId(null);
        }
    };

    const handleMfaVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setMfaVerifying(true);

        if (!supabase) {
            console.error('Supabase client not configured during MFA verify');
            setError('MFA verification is temporarily unavailable.');
            setLoading(false);
            setMfaVerifying(false);
            return;
        }

        try {
            console.log('1. Starting MFA verify, factorId:', factorId);

            // Create MFA challenge
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: factorId
            });

            console.log('2. Challenge response:', { challengeData, challengeError });

            if (challengeError) throw challengeError;

            console.log('3. Verifying code:', mfaCode, 'challengeId:', challengeData.id);

            // Verify MFA code with timeout protection using direct fetch (returns tokens reliably)
            const verifyStart = Date.now();
            console.log('3.1 Starting verify via fetch; timeout (ms):', MFA_VERIFY_TIMEOUT);

            const rawBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').replace(/\/$/, '');
            const verifyUrl = `${rawBase}/auth/v1/factors/${factorId}/verify`;
            const apiKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/^"|"$/g, '');

            // Use saved AAL1 token first, fallback to current session token
            let authToken = aal1Token;
            if (!authToken) {
                const currentSession = (await supabase.auth.getSession()).data?.session;
                authToken = currentSession?.access_token || '';
            }
            console.log('3.2 Using auth token:', authToken ? 'present' : 'missing');

            if (!authToken) {
                throw new Error('No authentication token available. Please sign in again.');
            }

            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(), MFA_VERIFY_TIMEOUT);

            let verifyResponse;
            try {
                verifyResponse = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': apiKey,
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ challenge_id: challengeData.id, code: mfaCode }),
                    signal: controller.signal
                });
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error('Verification timed out, please try again');
                }
                throw fetchErr;
            } finally {
                clearTimeout(to);
            }

            const verifyElapsed = Date.now() - verifyStart;
            let verifyResult;
            try {
                verifyResult = await verifyResponse.json();
            } catch (e) {
                const text = await verifyResponse.text().catch(() => '');
                verifyResult = { __raw: text };
            }

            console.log('4. Verify completed; elapsed (ms):', verifyElapsed, 'status:', verifyResponse.status, 'body:', verifyResult);

            if (!verifyResponse.ok) {
                const msg = verifyResult?.error_description || verifyResult?.msg || verifyResult?.error || JSON.stringify(verifyResult);
                throw new Error(msg || 'Invalid verification code');
            }

            console.log('5. MFA successful (verify returned OK) — extracting tokens from verifyResult...');

            // Extract tokens from verifyResult (check direct properties first, then nested in .data)
            const tokenCandidates = verifyResult || {};
            const access_token = tokenCandidates?.access_token || tokenCandidates?.data?.access_token;
            const refresh_token = tokenCandidates?.refresh_token || tokenCandidates?.data?.refresh_token;

            if (access_token && refresh_token) {
                console.log('Found AAL2 tokens in verifyResult, storing and redirecting...');
                try { window.__mfaPending = false; window.__suppressAlertsDuringMfa = false; } catch (e) { }

                // ALWAYS store tokens to localStorage FIRST (before any async operations)
                const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                const toStore = {
                    access_token,
                    refresh_token,
                    expires_at: verifyResult?.expires_at,
                    expires_in: verifyResult?.expires_in,
                    token_type: verifyResult?.token_type || 'bearer',
                    user: verifyResult?.user
                };
                try {
                    localStorage.setItem(storageKey, JSON.stringify(toStore));
                    console.log('Tokens stored to localStorage with key:', storageKey);
                } catch (e) {
                    console.error('Failed to store tokens:', e);
                }

                // Fire setSession in background (don't await) - it's a "nice to have"
                supabase.auth.setSession({ access_token, refresh_token })
                    .then(r => console.log('Background setSession completed:', r?.error ? 'error' : 'success'))
                    .catch(e => console.warn('Background setSession failed:', e));

                // Set redirect flag and redirect immediately
                try { window.__redirecting = true; } catch (e) { }
                console.log('Redirecting to dashboard...');
                window.location.replace('/dashboard');
                return;
            }

            // No tokens found in verifyResult
            console.warn('No tokens found in verifyResult after MFA verify');
            try { window.__mfaPending = false; window.__suppressAlertsDuringMfa = false; } catch (e) { }
            setMfaWaiting(false);
            setMfaRequired(false);
            setMfaVerifying(false);
            setError('Verification completed but no tokens received. Please try signing in again.');
            setLoading(false);
        } catch (err) {
            console.error('MFA Error:', err);
            try { window.__mfaPending = false; window.__suppressAlertsDuringMfa = false; } catch (e) { }
            setMfaWaiting(false);
            setMfaRequired(false);
            setMfaVerifying(false);
            setError(err.message || 'Invalid verification code');
            setLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Login - Site Organizer</title>
            </Head>

            <div className="min-h-screen bg-app-bg-primary flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent to-[#4A9FE8] mb-4 shadow-lg shadow-app-accent/20">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-app-text-primary">Site Organizer</h1>
                        <p className="text-app-text-secondary mt-2">Organize your favorite websites</p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-app-bg-secondary border border-app-border rounded-2xl p-6 sm:p-8 shadow-xl">
                        <h2 className="text-xl font-semibold text-app-text-primary mb-6">
                            {mfaRequired ? 'Two-Factor Authentication' : 'Welcome back'}
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {!mfaRequired ? (
                            // Email/Password Form
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-app-text-secondary mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-app-text-secondary mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full px-4 py-3 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={signing}
                                    className="w-full py-3 px-4 bg-btn-primary hover:bg-btn-hover text-app-accent font-medium rounded-xl border border-[#2A5A8A] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:text-app-accentLight"
                                >
                                    Sign In
                                </button>
                            </form>
                        ) : (
                            // MFA Verification Form
                            <form onSubmit={handleMfaVerify} className="space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-app-accent/20 mb-3">
                                        <svg className="w-6 h-6 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <p className="text-app-text-secondary text-sm">
                                        Enter the 6-digit code from your authenticator app
                                    </p>
                                </div>

                                <div>
                                    <input
                                        type="text"
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        required
                                        maxLength={6}
                                        autoFocus
                                        className="w-full px-4 py-4 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary text-center text-2xl tracking-[0.5em] font-mono placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                        placeholder="000000"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || mfaWaiting || mfaCode.length !== 6}
                                    className="w-full py-3 px-4 bg-btn-primary hover:bg-btn-hover text-app-accent font-medium rounded-xl border border-[#2A5A8A] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:text-app-accentLight"
                                >
                                    {loading ? (
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : 'Verify'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        try { window.__mfaPending = false; } catch (e) { }
                                        setMfaRequired(false);
                                        setMfaCode('');
                                        setError('');
                                        setMfaWaiting(false);
                                        setAal1Token(null);
                                    }}
                                    className="w-full py-2 text-app-text-secondary hover:text-app-text-primary text-sm transition-colors"
                                >
                                    ← Back to login
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Footer */}
                    <p className="text-center text-app-text-muted text-xs mt-6">
                        Your data is securely stored and encrypted
                    </p>
                </div>
            </div>
        </>
    );
}

export async function getServerSideProps() {
    // Prevent static prerendering for login page (client-only auth flow)
    return { props: {} };
}
