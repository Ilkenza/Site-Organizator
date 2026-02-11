/** Import API — bulk site creation from JSON/CSV */

import { HTTP, getSupabaseConfig, extractTokenFromReq, resolveTier, sendError, sendOk, methodGuard } from './helpers/api-utils';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const CHUNK = 200, PAR = 15, CAT_COLOR = '#6CBBFB', TAG_COLOR = '#D98BAC';

const VALID_PRICING = new Set(['fully_free', 'freemium', 'free_trial', 'paid']);
const PRICING_ALIASES = {
  fullyfree: 'fully_free', free: 'fully_free', besplatno: 'fully_free',
  freetrial: 'free_trial', trial: 'free_trial',
  nesto_se_placa: 'paid', nestoseplaca: 'paid', placeno: 'paid', premium: 'paid',
};

function normPricing(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  if (VALID_PRICING.has(s)) return s;
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

const trim = v => (v || '').toString().trim();
const split = v => v ? v.toString().split(/[,;|\n]+/).map(trim).filter(Boolean) : [];

function parseItems(row, arrKey, strKey, altKey) {
  if (Array.isArray(row[arrKey])) return row[arrKey].map(c => ({ name: c?.name || '', color: c?.color || null })).filter(c => c.name);
  if (typeof row[strKey] === 'string') return split(row[strKey]).map(n => ({ name: n, color: null }));
  if (Array.isArray(row[strKey])) return row[strKey].map(c => typeof c === 'string' ? { name: c, color: null } : { name: c?.name || '', color: c?.color || null }).filter(c => c.name);
  if (row[altKey]) return split(row[altKey] || '').map(n => ({ name: n, color: null }));
  return [];
}

function normRow(row, idx) {
  return {
    _i: idx,
    name: trim(row.name || row.title || row.Name || ''),
    url: trim(row.url || row.URL || row.link || ''),
    pricing: normPricing(row.pricing || row.pricing_model || row.pricingModel || '') || 'freemium',
    categories: parseItems(row, 'categories_array', 'categories', 'category'),
    tags: parseItems(row, 'tags_array', 'tags', 'tag'),
    is_favorite: row.is_favorite === true || row.is_favorite === 'true' || row.is_favorite === 1,
    is_pinned: row.is_pinned === true || row.is_pinned === 'true' || row.is_pinned === 1,
    created_at: row.created_at || row.createdAt || null,
  };
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const cfg = getSupabaseConfig();
  if (!cfg) return sendError(res, HTTP.INTERNAL_ERROR, 'Supabase config missing');

  const userToken = extractTokenFromReq(req);
  if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');

  const payload = req.body || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const userId = payload.userId;
  if (!rows.length) return sendError(res, HTTP.BAD_REQUEST, 'No rows provided');
  if (!userId) return sendError(res, HTTP.BAD_REQUEST, 'userId is required');

  const importSource = payload.importSource || 'manual';
  const createMissing = (payload.options || { createMissing: true }).createMissing;
  const chunkSize = Math.max(50, Number(payload.chunkSize) || CHUNK);

  const { url: BASE, anonKey: ANON } = cfg;
  const REL_KEY = cfg.serviceKey;
  const KEY = userToken;

  const hdr = (tok, prefer) => {
    const h = { apikey: ANON, Authorization: `Bearer ${tok}`, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    return h;
  };
  const rest = path => `${BASE}/rest/v1/${path}`;

  const catCache = new Map(), tagCache = new Map();
  const report = { created: [], attached: [], skipped: [], errors: [] };

  // Preload existing cats/tags
  async function preload() {
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(rest(`categories?select=id,name&user_id=eq.${userId}`), { headers: hdr(KEY) }),
        fetch(rest(`tags?select=id,name&user_id=eq.${userId}`), { headers: hdr(KEY) }),
      ]);
      if (cRes.ok) (await cRes.json() || []).forEach(c => catCache.set((c.name || '').toLowerCase(), c));
      if (tRes.ok) (await tRes.json() || []).forEach(t => tagCache.set((t.name || '').toLowerCase(), t));
    } catch { }
  }

  async function ensureItem(cache, table, name, color, defColor) {
    const key = (name || '').toLowerCase();
    if (cache.has(key)) return cache.get(key);
    if (!createMissing) return null;
    try {
      const r = await fetch(rest(table), { method: 'POST', headers: hdr(KEY, 'return=representation'), body: JSON.stringify({ name, color: color || defColor, user_id: userId }) });
      if (r.ok) { const j = await r.json(); if (j?.[0]) { cache.set(key, j[0]); return j[0]; } }
      // Lookup fallback
      const lr = await fetch(rest(`${table}?select=id,name&name=eq.${encodeURIComponent(name)}&user_id=eq.${userId}`), { headers: hdr(KEY) });
      if (lr.ok) { const lj = await lr.json(); if (lj?.[0]) { cache.set(key, lj[0]); return lj[0]; } }
    } catch { }
    return null;
  }

  async function lookupUrls(urls) {
    const unique = [...new Set(urls.map(trim).filter(Boolean))];
    if (!unique.length) return {};
    const out = {};
    for (let i = 0; i < unique.length; i += 50) {
      const batch = unique.slice(i, i + 50);
      const inList = batch.map(u => `"${encodeURIComponent(u)}"`).join(',');
      try {
        const r = await fetch(rest(`sites?select=*&url=in.(${inList})&user_id=eq.${userId}`), { headers: hdr(KEY) });
        if (r.ok) (await r.json() || []).forEach(s => { if (s?.url) out[s.url.trim()] = s; });
      } catch { }
    }
    return out;
  }

  async function insertBatch(items) {
    if (!items?.length) return [];
    const r = await fetch(rest('sites'), { method: 'POST', headers: hdr(KEY, 'return=representation'), body: JSON.stringify(items) });
    const t = await r.text();
    if (!r.ok) throw new Error(`Insert failed: ${t}`);
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : j ? [j] : [];
  }

  async function attachRels(table, rows) {
    if (!rows?.length) return;
    await fetch(rest(table), { method: 'POST', headers: hdr(REL_KEY), body: JSON.stringify(rows) });
  }

  try {
    await preload();

    // Tier limits
    const LIMITS = { free: { sites: 1000, categories: 100, tags: 300 }, pro: { sites: 10000, categories: 500, tags: 1000 }, promax: { sites: Infinity, categories: Infinity, tags: Infinity } };
    const { tier } = resolveTier(userToken);
    const limits = LIMITS[tier] || LIMITS.free;

    // Current site count
    let currentSites = 0;
    try {
      const cr = await fetch(rest(`sites?select=id&user_id=eq.${userId}`), { headers: { ...hdr(KEY), Prefer: 'count=exact', Range: '0-0' } });
      const range = cr.headers.get('content-range');
      if (range) { const m = range.match(/\/(\d+)/); if (m) currentSites = parseInt(m[1], 10); }
    } catch { }

    const slotsLeft = limits.sites === Infinity ? Infinity : Math.max(0, limits.sites - currentSites);
    const catsLeft = limits.categories === Infinity ? Infinity : Math.max(0, limits.categories - catCache.size);
    const tagsLeft = limits.tags === Infinity ? Infinity : Math.max(0, limits.tags - tagCache.size);

    if (slotsLeft === 0) {
      const label = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
      return sendOk(res, { report: { created: [], updated: [], skipped: [], errors: [], tierLimited: true, siteLimitReached: true, tierLabel: label, tierMessage: `Site limit reached (${currentSites}/${limits.sites}). Upgrade for more.` } });
    }

    // Pre-create all categories/tags in parallel
    const allNorm = rows.map((r, i) => normRow(r, i));
    const allCatInfos = new Map(), allTagInfos = new Map();
    for (const nr of allNorm) {
      for (const c of nr.categories) { const k = (c.name || '').toLowerCase(); if (k && !allCatInfos.has(k)) allCatInfos.set(k, c); }
      for (const t of nr.tags) { const k = (t.name || '').toLowerCase(); if (k && !allTagInfos.has(k)) allTagInfos.set(k, t); }
    }

    const newCats = [...allCatInfos.values()].filter(c => !catCache.has((c.name || '').toLowerCase()));
    const useCats = newCats.slice(0, catsLeft === Infinity ? undefined : catsLeft);
    const trimmedCats = newCats.length - useCats.length;
    for (let p = 0; p < useCats.length; p += PAR) await Promise.all(useCats.slice(p, p + PAR).map(c => ensureItem(catCache, 'categories', c.name, c.color, CAT_COLOR)));

    const newTags = [...allTagInfos.values()].filter(t => !tagCache.has((t.name || '').toLowerCase()));
    const useTags = newTags.slice(0, tagsLeft === Infinity ? undefined : tagsLeft);
    const trimmedTags = newTags.length - useTags.length;
    for (let p = 0; p < useTags.length; p += PAR) await Promise.all(useTags.slice(p, p + PAR).map(t => ensureItem(tagCache, 'tags', t.name, t.color, TAG_COLOR)));

    report.categoriesCreated = useCats.length;
    report.tagsCreated = useTags.length;

    // Process chunks
    let created = 0, skippedLimit = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const normRows = rows.slice(i, i + chunkSize).map((r, idx) => normRow(r, i + idx));
      const urls = normRows.map(r => r.url).filter(Boolean);
      const existing = await lookupUrls(urls);

      const toCreate = [], toUpdate = [];
      for (const nr of normRows) {
        if (!nr.url) { report.errors.push({ row: nr._i, error: 'Missing URL' }); continue; }
        const cats = nr.categories.map(c => catCache.get((c.name || '').toLowerCase())).filter(Boolean);
        const tags = nr.tags.map(t => tagCache.get((t.name || '').toLowerCase())).filter(Boolean);
        if (existing[nr.url]) toUpdate.push({ nr, cats, tags, existingSite: existing[nr.url] });
        else toCreate.push({ nr, cats, tags });
      }

      // Enforce tier limit on new creations
      if (slotsLeft !== Infinity) {
        const left = Math.max(0, slotsLeft - created);
        if (toCreate.length > left) { skippedLimit += toCreate.length - left; toCreate.length = left; }
      }

      // Insert new sites
      const inserts = toCreate.map(x => {
        const r = { name: x.nr.name || x.nr.url || '', url: x.nr.url, pricing: x.nr.pricing || 'freemium', is_favorite: x.nr.is_favorite, is_pinned: x.nr.is_pinned, user_id: userId, import_source: importSource };
        if (x.nr.created_at) r.created_at = x.nr.created_at;
        return r;
      });

      let createdSites = [];
      try { createdSites = await insertBatch(inserts); created += createdSites.length; } catch {
        for (let j = 0; j < inserts.length; j++) {
          try { const c = await insertBatch([inserts[j]]); if (c?.[0]) { createdSites.push(c[0]); created++; } } catch (e) { report.errors.push({ row: toCreate[j]?.nr?._i, error: e.message }); }
        }
      }

      // Update existing sites
      const updatedSites = [];
      for (const { nr, existingSite, ...ctx } of toUpdate) {
        try {
          const r = await fetch(rest(`sites?id=eq.${existingSite.id}&user_id=eq.${userId}`), { method: 'PATCH', headers: hdr(KEY, 'return=representation'), body: JSON.stringify({ name: nr.name || existingSite.name, pricing: nr.pricing || existingSite.pricing, is_favorite: nr.is_favorite, is_pinned: nr.is_pinned }) });
          if (!r.ok) { report.errors.push({ row: nr._i, error: `Update failed: ${await r.text()}` }); }
          else { const u = (await r.json())?.[0]; if (u) { updatedSites.push({ site: u, cats: ctx.cats, tags: ctx.tags }); report.updated = report.updated || []; report.updated.push({ row: nr._i, site: u }); } }
        } catch (e) { report.errors.push({ row: nr._i, error: e.message }); }
      }

      // Build relation rows
      const sc = [], st = [];
      createdSites.forEach((site, k) => {
        if (!site?.id) return;
        toCreate[k]?.cats?.forEach(c => sc.push({ site_id: site.id, category_id: c.id }));
        toCreate[k]?.tags?.forEach(t => st.push({ site_id: site.id, tag_id: t.id }));
        report.created.push({ row: toCreate[k]?.nr?._i, site });
      });

      for (const { site, cats, tags } of updatedSites) {
        if (!site?.id) continue;
        try { await fetch(rest(`site_categories?site_id=eq.${site.id}`), { method: 'DELETE', headers: hdr(REL_KEY) }); await fetch(rest(`site_tags?site_id=eq.${site.id}`), { method: 'DELETE', headers: hdr(REL_KEY) }); } catch { }
        cats?.forEach(c => sc.push({ site_id: site.id, category_id: c.id }));
        tags?.forEach(t => st.push({ site_id: site.id, tag_id: t.id }));
      }

      try { await attachRels('site_categories', sc); } catch { }
      try { await attachRels('site_tags', st); } catch { }
    }

    // Tier limit info
    if (skippedLimit > 0 || trimmedCats > 0 || trimmedTags > 0) {
      const label = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
      report.tierLimited = true; report.tierLabel = label;
      if (skippedLimit > 0) { report.siteLimitReached = true; report.skippedDueToLimit = skippedLimit; report.sitesImported = created; report.sitesTotal = rows.length; }
      if (trimmedCats > 0) report.trimmedCategories = trimmedCats;
      if (trimmedTags > 0) report.trimmedTags = trimmedTags;
      const parts = [];
      if (skippedLimit > 0) parts.push(`${skippedLimit} site(s) skipped`);
      if (trimmedCats > 0) parts.push(`${trimmedCats} categor${trimmedCats === 1 ? 'y' : 'ies'} skipped`);
      if (trimmedTags > 0) parts.push(`${trimmedTags} tag(s) skipped`);
      report.tierMessage = `${label} plan limits: ${parts.join(', ')}. Upgrade for more.`;
    }

    return sendOk(res, { report });
  } catch (err) {
    return sendError(res, HTTP.INTERNAL_ERROR, err.message || String(err));
  }
}
