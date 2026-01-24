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
                        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                        const projectRef = supabaseUrl.replace(/^"|"$/g, '').split('//')[1]?.split('.')[0];
                        if (projectRef) {
                            const storageKey = `sb-${projectRef}-auth-token`;
                            const storedTokens = localStorage.getItem(storageKey);
                            if (storedTokens) {
                                console.log('Found tokens in localStorage, attempting to restore session...');
                                const tokens = JSON.parse(storedTokens);
                                if (tokens?.access_token && tokens?.refresh_token) {
                                    // Wrap setSession in a timeout to prevent indefinite blocking (mobile fix)
                                    const SET_SESSION_TIMEOUT = 3000; // 3 seconds max for setSession
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

                                        if (setSessionError) {
                                            console.warn('Failed to restore session from localStorage:', setSessionError.message);
                                            // Clear invalid tokens
                                            localStorage.removeItem(storageKey);
                                        } else if (setSessionData?.session) {
                                            console.log('Session restored from localStorage successfully');
                                            session = setSessionData.session;
                                        }
                                    } catch (timeoutErr) {
                                        console.warn('setSession timed out, using tokens directly:', timeoutErr.message);
                                        // Even if setSession times out, try to use the tokens directly
                                        // The user object from stored tokens can be used as fallback
                                        if (tokens.user) {
                                            console.log('Using user from stored tokens as fallback');
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
                            }
                        }
                    } catch (e) {
                        console.warn('Error checking localStorage for tokens:', e);
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
                console.warn('Auth initialization timed out after 5s, forcing loading to false');
                setLoading(false);
                // Also try one more time to get session in background
                supabase.auth.getSession().then(({ data }) => {
                    if (isMounted && data?.session?.user) {
                        console.log('Late session recovery successful');
                        setUser(data.session.user);
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
