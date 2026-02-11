/** Sites collection — GET (paginated, filtered) + POST (create with relations) */

import {
  HTTP, configGuard, extractTokenFromReq,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';

const POST_FIELDS = ['name', 'url', 'pricing', 'user_id', 'import_source'];
const DEFAULT_LIMIT = 100, MAX_LIMIT = 5000;
const BATCH = 100;

// ── Shared helpers ──────────────────────────────────────────────────────────

function h(cfg, token, opts) { return buildHeaders(cfg.anonKey, token, opts); }

async function fetchNames(ids, table, cfg, token) {
  if (!ids?.length) return [];
  const p = ids.map(i => `"${i}"`).join(',');
  const r = await fetch(`${restUrl(cfg, table)}?id=in.(${p})&select=name`, { headers: h(cfg, token) });
  return r.ok ? (await r.json()).map(x => x.name) : [];
}

async function batchFetchJunction(cfg, table, selectSuffix, siteIds, relKey) {
  let all = [];
  for (let i = 0; i < siteIds.length; i += BATCH) {
    const batch = siteIds.slice(i, i + BATCH).map(id => `"${id}"`).join(',');
    try {
      const r = await fetch(`${restUrl(cfg, table)}?select=*,${selectSuffix}&site_id=in.(${encodeURIComponent(batch)})`, { headers: h(cfg, relKey) });
      if (r.ok) all.push(...(await r.json()));
    } catch { }
  }
  return all;
}

function buildRelMaps(scData, stData) {
  const cMap = new Map(), tMap = new Map();
  for (const sc of scData) { const a = cMap.get(sc.site_id) || []; if (sc.category) a.push(sc.category); cMap.set(sc.site_id, a); }
  for (const st of stData) { const a = tMap.get(st.site_id) || []; if (st.tag) a.push(st.tag); tMap.set(st.site_id, a); }
  return { cMap, tMap };
}

async function lookupNameMap(cfg, relKey, names, table) {
  if (!names.size) return new Map();
  const enc = Array.from(names).map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
  const r = await fetch(`${restUrl(cfg, table)}?select=id,name,color&name=in.(${enc})`, { headers: h(cfg, relKey) });
  if (!r.ok) return new Map();
  return new Map((await r.json()).map(x => [x.name, x]));
}

function normalizeSites(sites, cMap, tMap, nameToCat, nameToTag) {
  return sites.map(site => {
    const catsRel = cMap.get(site.id) || [];
    const tagsRel = tMap.get(site.id) || [];
    const rawC = catsRel.length ? catsRel : (site.categories_array || site.categories || []);
    const rawT = tagsRel.length ? tagsRel : (site.tags_array || site.tags || []);
    const normC = (Array.isArray(rawC) ? rawC : []).map(c => typeof c === 'string' ? (nameToCat.get(c) || { name: c }) : c);
    const normT = (Array.isArray(rawT) ? rawT : []).map(t => typeof t === 'string' ? (nameToTag.get(t) || { name: t }) : t);
    const { site_categories: _sc, site_tags: _st, ...clean } = site;
    return { ...clean, categories_array: normC, tags_array: normT };
  });
}

async function refetchComplete(cfg, relKey, siteId) {
  const sel = `*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
  const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${siteId}&select=${encodeURIComponent(sel)}`, { headers: h(cfg, relKey) });
  if (!r.ok) return null;
  const site = (await r.json())?.[0];
  if (!site) return null;
  if (site.categories_array) site.categories_array = site.categories_array.map(sc => sc.category).filter(Boolean);
  if (site.tags_array) site.tags_array = site.tags_array.map(st => st.tag).filter(Boolean);
  return site;
}

async function attachJunction(cfg, relKey, table, field, siteId, ids) {
  if (!ids?.length) return null;
  try {
    const r = await fetch(restUrl(cfg, table), {
      method: 'POST',
      headers: h(cfg, relKey, { contentType: true, prefer: 'return=representation' }),
      body: JSON.stringify(ids.map(id => ({ site_id: siteId, [field]: id }))),
    });
    if (!r.ok) return { stage: `${table}_insert`, status: r.status, details: await r.text() };
  } catch (err) { return { stage: `${table}_insert`, error: String(err) }; }
  return null;
}

