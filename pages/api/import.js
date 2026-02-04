/**
 * @fileoverview Import API endpoint for bulk site creation from JSON/CSV data
 * Processes import rows in chunks, creates missing categories/tags, and attaches relations
 */

// API Configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
};

// Error Messages
const ERROR_MESSAGES = {
  METHOD_NOT_ALLOWED: 'Method not allowed',
  MISSING_CONFIG: 'Supabase config missing',
  AUTH_REQUIRED: 'Authentication required for import',
  NO_ROWS: 'No rows provided',
  USER_ID_REQUIRED: 'userId is required',
  MISSING_URL: 'Missing URL',
  SITE_EXISTS: 'Site already exists',
};

// Default Configuration
const DEFAULT_CONFIG = {
  CHUNK_SIZE: 200,
  MIN_CHUNK_SIZE: 50,
  CATEGORY_COLOR: '#6CBBFB',
  TAG_COLOR: '#D98BAC',
};

// Response Field Names
const RESPONSE_FIELDS = {
  SUCCESS: 'success',
  ERROR: 'error',
  REPORT: 'report',
};

/**
 * Get Supabase environment configuration
 * @returns {Object} Configuration object with URL and keys
 */
function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };
}

/**
 * Extract user JWT token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} User token or null
 */
function extractUserToken(headers) {
  const authHeader = headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

/**
 * Validate import request data
 * @param {Object} payload - Request body payload
 * @returns {Object} Validation result with isValid flag and error message
 */
function validateImportRequest(payload, userToken) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const userId = payload.userId;

  if (!userToken) {
    return { isValid: false, error: ERROR_MESSAGES.AUTH_REQUIRED, status: HTTP_STATUS.UNAUTHORIZED };
  }
  if (!rows.length) {
    return { isValid: false, error: ERROR_MESSAGES.NO_ROWS, status: HTTP_STATUS.BAD_REQUEST };
  }
  if (!userId) {
    return { isValid: false, error: ERROR_MESSAGES.USER_ID_REQUIRED, status: HTTP_STATUS.BAD_REQUEST };
  }

  return { isValid: true, rows, userId };
}

/**
 * Calculate chunk size from payload or use default
 * @param {number} requestedChunkSize - Chunk size from request
 * @returns {number} Validated chunk size
 */
function calculateChunkSize(requestedChunkSize) {
  if (requestedChunkSize && Number.isFinite(Number(requestedChunkSize))) {
    return Math.max(DEFAULT_CONFIG.MIN_CHUNK_SIZE, Number(requestedChunkSize));
  }
  return DEFAULT_CONFIG.CHUNK_SIZE;
}

/**
 * Normalize string value by trimming whitespace
 * @param {*} value - Value to normalize
 * @returns {string} Normalized string
 */
function normalizeString(value) {
  return (value || '').toString().trim();
}

/**
 * Split comma/semicolon/pipe/newline-separated string into array
 * @param {*} value - Value to split
 * @returns {Array<string>} Array of normalized strings
 */
function splitDelimitedString(value) {
  if (!value && value !== 0) return [];
  return value.toString()
    .split(/[,;|\n]+/)
    .map(x => normalizeString(x))
    .filter(Boolean);
}

/**
 * Fetch JSON from URL with error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with ok, status, body, and json
 */
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      body: text,
      json: response.ok ? JSON.parse(text) : null
    };
  } catch (e) {
    return {
      ok: response.ok,
      status: response.status,
      body: text,
      json: null
    };
  }
}

/**
 * Build Supabase REST API headers
 * @param {string} apiKey - Supabase API key
 * @param {string} token - Authorization token
 * @param {boolean} includePrefer - Include Prefer header
 * @returns {Object} Headers object
 */
function buildSupabaseHeaders(apiKey, token, includePrefer = false) {
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (includePrefer) {
    headers.Prefer = 'return=representation';
  }

  return headers;
}

