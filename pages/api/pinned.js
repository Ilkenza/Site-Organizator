/**
 * @fileoverview API endpoint for managing pinned sites
 * Handles fetching pinned sites list and toggling pin status
 */

import { createClient } from '@supabase/supabase-js';

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500
};

// Error Messages
const ERROR_MESSAGES = {
    MISSING_CREDENTIALS: 'Missing Supabase credentials',
    SITE_ID_REQUIRED: 'site_id is required',
    SITE_NOT_FOUND: 'Site not found',
    METHOD_NOT_ALLOWED: 'Method not allowed'
};

// Default Values
const DEFAULT_PIN_POSITION = 0;
const INITIAL_MAX_POSITION = -1;

/**
 * Extract JWT token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} Extracted token or null
 */
const extractUserToken = (headers) => {
    const authHeader = headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

/**
 * Create Supabase client with user authentication
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase anon key
 * @param {string|null} token - User JWT token
 * @returns {Object} Supabase client instance
 */
const createAuthenticatedClient = (url, key, token) => {
    return createClient(url, key, {
        global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
    });
};

/**
 * Fetch all pinned sites sorted by position
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>} List of pinned site IDs
 */
const fetchPinnedSites = async (supabase) => {
    const { data, error } = await supabase
        .from('sites')
        .select('id')
        .eq('is_pinned', true)
        .order('pin_position', { ascending: true });

    if (error) throw error;
    return data || [];
};

/**
 * Fetch site data by ID
 * @param {Object} supabase - Supabase client
 * @param {string} siteId - Site ID to fetch
 * @returns {Promise<Object|null>} Site data or null if not found
 */
const fetchSiteById = async (supabase, siteId) => {
    const { data: siteData, error: fetchError } = await supabase
        .from('sites')
        .select('id, is_pinned, pin_position')
        .eq('id', siteId.toString());

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
    }

    return siteData && siteData.length > 0 ? siteData[0] : null;
};

/**
 * Get maximum pin position from currently pinned sites
 * @param {Object} supabase - Supabase client
 * @returns {Promise<number>} Maximum pin position
 */
const getMaxPinPosition = async (supabase) => {
    const { data: maxPositionData, error: maxError } = await supabase
        .from('sites')
        .select('pin_position')
        .eq('is_pinned', true)
        .order('pin_position', { ascending: false })
        .limit(1);

    if (maxError) throw maxError;

    return maxPositionData && maxPositionData.length > 0
        ? maxPositionData[0].pin_position
        : INITIAL_MAX_POSITION;
};

/**
 * Unpin a site - set is_pinned to false and reset position
 * @param {Object} supabase - Supabase client
 * @param {string} siteId - Site ID to unpin
 * @returns {Promise<void>}
 */
const unpinSite = async (supabase, siteId) => {
    const { error: updateError } = await supabase
        .from('sites')
        .update({ is_pinned: false, pin_position: DEFAULT_PIN_POSITION })
        .eq('id', siteId.toString());

    if (updateError) throw updateError;
};

/**
 * Pin a site - set is_pinned to true with next available position
 * @param {Object} supabase - Supabase client
 * @param {string} siteId - Site ID to pin
 * @returns {Promise<void>}
 */
const pinSite = async (supabase, siteId) => {
    const maxPos = await getMaxPinPosition(supabase);
    const nextPosition = maxPos + 1;

    const { error: updateError } = await supabase
        .from('sites')
        .update({ is_pinned: true, pin_position: nextPosition })
        .eq('id', siteId.toString());

    if (updateError) throw updateError;
};

/**
 * Handle GET request - fetch all pinned sites
 * @param {Object} supabase - Supabase client
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
const handleGetRequest = async (supabase, res) => {
    const pinnedSites = await fetchPinnedSites(supabase);
    return res.status(HTTP_STATUS.OK).json(pinnedSites);
};

/**
 * Handle POST request - toggle pin status
 * @param {Object} supabase - Supabase client
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
const handlePostRequest = async (supabase, req, res) => {
    const { site_id } = req.body;

    if (!site_id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: ERROR_MESSAGES.SITE_ID_REQUIRED
        });
    }

    const site = await fetchSiteById(supabase, site_id);

    if (!site) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            error: ERROR_MESSAGES.SITE_NOT_FOUND,
            query: { site_id, received_type: typeof site_id }
        });
    }

    if (site.is_pinned) {
        await unpinSite(supabase, site_id);
        return res.status(HTTP_STATUS.OK).json({ pinned: false });
    } else {
        await pinSite(supabase, site_id);
        return res.status(HTTP_STATUS.OK).json({ pinned: true });
    }
};

/**
 * Main API handler for pinned sites management
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: ERROR_MESSAGES.MISSING_CREDENTIALS
        });
    }

    const userToken = extractUserToken(req.headers);
    const supabase = createAuthenticatedClient(SUPABASE_URL, SUPABASE_ANON_KEY, userToken);

    try {
        if (req.method === 'GET') {
            return await handleGetRequest(supabase, res);
        }

        if (req.method === 'POST') {
            return await handlePostRequest(supabase, req, res);
        }

        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED
        });
    } catch (err) {
        console.error('Pinned API error:', err);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: err.message });
    }
}
