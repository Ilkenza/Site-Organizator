/**
 * @fileoverview API endpoint for individual site operations (GET, PUT/PATCH, DELETE)
 * Handles site updates with category/tag relations and RLS-aware key selection
 */

// Constants
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
  METHOD_NOT_ALLOWED: 'Method not allowed',
  MISSING_ENV: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  UPSTREAM_ERROR: 'Upstream REST error',
  REFETCH_FAILED: 'Failed to refetch site',
};

const HEADERS = {
  ACCEPT: 'application/json',
  CONTENT_TYPE: 'application/json',
  PREFER_RETURN: 'return=representation',
};

const SUPABASE_TABLES = {
  SITES: 'sites',
  CATEGORIES: 'categories',
  TAGS: 'tags',
  SITE_CATEGORIES: 'site_categories',
  SITE_TAGS: 'site_tags',
};

const ALLOWED_SITE_FIELDS = ['name', 'url', 'pricing'];

const WARNING_MESSAGES = {
  NO_SERVICE_KEY: '[Sites/ID API] No service role key configured - falling back to anon key. Relation writes may be blocked by RLS.',
  OWNER_CHECK_FAILED: '[Sites/ID API] Owner check for relation updates failed:',
  RLS_BLOCKED: '[Sites/ID API] Relation insert likely blocked by RLS; REL_KEY type:',
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
    serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/^["']|["']$/g, ''),
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
 * Parse JWT token to extract user ID
 * @param {string} token - JWT token
 * @returns {string|null} User ID (sub claim) or null
 */
function parseTokenUserId(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload?.sub || null;
  } catch (e) {
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
 * Check if user is owner of site and return appropriate key for relations
 * @param {string} siteId - Site ID
 * @param {string} userToken - User JWT token
 * @param {Object} config - Supabase config
 * @returns {Promise<string>} Key to use for relation operations
 */
async function determineRelationKey(siteId, userToken, config) {
  if (!userToken || !siteId) return config.anonKey;

  try {
    const userId = parseTokenUserId(userToken);
    if (!userId) return config.anonKey;

    // Check if user owns the site
    const ownerUrl = `${config.url}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${siteId}&select=user_id`;
    const headers = buildHeaders(config.anonKey, userToken);
    const response = await fetch(ownerUrl, { headers });

    if (!response.ok) return config.anonKey;

    const rows = await response.json();
    const ownerId = rows?.[0]?.user_id;

    if (ownerId === userId && config.serviceKey) {
      return config.serviceKey;
    }

    if (ownerId === userId && !config.serviceKey) {
      console.warn(WARNING_MESSAGES.NO_SERVICE_KEY);
    }

    return config.anonKey;
  } catch (e) {
    console.warn(WARNING_MESSAGES.OWNER_CHECK_FAILED, e);
    return config.anonKey;
  }
}

/**
 * Fetch names for given IDs from a table
 * @param {Array<string>} ids - Array of IDs
 * @param {string} tableName - Table name
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - API key
 * @param {string} authToken - Auth token
 * @returns {Promise<Array<string>>} Array of names
 */
async function fetchNamesByIds(ids, tableName, baseUrl, apiKey, authToken) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const idsParam = ids.map(id => `"${id}"`).join(',');
  const url = `${baseUrl}/rest/v1/${tableName}?id=in.(${idsParam})&select=name`;
  const headers = buildHeaders(apiKey, authToken);

  const response = await fetch(url, { headers });
  if (!response.ok) return [];

  const data = await response.json();
  return data.map(item => item.name);
}

/**
 * Delete all relations for a site in a specific junction table
 * @param {string} siteId - Site ID
 * @param {string} tableName - Junction table name
 * @param {string} baseUrl - Supabase base URL
 * @param {string} relationKey - Key to use for deletion
 * @returns {Promise<Object|null>} Warning object if failed, null if success
 */
async function deleteRelations(siteId, tableName, baseUrl, relationKey) {
  const url = `${baseUrl}/rest/v1/${tableName}?site_id=eq.${siteId}`;
  const headers = buildHeaders(relationKey, relationKey);

  const response = await fetch(url, { method: 'DELETE', headers });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`Failed to delete ${tableName}:`, response.status, errText);
    return { stage: `delete_${tableName}`, status: response.status, details: errText };
  }
  return null;
}

