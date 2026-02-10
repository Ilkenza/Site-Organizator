/**
 * @fileoverview API endpoint for categories collection (GET all, POST create)
 * Handles category creation with duplicate detection and service role key for RLS bypass
 */

// Constants
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
  MISSING_ENV: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  AUTH_REQUIRED: 'Authentication required to create categories',
  UPSTREAM_ERROR: 'Upstream REST error',
  METHOD_NOT_ALLOWED: 'Method not allowed',
};

const HEADERS = {
  ACCEPT: 'application/json',
  CONTENT_TYPE: 'application/json',
  PREFER_RETURN: 'return=representation',
};

const SUPABASE_TABLES = {
  CATEGORIES: 'categories',
};

const ALLOWED_FIELDS = ['name', 'color', 'display_order', 'user_id'];

const DUPLICATE_ERROR_PATTERN = /duplicate|unique|violat|23505/i;

// Helper Functions

/**
 * Get Supabase configuration from environment
 * @returns {Object|null} Config object or null if missing
 */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !anonKey) return null;

  return {
    url: url.replace(/\/$/, ''),
    anonKey,
    serviceKey: serviceKey || anonKey, // Fallback to anon key if no service key
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
 * Filter request body to only allowed fields
 * @param {Object} body - Request body
 * @returns {Object} Filtered body
 */
function filterAllowedFields(body) {
  const filtered = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      filtered[key] = body[key];
    }
  }
  return filtered;
}

/**
 * Check if error is a duplicate error
 * @param {string} errorText - Error text from response
 * @returns {boolean} True if duplicate error
 */
function isDuplicateError(errorText) {
  return DUPLICATE_ERROR_PATTERN.test(errorText);
}

/**
 * Lookup existing category by name
 * @param {string} name - Category name
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - API key
 * @param {string} authToken - Auth token (preferably service key)
 * @returns {Promise<Object|null>} Existing category or null
 */
async function lookupCategoryByName(name, baseUrl, apiKey, authToken) {
  if (!name) return null;

  try {
    const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.CATEGORIES}?select=*&name=eq.${encodeURIComponent(name)}`;
    const headers = buildHeaders(apiKey, authToken);
    const response = await fetch(url, { headers });

    if (!response.ok) return null;

    const rows = await response.json();
    return (rows && rows.length > 0) ? rows[0] : null;
  } catch (err) {
    console.warn('Category duplicate lookup failed:', err);
    return null;
  }
}

/**
 * Handle duplicate category error by returning existing category
 * @param {string} categoryName - Category name
 * @param {Object} config - Supabase config
 * @returns {Promise<Object|null>} Existing category or null
 */
async function handleDuplicateCategory(categoryName, config) {
  const existing = await lookupCategoryByName(
    categoryName,
    config.url,
    config.anonKey,
    config.serviceKey
  );
  return existing;
}

// Main Handler

/**
 * Handler for categories collection (GET all, POST create)
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
  // Get Supabase configuration
  const config = getSupabaseConfig();
  if (!config) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_ENV,
    });
  }

  // Extract user token
  const userToken = extractUserToken(req.headers.authorization);

  if (req.method === 'POST') {
    if (!userToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_MESSAGES.AUTH_REQUIRED,
      });
    }

    // ── Tier limit check ──────────────────────────────────────────────
    const TIER_LIMITS = { free: 50, pro: 200, promax: Infinity };
    let tier = 'free';
    try {
      const jwtPayload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString('utf8'));
      const meta = jwtPayload?.user_metadata || {};
      tier = meta.tier || (meta.is_pro ? 'pro' : 'free');
      const userEmail = jwtPayload?.email || '';
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (adminEmails.includes(userEmail.toLowerCase())) tier = 'promax';
    } catch { /* keep free */ }

    const catLimit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    if (catLimit !== Infinity) {
      try {
        const countUrl = `${config.url}/rest/v1/${SUPABASE_TABLES.CATEGORIES}?select=id&limit=${catLimit + 1}`;
        const countHeaders = buildHeaders(config.anonKey, userToken);
        const countRes = await fetch(countUrl, { headers: countHeaders });
        if (countRes.ok) {
          const rows = await countRes.json();
          if (rows.length >= catLimit) {
            const tierLabel = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
            const upgradeTarget = tier === 'free' ? 'Pro or Pro Max' : 'Pro Max';
            return res.status(HTTP_STATUS.FORBIDDEN).json({
              success: false,
              error: `Category limit reached (${rows.length}/${catLimit}). You are on the ${tierLabel} plan. Upgrade to ${upgradeTarget} for more.`
            });
          }
        }
      } catch { /* allow on count failure */ }
    }
    // ── End tier limit check ──────────────────────────────────────────

    try {
      const body = req.body || {};
      const filteredBody = filterAllowedFields(body);

      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.CATEGORIES}`;
      const headers = buildHeaders(config.anonKey, userToken, true, true);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(filteredBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Handle duplicate name error by returning existing category
        if (body.name && isDuplicateError(responseText)) {
          const existing = await handleDuplicateCategory(body.name, config);
          if (existing) {
            return res.status(HTTP_STATUS.OK).json({ success: true, data: existing });
          }
        }

        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.UPSTREAM_ERROR,
          details: responseText,
        });
      }

      const created = JSON.parse(responseText);
      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: Array.isArray(created) ? created[0] : created,
      });
    } catch (err) {
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: err.message || String(err),
      });
    }
  }

  if (req.method === 'GET') {
    // Require authentication for GET to respect RLS
    if (!userToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication required to fetch categories',
      });
    }

    try {
      // Fetch categories with site count using left join
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.CATEGORIES}?select=*,site_categories(count)`;
      const headers = buildHeaders(config.anonKey, userToken);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.UPSTREAM_ERROR,
          details: errorText,
        });
      }

      const raw = await response.json();
      // Flatten count: [{ ..., site_categories: [{ count: 5 }] }] → { ..., site_count: 5 }
      const data = raw.map(cat => {
        const count = cat.site_categories?.[0]?.count ?? 0;
        const { site_categories: _sc, ...rest } = cat;
        return { ...rest, site_count: count };
      });
      return res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (err) {
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: err.message || String(err),
      });
    }
  }

  return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
    success: false,
    error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
  });
}
