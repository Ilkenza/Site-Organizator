import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext({});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        let subscription;

        const initializeAuth = async () => {
            try {
                // Retry logic for session - sometimes needs a moment after redirect
                let session = null;
                let retryCount = 0;
                const maxRetries = 4; // Increased retries for mobile/slow networks
                const retryDelay = 150; // ms between retries

                while (!session && retryCount < maxRetries) {
                    const { data, error } = await supabase.auth.getSession();

                    if (!isMounted) return;

                    if (error) {
                        console.warn('Session check error (attempt ' + (retryCount + 1) + '):', error.message);
                    }

                    if (data?.session) {
                        session = data.session;
                        break;
                    }

                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`Session not found, retry ${retryCount}/${maxRetries}...`);
                        await new Promise(r => setTimeout(r, retryDelay));
                    }
                }

                // Fallback: If getSession returned null, check localStorage for tokens (mobile MFA fix)
                if (!session && typeof window !== 'undefined') {
                    try {
                        // IMPORTANT: Use EXACT same key format as login.js
                        const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                        const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                        console.log('[AuthContext] Checking localStorage with key:', storageKey);

                        const storedTokens = localStorage.getItem(storageKey);
                        console.log('[AuthContext] Tokens found in localStorage:', !!storedTokens);

                        if (storedTokens) {
                            console.log('[AuthContext] Found tokens in localStorage, attempting to restore session...');
                            const tokens = JSON.parse(storedTokens);
                            console.log('[AuthContext] Parsed tokens - has access_token:', !!tokens?.access_token, ', has refresh_token:', !!tokens?.refresh_token, ', has user:', !!tokens?.user);

                            if (tokens?.access_token && tokens?.refresh_token) {
                                // Wrap setSession in a timeout to prevent indefinite blocking (mobile fix)
                                const SET_SESSION_TIMEOUT = 3000; // 3 seconds max for setSession
                                let setSessionSucceeded = false;

                                try {
                                    const setSessionPromise = supabase.auth.setSession({
                                        access_token: tokens.access_token,
                                        refresh_token: tokens.refresh_token
                                    });

                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('setSession timeout')), SET_SESSION_TIMEOUT)
                                    );

                                    const { data: setSessionData, error: setSessionError } = await Promise.race([
                                        setSessionPromise,
                                        timeoutPromise
                                    ]);

                                    console.log('[AuthContext] setSession result - error:', setSessionError?.message, ', has session:', !!setSessionData?.session);

                                    if (setSessionError) {
                                        console.warn('[AuthContext] Failed to restore session from localStorage:', setSessionError.message);
                                        // Only clear tokens if it's an auth error, not a network error
                                        if (setSessionError.message?.includes('invalid') || setSessionError.message?.includes('expired')) {
                                            localStorage.removeItem(storageKey);
                                        }
                                    } else if (setSessionData?.session) {
                                        console.log('[AuthContext] Session restored from localStorage successfully');
                                        session = setSessionData.session;
                                        setSessionSucceeded = true;
                                    }
                                } catch (timeoutErr) {
                                    console.warn('[AuthContext] setSession timed out:', timeoutErr.message);
                                }

                                // CRITICAL: If setSession didn't return a session but tokens exist with user, use them directly
                                if (!session && tokens.user) {
                                    console.log('[AuthContext] Using user from stored tokens as fallback (setSessionSucceeded:', setSessionSucceeded, ')');
                                    session = {
                                        access_token: tokens.access_token,
                                        refresh_token: tokens.refresh_token,
                                        user: tokens.user,
                                        expires_at: tokens.expires_at,
                                        expires_in: tokens.expires_in,
                                        token_type: tokens.token_type || 'bearer'
                                    };
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[AuthContext] Error checking localStorage for tokens:', e);
                    }
                }
                if (session?.user) {
                    try {
                        // Fetch user profile including avatar and name
                        const { data: profile, error: profileError } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .maybeSingle();

                        if (!isMounted) return;

                        if (profileError && profileError.code !== 'PGRST116') {
                            console.warn('Profile fetch error:', profileError.message);
                        }

                        setUser({
                            ...session.user,
                            avatarUrl: profile?.avatar_url || null,
                            displayName: profile?.name || null,
                        });
                    } catch (err) {
                        if (!isMounted) return;
                        console.error('Error fetching profile:', err);
                        setUser(session.user);
                    }
                } else {
                    setUser(null);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('Unexpected error during session check:', err);
                setUser(null);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // Initialize auth
        initializeAuth();

        // Safety timeout - if loading doesn't complete in 5 seconds, force it to complete
        // Increased for mobile networks where setSession can be slow
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[AuthContext] Auth initialization timed out after 5s, forcing loading to false');
                setLoading(false);

                // Try getSession one more time
                supabase.auth.getSession().then(({ data }) => {
                    if (isMounted && data?.session?.user) {
                        console.log('[AuthContext] Late session recovery successful via getSession');
                        setUser(data.session.user);
                    } else if (isMounted && typeof window !== 'undefined') {
                        // CRITICAL FALLBACK: Check localStorage directly for tokens
                        try {
                            const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                            const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                            const storedTokens = localStorage.getItem(storageKey);

                            if (storedTokens) {
                                const tokens = JSON.parse(storedTokens);
                                if (tokens?.user) {
                                    console.log('[AuthContext] Late session recovery using tokens from localStorage');
                                    setUser(tokens.user);
                                }
                            }
                        } catch (e) {
                            console.warn('[AuthContext] Late localStorage fallback failed:', e);
                        }
                    }
                }).catch(() => { });
            }
        }, 5000);

        // Listen for auth changes
        try {
            const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
                async (_event, session) => {
                    if (!isMounted) return;

                    if (session?.user) {
                        try {
                            // Fetch user profile including avatar and name
                            const { data: profile, error: profileError } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', session.user.id)
                                .maybeSingle();

                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
                                console.warn('Profile fetch error:', profileError.message);
                            }

                            setUser({
                                ...session.user,
                                avatarUrl: profile?.avatar_url || null,
                                displayName: profile?.name || null,
                            });
                        } catch (err) {
                            if (!isMounted) return;
                            console.error('Error fetching profile:', err);
                            setUser(session.user);
                        }
                    } else {
                        setUser(null);
                    }
                }
            );
            subscription = authSubscription;
        } catch (err) {
            console.error('Error setting up auth state listener:', err);
        }

        // Cleanup function
        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const signIn = async (email, password) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        // Clear user state immediately to update UI
        setUser(null);

        // Clear any stored tokens from localStorage to prevent stale session issues
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('Error clearing auth tokens from localStorage:', e);
        }


        try {
            // Sign out from Supabase with scope: 'local' to avoid AAL2/MFA blocking issues
            await supabase.auth.signOut({ scope: 'local' });
        } catch (err) {
            console.error('Sign out exception:', err);
        }

        // Always redirect to login page
        window.location.href = '/login';
    };

    const refreshUser = async () => {
        if (!supabase || !user?.id) {
            console.warn('Cannot refresh user: supabase or user.id missing', {
                hasSupabase: !!supabase,
                userId: user?.id
            });
            return;
        }
        try {
            console.log('Fetching latest profile for user:', user.id);

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            console.log('Profile fetch result:', { profile, error: error?.message });

            if (error) {
                console.warn('Profile refresh error:', error.message);
                return;
            }

            if (profile) {
                console.log('Updating user state with new profile:', profile);
                setUser(prev => ({
                    ...prev,
                    avatarUrl: profile.avatar_url || null,
                    displayName: profile.name || null,
                }));
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    };

    // Emergency user recovery - if user is null but tokens exist in localStorage, set user directly
    useEffect(() => {
        if (user || loading) return; // Already have user or still loading

        if (typeof window === 'undefined') return;

        try {
            const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
            const storedTokens = localStorage.getItem(storageKey);

            if (storedTokens) {
                const tokens = JSON.parse(storedTokens);
                if (tokens?.user && tokens?.access_token) {
                    console.log('[AuthContext] Emergency recovery: setting user from localStorage');
                    setUser(tokens.user);
                }
            }
        } catch (e) {
            console.warn('[AuthContext] Error in emergency user recovery:', e);
        }
    }, [user, loading]);

    const value = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
        supabase,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
