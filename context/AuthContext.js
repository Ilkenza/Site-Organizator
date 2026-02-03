import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, fetchAPI } from '../lib/supabase';

const AuthContext = createContext({});

// Constants
const AUTH_INIT_TIMEOUT = 10000; // 10 seconds - allows for slow networks and MFA
const SESSION_RETRY_DELAY = 150;
const SESSION_MAX_RETRIES = 4;
const SET_SESSION_TIMEOUT = 10000; // 10 seconds - increased for reliability

// Helper to get localStorage key for auth tokens
function getStorageKey() {
    if (typeof window === 'undefined') return null;
    const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `sb-${supabaseUrlEnv.replace(/^"|"/g, '').split('//')[1].split('.')[0]}-auth-token`;
}

// Helper to get AAL from access token
function getTokenAAL(accessToken) {
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1] || '""'));
        return payload?.aal || null;
    } catch (e) {
        console.warn('[AuthContext] Failed to parse token AAL:', e);
        return null;
    }
}

// Helper to check if AAL is valid (aal2 required for MFA accounts)
function isAALValid(accessToken) {
    const aal = getTokenAAL(accessToken);
    return !aal || aal === 'aal2';
}

// Helper to get stored tokens from localStorage
function getStoredTokens() {
    if (typeof window === 'undefined') return null;
    try {
        const storageKey = getStorageKey();
        if (!storageKey) return null;

        const storedData = localStorage.getItem(storageKey);
        if (!storedData) return null;

        const tokens = JSON.parse(storedData);
        if (tokens?.access_token && tokens?.user) {
            return tokens;
        }
        return null;
    } catch (e) {
        console.warn('[AuthContext] Error reading stored tokens:', e);
        return null;
    }
}

// Helper to save tokens to localStorage
function saveTokensToStorage(tokens) {
    if (typeof window === 'undefined') return;
    try {
        const storageKey = getStorageKey();
        if (!storageKey) return;
        localStorage.setItem(storageKey, JSON.stringify(tokens));
    } catch (e) {
        console.warn('[AuthContext] Error saving tokens:', e);
    }
}

// Helper to fetch profile via our API (more reliable than SDK which can timeout)
async function fetchProfileViaAPI() {
    try {
        const result = await fetchAPI('/profile', { method: 'GET' });
        if (result?.success && result?.data) {
            return { profile: result.data, error: null };
        }
        return { profile: null, error: result?.error || 'No profile data' };
    } catch (err) {
        console.warn('[AuthContext] fetchProfileViaAPI error:', err.message);
        return { profile: null, error: err.message };
    }
}

