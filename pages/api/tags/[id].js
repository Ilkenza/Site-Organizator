/**
 * @fileoverview API endpoint for individual tag operations (GET, PUT/PATCH, DELETE)
 * Handles tag updates with automatic user_id extraction and cascade delete of relations
 */

// Constants
const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
  MISSING_ENV: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  AUTH_REQUIRED: 'Authentication required',
  UPSTREAM_ERROR: 'Upstream REST error',
  METHOD_NOT_ALLOWED: 'Method not allowed',
};

const HEADERS = {
  ACCEPT: 'application/json',
  CONTENT_TYPE: 'application/json',
  PREFER_RETURN: 'return=representation',
};

const SUPABASE_TABLES = {
  TAGS: 'tags',
  SITE_TAGS: 'site_tags',
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

  return {
    url: url.replace(/\/$/, ''),
    anonKey,
  };
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
 * Extract user ID from JWT token
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null
 */
function extractUserIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.sub || null;
  } catch (e) {
    console.warn('Failed to extract user_id from token:', e);
    return null;
  }
}

/**
 * Build headers for Supabase API calls
 * @param {string} apiKey - API key
 * @param {string} authToken - Authorization token
 * @param {boolean} [includeContentType=false] - Include Content-Type header
 * @param {boolean} [includePrefer=false] - Include Prefer header
 * @returns {Object} Headers object
 */
function buildHeaders(apiKey, authToken, includeContentType = false, includePrefer = false) {
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${authToken}`,
    Accept: HEADERS.ACCEPT,
  };
  if (includeContentType) headers['Content-Type'] = HEADERS.CONTENT_TYPE;
  if (includePrefer) headers['Prefer'] = HEADERS.PREFER_RETURN;
  return headers;
}

/**
 * Auto-fix request body by adding user_id from token if missing
 * @param {Object} body - Request body
 * @param {string} userToken - User JWT token
 * @returns {Object} Fixed body with user_id
 */
function autoFixBody(body, userToken) {
  const fixedBody = { ...body };

  if (userToken && !fixedBody.user_id) {
    const userId = extractUserIdFromToken(userToken);
    if (userId) {
      fixedBody.user_id = userId;
    }
  }

  return fixedBody;
}

/**
 * Send error response
 * @param {Object} res - Response object
 * @param {number} status - HTTP status code
 * @param {string} error - Error message
 * @param {string} [details] - Optional error details
 */
function sendError(res, status, error, details) {
  const response = { success: false, error };
  if (details) response.details = details;
  res.status(status).json(response);
}

/**
 * Send success response
 * @param {Object} res - Response object
 * @param {Object} [data] - Optional response data
 */
function sendSuccess(res, data) {
  const response = { success: true };
  if (data !== undefined) response.data = data;
  res.status(HTTP_STATUS.OK).json(response);
}

// Main Handler

/**
 * Handler for individual tag operations (GET, PUT/PATCH, DELETE)
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
  const { id } = req.query;

  // Get Supabase configuration
  const config = getSupabaseConfig();
  if (!config) {
    return sendError(res, HTTP_STATUS.INTERNAL_ERROR, ERROR_MESSAGES.MISSING_ENV);
  }

  // Extract user token
  const userToken = extractUserToken(req.headers.authorization);
  const authToken = userToken || config.anonKey;

  if (req.method === 'GET') {
    try {
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.TAGS}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, authToken);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return sendError(
          res,
          HTTP_STATUS.BAD_GATEWAY,
          ERROR_MESSAGES.UPSTREAM_ERROR,
          await response.text()
        );
      }

      const rows = await response.json();
      return sendSuccess(res, rows[0] || null);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_ERROR, err.message || String(err));
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!userToken) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.AUTH_REQUIRED);
    }

    try {
      // Auto-fix body by adding user_id from token if missing
      const body = autoFixBody(req.body || {}, userToken);

      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.TAGS}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, userToken, true, true);
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return sendError(
          res,
          HTTP_STATUS.BAD_GATEWAY,
          ERROR_MESSAGES.UPSTREAM_ERROR,
          await response.text()
        );
      }

      const updated = await response.json();
      return sendSuccess(res, Array.isArray(updated) ? updated[0] : updated);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_ERROR, err.message || String(err));
    }
  }

  if (req.method === 'DELETE') {
    if (!userToken) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.AUTH_REQUIRED);
    }

    try {
      // First delete all site_tags that use this tag (cascade delete)
      const delUrl = `${config.url}/rest/v1/${SUPABASE_TABLES.SITE_TAGS}?tag_id=eq.${id}`;
      const delHeaders = buildHeaders(config.anonKey, userToken);
      const delResponse = await fetch(delUrl, { method: 'DELETE', headers: delHeaders });

      if (!delResponse.ok) {
        console.warn('Failed to delete site_tags:', await delResponse.text());
      }

      // Then delete the tag itself
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.TAGS}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, userToken);
      const response = await fetch(url, { method: 'DELETE', headers });

      if (!response.ok) {
        return sendError(
          res,
          HTTP_STATUS.BAD_GATEWAY,
          ERROR_MESSAGES.UPSTREAM_ERROR,
          await response.text()
        );
      }

      return sendSuccess(res);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_ERROR, err.message || String(err));
    }
  }

  return sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, ERROR_MESSAGES.METHOD_NOT_ALLOWED);
}
