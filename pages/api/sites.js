/**
 * @fileoverview API endpoint for sites collection management
 * Handles listing sites with pagination/search and creating new sites with relations
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502
};

// Error Messages
const ERROR_MESSAGES = {
  MISSING_ENV: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
  MISSING_FIELDS: 'Missing required fields: name, url, pricing',
  MISSING_USER: 'Missing user_id (you must be logged in to add a site)',
  SITE_EXISTS: 'Site already exists',
  UPSTREAM_ERROR: 'Upstream REST error'
};

// Configuration
const QUERY_CONFIG = {
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 500,
  DEFAULT_PAGE: 1,
  ALLOWED_POST_FIELDS: ['name', 'url', 'pricing', 'user_id']
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
 * Fetch category names by IDs
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} categoryIds - Category IDs
 * @returns {Promise<Array<string>>} Category names
 */
const fetchCategoryNames = async (baseUrl, anonKey, relKey, categoryIds) => {
  if (!categoryIds || categoryIds.length === 0) return [];

  const catIdsParam = categoryIds.map(id => `"${id}"`).join(',');
  const catUrl = `${baseUrl}/rest/v1/categories?id=in.(${catIdsParam})&select=name`;

  const catRes = await fetch(catUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${relKey}`,
      Accept: 'application/json'
    }
  });

  if (catRes.ok) {
    const cats = await catRes.json();
    return cats.map(c => c.name);
  }

  return [];
};

/**
 * Fetch tag names by IDs
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} tagIds - Tag IDs
 * @returns {Promise<Array<string>>} Tag names
 */
const fetchTagNames = async (baseUrl, anonKey, relKey, tagIds) => {
  if (!tagIds || tagIds.length === 0) return [];

  const tagIdsParam = tagIds.map(id => `"${id}"`).join(',');
  const tagUrl = `${baseUrl}/rest/v1/tags?id=in.(${tagIdsParam})&select=name`;

  const tagRes = await fetch(tagUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${relKey}`,
      Accept: 'application/json'
    }
  });

  if (tagRes.ok) {
    const tagsData = await tagRes.json();
    return tagsData.map(t => t.name);
  }

  return [];
};

/**
 * Filter body to only allowed fields
 * @param {Object} body - Request body
 * @param {Array<string>} categoryNames - Category names to add
 * @param {Array<string>} tagNames - Tag names to add
 * @returns {Object} Filtered body
 */
const filterAllowedFields = (body, categoryNames, tagNames) => {
  const filtered = {};
  for (const k of QUERY_CONFIG.ALLOWED_POST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      filtered[k] = body[k];
    }
  }
  filtered.categories = categoryNames;
  filtered.tags = tagNames;
  return filtered;
};

/**
 * Create a new site
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key (user token or anon)
 * @param {Object} siteData - Site data to insert
 * @returns {Promise<Object>} Created site
 */
const createSite = async (baseUrl, anonKey, authKey, siteData) => {
  const url = `${baseUrl}/rest/v1/sites`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${authKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(siteData)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text);
  }

  const created = JSON.parse(text);
  return Array.isArray(created) ? created[0] : created;
};

/**
 * Handle duplicate site error
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key
 * @param {string} siteUrl - Site URL to lookup
 * @param {string} errorText - Error text from failed insert
 * @returns {Promise<Object|null>} Existing site or null
 */