// Helper to create user object with profile data
function createUserWithProfile(baseUser, profile) {
    return {
        ...baseUser,
        avatarUrl: profile?.avatar_url || null,
        displayName: baseUser?.user_metadata?.display_name || profile?.name || null,
    };
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

                while (!session && retryCount < SESSION_MAX_RETRIES) {
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
                    if (retryCount < SESSION_MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, SESSION_RETRY_DELAY));
                    }
                }

                // Fallback: If getSession returned null, check localStorage for tokens (mobile MFA fix)
                if (!session) {
                    const tokens = getStoredTokens();

                    if (tokens?.access_token && tokens?.refresh_token) {
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
                                console.warn('[AuthContext] Failed to restore session from localStorage:', setSessionError.message);
                                // Only clear tokens if it's an auth error, not a network error
                                if (setSessionError.message?.includes('invalid') || setSessionError.message?.includes('expired')) {
                                    const storageKey = getStorageKey();
                                    if (storageKey) localStorage.removeItem(storageKey);
                                }
                            } else if (setSessionData?.session) {
                                session = setSessionData.session;
                            }
                        } catch (timeoutErr) {
                            console.warn('[AuthContext] setSession timed out:', timeoutErr.message);
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

                if (session?.user) {
                    // CRITICAL: Don't process session if MFA verification is in progress
                    const mfaInProgress = sessionStorage.getItem('mfa_verification_in_progress') === 'true' ||
                                         localStorage.getItem('mfa_verification_in_progress') === 'true';
                    
                    if (mfaInProgress) {
                        console.log('[AuthContext] 🔒 MFA verification in progress - skipping session processing');
                        setLoading(false);
                        return;
                    }
                    
                    // Don't block users based on AAL - let login page handle MFA flow
                    // Just log for debugging
                    try {
                        const factorsResult = await supabase.auth.mfa.listFactors();
                        const totpFactor = factorsResult?.data?.totp?.find(f => f.status === 'verified');
                        const hasMFA = !!totpFactor;
                        const currentAAL = getTokenAAL(session.access_token);
                        
                        console.log('[AuthContext] Session loaded:', {
                            hasMFA,
                            currentAAL,
                            userId: session.user.id
                        });
                    } catch (err) {
                        console.warn('[AuthContext] Could not check MFA status:', err);
                    }

                    // Check if user already has REAL profile data (from localStorage)
                    const hasProfileData = !!session.user.avatarUrl || !!session.user.displayName;

                    if (hasProfileData) {
                        console.log('[AuthContext] Setting user with profile data');
                        setUser(session.user);
                    } else {
                        try {
                            const { profile, error: profileError } = await fetchProfileViaAPI();

                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
                                console.warn('[AuthContext] Profile fetch error:', profileError.message);
                            }

                            console.log('[AuthContext] Setting user from profile fetch');
                            setUser(profile ? createUserWithProfile(session.user, profile) : session.user);
                        } catch (err) {
                            if (!isMounted) return;
                            console.error('[AuthContext] Error fetching profile:', err);
                            console.log('[AuthContext] Setting user (fallback after error)');
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
                    console.warn('[AuthContext] Session check aborted (transient error, keeping user):', err?.message || err);
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

        // Safety timeout - 10s to allow slow networks and MFA challenges
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[AuthContext] Auth initialization timed out after 10s, forcing loading to false');
                setLoading(false);

                // Try getSession one more time
                supabase.auth.getSession().then(async ({ data }) => {
                    if (isMounted && data?.session?.user) {
                        try {
                            const { profile } = await fetchProfileViaAPI();
                            setUser(profile ? createUserWithProfile(data.session.user, profile) : data.session.user);
                        } catch (err) {
                            console.warn('[AuthContext] Late recovery: failed to fetch profile:', err);
                            setUser(data.session.user);
                        }
                    } else if (isMounted) {
                        // CRITICAL FALLBACK: Check localStorage directly for tokens
                        const tokens = getStoredTokens();

                        if (tokens) {
                            userSetFromLocalStorageRef.current = true;

                            try {
                                const { profile } = await fetchProfileViaAPI();
                                setUser(profile ? createUserWithProfile(tokens.user, profile) : tokens.user);
                            } catch (err) {
                                console.warn('[AuthContext] Late recovery: failed to fetch profile:', err);
                                setUser(tokens.user);
                            }
                        }
                    }
                }).catch(() => { });
            }
        }, AUTH_INIT_TIMEOUT);

        // Listen for auth changes
        try {
            const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
                async (_event, session) => {
                    if (!isMounted) return;

                    if (session?.user) {
                        try {
                            const { profile, error: profileError } = await fetchProfileViaAPI();

                            if (!isMounted) return;

                            if (profileError && profileError.code !== 'PGRST116') {
                                console.warn('Profile fetch error:', profileError.message);
                            }

                            setUser(createUserWithProfile(session.user, profile));
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
                            const tokens = getStoredTokens();

                            if (tokens) {
                                // Fetch profile data if user doesn't have it yet
                                try {
                                    const { profile } = await fetchProfileViaAPI();

                                    if (profile) {
                                        setUser(createUserWithProfile(tokens.user, profile));
                                    }
                                } catch (err) {
                                    console.warn('[AuthContext] Failed to fetch profile:', err);
                                }
                                return; // Don't clear the flag while tokens exist
                            }

                            // Tokens gone - clear the flag and user
                            userSetFromLocalStorageRef.current = false;
                            setUser(null);
                        } else {
                            // ALSO check localStorage before clearing - tokens might exist even if flag is false
                            const tokens = getStoredTokens();

                            if (tokens) {
                                userSetFromLocalStorageRef.current = true;

                                try {
                                    const { profile } = await fetchProfileViaAPI();
                                    setUser(createUserWithProfile(tokens.user, profile));
                                } catch (err) {
                                    console.warn('[AuthContext] Failed to fetch profile for restored user:', err);
                                    setUser(tokens.user);
                                }
                                return;
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
    }, [loading]);

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
        userSetFromLocalStorageRef.current = false;
        setUser(null);

        // Clear auth tokens from localStorage
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

        supabase.auth.signOut({ scope: 'local' }).catch(err => {
            console.error('Sign out exception:', err);
        });

        window.location.replace('/login');
    };

    const refreshUser = async () => {
        if (!supabase || !user?.id) {
            console.warn('Cannot refresh user: supabase or user.id missing');
            return;
        }

        try {
            const { profile, error } = await fetchProfileViaAPI();

            if (error) {
                console.warn('Profile refresh error:', error.message);
                return;
            }

            if (profile) {
                setUser(prev => createUserWithProfile(prev, profile));
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    };

    // Emergency user recovery + fetch missing profile (combined)
    useEffect(() => {
        // Case 1: No user but tokens exist - emergency recovery
        if (!user && !loading) {
            const tokens = getStoredTokens();

            if (tokens?.user && tokens?.access_token) {
                userSetFromLocalStorageRef.current = true;

                // Set user from localStorage
                (async () => {
                    const hasProfileData = !!tokens.user.avatarUrl || !!tokens.user.displayName;

                    if (hasProfileData) {
                        setUser(tokens.user);
                    } else {
                        // Set user immediately, then fetch profile
                        setUser(tokens.user);

                        (async () => {
                            try {
                                const { profile } = await fetchProfileViaAPI();
                                if (profile) {
                                    const updatedUser = createUserWithProfile(tokens.user, profile);
                                    setUser(updatedUser);

                                    // Update localStorage
                                    const stored = getStoredTokens();
                                    if (stored) {
                                        stored.user = updatedUser;
                                        saveTokensToStorage(stored);
                                    }
                                }
                            } catch (err) {
                                console.warn('[AuthContext] Emergency: Failed to fetch profile:', err);
                            }
                        })();
                    }
                })();
            }
            return;
        }

        // Case 2: User exists but missing profile data - fetch it
        if (user?.id && !user.avatarUrl && !user.displayName) {
            (async () => {
                try {
                    const { profile } = await fetchProfileViaAPI();
                    if (profile && (profile.avatar_url || profile.name)) {
                        setUser(prev => createUserWithProfile(prev, profile));
                    }
                } catch (err) {
                    console.warn('[AuthContext] Failed to fetch missing profile:', err);
                }
            })();
        }
    }, [user, loading]);

    // Sync user profile data to localStorage whenever user changes
    useEffect(() => {
        if (!user?.id || (!user.avatarUrl && !user.displayName)) return;

        const stored = getStoredTokens();
        if (stored?.user && (stored.user.avatarUrl !== user.avatarUrl || stored.user.displayName !== user.displayName)) {
            stored.user = {
                ...stored.user,
                avatarUrl: user.avatarUrl,
                displayName: user.displayName,
            };
            saveTokensToStorage(stored);
        }
    }, [user]);

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
