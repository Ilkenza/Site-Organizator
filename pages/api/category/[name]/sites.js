/**
 * API route to get all sites in a category by category name
 * Handles fallback lookups (quoted, unquoted, ilike) and enriches with relations
 */

// Constants
const HTTP_STATUS = {
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
  ENV_MISSING: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  UPSTREAM_ERROR: 'Upstream REST error',
};

const LOOKUP_TYPES = {
  QUOTED: 'quoted',
  UNQUOTED: 'unquoted',
  ILIKE: 'ilike',
};

/**
 * Build Supabase REST API headers
 * @param {string} anonKey - Supabase anon key
 * @param {string} authToken - Auth token
 * @returns {Object} Headers object
 */
function buildHeaders(anonKey, authToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${authToken}`,
    Accept: 'application/json',
  };
}

/**
 * Fetch and parse JSON response
 * @param {string} url - URL to fetch
 * @param {Object} headers - Headers object
 * @returns {Promise<Object>} Parsed JSON or null
 */
async function fetchJson(url, headers) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * Try to find category by name using different lookup strategies
 * @param {string} baseUrl - Supabase base URL
 * @param {string} name - Category name
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} Result with categories and tried lookups
 */
async function findCategoryByName(baseUrl, name, headers) {
  const tried = [];
  let cats = null;

  // 1. Try quoted name (most reliable for special characters)
  const quotedName = `"${name}"`;
  const quotedUrl = `${baseUrl}/rest/v1/categories?select=id&name=eq.${encodeURIComponent(quotedName)}`;
  cats = await fetchJson(quotedUrl, headers);
  tried.push({ type: LOOKUP_TYPES.QUOTED, url: quotedUrl, rows: cats?.length || 0 });
  if (cats && cats.length > 0) return { cats, tried };

  // 2. Try unquoted
  const unquotedUrl = `${baseUrl}/rest/v1/categories?select=id&name=eq.${encodeURIComponent(name)}`;
  cats = await fetchJson(unquotedUrl, headers);
  tried.push({ type: LOOKUP_TYPES.UNQUOTED, url: unquotedUrl, rows: cats?.length || 0 });
  if (cats && cats.length > 0) return { cats, tried };

  // 3. Try case-insensitive ilike
  const ilikeUrl = `${baseUrl}/rest/v1/categories?select=id&name=ilike.${encodeURIComponent(name)}`;
  cats = await fetchJson(ilikeUrl, headers);
  tried.push({ type: LOOKUP_TYPES.ILIKE, url: ilikeUrl, rows: cats?.length || 0 });

  return { cats, tried };
}

/**
 * Enrich sites with categories and tags arrays
 * @param {Array} sites - Sites to enrich
 * @param {string} baseUrl - Supabase base URL
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} Enriched sites with debug info
 */
async function enrichSitesWithRelations(sites, baseUrl, headers) {
  if (!sites || sites.length === 0) {
    return { enriched: sites, debug: {} };
  }

  const siteIds = sites.map(s => s.id);
  const encodedInList = encodeURIComponent(siteIds.map(id => `"${id}"`).join(','));

  // Fetch site_categories with embedded categories
  const scUrl = `${baseUrl}/rest/v1/site_categories?select=*,category:categories(*)&site_id=in.(${encodedInList})`;
  const siteCategories = await fetchJson(scUrl, headers) || [];

  // Fetch site_tags with embedded tags
  const stUrl = `${baseUrl}/rest/v1/site_tags?select=*,tag:tags(*)&site_id=in.(${encodedInList})`;
  const siteTags = await fetchJson(stUrl, headers) || [];

  // Build maps
  const categoriesBySite = new Map();
  siteCategories.forEach(sc => {
    const arr = categoriesBySite.get(sc.site_id) || [];
    if (sc.category) arr.push(sc.category);
    categoriesBySite.set(sc.site_id, arr);
  });

  const tagsBySite = new Map();
  siteTags.forEach(st => {
    const arr = tagsBySite.get(st.site_id) || [];
    if (st.tag) arr.push(st.tag);
    tagsBySite.set(st.site_id, arr);
  });

  // Enrich sites
  const enriched = sites.map(site => {
    const catsFromLinks = categoriesBySite.get(site.id) || [];
    const tagsFromLinks = tagsBySite.get(site.id) || [];

    const rawCats = site.categories_array || site.categories || catsFromLinks;
    const normalizedCats = (Array.isArray(rawCats) ? rawCats : [])
      .map(c => typeof c === 'string' ? { name: c } : c);

    const rawTags = site.tags_array || site.tags || tagsFromLinks;
    const normalizedTags = (Array.isArray(rawTags) ? rawTags : [])
      .map(t => typeof t === 'string' ? { name: t } : t);

    return {
      ...site,
      categories_array: normalizedCats,
      tags_array: normalizedTags,
    };
  });

  return {
    enriched,
    debug: {
      siteCategoriesCount: siteCategories.length,
      siteTagsCount: siteTags.length,
      siteIds,
      sitesCount: enriched.length,
    },
  };
}

export default async function handler(req, res) {
  const { name } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.ENV_MISSING,
    });
  }

  // Use user's token for RLS, fallback to anon key
  const authToken = userToken || SUPABASE_ANON_KEY;
  const baseUrl = SUPABASE_URL.replace(/\/$/, '');
  const headers = buildHeaders(SUPABASE_ANON_KEY, authToken);

  try {
    // Find category by name
    const { cats, tried } = await findCategoryByName(baseUrl, name, headers);

    // If no category found, return empty with diagnostics
    if (!cats || cats.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: [],
        requestedName: name,
        tried,
      });
    }

    const categoryId = cats[0].id;

    // Get site IDs from site_categories junction table
    const scUrl = `${baseUrl}/rest/v1/site_categories?select=site_id&category_id=eq.${categoryId}`;
    const scResponse = await fetch(scUrl, { headers });

    if (!scResponse.ok) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        error: ERROR_MESSAGES.UPSTREAM_ERROR,
        details: await scResponse.text(),
      });
    }

    const scRows = await scResponse.json();
    const siteIds = scRows.map(r => r.site_id);

    if (!siteIds || siteIds.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: [],
        category: cats[0],
      });
    }

    // Fetch sites
    const encodedSiteIds = encodeURIComponent(siteIds.map(id => `"${id}"`).join(','));
    const sitesUrl = `${baseUrl}/rest/v1/sites?id=in.(${encodedSiteIds})&select=*`;
    const sitesResponse = await fetch(sitesUrl, { headers });

    if (!sitesResponse.ok) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        error: ERROR_MESSAGES.UPSTREAM_ERROR,
        details: await sitesResponse.text(),
      });
    }

    const sites = await sitesResponse.json();

    if (!sites || sites.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: [],
        category: cats[0],
        requestedName: name,
      });
    }

    // Enrich sites with categories and tags
    const { enriched, debug } = await enrichSitesWithRelations(sites, baseUrl, headers);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      category: cats[0],
      requestedName: name,
      data: enriched,
      debug,
    });
  } catch (err) {
    console.error('Error in category sites API:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message || String(err),
    });
  }
}
