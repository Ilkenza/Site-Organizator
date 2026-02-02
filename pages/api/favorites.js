/**
 * @fileoverview Favorites API endpoint for managing favorite sites
 * Supports GET (fetch favorite site IDs) and POST (toggle favorite status)
 */

import { createClient } from '@supabase/supabase-js';

// Constants
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES = {
    MISSING_CREDENTIALS: 'Missing Supabase credentials',
    SITE_ID_REQUIRED: 'site_id is required',
    SITE_NOT_FOUND: 'Site not found',
    METHOD_NOT_ALLOWED: 'Method not allowed',
};

const SUPABASE_TABLES = {
    SITES: 'sites',
};

const SITE_FIELDS = {
    ID: 'id',
    IS_FAVORITE: 'is_favorite',
};

// Helper Functions

/**
 * Get Supabase configuration from environment
 * @returns {Object|null} Config object or null if missing
 */
function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return null;

    return { url, anonKey };
}

/**
 * Extract user token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} User token or null
 */
function extractUserToken(authHeader) {
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

/**
 * Create Supabase client with optional user token
 * @param {string} url - Supabase URL
 * @param {string} anonKey - Anon key
 * @param {string|null} userToken - User JWT token
 * @returns {Object} Supabase client
 */
function createSupabaseClient(url, anonKey, userToken) {
    return createClient(url, anonKey, {
        global: {
            headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        },
    });
}

/**
 * Fetch all favorite site IDs
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>} Array of favorite sites with IDs
 */
async function fetchFavoriteSites(supabase) {
    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITES)
        .select(SITE_FIELDS.ID)
        .eq(SITE_FIELDS.IS_FAVORITE, true);

    if (error) throw error;
    return data || [];
}

/**
 * Fetch site by ID
 * @param {Object} supabase - Supabase client
 * @param {string} siteId - Site ID
 * @returns {Promise<Object|null>} Site object or null
 */
async function fetchSiteById(supabase, siteId) {
    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITES)
        .select(`${SITE_FIELDS.ID}, ${SITE_FIELDS.IS_FAVORITE}`)
        .eq(SITE_FIELDS.ID, siteId);

    if (error) {
        console.error('[FAVORITES] Fetch error:', error);
        throw error;
    }

    return (data && data.length > 0) ? data[0] : null;
}

/**
 * Fetch total site count for debugging
 * @param {Object} supabase - Supabase client
 * @returns {Promise<number>} Total site count
 */
async function fetchTotalSiteCount(supabase) {
    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITES)
        .select(SITE_FIELDS.ID);

    if (error) {
        console.error('Error fetching all sites:', error);
        return 0;
    }

    return data?.length || 0;
}

/**
 * Toggle favorite status for a site
 * @param {Object} supabase - Supabase client
 * @param {string} siteId - Site ID
 * @param {boolean} currentStatus - Current favorite status
 * @returns {Promise<boolean>} New favorite status
 */
async function toggleFavoriteStatus(supabase, siteId, currentStatus) {
    const newStatus = !currentStatus;

    const { error } = await supabase
        .from(SUPABASE_TABLES.SITES)
        .update({ [SITE_FIELDS.IS_FAVORITE]: newStatus })
        .eq(SITE_FIELDS.ID, siteId.toString())
        .select(SITE_FIELDS.IS_FAVORITE);

    if (error) {
        console.error('Update error:', error);
        throw error;
    }

    return newStatus;
}

// Main Handler

/**
 * Favorites API handler - manages favorite sites
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
    // Get Supabase configuration
    const config = getSupabaseConfig();
    if (!config) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: ERROR_MESSAGES.MISSING_CREDENTIALS,
        });
    }

    // Extract user token and create Supabase client
    const userToken = extractUserToken(req.headers.authorization);
    const supabase = createSupabaseClient(config.url, config.anonKey, userToken);

    try {
        // GET - Fetch all favorite site IDs
        if (req.method === 'GET') {
            const favorites = await fetchFavoriteSites(supabase);
            return res.status(HTTP_STATUS.OK).json(favorites);
        }

        // POST - Toggle favorite status
        if (req.method === 'POST') {
            const { site_id } = req.body;

            if (!site_id) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: ERROR_MESSAGES.SITE_ID_REQUIRED,
                });
            }

            try {
                // Fetch current site status
                const site = await fetchSiteById(supabase, site_id);

                if (!site) {
                    // Get total site count for debugging
                    const totalSites = await fetchTotalSiteCount(supabase);

                    return res.status(HTTP_STATUS.NOT_FOUND).json({
                        error: ERROR_MESSAGES.SITE_NOT_FOUND,
                        debug: { site_id, totalSites },
                    });
                }

                // Toggle favorite status
                const newStatus = await toggleFavoriteStatus(supabase, site_id, site.is_favorite);

                return res.status(HTTP_STATUS.OK).json({ favorite: newStatus });
            } catch (err) {
                console.error('Favorites toggle error:', err);
                throw err;
            }
        }

        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
        });
    } catch (err) {
        console.error('Favorites API error:', err);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: err.message });
    }
}
