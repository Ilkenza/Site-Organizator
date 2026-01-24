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

    // Safety guard: if a network call hangs, clear loading after a timeout
    useEffect(() => {
        if (!loading && !signing) return;
        const t = setTimeout(() => {
            console.warn('Safety timeout: clearing loading states');
            setLoading(false);
            setSigning(false);
        }, 35000); // 35s safety net
        return () => clearTimeout(t);
    }, [loading, signing]);


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
    const MFA_CHECK_TIMEOUT = 20000; // 20 seconds
    const MFA_VERIFY_TIMEOUT = 90000; // 90 seconds (mobile networks can be very slow)

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Check if user already has a valid AAL2 session in localStorage
        try {
            const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Check if token has AAL2 (completed MFA) and not expired
                if (parsed?.access_token) {
                    const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                    const isExpired = payload.exp * 1000 < Date.now();
                    if (!isExpired && payload.aal === 'aal2') {
                        console.log('Already have valid AAL2 session, redirecting...');
                        window.location.replace('/dashboard');
                        return;
                    }
                    // Clear old/invalid session
                    if (isExpired) {
                        console.log('Clearing expired session');
                        localStorage.removeItem(storageKey);
                    }
                }
            }
        } catch (e) {
            console.warn('Session check failed:', e);
        }
        setSigning(true);
        setMfaRequired(false);
        setMfaWaiting(false);
        setFactorId(null);

        if (!supabase) {
            setError('Login is temporarily unavailable.');
            setSigning(false);
            return;
        }

        try {
            console.log('Sign in attempt for', email);

            // Create a timeout promise - increased for slow mobile networks
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timed out')), 45000);
            });

            // Race between signIn and timeout
            const signInPromise = supabase.auth.signInWithPassword({ email, password });

            let result;
            try {
                result = await Promise.race([signInPromise, timeoutPromise]);
            } catch (timeoutErr) {
                console.error('SignIn timed out');
                setSigning(false);
                setError('Connection timed out. Please check your internet and try again.');
                return;
            }

            const { data, error } = result;

            if (error) {
                throw error;
            }

            console.log('SignIn result:', { hasSession: !!data?.session, hasUser: !!data?.user });

            // Check for MFA with timeout
            let factorsData = null;
            try {
                const factorsPromise = supabase.auth.mfa.listFactors();
                const factorsTimeout = new Promise((resolve) => {
                    setTimeout(() => resolve({ data: null }), 10000);
                });
                const factorsResult = await Promise.race([factorsPromise, factorsTimeout]);
                factorsData = factorsResult?.data;
            } catch (e) {
                console.warn('MFA check failed:', e);
            }

            const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');

            if (totpFactor) {
                console.log('MFA required, showing MFA form');

                // Save AAL1 token
                const session = data?.session;
                if (session?.access_token) {
                    setAal1Token(session.access_token);
                }

                setFactorId(totpFactor.id);
                setMfaRequired(true);
                setSigning(false);
                return;
            }

            // No MFA - block login (MFA required policy)
            setSigning(false);
            setError('Multi-factor authentication is required. Please enable MFA.');

        } catch (err) {
            console.error('SignIn error:', err);
            setSigning(false);
            setError(err?.message || 'Sign in failed');
        }
    };

    // MFA Verification Handler
    const handleMfaVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Hard timeout - reset everything after 30s
        const hardTimeout = setTimeout(() => {
            console.warn('HARD TIMEOUT: MFA verify took too long');
            setLoading(false);
            setSigning(false);
            setError('Request timed out. Please try again.');
        }, 60000);

        try {
            console.log('MFA verify starting, factorId:', factorId, 'supabase:', !!supabase);

            // Validate inputs
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }
            if (!factorId) {
                throw new Error('No MFA factor ID');
            }
            if (!mfaCode || mfaCode.length !== 6) {
                throw new Error('Invalid MFA code');
            }

            // Step 1: Create challenge with timeout
            console.log('Creating challenge for factor:', factorId);
            let challengeData, challengeError;
            try {
                const challengePromise = supabase.auth.mfa.challenge({ factorId });
                console.log('Challenge promise created');
                const challengeTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Challenge timed out')), 45000)
                );
                const result = await Promise.race([challengePromise, challengeTimeout]);
                challengeData = result.data;
                challengeError = result.error;
            } catch (timeoutErr) {
                console.error('Challenge error:', timeoutErr?.message || timeoutErr);
                clearTimeout(hardTimeout);
                setLoading(false);
                if (timeoutErr?.message?.includes('timed out')) {
                    setError('Connection timed out. Please try again.');
                } else {
                    setError(timeoutErr?.message || 'Challenge failed. Please try again.');
                }
                return;
            }

            if (challengeError) {
                clearTimeout(hardTimeout);
                throw challengeError;
            }

            console.log('Challenge created:', challengeData?.id);

            // Step 2: Verify code - fire SDK call but use fetch interceptor result
            window.__debugSupabaseVerify = null; // Reset before verify

            // Start SDK verify (don't await)
            supabase.auth.mfa.verify({
                factorId: factorId,
                challengeId: challengeData.id,
                code: mfaCode
            }).then(result => {
                console.log('SDK verify completed:', result);
            }).catch(err => {
                console.log('SDK verify error (ignored, using fetch interceptor):', err);
            });

            // Poll for fetch interceptor result (much faster than waiting for SDK)
            let verifyData = null;
            for (let i = 0; i < 60; i++) { // 30 seconds max
                await new Promise(r => setTimeout(r, 500));

                const debugResponse = window.__debugSupabaseVerify;
                if (debugResponse && debugResponse.status === 200 && debugResponse.text) {
                    try {
                        const parsed = JSON.parse(debugResponse.text);
                        if (parsed.access_token) {
                            console.log('Got token from fetch interceptor!');
                            verifyData = { session: parsed, user: parsed.user };
                            break;
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            }

            if (!verifyData) {
                throw new Error('Verification failed - no response received');
            }

            console.log('Verify successful:', { hasSession: !!verifyData?.session });

            // Step 3: Store tokens and redirect
            const session = verifyData?.session;
            if (session?.access_token && session?.refresh_token && session?.user) {
                clearTimeout(hardTimeout);

                const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;

                // Fetch profile data before storing to localStorage
                let userWithProfile = { ...session.user };
                try {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('avatar_url, name')
                        .eq('id', session.user.id)
                        .single();

                    if (profileData) {
                        userWithProfile = {
                            ...session.user,
                            user_metadata: {
                                ...session.user.user_metadata,
                                avatar_url: profileData.avatar_url,
                                name: profileData.name
                            },
                            avatarUrl: profileData.avatar_url,
                            displayName: profileData.name
                        };
                        console.log('[MFA] Profile data fetched:', profileData);
                    }
                } catch (profileError) {
                    console.warn('[MFA] Could not fetch profile:', profileError);
                }

                // Store tokens with profile data
                localStorage.setItem(storageKey, JSON.stringify({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                    expires_at: session.expires_at,
                    expires_in: session.expires_in,
                    token_type: 'bearer',
                    user: userWithProfile
                }));

                console.log('Tokens stored, redirecting...');
                window.location.replace('/dashboard');
                return;
            }

            // No session received
            clearTimeout(hardTimeout);
            throw new Error('No session received after verification');

        } catch (err) {
            clearTimeout(hardTimeout);
            console.error('MFA Error:', err);

            setLoading(false);
            setSigning(false);

            // Show friendly error message
            if (err?.message?.includes('Invalid') || err?.message?.includes('invalid')) {
                setError('Invalid code. Please try again.');
            } else {
                setError(err?.message || 'Verification failed');
            }
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
                                    {signing ? (
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : 'Sign In'}
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