async function attachCatsByName(cfg, authKey, relKey, siteId, names) {
  if (!names?.length) return null;
  try {
    const enc = names.map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
    const r = await fetch(`${restUrl(cfg, 'categories')}?select=id,name&name=in.(${enc})`, { headers: h(cfg, authKey) });
    if (!r.ok) return null;
    const cats = await r.json();
    const toInsert = cats.map(c => ({ site_id: siteId, category_id: c.id }));
    if (toInsert.length) {
      const ir = await fetch(restUrl(cfg, 'site_categories'), {
        method: 'POST', headers: h(cfg, relKey, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(toInsert),
      });
      if (!ir.ok) return { stage: 'site_categories_name', details: await ir.text() };
    }
  } catch { }
  return null;
}

// ── URL builder ─────────────────────────────────────────────────────────────

function buildListUrl(cfg, limit, offset, f) {
  let select = '*';
  const qf = [];

  if (f.isUncategorized) { select += ',site_categories!left(category_id)'; qf.push('site_categories=is.null'); }
  else if (f.categoryId) { select += ',site_categories!inner(category_id)'; qf.push(`site_categories.category_id=eq.${encodeURIComponent(f.categoryId)}`); }

  if (f.isUntagged) { select += ',site_tags!left(tag_id)'; qf.push('site_tags=is.null'); }
  else if (f.tagId) { select += ',site_tags!inner(tag_id)'; qf.push(`site_tags.tag_id=eq.${encodeURIComponent(f.tagId)}`); }

  const validSorts = ['created_at', 'updated_at', 'name', 'url', 'pricing'];
  const sort = validSorts.includes(f.sortBy) ? f.sortBy : 'created_at';
  const order = f.sortOrder === 'asc' ? 'asc' : 'desc';

  let url = `${restUrl(cfg, 'sites')}?select=${encodeURIComponent(select)}&order=is_pinned.desc,${sort}.${order}&limit=${limit}&offset=${offset}`;
  if (f.favoritesOnly) url += '&is_favorite=eq.true';
  qf.forEach(q => { url += `&${q}`; });
  if (f.searchQuery) { const e = encodeURIComponent(f.searchQuery); url += `&or=(name.ilike.*${e}*,url.ilike.*${e}*)`; }
  if (f.importSource) url += `&import_source=eq.${encodeURIComponent(f.importSource)}`;
  return url;
}

// ── GET handler ─────────────────────────────────────────────────────────────

async function handleGet(req, res, cfg, authKey, relKey) {
  const q = req.query || {};
  let limit = parseInt(q.limit, 10) || DEFAULT_LIMIT;
  if (limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  let page = parseInt(q.page, 10) || 1;
  if (page <= 0) page = 1;
  const offset = (page - 1) * limit;

  const filters = {
    searchQuery: q.q ? String(q.q).trim() : null,
    categoryId: q.category_id && q.category_id !== 'uncategorized' ? q.category_id : null,
    tagId: q.tag_id && q.tag_id !== 'untagged' ? q.tag_id : null,
    sortBy: q.sort_by || 'created_at',
    sortOrder: q.sort_order || 'desc',
    favoritesOnly: q.favorites === 'true',
    isUncategorized: q.category_id === 'uncategorized',
    isUntagged: q.tag_id === 'untagged',
    importSource: q.import_source || null,
  };

  const url = buildListUrl(cfg, limit, offset, filters);
  const r = await fetch(url, { headers: { ...h(cfg, authKey), Prefer: 'count=exact' } });
  if (!r.ok) throw new Error(await r.text());
  const sites = await r.json();
  const crh = r.headers.get('content-range');
  let total = crh ? parseInt(crh.match(/\/(\d+)/)?.[1], 10) : null;
  if (total == null) total = Array.isArray(sites) ? sites.length : 0;

  const fieldsMode = q.fields || null;

  // Minimal mode
  if (fieldsMode === 'minimal') {
    const data = (Array.isArray(sites) ? sites : []).map(({ site_categories: _a, site_tags: _b, ...s }) => ({
      ...s,
      categories_array: (s.categories_array || []).map(c => typeof c === 'string' ? { name: c } : c),
      tags_array: (s.tags_array || []).map(t => typeof t === 'string' ? { name: t } : t),
    }));
    return sendOk(res, { data, totalCount: total });
  }

  if (!Array.isArray(sites) || !sites.length) return sendOk(res, { data: [], totalCount: total });

  const siteIds = sites.map(s => s.id);

  // IDs mode
  if (fieldsMode === 'ids') {
    const scData = await batchFetchJunction(cfg, 'site_categories', 'category_id', siteIds, relKey);
    const stData = await batchFetchJunction(cfg, 'site_tags', 'tag_id', siteIds, relKey);
    const { cMap, tMap } = buildRelMaps(scData, stData);
    const data = sites.map(s => ({
      id: s.id, url: s.url,
      category_ids: (cMap.get(s.id) || []).map(c => c.id).filter(Boolean),
      tag_ids: (tMap.get(s.id) || []).map(t => t.id).filter(Boolean),
    }));
    return sendOk(res, { data, totalCount: total });
  }

  // Full mode
  const scData = await batchFetchJunction(cfg, 'site_categories', 'category:categories(*)', siteIds, relKey);
  const stData = await batchFetchJunction(cfg, 'site_tags', 'tag:tags(*)', siteIds, relKey);
  const { cMap, tMap } = buildRelMaps(scData, stData);

  // Collect string names for legacy fallback
  const catNames = new Set(), tagNameSet = new Set();
  for (const s of sites) {
    for (const c of (s.categories_array || s.categories || [])) if (typeof c === 'string' && c.trim()) catNames.add(c.trim());
    for (const t of (s.tags_array || s.tags || [])) if (typeof t === 'string' && t.trim()) tagNameSet.add(t.trim());
  }
  const [nameToCat, nameToTag] = await Promise.all([
    lookupNameMap(cfg, relKey, catNames, 'categories'),
    lookupNameMap(cfg, relKey, tagNameSet, 'tags'),
  ]);

  return sendOk(res, { data: normalizeSites(sites, cMap, tMap, nameToCat, nameToTag), totalCount: total });
}

// ── POST handler ────────────────────────────────────────────────────────────

async function handlePost(req, res, cfg, authKey, relKey) {
  const body = req.body || {};
  if (!body.name || !body.url || !body.pricing) return sendError(res, HTTP.BAD_REQUEST, 'Missing required fields: name, url, pricing');
  if (!body.user_id) return sendError(res, HTTP.BAD_REQUEST, 'Missing user_id (you must be logged in)');

  const catNames = await fetchNames(body.category_ids, 'categories', cfg, relKey);
  const tagNames = await fetchNames(body.tag_ids, 'tags', cfg, relKey);
  const filtered = {};
  for (const k of POST_FIELDS) if (body[k] !== undefined) filtered[k] = body[k];
  filtered.categories = catNames;
  filtered.tags = tagNames;

  let newSite;
  try {
    const r = await fetch(restUrl(cfg, 'sites'), {
      method: 'POST', headers: h(cfg, authKey, { contentType: true, prefer: 'return=representation' }),
      body: JSON.stringify(filtered),
    });
    const text = await r.text();
    if (!r.ok) {
      if (body.url && /duplicate|unique|violat|already exists/i.test(text)) {
        const lr = await fetch(`${restUrl(cfg, 'sites')}?select=*&url=eq.${encodeURIComponent(body.url)}`, { headers: h(cfg, authKey) });
        if (lr.ok) { const rows = await lr.json(); if (rows?.[0]) return res.status(HTTP.CONFLICT).json({ success: false, error: 'Site already exists', data: rows[0] }); }
      }
      return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: text });
    }
    const created = JSON.parse(text);
    newSite = Array.isArray(created) ? created[0] : created;
  } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }

  const warnings = [];
  const w1 = await attachJunction(cfg, relKey, 'site_tags', 'tag_id', newSite.id, body.tag_ids);
  if (w1) warnings.push(w1);

  const catIds = body.category_ids || [];
  if (catIds.length) {
    const w2 = await attachJunction(cfg, relKey, 'site_categories', 'category_id', newSite.id, catIds);
    if (w2) warnings.push(w2);
  } else if (body.categories?.length) {
    const w2 = await attachCatsByName(cfg, authKey, relKey, newSite.id, body.categories);
    if (w2) warnings.push(w2);
  }

  const complete = await refetchComplete(cfg, relKey, newSite.id);
  return res.status(HTTP.CREATED).json({
    success: true,
    data: complete || newSite,
    warnings: warnings.length ? warnings : undefined,
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;

  const userToken = extractTokenFromReq(req);
  const authKey = userToken || cfg.anonKey;
  const relKey = cfg.serviceKey || cfg.anonKey;

  try {
    if (req.method === 'GET') return await handleGet(req, res, cfg, authKey, relKey);
    if (req.method === 'POST') return await handlePost(req, res, cfg, authKey, relKey);
    return sendError(res, HTTP.BAD_REQUEST, 'Only GET and POST are allowed');
  } catch (err) {
    console.error('Unhandled error in sites API:', err);
    return sendError(res, HTTP.INTERNAL_ERROR, String(err));
  }
}