/**
 * Insert relations for a site
 * @param {string} siteId - Site ID
 * @param {Array<string>} relationIds - Array of relation IDs
 * @param {string} tableName - Junction table name
 * @param {string} relationField - Field name for relation ID
 * @param {string} baseUrl - Supabase base URL
 * @param {string} relationKey - Key to use for insertion
 * @param {string} anonKey - Anon key for comparison
 * @returns {Promise<Object|null>} Warning object if failed, null if success
 */
async function insertRelations(siteId, relationIds, tableName, relationField, baseUrl, relationKey, anonKey) {
  if (relationIds.length === 0) return null;

  const payload = relationIds.map(relationId => ({
    site_id: siteId,
    [relationField]: relationId,
  }));

  const url = `${baseUrl}/rest/v1/${tableName}`;
  const headers = buildHeaders(relationKey, relationKey, true);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Failed to insert ${tableName}:`, response.status, errText);

    if (response.status === HTTP_STATUS.UNAUTHORIZED || (errText && errText.includes('42501'))) {
      console.warn(WARNING_MESSAGES.RLS_BLOCKED, relationKey === anonKey ? 'anon' : 'service');
      console.warn(`Upstream response for ${tableName} insert:`, errText);
    }

    return { stage: `insert_${tableName}`, status: response.status, details: errText };
  }
  return null;
}

/**
 * Update site relations (categories and tags)
 * @param {string} siteId - Site ID
 * @param {Array<string>} categoryIds - Category IDs
 * @param {Array<string>} tagIds - Tag IDs
 * @param {string} baseUrl - Supabase base URL
 * @param {string} relationKey - Key to use for relation operations
 * @param {string} anonKey - Anon key for comparison
 * @returns {Promise<Array>} Array of warnings
 */
async function updateSiteRelations(siteId, categoryIds, tagIds, baseUrl, relationKey, anonKey) {
  const warnings = [];

  // Update categories
  if (Array.isArray(categoryIds)) {
    try {
      const delWarning = await deleteRelations(siteId, SUPABASE_TABLES.SITE_CATEGORIES, baseUrl, relationKey);
      if (delWarning) warnings.push(delWarning);

      const insWarning = await insertRelations(
        siteId,
        categoryIds,
        SUPABASE_TABLES.SITE_CATEGORIES,
        'category_id',
        baseUrl,
        relationKey,
        anonKey
      );
      if (insWarning) warnings.push(insWarning);
    } catch (err) {
      console.error('Exception updating categories:', err);
      warnings.push({ stage: 'exception_update_categories', error: String(err) });
    }
  }

  // Update tags
  if (Array.isArray(tagIds)) {
    try {
      const delWarning = await deleteRelations(siteId, SUPABASE_TABLES.SITE_TAGS, baseUrl, relationKey);
      if (delWarning) warnings.push(delWarning);

      const insWarning = await insertRelations(
        siteId,
        tagIds,
        SUPABASE_TABLES.SITE_TAGS,
        'tag_id',
        baseUrl,
        relationKey,
        anonKey
      );
      if (insWarning) warnings.push(insWarning);
    } catch (err) {
      console.error('Exception updating tags:', err);
      warnings.push({ stage: 'exception_update_tags', error: String(err) });
    }
  }

  return warnings;
}

/**
 * Refetch site with all relations
 * @param {string} siteId - Site ID
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - API key
 * @param {string} authToken - Auth token
 * @returns {Promise<Object|null>} Complete site object or null
 */
async function refetchSiteWithRelations(siteId, baseUrl, apiKey, authToken) {
  const selectQuery = `*,categories_array:${SUPABASE_TABLES.SITE_CATEGORIES}(category:${SUPABASE_TABLES.CATEGORIES}(*)),tags_array:${SUPABASE_TABLES.SITE_TAGS}(tag:${SUPABASE_TABLES.TAGS}(*))`;
  const url = `${baseUrl}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${siteId}&select=${selectQuery}`;
  const headers = buildHeaders(apiKey, authToken);

  const response = await fetch(url, { headers });
  if (!response.ok) return null;

  const data = await response.json();
  const site = Array.isArray(data) ? data[0] : data;

  if (!site) return null;

  // Transform nested relations to flat format
  if (site.categories_array) {
    site.categories_array = site.categories_array.map(sc => sc.category).filter(Boolean);
  }
  if (site.tags_array) {
    site.tags_array = site.tags_array.map(st => st.tag).filter(Boolean);
  }

  return site;
}

/**
 * Filter request body to only allowed fields
 * @param {Object} body - Request body
 * @returns {Object} Filtered body with only allowed fields
 */
function filterAllowedFields(body) {
  const filtered = {};
  for (const key of ALLOWED_SITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      filtered[key] = body[key];
    }
  }
  filtered.updated_at = new Date().toISOString();
  return filtered;
}

// Main Handler

/**
 * Handler for individual site operations (GET, PUT/PATCH, DELETE)
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
  const { id } = req.query;

  // Get Supabase configuration
  const config = getSupabaseConfig();
  if (!config) {
    console.error('Missing env vars:', {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    });
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_ENV,
    });
  }

  // Extract user token
  const userToken = extractUserToken(req.headers.authorization);
  const authToken = userToken || config.anonKey;

  // Determine key to use for relation updates (service key if owner, anon key otherwise)
  const relationKey = await determineRelationKey(id, userToken, config);

  if (req.method === 'GET') {
    try {
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, authToken);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.UPSTREAM_ERROR,
          details: await response.text(),
        });
      }

      const rows = await response.json();
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: rows[0] || null,
      });
    } catch (err) {
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: err.message || String(err),
      });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const { category_ids, tag_ids, ...siteData } = body;

      // Filter to only allowed fields and add timestamp
      const filteredData = filterAllowedFields(siteData);

      // Fetch category and tag names from IDs
      const categoryNames = await fetchNamesByIds(
        category_ids,
        SUPABASE_TABLES.CATEGORIES,
        config.url,
        config.anonKey,
        relationKey
      );
      const tagNames = await fetchNamesByIds(
        tag_ids,
        SUPABASE_TABLES.TAGS,
        config.url,
        config.anonKey,
        relationKey
      );

      // Save names to sites table columns
      filteredData.categories = categoryNames;
      filteredData.tags = tagNames;

      // Update site
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, userToken, true, true);
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(filteredData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase PATCH error:', response.status, errorText);
        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.UPSTREAM_ERROR,
          status: response.status,
          details: errorText,
        });
      }

      // Update relations (categories and tags junction tables)
      const warnings = await updateSiteRelations(
        id,
        category_ids,
        tag_ids,
        config.url,
        relationKey,
        config.anonKey
      );

      // Refetch complete site with relations
      const completeSite = await refetchSiteWithRelations(
        id,
        config.url,
        config.anonKey,
        relationKey
      );

      if (completeSite) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          data: completeSite,
          warnings: warnings.length ? warnings : undefined,
        });
      } else {
        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.REFETCH_FAILED,
        });
      }
    } catch (err) {
      console.error('PUT/PATCH exception:', err);
      return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: err.message || String(err),
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Just delete the site — DB ON DELETE CASCADE cleans up site_categories & site_tags
      const url = `${config.url}/rest/v1/${SUPABASE_TABLES.SITES}?id=eq.${id}`;
      const headers = buildHeaders(config.anonKey, userToken);
      const response = await fetch(url, { method: 'DELETE', headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase DELETE error:', response.status, errorText);
        return res.status(HTTP_STATUS.BAD_GATEWAY).json({
          success: false,
          error: ERROR_MESSAGES.UPSTREAM_ERROR,
          status: response.status,
          details: errorText,
        });
      }

      return res.status(HTTP_STATUS.OK).json({ success: true });
    } catch (err) {
      console.error('DELETE exception:', err);
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
