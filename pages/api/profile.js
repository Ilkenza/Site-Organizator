/**
 * @fileoverview API endpoint for user profile management
 * Handles fetching and updating user profile data with RLS compliance
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500,
    BAD_GATEWAY: 502
};

// Error Messages
const ERROR_MESSAGES = {
    MISSING_CONFIG: 'Supabase config missing',
    AUTH_REQUIRED: 'Authentication required',
    INVALID_TOKEN: 'Invalid token format',
    INVALID_TOKEN_NO_USER: 'Invalid token - no user ID',
    FETCH_FAILED: 'Failed to fetch profile',
    UPDATE_FAILED: 'Failed to update profile',
    NO_VALID_FIELDS: 'No valid fields to update',
    METHOD_NOT_ALLOWED: 'Method not allowed'
};

// Profile Configuration
const PROFILE_CONFIG = {
    TABLE: 'profiles',
    SELECT_FIELDS: 'id,name,avatar_url',
    ALLOWED_UPDATE_FIELDS: ['name', 'avatar_url']
};

/**
 * Extract JWT token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} Extracted JWT token or null
 */
const extractUserToken = (headers) => {
    const authHeader = headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

/**
 * Decode JWT token and extract user ID
 * @param {string} token - JWT token
 * @returns {string|null} User ID from token payload
 * @throws {Error} If token is invalid or missing user ID
 */
const decodeUserIdFromToken = (token) => {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || null;
};

/**
 * Build Supabase REST API URL for profile operations
 * @param {string} baseUrl - Supabase URL
 * @param {string} userId - User ID for filtering
 * @param {boolean} forUpdate - Whether URL is for update operation
 * @returns {string} Complete API URL
 */
const buildProfileUrl = (baseUrl, userId, forUpdate = false) => {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const queryParams = forUpdate
        ? `?id=eq.${userId}`
        : `?id=eq.${userId}&select=${PROFILE_CONFIG.SELECT_FIELDS}`;
    return `${cleanUrl}/rest/v1/${PROFILE_CONFIG.TABLE}${queryParams}`;
};

/**
 * Create headers for Supabase REST API request
 * @param {string} anonKey - Supabase anon key
 * @param {string} userToken - User JWT token
 * @param {boolean} isUpdate - Whether this is an update request
 * @returns {Object} Request headers
 */
const createSupabaseHeaders = (anonKey, userToken, isUpdate = false) => {
    const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/json'
    };

    if (isUpdate) {
        headers['Content-Type'] = 'application/json';
        headers.Prefer = 'return=representation';
    }

    return headers;
};

/**
 * Filter request body to only include allowed fields
 * @param {Object} body - Request body
 * @returns {Object} Filtered update data
 */
const filterAllowedFields = (body) => {
    const updateData = {};
    for (const key of PROFILE_CONFIG.ALLOWED_UPDATE_FIELDS) {
        if (body[key] !== undefined) {
            updateData[key] = body[key];
        }
    }
    return updateData;
};

/**
 * Fetch user profile from Supabase
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} anonKey - Supabase anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Profile data or null
 */
const fetchUserProfile = async (supabaseUrl, anonKey, userToken, userId) => {
    const url = buildProfileUrl(supabaseUrl, userId, false);
    const headers = createSupabaseHeaders(anonKey, userToken, false);

    const response = await fetch(url, { headers });

    if (!response.ok) {
        const text = await response.text();
        console.error('[Profile API] Fetch error:', response.status, text);
        throw new Error(`${ERROR_MESSAGES.FETCH_FAILED}: ${text}`);
    }

    const rows = await response.json();
    return rows[0] || null;
};

/**
 * Update user profile in Supabase
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} anonKey - Supabase anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated profile data or null
 */
const updateUserProfile = async (supabaseUrl, anonKey, userToken, userId, updateData) => {
    const url = buildProfileUrl(supabaseUrl, userId, true);
    const headers = createSupabaseHeaders(anonKey, userToken, true);

    const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('[Profile API] Update error:', response.status, text);
        throw new Error(`${ERROR_MESSAGES.UPDATE_FAILED}: ${text}`);
    }

    const updated = await response.json();
    return updated[0] || null;
};

/**
 * Handle GET request - fetch user profile
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} anonKey - Supabase anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
const handleGetRequest = async (supabaseUrl, anonKey, userToken, userId, res) => {
    const profile = await fetchUserProfile(supabaseUrl, anonKey, userToken, userId);
    return res.status(HTTP_STATUS.OK).json({ success: true, data: profile });
};

/**
 * Handle PUT/PATCH request - update user profile
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} anonKey - Supabase anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
const handleUpdateRequest = async (supabaseUrl, anonKey, userToken, userId, req, res) => {
    const body = req.body || {};
    const updateData = filterAllowedFields(body);

    if (Object.keys(updateData).length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: ERROR_MESSAGES.NO_VALID_FIELDS
        });
    }

    const updated = await updateUserProfile(supabaseUrl, anonKey, userToken, userId, updateData);
    return res.status(HTTP_STATUS.OK).json({ success: true, data: updated });
};

/**
 * Main API handler for user profile management
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: ERROR_MESSAGES.MISSING_CONFIG
        });
    }

    const userToken = extractUserToken(req.headers);

    if (!userToken) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: ERROR_MESSAGES.AUTH_REQUIRED
        });
    }

    // Decode JWT to get user ID
    let userId;
    try {
        userId = decodeUserIdFromToken(userToken);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: ERROR_MESSAGES.INVALID_TOKEN_NO_USER
            });
        }
    } catch (err) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: ERROR_MESSAGES.INVALID_TOKEN
        });
    }

    try {
        if (req.method === 'GET') {
            return await handleGetRequest(SUPABASE_URL, SUPABASE_ANON_KEY, userToken, userId, res);
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
            return await handleUpdateRequest(SUPABASE_URL, SUPABASE_ANON_KEY, userToken, userId, req, res);
        }

        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            success: false,
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED
        });
    } catch (err) {
        console.error('[Profile API] Error:', err);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: err.message
        });
    }
}
