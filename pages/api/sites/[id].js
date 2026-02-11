/** Individual site — GET, PUT/PATCH, DELETE */

import {
  HTTP, configGuard, extractTokenFromReq, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from '../helpers/api-utils';

const ALLOWED = ['name', 'url', 'pricing', 'description'];
const pick = (body) => {
  const f = {};
  for (const k of ALLOWED) if (Object.prototype.hasOwnProperty.call(body, k)) f[k] = body[k];
  f.updated_at = new Date().toISOString();
  return f;
};

async function fetchNames(ids, table, cfg, token) {
  if (!ids?.length) return [];
  const p = ids.map(i => `"${i}"`).join(',');
  const r = await fetch(`${restUrl(cfg, table)}?id=in.(${p})&select=name`, { headers: buildHeaders(cfg.anonKey, token) });
  return r.ok ? (await r.json()).map(x => x.name) : [];
}

async function determineRelKey(siteId, token, cfg) {
  if (!token || !siteId) return cfg.anonKey;
  try {
    const uid = decodeJwt(token)?.sub;
    if (!uid) return cfg.anonKey;
    const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${siteId}&select=user_id`, { headers: buildHeaders(cfg.anonKey, token) });
    if (!r.ok) return cfg.anonKey;
    const rows = await r.json();
    return (rows?.[0]?.user_id === uid && cfg.serviceKey) ? cfg.serviceKey : cfg.anonKey;
  } catch { return cfg.anonKey; }
}

async function syncRelations(siteId, ids, table, field, cfg, relKey) {
  if (!Array.isArray(ids)) return null;
  const h = buildHeaders(relKey, relKey);
  try {
    await fetch(`${restUrl(cfg, table)}?site_id=eq.${siteId}`, { method: 'DELETE', headers: h });
    if (ids.length) {
      const hw = buildHeaders(relKey, relKey, { contentType: true });
      const r = await fetch(restUrl(cfg, table), { method: 'POST', headers: hw, body: JSON.stringify(ids.map(id => ({ site_id: siteId, [field]: id }))) });
      if (!r.ok) return { stage: `insert_${table}`, status: r.status, details: await r.text() };
    }
  } catch (err) { return { stage: `sync_${table}`, error: String(err) }; }
  return null;
}

async function refetchSite(siteId, cfg, token) {
  const sel = `*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
  const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${siteId}&select=${sel}`, { headers: buildHeaders(cfg.anonKey, token) });
  if (!r.ok) return null;
  const site = (await r.json())?.[0];
  if (!site) return null;
  if (site.categories_array) site.categories_array = site.categories_array.map(sc => sc.category).filter(Boolean);
  if (site.tags_array) site.tags_array = site.tags_array.map(st => st.tag).filter(Boolean);
  return site;
}

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const { id } = req.query;
  const token = extractTokenFromReq(req);
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
  const authToken = token;
  const relKey = await determineRelKey(id, token, cfg);

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${id}`, { headers: buildHeaders(cfg.anonKey, authToken) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      return sendOk(res, { data: (await r.json())[0] || null });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { category_ids, tag_ids, ...siteData } = req.body || {};
      const filtered = pick(siteData);
      filtered.categories = await fetchNames(category_ids, 'categories', cfg, relKey);
      filtered.tags = await fetchNames(tag_ids, 'tags', cfg, relKey);

      const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${id}`, {
        method: 'PATCH',
        headers: buildHeaders(cfg.anonKey, token, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(filtered),
      });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });

      const warnings = [];
      const w1 = await syncRelations(id, category_ids, 'site_categories', 'category_id', cfg, relKey);
      if (w1) warnings.push(w1);
      const w2 = await syncRelations(id, tag_ids, 'site_tags', 'tag_id', cfg, relKey);
      if (w2) warnings.push(w2);

      const complete = await refetchSite(id, cfg, relKey);
      if (complete) return sendOk(res, { data: complete, warnings: warnings.length ? warnings : undefined });
      return sendError(res, HTTP.BAD_GATEWAY, 'Failed to refetch site');
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'DELETE') {
    try {
      const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${id}`, { method: 'DELETE', headers: buildHeaders(cfg.anonKey, token) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      return sendOk(res);
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
