/**
 * @fileoverview API endpoint to retry/rebuild site relations (categories and tags)
 * Deletes existing relations and recreates them from provided IDs
 */

import { parse } from 'url';
import { verifyUserFromAuthHeader } from '../../../helpers/auth-helpers';

// Constants
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method not allowed',
    NOT_AUTHENTICATED: 'Not authenticated',
    NOT_OWNER: 'Not site owner',
    SUPABASE_URL_MISSING: 'SUPABASE_URL missing',
    SERVICE_KEY_MISSING: 'Service role key not configured',
    FETCH_OWNER_FAILED: 'Failed to fetch site owner',
    INSERT_CATEGORIES_FAILED: 'Failed to insert site_categories',
    INSERT_TAGS_FAILED: 'Failed to insert site_tags',
};

const SUPABASE_TABLES = {
    SITES: 'sites',
    SITE_CATEGORIES: 'site_categories',
    SITE_TAGS: 'site_tags',
    CATEGORIES: 'categories',
    TAGS: 'tags',
};

const HEADERS = {
    CONTENT_TYPE: 'application/json',
    ACCEPT: 'application/json',
};

const BODY_FIELD_VARIANTS = {
    CATEGORY_IDS: ['category_ids', 'categoryIds'],
    TAG_IDS: ['tag_ids', 'tagIds'],
};

// Helper Functions

/**
 * Parse request body safely
 * @param {Object|string} reqBody - Request body
 * @returns {Object} Parsed body object
 */
function parseRequestBody(reqBody) {
    if (!reqBody) return {};

    try {
        return typeof reqBody === 'string' ? JSON.parse(reqBody) : reqBody;
    } catch (e) {
        return {};
    }
}

/**
 * Extract array from body using multiple possible field names
 * @param {Object} body - Request body
 * @param {Array<string>} fieldNames - Possible field names
 * @returns {Array} Extracted array or empty array
 */
function extractArrayFromBody(body, fieldNames) {
    for (const fieldName of fieldNames) {
        if (Array.isArray(body[fieldName])) {
            return body[fieldName];
        }
    }
    return [];
}

/**
 * Get Supabase configuration from environment
 * @returns {Object} Config object with url, anonKey, serviceKey
 * @throws {Error} If required config is missing
 */
function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!url) {
        throw new Error(ERROR_MESSAGES.SUPABASE_URL_MISSING);
    }
    if (!serviceKey) {
        throw new Error(ERROR_MESSAGES.SERVICE_KEY_MISSING);
    }

    return {
        url: url.replace(/\/$/, ''),
        anonKey,
        serviceKey,
    };
}

/**
 * Build headers for Supabase API calls
 * @param {string} apiKey - API key
 * @param {string} [authToken] - Optional auth token
 * @param {boolean} [includeContentType=false] - Include Content-Type header
 * @returns {Object} Headers object
 */
function buildSupabaseHeaders(apiKey, authToken, includeContentType = false) {
    const headers = {
        apikey: apiKey,
        Authorization: `Bearer ${authToken || apiKey}`,
        Accept: HEADERS.ACCEPT,
    };
    if (includeContentType) {
        headers['Content-Type'] = HEADERS.CONTENT_TYPE;
    }
    return headers;
}

/**
 * Fetch site owner ID to verify ownership
 * @param {string} siteId - Site ID
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authToken - Auth token
 * @returns {Promise<string|null>} Owner user ID or null
 */
