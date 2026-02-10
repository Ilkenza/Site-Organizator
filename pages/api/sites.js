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
  MAX_LIMIT: 5000,
  DEFAULT_PAGE: 1,
  ALLOWED_POST_FIELDS: ['name', 'url', 'pricing', 'user_id', 'import_source']
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
 * @param {Object} filters - Filter options
 * @returns {string} Complete URL
 */
const buildSitesListUrl = (baseUrl, limit, offset, filters = {}) => {
  const { searchQuery, categoryId, tagId, sortBy, sortOrder, favoritesOnly, isUncategorized, isUntagged, importSource } = filters;

  // Build select with appropriate joins
  let select = '*';
  const queryFilters = [];

  // Category filter: inner join for specific category, left join for uncategorized
  if (isUncategorized) {
    select += ',site_categories!left(category_id)';
    queryFilters.push('site_categories=is.null');
  } else if (categoryId) {
    select += ',site_categories!inner(category_id)';
    queryFilters.push(`site_categories.category_id=eq.${encodeURIComponent(categoryId)}`);
  }

  // Tag filter: inner join for specific tag, left join for untagged
  if (isUntagged) {
    select += ',site_tags!left(tag_id)';
    queryFilters.push('site_tags=is.null');
  } else if (tagId) {
    select += ',site_tags!inner(tag_id)';
    queryFilters.push(`site_tags.tag_id=eq.${encodeURIComponent(tagId)}`);
  }

  // Sort field mapping
  const validSorts = ['created_at', 'updated_at', 'name', 'url', 'pricing'];
  const sort = validSorts.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  let url = `${baseUrl}/rest/v1/sites?select=${encodeURIComponent(select)}`;
  url += `&order=is_pinned.desc,${sort}.${order}&limit=${limit}&offset=${offset}`;

  // Favorites filter
  if (favoritesOnly) {
    url += '&is_favorite=eq.true';
  }

  // Append all query filters
  queryFilters.forEach(f => { url += `&${f}`; });

  if (searchQuery) {
    const qEsc = encodeURIComponent(searchQuery);
    const orFilter = `or=(name.ilike.*${qEsc}*,url.ilike.*${qEsc}*)`;
    url += `&${orFilter}`;
  }

  // Import source filter
  if (importSource) {
    url += `&import_source=eq.${encodeURIComponent(importSource)}`;
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
      Accept: 'application/json',
      Prefer: 'count=exact'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  const data = await response.json();
  const contentRange = response.headers.get('content-range');
  let totalCount = null;
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) totalCount = parseInt(match[1], 10);
  }
  if (totalCount === null) totalCount = Array.isArray(data) ? data.length : 0;

  return { data, totalCount };
};

/**
 * Fetch site categories with relations (in batches to avoid URI Too Long error)
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} siteIds - Site IDs
 * @returns {Promise<Object>} Categories data and debug info
 */
