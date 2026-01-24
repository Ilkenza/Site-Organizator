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
                // Check active session with error handling
                const { data, error } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (error) {
                    console.warn('Session check error:', error.message);
                    setLoading(false);
                    return;
                }

                const session = data?.session;
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

        // Safety timeout - if loading doesn't complete in 10 seconds, force it to complete
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('Auth initialization timed out, forcing loading to false');
                setLoading(false);
            }
        }, 10000);

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

        if (!supabase) {
            window.location.href = '/login';
            return;
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