async function fetchSiteOwner(siteId, baseUrl, anonKey, authToken) {
    const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${siteId}&select=user_id`;
    const headers = buildSupabaseHeaders(anonKey, authToken);

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(ERROR_MESSAGES.FETCH_OWNER_FAILED);
    }

    const data = await response.json();
    return data?.[0]?.user_id || null;
}

/**
 * Delete all relations for a site in a specific table
 * @param {string} siteId - Site ID
 * @param {string} tableName - Table name
 * @param {string} baseUrl - Supabase base URL
 * @param {string} serviceKey - Service role key
 * @returns {Promise<void>}
 */
async function deleteRelations(siteId, tableName, baseUrl, serviceKey) {
    const url = `${baseUrl}/rest/v1/${tableName}?site_id=eq.${siteId}`;
    const headers = buildSupabaseHeaders(serviceKey);
    await fetch(url, { method: 'DELETE', headers });
}

/**
 * Insert relations for a site
 * @param {string} siteId - Site ID
 * @param {Array<string>} relationIds - Array of relation IDs
 * @param {string} tableName - Table name
 * @param {string} relationField - Field name for relation ID
 * @param {string} baseUrl - Supabase base URL
 * @param {string} serviceKey - Service role key
 * @returns {Promise<void>}
 * @throws {Error} If insert fails
 */
async function insertRelations(siteId, relationIds, tableName, relationField, baseUrl, serviceKey) {
    if (!relationIds.length) return;

    const url = `${baseUrl}/rest/v1/${tableName}`;
    const headers = buildSupabaseHeaders(serviceKey, null, true);
    const records = relationIds.map(relationId => ({
        site_id: siteId,
        [relationField]: relationId,
    }));

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(records),
    });

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
            tableName === SUPABASE_TABLES.SITE_CATEGORIES
                ? ERROR_MESSAGES.INSERT_CATEGORIES_FAILED
                : ERROR_MESSAGES.INSERT_TAGS_FAILED
        );
        error.details = errorText;
        throw error;
    }
}

/**
 * Refetch complete site with all relations
 * @param {string} siteId - Site ID
 * @param {string} baseUrl - Supabase base URL
 * @param {string} serviceKey - Service role key
 * @returns {Promise<Object|null>} Complete site object or null
 */
async function refetchSiteWithRelations(siteId, baseUrl, serviceKey) {
    const selectQuery = `*,categories_array:${SUPABASE_TABLES.SITE_CATEGORIES}(category:${SUPABASE_TABLES.CATEGORIES}(*)),tags_array:${SUPABASE_TABLES.SITE_TAGS}(tag:${SUPABASE_TABLES.TAGS}(*))`;
    const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${siteId}&select=${selectQuery}`;
    const headers = buildSupabaseHeaders(serviceKey);

    const response = await fetch(url, { headers });
    const data = await response.json();
    return data?.[0] || null;
}

/**
 * Rebuild site relations (delete all, then insert new ones)
 * @param {string} siteId - Site ID
 * @param {Array<string>} categoryIds - Category IDs
 * @param {Array<string>} tagIds - Tag IDs
 * @param {Object} config - Supabase config
 * @returns {Promise<Object>} Updated site object
 */
async function rebuildSiteRelations(siteId, categoryIds, tagIds, config) {
    const { url: baseUrl, serviceKey } = config;

    // Delete existing relations
    await Promise.all([
        deleteRelations(siteId, SUPABASE_TABLES.SITE_CATEGORIES, baseUrl, serviceKey),
        deleteRelations(siteId, SUPABASE_TABLES.SITE_TAGS, baseUrl, serviceKey),
    ]);

    // Insert new relations
    await insertRelations(
        siteId,
        categoryIds,
        SUPABASE_TABLES.SITE_CATEGORIES,
        'category_id',
        baseUrl,
        serviceKey
    );

    await insertRelations(
        siteId,
        tagIds,
        SUPABASE_TABLES.SITE_TAGS,
        'tag_id',
        baseUrl,
        serviceKey
    );

    // Refetch complete site
    return await refetchSiteWithRelations(siteId, baseUrl, serviceKey);
}

// Main Handler

/**
 * Handler for retrying/rebuilding site relations
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
    // Parse site ID from URL
    const { query: { id } } = parse(req.url, true);

    // Check HTTP method
    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            success: false,
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
        });
    }

    // Parse request body and extract IDs
    const body = parseRequestBody(req.body);
    const categoryIds = extractArrayFromBody(body, BODY_FIELD_VARIANTS.CATEGORY_IDS);
    const tagIds = extractArrayFromBody(body, BODY_FIELD_VARIANTS.TAG_IDS);

    // Authenticate user
    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth?.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: ERROR_MESSAGES.NOT_AUTHENTICATED,
        });
    }

    try {
        // Get Supabase configuration
        const config = getSupabaseConfig();

        // Verify site ownership
        const ownerId = await fetchSiteOwner(id, config.url, config.anonKey, auth.token);
        if (ownerId !== auth.user.id) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: ERROR_MESSAGES.NOT_OWNER,
            });
        }

        // Rebuild relations
        const updatedSite = await rebuildSiteRelations(id, categoryIds, tagIds, config);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: updatedSite,
        });
    } catch (err) {
        console.error('Retry relations error:', err);

        // Determine appropriate status code
        let status = HTTP_STATUS.INTERNAL_ERROR;
        if (err.message === ERROR_MESSAGES.SUPABASE_URL_MISSING ||
            err.message === ERROR_MESSAGES.SERVICE_KEY_MISSING) {
            status = HTTP_STATUS.INTERNAL_ERROR;
        } else if (err.message === ERROR_MESSAGES.FETCH_OWNER_FAILED) {
            status = HTTP_STATUS.BAD_REQUEST;
        }

        const response = {
            success: false,
            error: err.message || String(err),
        };
        if (err.details) {
            response.details = err.details;
        }

        return res.status(status).json(response);
    }
}
