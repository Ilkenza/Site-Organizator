import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
    // Track when user was set from localStorage to prevent onAuthStateChange from overwriting
    const userSetFromLocalStorageRef = useRef(false);

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
                                    userSetFromLocalStorageRef.current = true;
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
                    // Check if user already has profile data (from localStorage)
                    const hasProfileData = session.user.avatarUrl !== undefined || session.user.displayName !== undefined;

                    if (hasProfileData) {
                        console.log('[AuthContext] User already has profile data from localStorage, skipping fetch');
                        setUser(session.user);
                    } else {
                        console.log('[AuthContext] Fetching profile data for user:', session.user.id);
                        try {
                            // Fetch user profile including avatar and name
                            const { data: profile, error: profileError } = await supabase
                                .from('profiles')
                                .select('avatar_url, name')
                                .eq('id', session.user.id)
                                .maybeSingle();

                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
                                console.warn('[AuthContext] Profile fetch error:', profileError.message);
                            }

                            if (profile) {
                                console.log('[AuthContext] Profile fetched successfully');
                                setUser({
                                    ...session.user,
                                    avatarUrl: profile.avatar_url || null,
                                    displayName: profile.name || null,
                                });
                            } else {
                                setUser(session.user);
                            }
                        } catch (err) {
                            if (!isMounted) return;
                            console.error('[AuthContext] Error fetching profile:', err);
                            setUser(session.user);
                        }
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

        // Safety timeout - reduced to 3s to match dashboard timeout
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[AuthContext] Auth initialization timed out after 3s, forcing loading to false');
                setLoading(false);

                // Try getSession one more time
                supabase.auth.getSession().then(async ({ data }) => {
                    if (isMounted && data?.session?.user) {
                        console.log('[AuthContext] Late session recovery successful via getSession');

                        // Fetch profile data to get avatar and displayName
                        try {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('avatar_url, name')
                                .eq('id', data.session.user.id)
                                .maybeSingle();

                            if (profile) {
                                console.log('[AuthContext] Late recovery: fetched profile data');
                                setUser({
                                    ...data.session.user,
                                    avatarUrl: profile.avatar_url || null,
                                    displayName: profile.name || null
                                });
                            } else {
                                setUser(data.session.user);
                            }
                        } catch (err) {
                            console.warn('[AuthContext] Late recovery: failed to fetch profile:', err);
                            setUser(data.session.user);
                        }
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
                                    userSetFromLocalStorageRef.current = true;

                                    // Fetch profile data
                                    try {
                                        const { data: profile } = await supabase
                                            .from('profiles')
                                            .select('avatar_url, name')
                                            .eq('id', tokens.user.id)
                                            .maybeSingle();

                                        if (profile) {
                                            console.log('[AuthContext] Late recovery localStorage: fetched profile');
                                            setUser({
                                                ...tokens.user,
                                                avatarUrl: profile.avatar_url || null,
                                                displayName: profile.name || null
                                            });
                                        } else {
                                            setUser(tokens.user);
                                        }
                                    } catch (err) {
                                        console.warn('[AuthContext] Late recovery localStorage: failed to fetch profile:', err);
                                        setUser(tokens.user);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('[AuthContext] Late localStorage fallback failed:', e);
                        }
                    }
                }).catch(() => { });
            }
        }, 3000);

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
                        // Only set user to null if:
                        // 1. This is an explicit sign-out event, OR
                        // 2. User was NOT recovered from localStorage
                        // This prevents onAuthStateChange from overwriting the user we just set from MFA verification
                        if (_event === 'SIGNED_OUT') {
                            console.log('[AuthContext] SIGNED_OUT event, clearing user');
                            userSetFromLocalStorageRef.current = false;
                            setUser(null);
                        } else if (userSetFromLocalStorageRef.current) {
                            console.log('[AuthContext] Ignoring null session - user was set from localStorage, event:', _event);
                            // Check if localStorage still has valid tokens - only then keep ignoring
                            try {
                                const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                                const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                                const storedTokens = localStorage.getItem(storageKey);
                                if (storedTokens) {
                                    const tokens = JSON.parse(storedTokens);
                                    if (tokens?.access_token && tokens?.user) {
                                        console.log('[AuthContext] localStorage still has valid tokens, keeping user');

                                        // Fetch profile data if user doesn't have it yet
                                        try {
                                            const { data: profile } = await supabase
                                                .from('profiles')
                                                .select('avatar_url, name')
                                                .eq('id', tokens.user.id)
                                                .maybeSingle();

                                            if (profile) {
                                                console.log('[AuthContext] Updating user with profile data');
                                                setUser({
                                                    ...tokens.user,
                                                    avatarUrl: profile.avatar_url || null,
                                                    displayName: profile.name || null
                                                });
                                            }
                                        } catch (err) {
                                            console.warn('[AuthContext] Failed to fetch profile:', err);
                                        }

                                        // Don't clear the flag while tokens exist
                                        return;
                                    }
                                }
                                // Tokens gone - clear the flag and user
                                console.log('[AuthContext] localStorage tokens gone, clearing user');
                                userSetFromLocalStorageRef.current = false;
                                setUser(null);
                            } catch (e) {
                                console.warn('[AuthContext] Error checking tokens in onAuthStateChange:', e);
                            }
                        } else {
                            // ALSO check localStorage before clearing - tokens might exist even if flag is false
                            try {
                                const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                                const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                                const storedTokens = localStorage.getItem(storageKey);
                                if (storedTokens) {
                                    const tokens = JSON.parse(storedTokens);
                                    if (tokens?.access_token && tokens?.user) {
                                        console.log('[AuthContext] localStorage has valid tokens - NOT clearing user, event:', _event);
                                        // Set the flag and restore user from tokens
                                        userSetFromLocalStorageRef.current = true;

                                        // Fetch profile data to get avatar and displayName
                                        try {
                                            const { data: profile } = await supabase
                                                .from('profiles')
                                                .select('avatar_url, name')
                                                .eq('id', tokens.user.id)
                                                .maybeSingle();

                                            console.log('[AuthContext] Fetched profile for restored user:', { hasAvatar: !!profile?.avatar_url, hasName: !!profile?.name });
                                            setUser({
                                                ...tokens.user,
                                                avatarUrl: profile?.avatar_url || null,
                                                displayName: profile?.name || null
                                            });
                                        } catch (err) {
                                            console.warn('[AuthContext] Failed to fetch profile for restored user:', err);
                                            setUser(tokens.user);
                                        }
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.warn('[AuthContext] Error checking localStorage in else branch:', e);
                            }
                            console.log('[AuthContext] No session and no localStorage tokens, clearing user, event:', _event);
                            setUser(null);
                        }
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
        // Clear the localStorage recovery flag
        userSetFromLocalStorageRef.current = false;
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

        // Sign out from Supabase (fire and forget - don't wait)
        supabase.auth.signOut({ scope: 'local' }).catch(err => {
            console.error('Sign out exception:', err);
        });

        // Redirect immediately - don't wait for signOut to complete
        window.location.replace('/login');
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
                    userSetFromLocalStorageRef.current = true;

                    // Check if user already has profile data from localStorage
                    const hasProfileData = tokens.user.avatarUrl !== undefined || tokens.user.displayName !== undefined;

                    if (hasProfileData) {
                        // User already has profile data, use it directly
                        console.log('[AuthContext] Emergency recovery: user has profile data, using directly');
                        setUser(tokens.user);
                    } else {
                        // Set user immediately (without profile) to avoid null state
                        console.log('[AuthContext] Emergency recovery: setting user immediately, then fetching profile');
                        setUser(tokens.user);

                        // Fetch fresh profile data asynchronously and update
                        (async () => {
                            try {
                                if (!supabase) {
                                    return;
                                }

                                console.log('[AuthContext] Emergency recovery: fetching profile data');
                                const { data: profile, error } = await supabase
                                    .from('profiles')
                                    .select('avatar_url, name')
                                    .eq('id', tokens.user.id)
                                    .maybeSingle();

                                if (!error && profile) {
                                    console.log('[AuthContext] Emergency recovery: fetched profile data');
                                    const updatedUser = {
                                        ...tokens.user,
                                        avatar_url: profile.avatar_url,
                                        avatarUrl: profile.avatar_url,
                                        displayName: profile.name,
                                        name: profile.name
                                    };
                                    setUser(updatedUser);

                                    // Save profile to localStorage for next refresh
                                    try {
                                        const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                                        const storedData = localStorage.getItem(storageKey);
                                        if (storedData) {
                                            const parsed = JSON.parse(storedData);
                                            parsed.user = updatedUser;
                                            localStorage.setItem(storageKey, JSON.stringify(parsed));
                                            console.log('[AuthContext] Emergency recovery: saved profile to localStorage');
                                        }
                                    } catch (e) {
                                        console.warn('[AuthContext] Failed to save profile to localStorage:', e);
                                    }
                                } else {
                                    console.log('[AuthContext] Emergency recovery: no profile found, using basic user');
                                    setUser(tokens.user);
                                }
                            } catch (err) {
                                console.warn('[AuthContext] Emergency recovery: profile fetch failed:', err);
                                setUser(tokens.user);
                            }
                        })();
                    }
                }
            }
        } catch (e) {
            console.warn('[AuthContext] Error in emergency user recovery:', e);
        }
    }, [user, loading]);

    // Sync user profile data to localStorage whenever user changes
    useEffect(() => {
        if (!user || !user.id) return;

        // Only sync if user has profile data
        if (!user.avatarUrl && !user.displayName) return;

        try {
            const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
            const storedData = localStorage.getItem(storageKey);
            if (storedData) {
                const parsed = JSON.parse(storedData);
                // Check if localStorage user is missing profile data
                if (parsed?.user && (parsed.user.avatarUrl !== user.avatarUrl || parsed.user.displayName !== user.displayName)) {
                    parsed.user = {
                        ...parsed.user,
                        avatarUrl: user.avatarUrl,
                        avatar_url: user.avatarUrl,
                        displayName: user.displayName,
                        name: user.displayName
                    };
                    localStorage.setItem(storageKey, JSON.stringify(parsed));
                    console.log('[AuthContext] Synced profile data to localStorage');
                }
            }
        } catch (e) {
            console.warn('[AuthContext] Failed to sync profile to localStorage:', e);
        }
    }, [user]);

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
