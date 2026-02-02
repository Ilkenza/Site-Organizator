/**
 * API route for individual category operations (GET, PUT/PATCH, DELETE)
 */

// Constants
const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
  ENV_MISSING: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  AUTH_REQUIRED: 'Authentication required',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  UPSTREAM_ERROR: 'Upstream REST error',
};

const HEADERS = {
  ACCEPT: 'application/json',
  CONTENT_TYPE: 'application/json',
  PREFER_RETURN: 'return=representation',
};

/**
 * Extract user ID from JWT token
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null
 */
function extractUserIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch (e) {
    console.warn('Failed to extract user_id from token:', e);
    return null;
  }
}

/**
 * Build Supabase REST API headers
 * @param {string} anonKey - Supabase anon key
 * @param {string} authToken - Auth token (user or anon)
 * @param {boolean} includePrefer - Include Prefer header
 * @returns {Object} Headers object
 */
function buildHeaders(anonKey, authToken, includePrefer = false) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${authToken}`,
    Accept: HEADERS.ACCEPT,
  };

  if (includePrefer) {
    headers['Content-Type'] = HEADERS.CONTENT_TYPE;
    headers['Prefer'] = HEADERS.PREFER_RETURN;
  }

  return headers;
}

/**
 * Send error response
 * @param {Object} res - Response object
 * @param {number} status - HTTP status code
 * @param {string} error - Error message
 * @param {Object} extra - Extra data to include
 */
function sendError(res, status, error, extra = {}) {
  return res.status(status).json({ success: false, error, ...extra });
}

/**
 * Send success response
 * @param {Object} res - Response object
 * @param {Object} data - Data to send
 */
function sendSuccess(res, data = null) {
  const response = { success: true };
  if (data !== null) response.data = data;
  return res.status(HTTP_STATUS.OK).json(response);
}

export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_MESSAGES.ENV_MISSING);
  }

  // Use user's token for authenticated requests (respects RLS), fallback to anon key
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;
  const baseUrl = SUPABASE_URL.replace(/\/$/, '');

  // Handle UPDATE (PUT/PATCH)
  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!userToken) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.AUTH_REQUIRED);
    }

    try {
      const body = req.body || {};

      // Auto-fix null user_id: extract from token if missing
      if (userToken && !body.user_id) {
        const userId = extractUserIdFromToken(userToken);
        if (userId) {
          body.user_id = userId;
        }
      }

      const url = `${baseUrl}/rest/v1/categories?id=eq.${id}`;
      const headers = buildHeaders(SUPABASE_ANON_KEY, userToken, true);

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return sendError(
          res,
          HTTP_STATUS.BAD_GATEWAY,
          ERROR_MESSAGES.UPSTREAM_ERROR,
          {
            upstreamStatus: response.status,
            upstreamStatusText: response.statusText,
            upstreamBody: text,
            requestBody: body,
          }
        );
      }

      const updated = await response.json();
      return sendSuccess(res, Array.isArray(updated) ? updated[0] : updated);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || String(err));
    }
  }

  // Handle DELETE
  if (req.method === 'DELETE') {
    if (!userToken) {
      return sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.AUTH_REQUIRED);
    }

    try {
      const headers = buildHeaders(SUPABASE_ANON_KEY, userToken);

      // First delete all site_categories that reference this category
      const deleteRelationsUrl = `${baseUrl}/rest/v1/site_categories?category_id=eq.${id}`;
      const relationsResponse = await fetch(deleteRelationsUrl, {
        method: 'DELETE',
        headers,
      });

      if (!relationsResponse.ok) {
        console.warn('Failed to delete site_categories:', await relationsResponse.text());
      }

      // Then delete the category itself
      const deleteCategoryUrl = `${baseUrl}/rest/v1/categories?id=eq.${id}`;
      const categoryResponse = await fetch(deleteCategoryUrl, {
        method: 'DELETE',
        headers,
      });

      if (!categoryResponse.ok) {
        const details = await categoryResponse.text();
        return sendError(res, HTTP_STATUS.BAD_GATEWAY, ERROR_MESSAGES.UPSTREAM_ERROR, { details });
      }

      return sendSuccess(res);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || String(err));
    }
  }

  // Handle GET
  if (req.method === 'GET') {
    try {
      const url = `${baseUrl}/rest/v1/categories?id=eq.${id}`;
      const headers = buildHeaders(SUPABASE_ANON_KEY, AUTH_TOKEN);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const details = await response.text();
        return sendError(res, HTTP_STATUS.BAD_GATEWAY, ERROR_MESSAGES.UPSTREAM_ERROR, { details });
      }

      const rows = await response.json();
      return sendSuccess(res, rows[0] || null);
    } catch (err) {
      return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || String(err));
    }
  }

  // Method not allowed
  return sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, ERROR_MESSAGES.METHOD_NOT_ALLOWED);
}
