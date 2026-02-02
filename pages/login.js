/**
 * @fileoverview Login and registration page with MFA support
 * Handles user authentication, 2FA verification, and redirect to dashboard
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Head from 'next/head';
import Modal from '../components/ui/Modal';

// Configuration
const LOGIN_CONFIG = {
    DASHBOARD_URL: '/dashboard/sites',
    SAFETY_TIMEOUT_MS: 35000,
    SUCCESS_MESSAGE: 'Login successful — redirecting to dashboard'
};

/**
 * Login page component with authentication and MFA support
 * @returns {JSX.Element} Login page
 */
export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });
    // Signing indicates we're processing the initial email/password sign-in (no spinner on the Sign In button)
    const [signing, setSigning] = useState(false);

    // Silent notice for user-facing messages where we DO NOT want to show a loading spinner

    // Helper to complete login and redirect. If MFA is active, suppress the alert and keep the loading screen.
    const _completeLogin = ({ showAlert = false } = {}) => {
        if (typeof window !== 'undefined') {
            if (window.__suppressAlertsDuringMfa) showAlert = false;
            window.__suppressAlertsDuringMfa = false;
        }
        if (showAlert) {
            try { alert(LOGIN_CONFIG.SUCCESS_MESSAGE); } catch (e) { /* Suppress alert errors */ }
        }
        try { setLoading(true); } catch (e) { /* Suppress state update errors during unmount */ }
        window.location.replace(LOGIN_CONFIG.DASHBOARD_URL);
    };

    // Ensure any alert shown while on this page results in the loading screen remaining visible (unless suppressed during MFA)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const originalAlert = window.alert;
        window.alert = (msg) => {
            if (window.__suppressAlertsDuringMfa) {
                try { setLoading(true); } catch (e) { /* Suppress state update errors during unmount */ }
                return;
            }
            originalAlert(msg);
            try { setLoading(true); } catch (e) { /* Suppress state update errors during unmount */ }
        };
        return () => { window.alert = originalAlert; };
    }, [setLoading]);
    const [_verifyDebug, setVerifyDebug] = useState(null);

    // MFA states
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaWaiting, setMfaWaiting] = useState(false); // true while we wait for server to confirm factorId
    const [_mfaVerifying, _setMfaVerifying] = useState(false); // true while MFA verify is in progress
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState(null);
    const [aal1Token, setAal1Token] = useState(null); // Store AAL1 token from sign-in for MFA verify
    const [isFreshLogin, setIsFreshLogin] = useState(false); // true if user just signed in (vs page refresh restore)

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
    const safetyTimerRef = useRef(null);
    useEffect(() => {
        if (!loading && !signing) return;
        safetyTimerRef.current = setTimeout(() => {
            console.warn('Safety timeout: clearing loading states');
            setLoading(false);
            setSigning(false);
            safetyTimerRef.current = null;
        }, LOGIN_CONFIG.SAFETY_TIMEOUT_MS); // Safety timeout
        return () => {
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
        };
    }, [loading, signing]);


    const { supabase } = useAuth();

    // Sign Up Handler
    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setSigning(true);

        try {
            // Validate username
            if (!username || username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            // Validate password match
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            // Validate password strength
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                throw new Error('Password must be at least 8 characters and contain: uppercase, lowercase, number, and special character (@$!%*?&)');
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                        display_name: username
                    },
                    emailRedirectTo: window.location.origin + '/dashboard/sites'
                }
            });

            if (error) throw error;

            if (data?.user) {
                // Check if email confirmation is disabled (auto-confirm)
                if (data.user.confirmed_at || data.session) {
                    setSuccessModal({
                        isOpen: true,
                        message: `Welcome, ${username}! Your account has been created successfully. You can now sign in.`
                    });
                } else {
                    setSuccessModal({
                        isOpen: true,
                        message: `Account created! Please check your email (${email}) to verify your account before signing in.`
                    });
                }
                setIsSignUp(false);
                setEmail('');
                setPassword('');
                setUsername('');
                setConfirmPassword('');
            }
        } catch (err) {
            console.error('SignUp error:', err);
            setError(err?.message || 'Sign up failed');
        } finally {
            setSigning(false);
        }
    };

    // Debug presence of Supabase config (do NOT log secrets)
    useEffect(() => {
        // Check if user already has a valid session on page load
        try {
            const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.access_token) {
                    const payload = JSON.parse(atob(parsed.access_token.split('.')[1] || '""'));
                    const isExpired = payload.exp * 1000 < Date.now();
                    if (!isExpired) {
                        if (payload.aal === 'aal2') {
                            window.location.replace(LOGIN_CONFIG.DASHBOARD_URL);
                            return;
                        } else {
                            // Valid token but not AAL2 (e.g., AAL1) — restore MFA flow instead of redirecting
                            try {
                                setAal1Token(parsed.access_token);
                                setMfaRequired(true);

                                // Try to detect MFA factor id so Verify form works immediately
                                (async () => {
                                    try {
                                        // First, check if we have the factorId saved in localStorage from the original login
                                        const savedFactorId = localStorage.getItem('mfa_pending_factor');
                                        if (savedFactorId) {
                                            setFactorId(savedFactorId);
                                            return; // No need to query listFactors
                                        }

                                        // Fallback: try to query listFactors (may fail with AAL1 token)
                                        // Ensure supabase client uses the stored AAL1 token so listFactors can be queried
                                        try {
                                            await supabase.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token || '' });
                                        } catch (setErr) {
                                            console.warn('Restored MFA flow: failed to set supabase session:', setErr);
                                        }

                                        // Try several times to find a factor (some delays may apply server-side)
                                        let found = false;
                                        for (let attempt = 0; attempt < 4 && !found; attempt++) {
                                            try {
                                                const factorsPromise = supabase.auth.mfa.listFactors();
                                                const factorsTimeout = new Promise((resolve) => setTimeout(() => resolve({ data: null }), 5000));
                                                const factorsResult = await Promise.race([factorsPromise, factorsTimeout]);
                                                const factorsData = factorsResult?.data;

                                                // Prefer verified TOTP, else any TOTP, else any factor
                                                let totpFactor = null;
                                                if (Array.isArray(factorsData?.totp) && factorsData.totp.length) {
                                                    totpFactor = factorsData.totp.find(f => f.status === 'verified') || factorsData.totp[0];
                                                }
                                                if (totpFactor) {
                                                    setFactorId(totpFactor.id);
                                                    found = true;
                                                    break;
                                                }

                                                // Try any factor across types
                                                const allFactors = Object.keys(factorsData || {}).flatMap(k => factorsData[k] || []);
                                                if (allFactors.length) {
                                                    setFactorId(allFactors[0].id);
                                                    found = true;
                                                    break;
                                                }

                                            } catch (qErr) {
                                                console.warn('Restored MFA flow: listFactors attempt failed:', qErr);
                                            }
                                            // wait a bit before retrying
                                            await new Promise(r => setTimeout(r, 300));
                                        }

                                        if (!found) {
                                            console.warn('Restored MFA flow: no factor found after retries');
                                            setError('No MFA factor found for this account. Please enable 2FA.');
                                        }
                                    } catch (fErr) {
                                        console.warn('Restored MFA flow: failed to query factors:', fErr);
                                    }
                                })();

                            } catch (e) {
                                console.warn('Failed to restore MFA flow from token:', e);
                            }
                            return;
                        }
                    } else {
                        // Clear expired session
                        localStorage.removeItem(storageKey);
                    }
                }
            }
        } catch (e) {
            console.warn('Session check on login page load failed:', e);
        }
    }, [supabase]);


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
                        window.location.replace(LOGIN_CONFIG.DASHBOARD_URL);
                        return;
                    }
                    // Clear old/invalid session
                    if (isExpired) {
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
        // Clear any pending MFA factor from localStorage when starting fresh login

        if (!supabase) {
            setError('Login is temporarily unavailable.');
            setSigning(false);
            return;
        }

        try {
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
                // Save AAL1 token and mark as fresh login
                const session = data?.session;
                if (session?.access_token) {
                    setAal1Token(session.access_token);
                }
                setIsFreshLogin(true); // Mark that SDK already has session from signInWithPassword

                setFactorId(totpFactor.id);
                // Persist factorId so page refresh can restore MFA flow
                try {
                    localStorage.setItem('mfa_pending_factor', totpFactor.id);
                } catch (e) { console.warn('Failed to save MFA factor to localStorage:', e); }
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

            // Only call setSession if we're restoring from a page refresh (not a fresh login)
            // After signInWithPassword, the SDK already has the session internally
            if (aal1Token && !isFreshLogin) {
                try {
                    const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                    const storedTokens = localStorage.getItem(storageKey);
                    if (storedTokens) {
                        const tokens = JSON.parse(storedTokens);
                        if (tokens?.refresh_token) {
                            // Wrap setSession in a timeout to prevent hanging
                            const setSessionPromise = supabase.auth.setSession({
                                access_token: aal1Token,
                                refresh_token: tokens.refresh_token
                            });
                            const setSessionTimeout = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('setSession timeout')), 5000)
                            );
                            try {
                                await Promise.race([setSessionPromise, setSessionTimeout]);
                            } catch (timeoutErr) {
                                console.warn('setSession timed out, continuing anyway:', timeoutErr.message);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error restoring AAL1 session:', e);
                }
            }

            // Use challengeAndVerify which combines both steps in one call
            let verifyData = null;
            let verifyError = null;

            try {
                const verifyPromise = supabase.auth.mfa.challengeAndVerify({
                    factorId: factorId,
                    code: mfaCode
                });

                // Shorter timeout - if SDK hangs, we'll try to recover from intercepted fetch response
                const verifyTimeout = new Promise((resolve) =>
                    setTimeout(() => resolve({ timedOut: true }), 8000)
                );

                const result = await Promise.race([verifyPromise, verifyTimeout]);

                // Check if SDK returned or timed out
                if (result?.timedOut) {
                    console.warn('challengeAndVerify SDK hung, checking for intercepted response...');

                    // Try to recover from the fetch interceptor's captured response
                    const debugData = window.__debugSupabaseVerify;
                    if (debugData?.status === 200 && debugData?.text) {
                        try {
                            const parsed = JSON.parse(debugData.text);
                            if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
                                verifyData = { session: parsed };
                            } else {
                                throw new Error('Incomplete session in intercepted response');
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse intercepted response:', parseErr);
                            verifyError = { message: 'Verification response invalid' };
                        }
                    } else if (debugData?.status && debugData.status !== 200) {
                        // Non-200 status - likely invalid code
                        console.error('Intercepted non-200 response:', debugData.status);
                        verifyError = { message: 'Invalid code. Please try again.' };
                    } else {
                        console.error('No intercepted response available');
                        verifyError = { message: 'Verification timed out. Please try again.' };
                    }
                } else {
                    if (result?.error) {
                        verifyError = result.error;
                    } else {
                        // SDK may return session in different formats
                        // Format 1: result.data.session (standard)
                        // Format 2: result.data directly contains tokens (observed behavior)
                        if (result?.data?.session) {
                            verifyData = result.data;
                        } else if (result?.data?.access_token && result?.data?.refresh_token && result?.data?.user) {
                            // Session data is directly in result.data
                            verifyData = { session: result.data };
                        } else {
                            // Try to recover from intercepted response
                            const debugData = window.__debugSupabaseVerify;
                            if (debugData?.status === 200 && debugData?.text) {
                                try {
                                    const parsed = JSON.parse(debugData.text);
                                    if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {

                                        verifyData = { session: parsed };
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }
                }
            } catch (sdkErr) {
                console.error('MFA SDK error:', sdkErr?.message || sdkErr);

                // Even on SDK error, try to recover from intercepted response
                const debugData = window.__debugSupabaseVerify;
                if (debugData?.status === 200 && debugData?.text) {
                    try {
                        const parsed = JSON.parse(debugData.text);
                        if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
                            verifyData = { session: parsed };
                        }
                    } catch (e) { /* ignore parse error */ }
                }

                if (!verifyData) {
                    clearTimeout(hardTimeout);
                    setLoading(false);
                    if (sdkErr?.message?.includes('Invalid') || sdkErr?.message?.includes('invalid')) {
                        setError('Invalid code. Please try again.');
                    } else {
                        setError(sdkErr?.message || 'Verification failed. Please try again.');
                    }
                    return;
                }
            }

            if (verifyError) {
                clearTimeout(hardTimeout);
                if (verifyError.message?.includes('Invalid') || verifyError.message?.includes('invalid')) {
                    setError('Invalid code. Please try again.');
                } else {
                    setError(verifyError.message || 'Verification failed');
                }
                setLoading(false);
                return;
            }


            // Get session from the verify result
            const session = verifyData?.session;

            if (session?.access_token && session?.refresh_token && session?.user) {
                clearTimeout(hardTimeout);

                const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;

                // Fetch profile data before storing to include avatar and displayName
                let userWithProfile = session.user;
                try {
                    // Use our API endpoint instead of Supabase SDK to avoid timeout issues
                    const profilePromise = fetch('/api/profile', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    }).then(res => res.json());

                    const profileTimeout = new Promise((resolve) =>
                        setTimeout(() => resolve({ timedOut: true }), 3000)
                    );

                    const profileResult = await Promise.race([profilePromise, profileTimeout]);

                    if (profileResult?.timedOut) {
                        console.warn('Profile fetch timed out, continuing without profile data');
                    } else if (profileResult?.success && profileResult?.data) {
                        const profile = profileResult.data;
                        userWithProfile = {
                            ...session.user,
                            avatarUrl: profile.avatar_url || null,
                            displayName: profile.name || null
                        };
                    }
                } catch (profileErr) {
                    console.warn('Failed to fetch profile before redirect:', profileErr);
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

                // Skip setSession - it hangs on this SDK version. Tokens are in localStorage,
                // and dashboard/AuthContext will handle session restoration.



                setMfaRequired(false);
                setFactorId(null);
                setAal1Token(null);
                setMfaCode('');

                // Ensure loading states are cleared in case navigation is blocked
                setLoading(false);
                setSigning(false);

                try {
                    window.location.replace(LOGIN_CONFIG.DASHBOARD_URL);
                } catch (navErr) {
                    console.error('Navigation error:', navErr);
                    try { window.location.href = LOGIN_CONFIG.DASHBOARD_URL; } catch (e) { console.error('href fallback failed', e); }
                }

                // As a final safety, force a location change after a short delay
                setTimeout(() => {
                    try { if (window.location.pathname !== LOGIN_CONFIG.DASHBOARD_URL) window.location.assign(LOGIN_CONFIG.DASHBOARD_URL); } catch (e) { /* ignore */ }
                }, 300);

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
                        {!mfaRequired && (
                            <div className="flex gap-2 mb-6 p-1 bg-app-bg-tertiary rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(false);
                                        setError('');
                                        setUsername('');
                                        setConfirmPassword('');
                                    }}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${!isSignUp
                                            ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                            : 'text-app-text-secondary hover:text-app-text-primary'
                                        }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(true);
                                        setError('');
                                        setUsername('');
                                        setConfirmPassword('');
                                    }}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${isSignUp
                                            ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                            : 'text-app-text-secondary hover:text-app-text-primary'
                                        }`}
                                >
                                    Sign Up
                                </button>
                            </div>
                        )}

                        <h2 className="text-xl font-semibold text-app-text-primary mb-6">
                            {mfaRequired ? 'Two-Factor Authentication' : (isSignUp ? 'Create Account' : 'Welcome back')}
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {!mfaRequired ? (
                            // Email/Password Form
                            <form onSubmit={isSignUp ? handleSignUp : handleSubmit} className="space-y-4">
                                {isSignUp && (
                                    <div>
                                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                            minLength={3}
                                            className="w-full px-4 py-3 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                            placeholder="johndoe"
                                        />
                                    </div>
                                )}

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
                                        minLength={isSignUp ? 8 : 6}
                                        className="w-full px-4 py-3 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                    {isSignUp && (
                                        <p className="text-xs text-app-text-muted mt-1">
                                            Min 8 characters: uppercase, lowercase, number, special char (@$!%*?&)
                                        </p>
                                    )}
                                </div>

                                {isSignUp && (
                                    <div>
                                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            className="w-full px-4 py-3 bg-app-bg-tertiary border border-app-border rounded-xl text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                )}

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
                                    ) : (isSignUp ? 'Create Account' : 'Sign In')}
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
                                        {!factorId && (
                                            <div className="text-sm text-red-400 mt-2">Cannot find an MFA factor for your account. Please enable 2FA or try again later.</div>
                                        )}
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
                                    disabled={loading || mfaWaiting || mfaCode.length !== 6 || !factorId}
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

                                        setMfaRequired(false);
                                        setMfaCode('');
                                        setError('');
                                        setMfaWaiting(false);
                                        setFactorId(null);
                                        setAal1Token(null);
                                        setIsFreshLogin(false);
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

            {/* Success Modal */}
            <Modal
                isOpen={successModal.isOpen}
                onClose={() => setSuccessModal({ isOpen: false, message: '' })}
                title="Success! 🎉"
            >
                <div className="space-y-4">
                    <p className="text-gray-300 text-lg">
                        {successModal.message}
                    </p>
                </div>
            </Modal>
        </>
    );
}

export async function getServerSideProps() {
    // Prevent static prerendering for login page (client-only auth flow)
    return { props: {} };
}
