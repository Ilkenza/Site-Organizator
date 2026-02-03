/**
 * @fileoverview API endpoint for tags collection management
 * Handles listing all tags and creating new tags
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502
};

// Error Messages
const ERROR_MESSAGES = {
  MISSING_ENV: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  AUTH_REQUIRED: 'Authentication required to create tags',
  UPSTREAM_ERROR: 'Upstream REST error'
};

// Configuration
const TAG_CONFIG = {
  ALLOWED_FIELDS: ['name', 'color', 'user_id'],
  DUPLICATE_REGEX: /duplicate|unique|violat|23505/i
};

/**
 * Extract JWT token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} JWT token or null
 */
const extractUserToken = (headers) => {
  const authHeader = headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

/**
 * Build clean Supabase base URL
 * @param {string} url - Raw Supabase URL
 * @returns {string} Clean URL without trailing slash
 */
const buildBaseUrl = (url) => url.replace(/\/$/, '');

/**
 * Filter request body to only allowed fields
 * @param {Object} body - Request body
 * @returns {Object} Filtered body with only allowed fields
 */
const filterAllowedFields = (body) => {
  const filtered = {};
  for (const key of TAG_CONFIG.ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      filtered[key] = body[key];
    }
  }
  return filtered;
};

/**
 * Create a new tag
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {Object} tagData - Tag data to insert
 * @returns {Promise<Object>} Created tag
 */
const createTag = async (baseUrl, anonKey, userToken, tagData) => {
  const url = `${baseUrl}/rest/v1/tags`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(tagData)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text);
  }

  const created = JSON.parse(text);
  return Array.isArray(created) ? created[0] : created;
};

/**
 * Handle duplicate tag error by looking up existing tag
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} serviceKey - Service role key
 * @param {string} tagName - Tag name to lookup
 * @param {string} errorText - Error text from failed insert
 * @returns {Promise<Object|null>} Existing tag or null
 */
const handleDuplicateTag = async (baseUrl, anonKey, serviceKey, tagName, errorText) => {
  if (!tagName || !TAG_CONFIG.DUPLICATE_REGEX.test(errorText)) {
    return null;
  }

  try {
    const lookupUrl = `${baseUrl}/rest/v1/tags?select=*&name=eq.${encodeURIComponent(tagName)}`;
    const lookupToken = serviceKey || anonKey;

    const lookupRes = await fetch(lookupUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${lookupToken}`,
        Accept: 'application/json'
      }
    });

    if (lookupRes.ok) {
      const rows = await lookupRes.json();
      if (rows && rows.length > 0) {
        return rows[0];
      }
    }
  } catch (err) {
    console.warn('tag duplicate lookup failed', err);
  }

  return null;
};

/**
 * Fetch all tags
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} readToken - Read token (service role or anon)
 * @returns {Promise<Array>} Tags array
 */
const fetchAllTags = async (baseUrl, anonKey, readToken) => {
  const url = `${baseUrl}/rest/v1/tags?select=*`;
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${readToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  return await response.json();
};

/**
 * Handle POST request - create new tag
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} serviceKey - Service role key
 * @param {string|null} userToken - User JWT token
 * @returns {Promise<void>}
 */
const handlePostRequest = async (req, res, baseUrl, anonKey, serviceKey, userToken) => {
  if (!userToken) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: ERROR_MESSAGES.AUTH_REQUIRED
    });
  }

  try {
    const body = req.body || {};
    const filteredBody = filterAllowedFields(body);

    const newTag = await createTag(baseUrl, anonKey, userToken, filteredBody);

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newTag
    });
  } catch (err) {
    // Handle duplicate tag
    const tagName = req.body?.name;
    const duplicate = await handleDuplicateTag(
      baseUrl,
      anonKey,
      serviceKey,
      tagName,
      err.message
    );

    if (duplicate) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: duplicate
      });
    }

    return res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: ERROR_MESSAGES.UPSTREAM_ERROR,
      details: err.message
    });
  }
};

/**
 * Handle GET request - list all tags
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token for RLS
 * @returns {Promise<void>}
 */
const handleGetRequest = async (req, res, baseUrl, anonKey, userToken) => {
  if (!userToken) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: 'Authentication required to fetch tags'
    });
  }

  try {
    const tags = await fetchAllTags(baseUrl, anonKey, userToken);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: tags
    });
  } catch (err) {
    return res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: ERROR_MESSAGES.UPSTREAM_ERROR,
      details: err.message
    });
  }
};

/**
 * Main API handler for tags collection
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_ENV
    });
  }

  const userToken = extractUserToken(req.headers);
  const baseUrl = buildBaseUrl(SUPABASE_URL);

  try {
    if (req.method === 'POST') {
      return await handlePostRequest(
        req,
        res,
        baseUrl,
        SUPABASE_ANON_KEY,
        SERVICE_ROLE_KEY,
        userToken
      );
    } else if (req.method === 'GET') {
      return await handleGetRequest(req, res, baseUrl, SUPABASE_ANON_KEY, userToken);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Only GET and POST are allowed'
      });
    }
  } catch (err) {
    console.error('Unhandled error in tags API:', err);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: String(err)
    });
  }
}