const handleDuplicateSite = async (baseUrl, anonKey, authKey, siteUrl, errorText) => {
  if (!siteUrl || !/duplicate|unique|violat|already exists|duplicate key/i.test(errorText)) {
    return null;
  }

  try {
    const lookupUrl = `${baseUrl}/rest/v1/sites?select=*&url=eq.${encodeURIComponent(siteUrl)}`;
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${authKey}`,
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
    console.warn('site duplicate lookup failed', err);
  }

  return null;
};

/**
 * Attach tag IDs to site via junction table
 * @param {string} baseUrl - Supabase base URL
 * @param {string} relKey - Service role key
 * @param {string} siteId - Site ID
 * @param {Array<string>} tagIds - Tag IDs
 * @returns {Promise<Object|null>} Warning object if failed, null otherwise
 */
const attachTags = async (baseUrl, relKey, siteId, tagIds) => {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return null;

  try {
    const stUrl = `${baseUrl}/rest/v1/site_tags`;
    const payload = tagIds.map(tag_id => ({ site_id: siteId, tag_id }));

    const stRes = await fetch(stUrl, {
      method: 'POST',
      headers: {
        apikey: relKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!stRes.ok) {
      const errText = await stRes.text();
      console.error('site_tags insert failed', stRes.status, errText);
      return { stage: 'site_tags_insert', status: stRes.status, details: errText };
    }
  } catch (err) {
    console.error('site_tags insert failed', err);
    return { stage: 'site_tags_insert', error: String(err) };
  }

  return null;
};

/**
 * Attach category IDs to site via junction table
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key
 * @param {string} relKey - Service role key
 * @param {string} siteId - Site ID
 * @param {Array<string>} categoryIds - Category IDs
 * @param {Array<string>} categoryNames - Category names (fallback)
 * @returns {Promise<Object|null>} Warning object if failed, null otherwise
 */
const attachCategories = async (baseUrl, anonKey, authKey, relKey, siteId, categoryIds, categoryNames) => {
  if (categoryIds.length > 0) {
    // Direct ID insertion
    try {
      const scUrl = `${baseUrl}/rest/v1/site_categories`;
      const toInsert = categoryIds.map(category_id => ({ site_id: siteId, category_id }));

      const scRes = await fetch(scUrl, {
        method: 'POST',
        headers: {
          apikey: relKey,
          Authorization: `Bearer ${relKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(toInsert)
      });

      if (!scRes.ok) {
        const errText = await scRes.text();
        console.error('site_categories insert failed', scRes.status, errText);
        return { stage: 'site_categories_insert', status: scRes.status, details: errText };
      }
    } catch (err) {
      console.error('site_categories insert failed', err);
      return { stage: 'site_categories_insert', error: String(err) };
    }
  } else if (categoryNames.length > 0) {
    // Resolve names to IDs first
    try {
      const encoded = categoryNames.map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
      const catUrl = `${baseUrl}/rest/v1/categories?select=id,name&name=in.(${encoded})`;

      const catRes = await fetch(catUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${authKey}`,
          Accept: 'application/json'
        }
      });

      if (catRes.ok) {
        const cats = await catRes.json();
        const nameToId = new Map(cats.map(c => [c.name, c.id]));
        const toInsert = [];

        categoryNames.forEach(name => {
          const cid = nameToId.get(name);
          if (cid) toInsert.push({ site_id: siteId, category_id: cid });
        });

        if (toInsert.length > 0) {
          const scUrl = `${baseUrl}/rest/v1/site_categories`;
          const scRes = await fetch(scUrl, {
            method: 'POST',
            headers: {
              apikey: relKey,
              Authorization: `Bearer ${relKey}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(toInsert)
          });

          if (!scRes.ok) {
            const errText = await scRes.text();
            console.error('site_categories insert failed', scRes.status, errText);
            return { stage: 'site_categories_insert', status: scRes.status, details: errText };
          }
        }
      }
    } catch (err) {
      console.warn('site_categories attach failed', err);
    }
  }

  return null;
};

/**
 * Refetch complete site with relations
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {string} siteId - Site ID
 * @returns {Promise<Object|null>} Complete site with relations or null
 */
