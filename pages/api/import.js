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
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
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
 * Valid pricing values matching DB CHECK constraint:
 * pricing TEXT CHECK (pricing IN ('fully_free', 'freemium', 'free_trial', 'paid'))
 */
const VALID_PRICING_SET = new Set(['fully_free', 'freemium', 'free_trial', 'paid']);
const PRICING_ALIASES = {
  'fully_free': 'fully_free', 'fullyfree': 'fully_free', 'free': 'fully_free', 'besplatno': 'fully_free',
  'freemium': 'freemium',
  'free_trial': 'free_trial', 'freetrial': 'free_trial', 'trial': 'free_trial',
  'paid': 'paid', 'nesto_se_placa': 'paid', 'nestoseplaca': 'paid', 'placeno': 'paid', 'premium': 'paid',
};

function normalizePricingValue(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  if (!s) return null;
  if (VALID_PRICING_SET.has(s)) return s;
  const w = s.replace(/[\s-]+/g, '_');
  if (PRICING_ALIASES[w]) return PRICING_ALIASES[w];
  const f = s.replace(/[\s_-]+/g, '');
  if (PRICING_ALIASES[f]) return PRICING_ALIASES[f];
  if (/trial/i.test(s)) return 'free_trial';
  if (/freemium/i.test(s)) return 'freemium';
  if (/paid|premium|plac|money|cost/i.test(s)) return 'paid';
  if (/free|besplatn|gratis/i.test(s)) return 'fully_free';
  return null;
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
  const importSource = payload.importSource || 'manual';

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
   * @param {string|null} color - Category color from export
   * @returns {Promise<Object|null>} Category object or null
   */
  async function ensureCategoryByName(name, color = null) {
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
          color: color || DEFAULT_CONFIG.CATEGORY_COLOR,
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
   * @param {string|null} color - Tag color from export
   * @returns {Promise<Object|null>} Tag object or null
   */
  async function ensureTagByName(name, color = null) {
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
          color: color || DEFAULT_CONFIG.TAG_COLOR,
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
      // Export format with full objects - preserve name and color
      categories = row.categories_array.map(c => ({
        name: c?.name || '',
        color: c?.color || null
      })).filter(c => c.name);
    } else if (typeof row.categories === 'string') {
      categories = splitDelimitedString(row.categories).map(name => ({ name, color: null }));
    } else if (Array.isArray(row.categories)) {
      categories = row.categories.map(c => {
        if (typeof c === 'string') return { name: c, color: null };
        return { name: c?.name || '', color: c?.color || null };
      }).filter(c => c.name);
    } else if (row.category) {
      categories = splitDelimitedString(row.category || row.Category || '').map(name => ({ name, color: null }));
    }

    // Handle tags - prioritize tags_array (from export format)
    let tags = [];
    if (Array.isArray(row.tags_array)) {
      // Export format with full objects - preserve name and color
      tags = row.tags_array.map(t => ({
        name: t?.name || '',
        color: t?.color || null
      })).filter(t => t.name);
    } else if (typeof row.tags === 'string') {
      tags = splitDelimitedString(row.tags).map(name => ({ name, color: null }));
    } else if (Array.isArray(row.tags)) {
      tags = row.tags.map(t => {
        if (typeof t === 'string') return { name: t, color: null };
        return { name: t?.name || '', color: t?.color || null };
      }).filter(t => t.name);
    } else if (row.tag) {
      tags = splitDelimitedString(row.tag || row.Tag || '').map(name => ({ name, color: null }));
    }

    return {
      _origIndex: index,
      name: normalizeString(row.name || row.title || row.Name || ''),
      url: normalizeString(row.url || row.URL || row.link || ''),
      pricing: normalizePricingValue(row.pricing || row.pricing_model || row.pricingModel || '') || 'freemium',
      categories: categories,
      tags: tags,
      is_favorite: row.is_favorite === true || row.is_favorite === 'true' || row.is_favorite === 1 || false,
      is_pinned: row.is_pinned === true || row.is_pinned === 'true' || row.is_pinned === 1 || false,
      created_at: row.created_at || row.createdAt || null
    };
  }

  try {
    await preloadCategoriesAndTags();

    // ── Tier limit check ──────────────────────────────────────────────────
    // Decode JWT to resolve tier, then enforce limits on import size
    const TIER_LIMITS = {
      free: { sites: 500, categories: 50, tags: 200 },
      pro: { sites: 2000, categories: 200, tags: 500 },
      promax: { sites: Infinity, categories: Infinity, tags: Infinity },
    };

    let tier = 'free';
    try {
      const jwtPayload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString('utf8'));
      const meta = jwtPayload?.user_metadata || {};
      tier = meta.tier || (meta.is_pro ? 'pro' : 'free');
      const userEmail = jwtPayload?.email || '';
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (adminEmails.includes(userEmail.toLowerCase())) tier = 'promax';
    } catch { /* keep free */ }

    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Current counts
    const currentSitesCount = await (async () => {
      try {
        const url = buildSupabaseUrl(SUPABASE_URL, `sites?select=id&user_id=eq.${userId}`);
        const r = await fetch(url, { headers: { ...buildSupabaseHeaders(SUPABASE_ANON_KEY, KEY), 'Prefer': 'count=exact', 'Range': '0-0' } });
        const range = r.headers.get('content-range');
        if (range) { const m = range.match(/\/(\d+)/); if (m) return parseInt(m[1], 10); }
        return 0;
      } catch { return 0; }
    })();
    const currentCatsCount = catNameToObj.size;
    const currentTagsCount = tagNameToObj.size;

    const sitesRemaining = limits.sites === Infinity ? Infinity : Math.max(0, limits.sites - currentSitesCount);
    const catsRemaining = limits.categories === Infinity ? Infinity : Math.max(0, limits.categories - currentCatsCount);
    const tagsRemaining = limits.tags === Infinity ? Infinity : Math.max(0, limits.tags - currentTagsCount);

    // If no sites can be imported, return structured tier-limited response
    if (sitesRemaining === 0) {
      const tierLabel = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
      const upgradeTarget = tier === 'free' ? 'Pro or Pro Max' : 'Pro Max';
      return res.status(HTTP_STATUS.OK).json({
        [RESPONSE_FIELDS.SUCCESS]: true,
        [RESPONSE_FIELDS.REPORT]: {
          created: [],
          updated: [],
          skipped: [],
          errors: [],
          tierLimited: true,
          siteLimitReached: true,
          tierLabel,
          tierMessage: `Site limit reached (${currentSitesCount}/${limits.sites}). You are on the ${tierLabel} plan. Upgrade to ${upgradeTarget} for more.`
        }
      });
    }

    // Don't pre-trim rows — process all and limit only actual NEW site creations
    // (duplicates/updates don't consume slots)
    let importRows = rows;
    // ── End tier limit check ──────────────────────────────────────────────

    // ── Pre-create ALL categories & tags in parallel before chunk loop ──
    // This avoids sequential HTTP calls inside the loop (the #1 timeout cause).
    const allNormRows = importRows.map((r, idx) => normalizeImportRow(r, idx));

    // Collect unique category/tag names from ALL rows
    const allCatInfos = new Map(); // key → {name, color}
    const allTagInfos = new Map();
    for (const nr of allNormRows) {
      for (const c of nr.categories) {
        const key = (c.name || '').toLowerCase();
        if (key && !allCatInfos.has(key)) allCatInfos.set(key, c);
      }
      for (const t of nr.tags) {
        const key = (t.name || '').toLowerCase();
        if (key && !allTagInfos.has(key)) allTagInfos.set(key, t);
      }
    }

    // Filter out already-cached, then create in parallel batches
    const PARALLEL_LIMIT = 15;

    const allNewCats = Array.from(allCatInfos.values())
      .filter(c => !catNameToObj.has((c.name || '').toLowerCase()));
    const newCats = allNewCats.slice(0, catsRemaining === Infinity ? undefined : catsRemaining);
    const trimmedCats = allNewCats.length - newCats.length;
    for (let p = 0; p < newCats.length; p += PARALLEL_LIMIT) {
      const batch = newCats.slice(p, p + PARALLEL_LIMIT);
      await Promise.all(batch.map(c => ensureCategoryByName(c.name, c.color)));
    }

    const allNewTags = Array.from(allTagInfos.values())
      .filter(t => !tagNameToObj.has((t.name || '').toLowerCase()));
    const newTags = allNewTags.slice(0, tagsRemaining === Infinity ? undefined : tagsRemaining);
    const trimmedTags = allNewTags.length - newTags.length;
    for (let p = 0; p < newTags.length; p += PARALLEL_LIMIT) {
      const batch = newTags.slice(p, p + PARALLEL_LIMIT);
      await Promise.all(batch.map(t => ensureTagByName(t.name, t.color)));
    }

    // Track how many categories & tags were actually created in this chunk
    report.categoriesCreated = newCats.length;
    report.tagsCreated = newTags.length;
    // ── All categories & tags now cached — chunk loop needs no HTTP calls ──

    // Process in chunks
    let newSitesCreated = 0; // Track actual new creations across chunks
    let skippedDueToLimit = 0; // Track skipped new sites due to tier limit
    for (let i = 0; i < importRows.length; i += chunkSize) {
      const chunk = importRows.slice(i, i + chunkSize);

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

        // Resolve categories/tags from cache (already created above)
        const cats = nr.categories
          .map(catInfo => catNameToObj.get((catInfo.name || '').toLowerCase()))
          .filter(Boolean);

        const tags = nr.tags
          .map(tagInfo => tagNameToObj.get((tagInfo.name || '').toLowerCase()))
          .filter(Boolean);

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

      // Enforce tier limit on new site creations (updates always allowed)
      let skippedInChunk = 0;
      if (sitesRemaining !== Infinity) {
        const slotsLeft = Math.max(0, sitesRemaining - newSitesCreated);
        if (toCreateSites.length > slotsLeft) {
          skippedInChunk = toCreateSites.length - slotsLeft;
          skippedDueToLimit += skippedInChunk;
          toCreateSites.length = slotsLeft; // trim to available slots
        }
      }

      // Insert new sites in batch
      // NOTE: Do NOT include 'categories' or 'tags' here — they conflict with
      // PostgREST's resource embedding (site_categories/site_tags junction tables).
      // Relations are attached separately via attachSiteCategories/attachSiteTags.
      const siteInserts = toCreateSites.map(x => {
        const row = {
          name: x.nr.name || x.nr.url || '',
          url: x.nr.url,
          pricing: x.nr.pricing || 'freemium',
          is_favorite: x.nr.is_favorite || false,
          is_pinned: x.nr.is_pinned || false,
          user_id: userId,
          import_source: importSource
        };
        // Only include created_at when it has a value — sending null overrides DB DEFAULT
        if (x.nr.created_at) row.created_at = x.nr.created_at;
        return row;
      });

      let createdSites = [];
      try {
        createdSites = await insertSitesBatch(siteInserts);
        newSitesCreated += createdSites.length;
      } catch (err) {
        // Fallback: try single inserts to get per-row errors
        for (let j = 0; j < siteInserts.length; j++) {
          const s = siteInserts[j];
          try {
            const created = await insertSitesBatch([s]);
            if (created && created.length > 0) {
              createdSites.push(created[0]);
              newSitesCreated++;
            }
          } catch (e) {
            const origIndex = toCreateSites[j] && toCreateSites[j].nr && toCreateSites[j].nr._origIndex;
            report.errors.push({ row: origIndex, error: e.message });
          }
        }
      }

      // Update existing sites
      const updatedSites = [];
      for (const updateItem of toUpdateSites) {
        const { nr, existingSite } = updateItem;
        try {
          const updateUrl = buildSupabaseUrl(SUPABASE_URL, `sites?id=eq.${existingSite.id}&user_id=eq.${userId}`);
          // NOTE: Do NOT include 'categories'/'tags' here — junction tables handle relations.
          const updateBody = {
            name: nr.name || existingSite.name,
            pricing: nr.pricing || existingSite.pricing,
            is_favorite: nr.is_favorite,
            is_pinned: nr.is_pinned
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

    // Add tier info to report
    if (skippedDueToLimit > 0 || trimmedCats > 0 || trimmedTags > 0) {
      const tierLabel = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
      const upgradeTarget = tier === 'free' ? 'Pro or Pro Max' : 'Pro Max';
      report.tierLimited = true;
      report.tierLabel = tierLabel;
      if (skippedDueToLimit > 0) report.siteLimitReached = true;

      // What was skipped due to limits
      const limitParts = [];
      if (skippedDueToLimit > 0) {
        report.skippedDueToLimit = skippedDueToLimit;
        report.sitesImported = newSitesCreated;
        report.sitesTotal = rows.length;
        limitParts.push(`${skippedDueToLimit} new site(s) skipped (${currentSitesCount + newSitesCreated}/${limits.sites})`);
      }
      if (trimmedCats > 0) {
        report.trimmedCategories = trimmedCats;
        limitParts.push(`${trimmedCats} categor${trimmedCats === 1 ? 'y' : 'ies'} skipped (${currentCatsCount}/${limits.categories})`);
      }
      if (trimmedTags > 0) {
        report.trimmedTags = trimmedTags;
        limitParts.push(`${trimmedTags} tag(s) skipped (${currentTagsCount}/${limits.tags})`);
      }

      report.tierMessage = `${tierLabel} plan limits reached: ${limitParts.join(', ')}. Upgrade to ${upgradeTarget} for more.`;
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