const fetchSiteCategories = async (baseUrl, anonKey, relKey, siteIds) => {
  const BATCH_SIZE = 100; // Limit to avoid 414 URI Too Long
  let siteCategories = [];
  let scDebug = [];

  // Process in batches
  for (let i = 0; i < siteIds.length; i += BATCH_SIZE) {
    const batch = siteIds.slice(i, i + BATCH_SIZE);
    const rawInList = batch.map(id => `"${id}"`).join(',');
    const encodedInList = encodeURIComponent(rawInList);
    const scUrl = `${baseUrl}/rest/v1/site_categories?select=*,category:categories(*)&site_id=in.(${encodedInList})`;

    try {
      const scRes = await fetch(scUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${relKey}`,
          Accept: 'application/json'
        }
      });

      const scText = await scRes.text();
      const batchDebug = {
        batch: Math.floor(i / BATCH_SIZE) + 1,
        ok: scRes.ok,
        status: scRes.status,
        statusText: scRes.statusText
      };

      if (scRes.ok) {
        try {
          const batchData = JSON.parse(scText);
          siteCategories.push(...batchData);
        } catch (e) {
          batchDebug.parseError = String(e);
        }
      } else {
        console.warn(`site_categories batch ${batchDebug.batch} failed`, batchDebug);
        scDebug.push(batchDebug);
      }
    } catch (err) {
      console.warn(`site_categories batch error at ${i}`, err);
      scDebug.push({ error: String(err), index: i });
    }
  }

  return { siteCategories, scDebug: scDebug.length > 0 ? scDebug : null };
};

/**
 * Fetch site tags with relations (in batches to avoid URI Too Long error)
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} relKey - Service role key
 * @param {Array<string>} siteIds - Site IDs
 * @returns {Promise<Object>} Tags data and debug info
 */
const fetchSiteTags = async (baseUrl, anonKey, relKey, siteIds) => {
  const BATCH_SIZE = 100; // Limit to avoid 414 URI Too Long
  let siteTags = [];
  let stDebug = [];

  // Process in batches
  for (let i = 0; i < siteIds.length; i += BATCH_SIZE) {
    const batch = siteIds.slice(i, i + BATCH_SIZE);
    const rawInList = batch.map(id => `"${id}"`).join(',');
    const encodedInList = encodeURIComponent(rawInList);
    const stUrl = `${baseUrl}/rest/v1/site_tags?select=*,tag:tags(*)&site_id=in.(${encodedInList})`;

    try {
      const stRes = await fetch(stUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${relKey}`,
          Accept: 'application/json'
        }
      });

      const stText = await stRes.text();
      const batchDebug = {
        batch: Math.floor(i / BATCH_SIZE) + 1,
        ok: stRes.ok,
        status: stRes.status,
        statusText: stRes.statusText
      };

      if (stRes.ok) {
        try {
          const batchData = JSON.parse(stText);
          siteTags.push(...batchData);
        } catch (e) {
          batchDebug.parseError = String(e);
        }
      } else {
        console.warn(`site_tags batch ${batchDebug.batch} failed`, batchDebug);
        stDebug.push(batchDebug);
      }
    } catch (err) {
      console.warn(`site_tags batch error at ${i}`, err);
      stDebug.push({ error: String(err), index: i });
    }
  }

  return { siteTags, stDebug: stDebug.length > 0 ? stDebug : null };
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

    // Strip left-join artifacts from uncategorized/untagged queries
    const { site_categories: _sc, site_tags: _st, ...cleanSite } = site;
    return Object.assign({}, cleanSite, {
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
  const categoryId = req.query?.category_id || null;
  const tagId = req.query?.tag_id || null;
  const sortBy = req.query?.sort_by || 'created_at';
  const sortOrder = req.query?.sort_order || 'desc';
  const favoritesOnly = req.query?.favorites === 'true';
  const importSource = req.query?.import_source || null;
  const { limit, offset } = parsePaginationParams(req.query);

  // Build URL with filters — use left join + is.null for uncategorized/untagged
  const filters = {
    searchQuery,
    categoryId: (categoryId && categoryId !== 'uncategorized') ? categoryId : null,
    tagId: (tagId && tagId !== 'untagged') ? tagId : null,
    sortBy,
    sortOrder,
    favoritesOnly,
    isUncategorized: categoryId === 'uncategorized',
    isUntagged: tagId === 'untagged',
    importSource
  };
  const url = buildSitesListUrl(baseUrl, limit, offset, filters);
  const fieldsMode = req.query?.fields || null;
  const { data: sites, totalCount } = await fetchSites(url, anonKey, authKey);

  // Minimal mode: return raw site data with basic array normalization (no relation lookups)
  // Used for fast bulk fetches (e.g. import source filtering where only url/id matter)
  if (fieldsMode === 'minimal') {
    const minimalSites = (Array.isArray(sites) ? sites : []).map(site => {
      const { site_categories: _sc, site_tags: _st, ...clean } = site;
      // Convert legacy string arrays to {name} objects for Badge compatibility
      const cats = (Array.isArray(clean.categories_array) ? clean.categories_array : []).map(
        c => typeof c === 'string' ? { name: c } : c
      );
      const tagArr = (Array.isArray(clean.tags_array) ? clean.tags_array : []).map(
        t => typeof t === 'string' ? { name: t } : t
      );
      return { ...clean, categories_array: cats, tags_array: tagArr };
    });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: minimalSites,
      totalCount: totalCount || minimalSites.length
    });
  }

  // IDs mode: fetch junction table data only (no name lookups or full normalization)
  // Used for fast cross-filter counts in sidebar — returns category_ids and tag_ids per site
  if (fieldsMode === 'ids') {
    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(HTTP_STATUS.OK).json({ success: true, data: [], totalCount: totalCount || 0 });
    }
    const siteIds = sites.map(s => s.id);
    const { siteCategories: scData } = await fetchSiteCategories(baseUrl, anonKey, relKey, siteIds);
    const { siteTags: stData } = await fetchSiteTags(baseUrl, anonKey, relKey, siteIds);
    const { categoriesBySite: cbsMap, tagsBySite: tbsMap } = buildRelationMaps(scData, stData);
    const idsSites = sites.map(site => ({
      id: site.id,
      url: site.url,
      category_ids: (cbsMap.get(site.id) || []).map(c => c.id).filter(Boolean),
      tag_ids: (tbsMap.get(site.id) || []).map(t => t.id).filter(Boolean)
    }));
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: idsSites,
      totalCount: totalCount || idsSites.length
    });
  }

  // If no sites, return early
  if (!Array.isArray(sites) || sites.length === 0) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: [],
      totalCount: totalCount || 0,
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
  const normalizedSites = normalizeSiteRelations(
    sites,
    categoriesBySite,
    tagsBySite,
    nameToCategory,
    nameToTag
  );

  // Build debug info
  const debug = buildDebugCounts(normalizedSites, siteCategories, siteTags, scDebug, stDebug);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    data: normalizedSites,
    totalCount,
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