const refetchCompleteSite = async (baseUrl, anonKey, relKey, siteId) => {
  try {
    const refetchUrl = `${baseUrl}/rest/v1/sites?id=eq.${siteId}&select=*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;

    const refetchRes = await fetch(refetchUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json'
      }
    });

    if (refetchRes.ok) {
      const refetchData = await refetchRes.json();
      const completeSite = Array.isArray(refetchData) ? refetchData[0] : refetchData;

      // Transform categories_array and tags_array to flat format
      if (completeSite?.categories_array) {
        completeSite.categories_array = completeSite.categories_array
          .map(sc => sc.category)
          .filter(Boolean);
      }
      if (completeSite?.tags_array) {
        completeSite.tags_array = completeSite.tags_array
          .map(st => st.tag)
          .filter(Boolean);
      }

      return completeSite;
    } else {
      console.warn('Failed to refetch complete site');
    }
  } catch (err) {
    console.warn('Refetch complete site failed:', err);
  }

  return null;
};

/**
 * Parse and validate pagination parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} Validated limit, page, and offset
 */
const parsePaginationParams = (query) => {
  let limit = query?.limit ? parseInt(query.limit, 10) : QUERY_CONFIG.DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) limit = QUERY_CONFIG.DEFAULT_LIMIT;
  if (limit > QUERY_CONFIG.MAX_LIMIT) limit = QUERY_CONFIG.MAX_LIMIT;

  let page = query?.page ? parseInt(query.page, 10) : QUERY_CONFIG.DEFAULT_PAGE;
  if (!Number.isFinite(page) || page <= 0) page = QUERY_CONFIG.DEFAULT_PAGE;

  const offset = (page - 1) * limit;

  return { limit, page, offset };
};

/**
 * Build sites list URL with filters
 * @param {string} baseUrl - Supabase base URL
 * @param {number} limit - Result limit
 * @param {number} offset - Result offset
 * @param {string|null} searchQuery - Search query
 * @returns {string} Complete URL
 */
const buildSitesListUrl = (baseUrl, limit, offset, searchQuery) => {
  let url = `${baseUrl}/rest/v1/sites?select=*`;
  url += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (searchQuery) {
    const qEsc = encodeURIComponent(searchQuery.replace(/%/g, '%25'));
    const orFilter = `or=(name.ilike.*${qEsc}*,url.ilike.*${qEsc}*)`;
    url += `&${orFilter}`;
  }

  return url;
};

/**
 * Fetch sites from Supabase
 * @param {string} url - Request URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key
 * @returns {Promise<Array>} Sites array
 */
const fetchSites = async (url, anonKey, authKey) => {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${authKey}`,
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
 * Fetch site categories with relations
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} siteIds - Site IDs
 * @returns {Promise<Object>} Categories data and debug info
 */
const fetchSiteCategories = async (baseUrl, anonKey, relKey, siteIds) => {
  const rawInList = siteIds.map(id => `"${id}"`).join(',');
  const encodedInList = encodeURIComponent(rawInList);
  const scUrl = `${baseUrl}/rest/v1/site_categories?select=*,category:categories(*)&site_id=in.(${encodedInList})`;

  let siteCategories = [];
  let scDebug = null;

  try {
    const scRes = await fetch(scUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json'
      }
    });

    const scText = await scRes.text();
    scDebug = {
      ok: scRes.ok,
      status: scRes.status,
      statusText: scRes.statusText,
      body: scText,
      url: scUrl
    };

    if (scRes.ok) {
      try {
        siteCategories = JSON.parse(scText);
      } catch (e) {
        siteCategories = [];
        scDebug.parseError = String(e);
      }
    } else {
      console.warn('site_categories fetch failed', scDebug);
    }
  } catch (err) {
    console.warn('site_categories fetch error', err);
    scDebug = { error: String(err) };
  }

  return { siteCategories, scDebug };
};

/**
 * Fetch site tags with relations
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} siteIds - Site IDs
 * @returns {Promise<Object>} Tags data and debug info
 */
const fetchSiteTags = async (baseUrl, anonKey, relKey, siteIds) => {
  const rawInList = siteIds.map(id => `"${id}"`).join(',');
  const encodedInList = encodeURIComponent(rawInList);
  const stUrl = `${baseUrl}/rest/v1/site_tags?select=*,tag:tags(*)&site_id=in.(${encodedInList})`;

  let siteTags = [];
  let stDebug = null;

  try {
    const stRes = await fetch(stUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json'
      }
    });

    const stText = await stRes.text();
    stDebug = {
      ok: stRes.ok,
      status: stRes.status,
      statusText: stRes.statusText,
      body: stText,
      url: stUrl
    };

    if (stRes.ok) {
      try {
        siteTags = JSON.parse(stText);
      } catch (e) {
        siteTags = [];
        stDebug.parseError = String(e);
      }
    } else {
      console.warn('site_tags fetch failed', stDebug);
    }
  } catch (err) {
    console.warn('site_tags fetch error', err);
    stDebug = { error: String(err) };
  }

  return { siteTags, stDebug };
};

