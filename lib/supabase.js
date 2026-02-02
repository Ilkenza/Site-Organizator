/**
 * Supabase client utilities
 * Provides Supabase client and fetch wrappers for REST API and Next.js API routes
 */

import { createClient } from '@supabase/supabase-js';

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REST_API_VERSION = 'v1';
const DEFAULT_PREFER = 'return=representation';
const HTTP_NO_CONTENT = 204;

// ========================================
// Supabase Client
// ========================================

/**
 * Browser-side Supabase client
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========================================
// Helper Functions
// ========================================

// Helper to extract project reference from Supabase URL
function getProjectRef(url) {
    try {
        return url.replace(/^"|"$/g, '').split('//')[1]?.split('.')[0] || '';
    } catch (e) {
        console.warn('Failed to extract project ref from URL:', e);
        return '';
    }
}

// Helper to generate storage key for auth token
function getStorageKey() {
    const projectRef = getProjectRef(SUPABASE_URL || '');
    return `sb-${projectRef}-auth-token`;
}

/**
 * Get appropriate Supabase API key based on environment
 * @param {boolean} isServer - Whether running on server-side
 * @returns {string} API key
 */
export function getSupabaseKey(isServer = false) {
    return isServer && SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
}

/**
 * Fetch data from Supabase REST API
 * @param {string} endpoint - API endpoint (e.g., 'sites', 'categories')
 * @param {Object} options - Fetch options
 * @param {boolean} isServer - Whether running on server-side
 * @returns {Promise<Object|null>} Response data or null for 204
 */
export async function supabaseFetch(endpoint, options = {}, isServer = false) {
    const url = `${SUPABASE_URL}/rest/${REST_API_VERSION}/${endpoint}`;
    const key = getSupabaseKey(isServer);

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || DEFAULT_PREFER,
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase error (${response.status}): ${error}`);
    }

    // Handle 204 No Content
    if (response.status === HTTP_NO_CONTENT) {
        return null;
    }

    return response.json();
}

/**
 * Helper to get user's access token from localStorage
 * @returns {string|null} Access token or null
 */
function getAccessToken() {
    if (typeof window === 'undefined') return null;

    try {
        const storageKey = getStorageKey();
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed?.access_token || null;
        }
    } catch (e) {
        console.warn('Failed to get access token:', e);
    }
    return null;
}

/**
 * Fetch wrapper for Next.js API routes
 * Automatically includes user's access token from localStorage
 * @param {string} path - API path (e.g., '/sites', '/categories')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object|null>} Response data or null for 204
 */
export async function fetchAPI(path, options = {}) {
    const accessToken = getAccessToken();

    // Ensure path starts with /
    const apiPath = path.startsWith('/') ? path : `/${path}`;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Add Authorization header if we have a token
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api${apiPath}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        console.error(`API Error (${response.status}):`, errorData);
        throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
    }

    if (response.status === HTTP_NO_CONTENT) {
        return null;
    }

    return response.json();
}
