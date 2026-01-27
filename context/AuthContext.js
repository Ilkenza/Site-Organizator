import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { fetchAPI } from '../lib/supabase';

const AuthContext = createContext({});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Helper to fetch profile via our API (more reliable than SDK which can timeout)
async function fetchProfileViaAPI() {
    try {
        const result = await fetchAPI('/profile', { method: 'GET' });
        if (result?.success && result?.data) {
            return { profile: result.data, error: null };
        }
        return { profile: null, error: result?.error || 'No profile data' };
    } catch (err) {
        return { profile: null, error: err.message };
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsMfa, setNeedsMfa] = useState(false);
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

                    }

                    if (data?.session) {
                        session = data.session;
                        break;
                    }

                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(r => setTimeout(r, retryDelay));
                    }
                }

                // Fallback: If getSession returned null, check localStorage for tokens (mobile MFA fix)
                if (!session && typeof window !== 'undefined') {
                    try {
                        // IMPORTANT: Use EXACT same key format as login.js
                        const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                        const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;

                        const storedTokens = localStorage.getItem(storageKey);

                        if (storedTokens) {
                            const tokens = JSON.parse(storedTokens);

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


                                    if (setSessionError) {
                                        // Only clear tokens if it's an auth error, not a network error
                                        if (setSessionError.message?.includes('invalid') || setSessionError.message?.includes('expired')) {
                                            localStorage.removeItem(storageKey);
                                        }
                                    } else if (setSessionData?.session) {
                                        session = setSessionData.session;
                                        setSessionSucceeded = true;
                                    }
                                } catch (timeoutErr) {
                                }

                                // CRITICAL: If setSession didn't return a session but tokens exist with user, use them directly
                                if (!session && tokens.user) {
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
                    }
                }
                if (session?.user) {
                    // Before setting user, ensure the session is at AAL2 if account requires MFA
                    try {
                        const payload = JSON.parse(atob(session.access_token.split('.')[1] || '""'));
                        if (payload?.aal && payload.aal !== 'aal2') {
                            setNeedsMfa(true);
                            setUser(null);
                            // Do not proceed to fetch profile
                            return;
                        }
                    } catch (e) {
                    }

                    // Check if user already has REAL profile data (from localStorage)
                    // Must check for truthy values, not just !== undefined, because null means data wasn't fetched
                    const hasProfileData = !!session.user.avatarUrl || !!session.user.displayName;

                    if (hasProfileData) {
                        setUser(session.user);
                    } else {
                        try {
                            // Check session first
                            const { data: sessionCheck } = await supabase.auth.getSession();

                            // Fetch user profile including avatar and name
                            const { profile, error: profileError } = await fetchProfileViaAPI();


                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
                            }

                            if (profile) {
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
                // AbortError is a transient error from SDK's internal abort signals - don't clear user
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                    // Don't clear user on AbortError - it's usually a race condition
                    return;
                }
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
                setLoading(false);

                // Try getSession one more time
                supabase.auth.getSession().then(async ({ data }) => {
                    if (isMounted && data?.session?.user) {

                        // Fetch profile data to get avatar and displayName
                        try {
                            const { profile } = await fetchProfileViaAPI();

                            if (profile) {
                                setUser({
                                    ...data.session.user,
                                    avatarUrl: profile.avatar_url || null,
                                    displayName: profile.name || null
                                });
                            } else {
                                setUser(data.session.user);
                            }
                        } catch (err) {
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
                                    userSetFromLocalStorageRef.current = true;

                                    // Fetch profile data
                                    try {
                                        const { profile } = await fetchProfileViaAPI();

                                        if (profile) {
                                            // Before setting user, ensure token AAL is aal2
                                            try {
                                                const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                                                if (payload?.aal && payload.aal !== 'aal2') {
                                                    setNeedsMfa(true);
                                                } else {
                                                    setUser({
                                                        ...tokens.user,
                                                        avatarUrl: profile.avatar_url || null,
                                                        displayName: profile.name || null
                                                    });
                                                }
                                            } catch (e) {
                                                setUser({
                                                    ...tokens.user,
                                                    avatarUrl: profile.avatar_url || null,
                                                    displayName: profile.name || null
                                                });
                                            }
                                        } else {
                                            try {
                                                const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                                                if (payload?.aal && payload.aal !== 'aal2') {
                                                    setNeedsMfa(true);
                                                } else {
                                                    setUser(tokens.user);
                                                }
                                            } catch (e) {
                                                setUser(tokens.user);
                                            }
                                        }
                                    } catch (err) {
                                        setUser(tokens.user);
                                    }
                                }
                            }
                        } catch (e) {
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
                            const { profile, error: profileError } = await fetchProfileViaAPI();

                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
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
                            userSetFromLocalStorageRef.current = false;
                            setUser(null);
                        } else if (userSetFromLocalStorageRef.current) {
                            // Check if localStorage still has valid tokens - only then keep ignoring
                            try {
                                const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                                const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                                const storedTokens = localStorage.getItem(storageKey);
                                if (storedTokens) {
                                    const tokens = JSON.parse(storedTokens);
                                    if (tokens?.access_token && tokens?.user) {

                                        // Fetch profile data if user doesn't have it yet
                                        try {
                                            const { profile } = await fetchProfileViaAPI();

                                            if (profile) {
                                                setUser({
                                                    ...tokens.user,
                                                    avatarUrl: profile.avatar_url || null,
                                                    displayName: profile.name || null
                                                });
                                            }
                                        } catch (err) {
                                        }

                                        // Don't clear the flag while tokens exist
                                        return;
                                    }
                                }
                                // Tokens gone - clear the flag and user
                                userSetFromLocalStorageRef.current = false;
                                setUser(null);
                            } catch (e) {
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
                                        // Set the flag and restore user from tokens
                                        userSetFromLocalStorageRef.current = true;

                                        // Fetch profile data to get avatar and displayName
                                        try {
                                            const { profile } = await fetchProfileViaAPI();

                                            try {
                                                const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                                                if (payload?.aal && payload.aal !== 'aal2') {
                                                    setNeedsMfa(true);
                                                } else {
                                                    setUser({
                                                        ...tokens.user,
                                                        avatarUrl: profile?.avatar_url || null,
                                                        displayName: profile?.name || null
                                                    });
                                                }
                                            } catch (e) {
                                                setUser({
                                                    ...tokens.user,
                                                    avatarUrl: profile?.avatar_url || null,
                                                    displayName: profile?.name || null
                                                });
                                            }
                                        } catch (err) {
                                            try {
                                                const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                                                if (payload?.aal && payload.aal !== 'aal2') {
                                                    setNeedsMfa(true);
                                                } else {
                                                    setUser(tokens.user);
                                                }
                                            } catch (e) {
                                                setUser(tokens.user);
                                            }
                                        }
                                        return;
                                    }
                                }
                            } catch (e) {
                            }
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
            return;
        }
        try {

            const { profile, error } = await fetchProfileViaAPI();


            if (error) {
                return;
            }

            if (profile) {
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
                    userSetFromLocalStorageRef.current = true;

                    // Check if user already has REAL profile data from localStorage
                    const hasProfileData = !!tokens.user.avatarUrl || !!tokens.user.displayName;

                    if (hasProfileData) {
                        // User already has profile data, use it directly
                        try {
                            const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                            if (payload?.aal && payload.aal !== 'aal2') {
                                // Do not set user to prevent bypassing MFA; keep tokens in localStorage and let Dashboard enforce MFA
                            } else {
                                setUser(tokens.user);
                            }
                        } catch (parseErr) {
                            setUser(tokens.user);
                        }
                    } else {
                        // Set user immediately (without profile) to avoid null state
                        try {
                            const payload = JSON.parse(atob(tokens.access_token.split('.')[1] || '""'));
                            if (payload?.aal && payload.aal !== 'aal2') {
                                setNeedsMfa(true);
                            } else {
                                setUser(tokens.user);
                            }
                        } catch (e) {
                            setUser(tokens.user);
                        }

                        // Fetch fresh profile data asynchronously and update
                        (async () => {
                            try {

                                // Use our API endpoint instead of Supabase SDK (which times out)
                                const { profile, error } = await fetchProfileViaAPI();

                                if (error) {
                                    return;
                                }

                                if (profile) {
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
                                        }
                                    } catch (e) {
                                    }
                                } else {
                                    setUser(tokens.user);
                                }
                            } catch (err) {
                                setUser(tokens.user);
                            }
                        })();
                    }
                }
            }
        } catch (e) {
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
                }
            }
        } catch (e) {
        }
    }, [user]);

    // Fetch profile data if user exists but doesn't have avatar/displayName
    useEffect(() => {
        if (!user || !user.id) return;
        // If user already has profile data, skip
        if (user.avatarUrl || user.displayName) return;

        const fetchMissingProfile = async () => {
            try {

                const { profile } = await fetchProfileViaAPI();

                if (profile && (profile.avatar_url || profile.name)) {
                    setUser(prev => ({
                        ...prev,
                        avatarUrl: profile.avatar_url || prev?.avatarUrl || null,
                        displayName: profile.name || prev?.displayName || null
                    }));
                }
            } catch (err) {
            }
        };

        fetchMissingProfile();
    }, [user?.id, user?.avatarUrl, user?.displayName]);

    const value = {
        user,
        loading,
        needsMfa,
        setNeedsMfa,
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