/**
 * Build maps from site relations
 * @param {Array} siteCategories - Site categories data
 * @param {Array} siteTags - Site tags data
 * @returns {Object} Maps for categories and tags by site ID
 */
const buildRelationMaps = (siteCategories, siteTags) => {
  const categoriesBySite = new Map();
  (siteCategories || []).forEach(sc => {
    const arr = categoriesBySite.get(sc.site_id) || [];
    if (sc.category) arr.push(sc.category);
    categoriesBySite.set(sc.site_id, arr);
  });

  const tagsBySite = new Map();
  (siteTags || []).forEach(st => {
    const arr = tagsBySite.get(st.site_id) || [];
    if (st.tag) arr.push(st.tag);
    tagsBySite.set(st.site_id, arr);
  });

  return { categoriesBySite, tagsBySite };
};

/**
 * Collect category and tag names from sites
 * @param {Array} sites - Sites array
 * @returns {Object} Sets of category and tag names
 */
const collectNamesFromSites = (sites) => {
  const categoryNames = new Set();
  const tagNames = new Set();

  sites.forEach(site => {
    const rawCats = site.categories_array || site.categories || [];
    (Array.isArray(rawCats) ? rawCats : []).forEach(c => {
      if (typeof c === 'string' && c.trim()) categoryNames.add(c.trim());
    });

    const rawTags = site.tags_array || site.tags || [];
    (Array.isArray(rawTags) ? rawTags : []).forEach(t => {
      if (typeof t === 'string' && t.trim()) tagNames.add(t.trim());
    });
  });

  return { categoryNames, tagNames };
};

/**
 * Lookup category objects by names
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Set<string>} categoryNames - Category names
 * @returns {Promise<Map>} Map of name to category object
 */
const lookupCategoriesByNames = async (baseUrl, anonKey, relKey, categoryNames) => {
  const nameToCategory = new Map();

  if (categoryNames.size > 0) {
    const enc = Array.from(categoryNames)
      .map(n => encodeURIComponent(n.replace(/\)/g, '\\)')))
      .join(',');
    const catLookupUrl = `${baseUrl}/rest/v1/categories?select=id,name,color&name=in.(${enc})`;

    const catLookupRes = await fetch(catLookupUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json'
      }
    });

    if (catLookupRes.ok) {
      const catsFound = await catLookupRes.json();
      catsFound.forEach(c => nameToCategory.set(c.name, c));
    }
  }

  return nameToCategory;
};

/**
 * Lookup tag objects by names
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Set<string>} tagNames - Tag names
 * @returns {Promise<Map>} Map of name to tag object
 */
