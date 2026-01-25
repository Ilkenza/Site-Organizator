// Supabase client configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service key server-side, anon key client-side
export function getSupabaseKey(isServer = false) {
    return isServer && SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
}

export async function supabaseFetch(endpoint, options = {}, isServer = false) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const key = getSupabaseKey(isServer);

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Client-side fetch wrapper
export async function fetchAPI(path, options = {}) {
    // Get user's access token from localStorage to pass to API
    let accessToken = null;
    try {
        const storageKey = `sb-${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1]?.split('.')[0]}-auth-token`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            accessToken = parsed?.access_token;
        }
    } catch (e) {
        console.warn('Failed to get access token for API call:', e);
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Add Authorization header if we have a token
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api${path}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}