/**
 * Build Supabase REST API URL
 * @param {string} baseUrl - Supabase base URL
 * @param {string} endpoint - API endpoint
 * @returns {string} Full URL
 */
function buildSupabaseUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/$/, '')}/rest/v1/${endpoint}`;
}

export default async function handler(req, res) {


  // Validate HTTP method
  if (req.method !== 'POST') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
      [RESPONSE_FIELDS.SUCCESS]: false,
      [RESPONSE_FIELDS.ERROR]: ERROR_MESSAGES.METHOD_NOT_ALLOWED
    });
  }

  // Get configuration
  const config = getSupabaseConfig();
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY } = config;
  const REL_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  // Extract user token
  const userToken = extractUserToken(req.headers);

  // Validate Supabase configuration
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      [RESPONSE_FIELDS.SUCCESS]: false,
      [RESPONSE_FIELDS.ERROR]: ERROR_MESSAGES.MISSING_CONFIG
    });
  }

  const KEY = userToken;

  // Parse and validate request
  const payload = req.body || {};
  const validation = validateImportRequest(payload, userToken);

  if (!validation.isValid) {
    return res.status(validation.status).json({
      [RESPONSE_FIELDS.SUCCESS]: false,
      [RESPONSE_FIELDS.ERROR]: validation.error
    });
  }

  const { rows, userId } = validation;


  const options = payload.options || { createMissing: true };
  const chunkSize = calculateChunkSize(payload.chunkSize);

  // Caching lookups inside import
  const catNameToObj = new Map(); // name -> {id,name}
  const tagNameToObj = new Map();

  const report = { created: [], attached: [], skipped: [], errors: [] };

  /**
   * Preload existing categories and tags to reduce roundtrips
   * @returns {Promise<void>}
   */
  async function preloadCategoriesAndTags() {
    try {
      const categoriesUrl = buildSupabaseUrl(SUPABASE_URL, `categories?select=id,name&user_id=eq.${userId}`);
      const catRes = await fetch(categoriesUrl, {
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY)
      });

      if (catRes.ok) {
        const cats = await catRes.json();
        (cats || []).forEach(c =>
          catNameToObj.set((c.name || '').toLowerCase(), c)
        );
      }
    } catch (e) {
      // Silently continue
    }

    try {
      const tagsUrl = buildSupabaseUrl(SUPABASE_URL, `tags?select=id,name&user_id=eq.${userId}`);
      const tagRes = await fetch(tagsUrl, {
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY)
      });

      if (tagRes.ok) {
        const tags = await tagRes.json();
        (tags || []).forEach(t =>
          tagNameToObj.set((t.name || '').toLowerCase(), t)
        );
      }
    } catch (e) {
      // Silently continue
    }
  }

  /**
   * Create category if missing and cache it
   * @param {string} name - Category name
   * @returns {Promise<Object|null>} Category object or null
   */
  async function ensureCategoryByName(name) {
    const key = (name || '').toLowerCase();

    if (catNameToObj.has(key)) {
      return catNameToObj.get(key);
    }

    if (!options.createMissing) {
      return null;
    }

    try {
      const url = buildSupabaseUrl(SUPABASE_URL, 'categories');
      const response = await fetch(url, {
        method: 'POST',
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY, true),
        body: JSON.stringify({
          name: name,
          color: DEFAULT_CONFIG.CATEGORY_COLOR,
          user_id: userId
        })
      });

      const text = await response.text();

      if (response.ok) {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) {
          catNameToObj.set(key, json[0]);
          return json[0];
        }
      }

      // If not ok, try to lookup (maybe created concurrently or already exists)
      const lookupUrl = buildSupabaseUrl(
        SUPABASE_URL,
        `categories?select=id,name&name=eq.${encodeURIComponent(name)}&user_id=eq.${userId}`
      );

      const lookupRes = await fetch(lookupUrl, {
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY)
      });

      if (lookupRes.ok) {
        const lookupJson = await lookupRes.json();

        if (Array.isArray(lookupJson) && lookupJson.length > 0) {
          catNameToObj.set(key, lookupJson[0]);
          return lookupJson[0];
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Create tag if missing and cache it
   * @param {string} name - Tag name
   * @returns {Promise<Object|null>} Tag object or null
   */
  async function ensureTagByName(name) {
    const key = (name || '').toLowerCase();

    if (tagNameToObj.has(key)) {
      return tagNameToObj.get(key);
    }

    if (!options.createMissing) {
      return null;
    }

    try {
      const url = buildSupabaseUrl(SUPABASE_URL, 'tags');
      const response = await fetch(url, {
        method: 'POST',
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY, true),
        body: JSON.stringify({
          name: name,
          color: DEFAULT_CONFIG.TAG_COLOR,
          user_id: userId
        })
      });

      const text = await response.text();

      if (response.ok) {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) {
          tagNameToObj.set(key, json[0]);
          return json[0];
        }
      }

      // NOTE: Try lookup with user_id filter
      const lookupUrl = buildSupabaseUrl(
        SUPABASE_URL,
        `tags?select=id,name&name=eq.${encodeURIComponent(name)}&user_id=eq.${userId}`
      );
      const lookup = await fetchJson(lookupUrl, {
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY)
      });

      if (lookup.ok && Array.isArray(lookup.json) && lookup.json.length > 0) {
        tagNameToObj.set(key, lookup.json[0]);
        return lookup.json[0];
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check existing sites by URLs
   * @param {Array<string>} urls - Array of URLs to check
   * @returns {Promise<Object>} Map of URL to site object
   */
  async function lookupSitesByUrls(urls) {
    const unique = Array.from(new Set(urls.map(u => (u || '').trim()))).filter(Boolean);
    if (unique.length === 0) return {};

    const BATCH_SIZE = 50;
    const out = {};

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const inList = batch.map(u => `"${encodeURIComponent(u)}"`).join(',');
      const url = buildSupabaseUrl(SUPABASE_URL, `sites?select=*&url=in.(${inList})&user_id=eq.${userId}`);

      const response = await fetch(url, {
        headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY)
      });

      if (!response.ok) {
        continue;
      }

      const json = await response.json();

      (json || []).forEach(s => {
        if (s && s.url) out[(s.url || '').trim()] = s;
      });
    }

    return out;
  }

  /**
   * Insert sites in batch
   * @param {Array<Object>} rowsToInsert - Rows to insert
   * @returns {Promise<Array<Object>>} Created sites
   */
  async function insertSitesBatch(rowsToInsert) {
    if (!rowsToInsert || rowsToInsert.length === 0) return [];

    const url = buildSupabaseUrl(SUPABASE_URL, 'sites');
    const response = await fetch(url, {
      method: 'POST',
      headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY, true),
      body: JSON.stringify(rowsToInsert)
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Insert failed: ${text}`);

    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json ? [json] : []);
  }

  /**
   * Attach categories to sites in batch
   * @param {Array<Object>} rows - Relation rows to insert
   * @returns {Promise<void>}
   */
  async function attachSiteCategories(rows) {
    if (!rows || rows.length === 0) {
      return;
    }

    const url = buildSupabaseUrl(SUPABASE_URL, 'site_categories');
    await fetch(url, {
      method: 'POST',
      headers: buildSupabaseHeaders(REL_KEY, REL_KEY),
      body: JSON.stringify(rows)
    });
  }

  /**
   * Attach tags to sites in batch
   * @param {Array<Object>} rows - Relation rows to insert
   * @returns {Promise<void>}
   */
  async function attachSiteTags(rows) {
    if (!rows || rows.length === 0) {
      return;
    }

    const url = buildSupabaseUrl(SUPABASE_URL, 'site_tags');
    await fetch(url, {
      method: 'POST',
      headers: buildSupabaseHeaders(REL_KEY, REL_KEY),
      body: JSON.stringify(rows)
    });
  }

  /**
   * Normalize import row data
   * @param {Object} row - Raw import row
   * @param {number} index - Row index
   * @returns {Object} Normalized row
   */
  function normalizeImportRow(row, index) {
    // Handle categories - prioritize categories_array (from export format)
    let categories = [];
    if (Array.isArray(row.categories_array)) {
      // Export format with full objects
      categories = row.categories_array.map(c => c?.name || '').filter(Boolean);
    } else if (typeof row.categories === 'string') {
      categories = splitDelimitedString(row.categories);
    } else if (Array.isArray(row.categories)) {
      categories = row.categories.map(c => typeof c === 'string' ? c : c?.name || '').filter(Boolean);
    } else if (row.category) {
      categories = splitDelimitedString(row.category || row.Category || '');
    }

    // Handle tags - prioritize tags_array (from export format)
    let tags = [];
    if (Array.isArray(row.tags_array)) {
      // Export format with full objects
      tags = row.tags_array.map(t => t?.name || '').filter(Boolean);
    } else if (typeof row.tags === 'string') {
      tags = splitDelimitedString(row.tags);
    } else if (Array.isArray(row.tags)) {
      tags = row.tags.map(t => typeof t === 'string' ? t : t?.name || '').filter(Boolean);
    } else if (row.tag) {
      tags = splitDelimitedString(row.tag || row.Tag || '');
    }

    return {
      _origIndex: index,
      name: normalizeString(row.name || row.title || row.Name || ''),
      url: normalizeString(row.url || row.URL || row.link || ''),
      pricing: normalizeString(row.pricing || row.pricing_model || row.pricingModel || '') || null,
      categories: categories,
      tags: tags,
      is_favorite: row.is_favorite === true || row.is_favorite === 'true' || row.is_favorite === 1 || false,
      is_pinned: row.is_pinned === true || row.is_pinned === 'true' || row.is_pinned === 1 || false,
      created_at: row.created_at || row.createdAt || null
    };
  }

  try {
    await preloadCategoriesAndTags();

    // Process in chunks
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      // Normalize rows
      const normRows = chunk.map((r, idx) => normalizeImportRow(r, i + idx));

      // Lookup existing sites by URL
      const urls = normRows.map(r => r.url).filter(Boolean);
      const existingSites = await lookupSitesByUrls(urls);

      // Prepare lists for creation and update
      const toCreateSites = [];
      const toUpdateSites = [];

      for (const nr of normRows) {
        if (!nr.url) {
          report.errors.push({ row: nr._origIndex, error: ERROR_MESSAGES.MISSING_URL });
          continue;
        }

        // Ensure categories/tags exist
        const cats = [];
        for (const cname of nr.categories) {
          const c = await ensureCategoryByName(cname);
          if (c) {
            cats.push(c);
          }
        }

        const tags = [];
        for (const tname of nr.tags) {
          const t = await ensureTagByName(tname);
          if (t) {
            tags.push(t);
          }
        }

        if (existingSites[nr.url]) {
          // Site exists - prepare for update
          toUpdateSites.push({
            nr,
            cats,
            tags,
            existingSite: existingSites[nr.url]
          });
        } else {
          // New site - prepare for creation
          toCreateSites.push({ nr, cats, tags });
        }
      }

      // Insert new sites in batch
      const siteInserts = toCreateSites.map(x => ({
        name: x.nr.name || '',
        url: x.nr.url,
        pricing: x.nr.pricing || null,
        is_favorite: x.nr.is_favorite || false,
        is_pinned: x.nr.is_pinned || false,
        created_at: x.nr.created_at || null,
        user_id: userId,
        categories: x.cats.map(c => c.name),
        tags: x.tags.map(t => t.name)
      }));

      let createdSites = [];
      try {
        createdSites = await insertSitesBatch(siteInserts);
      } catch (err) {
        // Fallback: try single inserts to get per-row errors
        for (let j = 0; j < siteInserts.length; j++) {
          const s = siteInserts[j];
          try {
            const created = await insertSitesBatch([s]);
            if (created && created.length > 0) createdSites.push(created[0]);
          } catch (e) {
            const origIndex = toCreateSites[j] && toCreateSites[j].nr && toCreateSites[j].nr._origIndex;
            report.errors.push({ row: origIndex, error: e.message });
          }
        }
      }

      // Update existing sites
      const updatedSites = [];
      for (const updateItem of toUpdateSites) {
        const { nr, cats, tags, existingSite } = updateItem;
        try {
          const updateUrl = buildSupabaseUrl(SUPABASE_URL, `sites?id=eq.${existingSite.id}&user_id=eq.${userId}`);
          const updateBody = {
            name: nr.name || existingSite.name,
            pricing: nr.pricing || existingSite.pricing,
            is_favorite: nr.is_favorite,
            is_pinned: nr.is_pinned,
            categories: cats.map(c => c.name),
            tags: tags.map(t => t.name)
          };

          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY, true),
            body: JSON.stringify(updateBody)
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            report.errors.push({ row: nr._origIndex, error: `Update failed: ${errorText}` });
          } else {
            const updatedArray = await updateResponse.json();
            const updated = updatedArray && updatedArray[0];
            if (updated) {
              updatedSites.push({ site: updated, ctx: updateItem });
              report.updated = report.updated || [];
              report.updated.push({ row: nr._origIndex, site: updated });
            }
          }
        } catch (err) {
          report.errors.push({ row: nr._origIndex, error: err.message });
        }
      }

      // Attach relations for new sites
      const scRows = [];
      const stRows = [];

      for (let k = 0; k < createdSites.length; k++) {
        const site = createdSites[k];
        const ctx = toCreateSites[k];

        if (!site || !site.id) {
          continue;
        }

        // Categories
        (ctx.cats || []).forEach(c => scRows.push({ site_id: site.id, category_id: c.id }));
        // Tags
        (ctx.tags || []).forEach(t => stRows.push({ site_id: site.id, tag_id: t.id }));

        report.created.push({ row: ctx.nr._origIndex, site });
      }

      // Update relations for existing sites
      for (const { site, ctx } of updatedSites) {
        if (!site || !site.id) continue;

        // Remove old relations
        try {
          const deleteCatsUrl = buildSupabaseUrl(SUPABASE_URL, `site_categories?site_id=eq.${site.id}`);
          await fetch(deleteCatsUrl, {
            method: 'DELETE',
            headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, REL_KEY)
          });

          const deleteTagsUrl = buildSupabaseUrl(SUPABASE_URL, `site_tags?site_id=eq.${site.id}`);
          await fetch(deleteTagsUrl, {
            method: 'DELETE',
            headers: buildSupabaseHeaders(SUPABASE_ANON_KEY, REL_KEY)
          });
        } catch (err) {
          // Continue anyway
        }

        // Add new relations
        (ctx.cats || []).forEach(c => scRows.push({ site_id: site.id, category_id: c.id }));
        (ctx.tags || []).forEach(t => stRows.push({ site_id: site.id, tag_id: t.id }));
      }

      try {
        await attachSiteCategories(scRows);
      } catch (e) {
        // Continue anyway
      }

      try {
        await attachSiteTags(stRows);
      } catch (e) {
        // Continue anyway
      }
    }

    return res.status(HTTP_STATUS.OK).json({
      [RESPONSE_FIELDS.SUCCESS]: true,
      [RESPONSE_FIELDS.REPORT]: report
    });
  } catch (err) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      [RESPONSE_FIELDS.SUCCESS]: false,
      [RESPONSE_FIELDS.ERROR]: err.message || String(err)
    });
  }
}