const lookupTagsByNames = async (baseUrl, anonKey, relKey, tagNames) => {
  const nameToTag = new Map();

  if (tagNames.size > 0) {
    const enc = Array.from(tagNames)
      .map(n => encodeURIComponent(n.replace(/\)/g, '\\)')))
      .join(',');
    const tagLookupUrl = `${baseUrl}/rest/v1/tags?select=id,name,color&name=in.(${enc})`;

    const tagLookupRes = await fetch(tagLookupUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${relKey}`,
        Accept: 'application/json'
      }
    });

    if (tagLookupRes.ok) {
      const tagsFound = await tagLookupRes.json();
      tagsFound.forEach(t => nameToTag.set(t.name, t));
    }
  }

  return nameToTag;
};

/**
 * Normalize and attach relations to sites
 * @param {Array} sites - Sites array
 * @param {Map} categoriesBySite - Categories by site ID
 * @param {Map} tagsBySite - Tags by site ID
 * @param {Map} nameToCategory - Category name to object map
 * @param {Map} nameToTag - Tag name to object map
 * @returns {Array} Sites with normalized relations
 */
const normalizeSiteRelations = (sites, categoriesBySite, tagsBySite, nameToCategory, nameToTag) => {
  return sites.map(site => {
    const catsFromLinks = categoriesBySite.get(site.id) || [];
    const tagsFromLinks = tagsBySite.get(site.id) || [];

    // Prioritize relational data over legacy text arrays
    const rawCats = catsFromLinks.length > 0
      ? catsFromLinks
      : (site.categories_array || site.categories || []);

    const normalizedCats = (Array.isArray(rawCats) ? rawCats : []).map(c => {
      if (typeof c === 'string') return nameToCategory.get(c) || { name: c };
      return c;
    });

    const rawTags = tagsFromLinks.length > 0
      ? tagsFromLinks
      : (site.tags_array || site.tags || []);

    const normalizedTags = (Array.isArray(rawTags) ? rawTags : []).map(t => {
      if (typeof t === 'string') return nameToTag.get(t) || { name: t };
      return t;
    });

    return Object.assign({}, site, {
      categories_array: normalizedCats,
      tags_array: normalizedTags
    });
  });
};

/**
 * Build debug counts object
 * @param {Array} sites - Sites array
 * @param {Array} siteCategories - Site categories
 * @param {Array} siteTags - Site tags
 * @param {Object} scDebug - Categories debug info
 * @param {Object} stDebug - Tags debug info
 * @returns {Object} Debug information
 */
const buildDebugCounts = (sites, siteCategories, siteTags, scDebug, stDebug) => {
  const siteCategoriesCount = Array.isArray(siteCategories) ? siteCategories.length : 0;
  const siteTagsCount = Array.isArray(siteTags) ? siteTags.length : 0;

  let scBodyCount = null;
  let stBodyCount = null;

  try {
    if (scDebug && typeof scDebug.body === 'string') {
      scBodyCount = JSON.parse(scDebug.body).length;
    }
  } catch (e) {
    scBodyCount = null;
  }

  try {
    if (stDebug && typeof stDebug.body === 'string') {
      stBodyCount = JSON.parse(stDebug.body).length;
    }
  } catch (e) {
    stBodyCount = null;
  }

  const countsMatch =
    (scBodyCount === null || scBodyCount === siteCategoriesCount) &&
    (stBodyCount === null || stBodyCount === siteTagsCount);

  if (!countsMatch) {
    console.warn('site counts mismatch', {
      siteCategoriesCount,
      scBodyCount,
      siteTagsCount,
      stBodyCount
    });
  }

  return {
    sitesCount: Array.isArray(sites) ? sites.length : 0,
    siteCategoriesCount,
    siteTagsCount,
    siteCategoriesDebug: scDebug,
    siteTagsDebug: stDebug,
    integrity: {
      siteCategoriesCount,
      scBodyCount,
      siteTagsCount,
      stBodyCount,
      countsMatch
    }
  };
};

/**
 * Handle POST request - create new site
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key
 * @param {string} relKey - Service role key
 * @returns {Promise<void>}
 */
const handlePostRequest = async (req, res, baseUrl, anonKey, authKey, relKey) => {
  const body = req.body || {};

  // Basic validation
  if (!body.name || !body.url || !body.pricing) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_FIELDS
    });
  }

  if (!body.user_id) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_USER
    });
  }

  // Fetch category and tag names
  const fetchedCategoryNames = await fetchCategoryNames(
    baseUrl,
    anonKey,
    relKey,
    body.category_ids
  );

  const tagNames = await fetchTagNames(baseUrl, anonKey, relKey, body.tag_ids);

  // Create site
  let newSite;
  try {
    const siteData = filterAllowedFields(body, fetchedCategoryNames, tagNames);
    newSite = await createSite(baseUrl, anonKey, authKey, siteData);
  } catch (err) {
    // Handle duplicate site
    const duplicate = await handleDuplicateSite(
      baseUrl,
      anonKey,
      authKey,
      body.url,
      err.message
    );

    if (duplicate) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: ERROR_MESSAGES.SITE_EXISTS,
        data: duplicate
      });
    }

    return res.status(HTTP_STATUS.BAD_GATEWAY).json({
      success: false,
      error: ERROR_MESSAGES.UPSTREAM_ERROR,
      details: err.message
    });
  }

  // Collect warnings
  const warnings = [];

  // Attach tags
  const tagWarning = await attachTags(baseUrl, relKey, newSite.id, body.tag_ids);
  if (tagWarning) warnings.push(tagWarning);

  // Attach categories
  const categoryIds = body.category_ids || [];
  const bodyCategoryNames = body.categories || [];
  const catWarning = await attachCategories(
    baseUrl,
    anonKey,
    authKey,
    relKey,
    newSite.id,
    categoryIds,
    bodyCategoryNames
  );
  if (catWarning) warnings.push(catWarning);

  // Refetch complete site with relations
  const completeSite = await refetchCompleteSite(baseUrl, anonKey, relKey, newSite.id);

  if (completeSite) {
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: completeSite,
      warnings: warnings.length ? warnings : undefined
    });
  } else {
    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newSite,
      warnings: warnings.length ? warnings : undefined
    });
  }
};

/**
 * Handle GET request - list sites with pagination and search
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} authKey - Auth key
 * @param {string} relKey - Service role key
 * @returns {Promise<void>}
 */
const handleGetRequest = async (req, res, baseUrl, anonKey, authKey, relKey) => {
  const searchQuery = req.query?.q ? String(req.query.q).trim() : null;
  const { limit, offset } = parsePaginationParams(req.query);

  // Build URL and fetch sites
  const url = buildSitesListUrl(baseUrl, limit, offset, searchQuery);
  let sites = await fetchSites(url, anonKey, authKey);

  // If no sites, return early
  if (!Array.isArray(sites) || sites.length === 0) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: [],
      debug: {
        sitesCount: 0,
        siteCategoriesCount: 0,
        siteTagsCount: 0,
        integrity: { countsMatch: true }
      }
    });
  }

  // Fetch relations
  const siteIds = sites.map(s => s.id);

  const { siteCategories, scDebug } = await fetchSiteCategories(
    baseUrl,
    anonKey,
    relKey,
    siteIds
  );

  const { siteTags, stDebug } = await fetchSiteTags(baseUrl, anonKey, relKey, siteIds);

  // Build relation maps
  const { categoriesBySite, tagsBySite } = buildRelationMaps(siteCategories, siteTags);

  // Collect and lookup names
  const { categoryNames, tagNames } = collectNamesFromSites(sites);

  const nameToCategory = await lookupCategoriesByNames(
    baseUrl,
    anonKey,
    relKey,
    categoryNames
  );

  const nameToTag = await lookupTagsByNames(baseUrl, anonKey, relKey, tagNames);

  // Normalize and attach relations
  sites = normalizeSiteRelations(
    sites,
    categoriesBySite,
    tagsBySite,
    nameToCategory,
    nameToTag
  );

  // Build debug info
  const debug = buildDebugCounts(sites, siteCategories, siteTags, scDebug, stDebug);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    data: sites,
    debug
  });
};

/**
 * Main API handler for sites collection
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_ENV
    });
  }

  const userToken = extractUserToken(req.headers);
  const authKey = userToken || SUPABASE_ANON_KEY;
  const relKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    SUPABASE_ANON_KEY;

  const baseUrl = buildBaseUrl(SUPABASE_URL);

  try {
    if (req.method === 'POST') {
      return await handlePostRequest(req, res, baseUrl, SUPABASE_ANON_KEY, authKey, relKey);
    } else if (req.method === 'GET') {
      return await handleGetRequest(req, res, baseUrl, SUPABASE_ANON_KEY, authKey, relKey);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Only GET and POST are allowed'
      });
    }
  } catch (err) {
    console.error('Unhandled error in sites API:', err);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: String(err)
    });
  }
}