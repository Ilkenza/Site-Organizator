import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Head from 'next/head';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // MFA states
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState(null);

    const { supabase } = useAuth();

    // Debug presence of Supabase config (do NOT log secrets)
    useEffect(() => {
        console.log('Login: supabase configured?', {
            hasSupabase: !!supabase,
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        });
    }, [supabase]);

    // Timeout constants (increased for production latency and TOTP window)
    const MFA_CHECK_TIMEOUT = 20000; // 20 seconds
    const MFA_VERIFY_TIMEOUT = 45000; // 45 seconds

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!supabase) {
            console.error('Supabase client not configured - missing NEXT_PUBLIC variables');
            setError('Login is temporarily unavailable. Please contact the site administrator.');
            setLoading(false);
            return;
        }

        try {
            console.log('Login attempt for', email);
            // Fallback timeout to avoid spinner stuck if something hangs
            const timeoutId = setTimeout(() => {
                console.warn('Login fallback timeout reached');
                setLoading(false);
                setError('Login timed out, please try again');
            }, 20000);

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            console.log('signInWithPassword result:', { data, error });

            if (error) {
                clearTimeout(timeoutId);
                throw error;
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
                setFactorId(totpFactor.id);
                setMfaRequired(true);
                setLoading(false);
                console.log('MFA required, showing MFA prompt');
                return;
            }

            // Log if MFA check failed or timed out
            if (factorsError) {
                console.warn('MFA check failed or timed out, proceeding without MFA:', factorsError.message);
            }

            clearTimeout(timeoutId);
            // No MFA required or already at aal2, proceed to dashboard
            console.log('Login complete, redirecting to /dashboard');
            setLoading(false);
            window.location.href = '/dashboard';
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed');
            setLoading(false);
        }
    };

    const handleMfaVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!supabase) {
            console.error('Supabase client not configured during MFA verify');
            setError('MFA verification is temporarily unavailable.');
            setLoading(false);
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

            // Verify MFA code with timeout protection
            const verifyStart = Date.now();
            console.log('3.1 Starting verify; timeout (ms):', MFA_VERIFY_TIMEOUT);

            const verifyPromise = Promise.race([
                supabase.auth.mfa.verify({
                    factorId: factorId,
                    challengeId: challengeData.id,
                    code: mfaCode
                }),
                new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'Verification timeout' } }), MFA_VERIFY_TIMEOUT))
            ]);

            const verifyResult = await verifyPromise;
            const verifyElapsed = Date.now() - verifyStart;
            console.log('4. Verify completed; elapsed (ms):', verifyElapsed, 'result:', verifyResult);

            const { error: verifyError } = verifyResult || {};

            if (verifyError) {
                throw new Error(verifyError.message === 'Verification timeout' 
                    ? 'Verification timed out, please try again' 
                    : 'Invalid verification code');
            }

            console.log('5. MFA successful (verify returned OK) — checking session...');

            // Try to get updated session from Supabase SDK; give it a short moment to appear
            let sessionData = null;
            const maxPollMs = 3000;
            const pollInterval = 300;
            const pollStart = Date.now();

            while (Date.now() - pollStart < maxPollMs) {
                try {
                    const { data: sess } = await supabase.auth.getSession();
                    console.log('Post-verify session poll:', sess);
                    if (sess?.session) { sessionData = sess.session; break; }
                } catch (e) {
                    console.warn('Error polling session after verify:', e?.message || e);
                }
                await new Promise(r => setTimeout(r, pollInterval));
            }

            // If session present, redirect. Otherwise, try to store tokens returned in verify result (if present)
            if (sessionData) {
                console.log('Session found after verify, redirecting...');
                setLoading(false);
                window.location.href = '/dashboard';
                return;
            }

            // Fallback: some Supabase setups return tokens directly in result - store them if available
            const tokenCandidates = verifyResult || {};
            const access_token = tokenCandidates?.data?.access_token || tokenCandidates?.access_token;
            const refresh_token = tokenCandidates?.data?.refresh_token || tokenCandidates?.refresh_token;
            if (access_token && refresh_token) {
                console.log('Storing tokens from verify response as fallback');
                const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^\"|\"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                localStorage.setItem(storageKey, JSON.stringify({
                    access_token,
                    refresh_token,
                    expires_at: tokenCandidates?.data?.expires_at || tokenCandidates?.expires_at,
                    expires_in: tokenCandidates?.data?.expires_in || tokenCandidates?.expires_in,
                    token_type: tokenCandidates?.data?.token_type || tokenCandidates?.token_type,
                    user: tokenCandidates?.data?.user || tokenCandidates?.user
                }));
                console.log('Fallback tokens stored, reloading...');
                setLoading(false);
                window.location.href = '/dashboard';
                return;
            }

            console.warn('No session or tokens found after verify; informing user');
            setError('Verification completed but we could not establish session. Please try signing in again.');
            setLoading(false);
        } catch (err) {
            console.error('MFA Error:', err);
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
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-btn-primary hover:bg-btn-hover text-app-accent font-medium rounded-xl border border-[#2A5A8A] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:text-app-accentLight"
                                >
                                    {loading ? (
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
                                    disabled={loading || mfaCode.length !== 6}
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
