/** Tags collection — GET all, POST create */

import {
  HTTP, configGuard, extractTokenFromReq, resolveTier, isDuplicate,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';

const ALLOWED = ['name', 'color', 'user_id', 'is_needed'];
const pick = (body) => Object.fromEntries(ALLOWED.filter(k => body[k] !== undefined).map(k => [k, body[k]]));

async function lookupByName(cfg, name, token) {
  if (!name) return null;
  try {
    const r = await fetch(`${restUrl(cfg, 'tags')}?select=*&name=eq.${encodeURIComponent(name)}`, { headers: buildHeaders(cfg.anonKey, token) });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] || null;
  } catch { return null; }
}

async function checkTierLimit(cfg, userToken, res) {
  const LIMITS = { free: 300, pro: 1000, promax: Infinity };
  const tier = resolveTier(userToken);
  const limit = LIMITS[tier] ?? LIMITS.free;
  if (limit === Infinity) return false;
  try {
    const r = await fetch(`${restUrl(cfg, 'tags')}?select=id&limit=${limit + 1}`, { headers: buildHeaders(cfg.anonKey, userToken) });
    if (r.ok) {
      const rows = await r.json();
      if (rows.length >= limit) {
        const label = tier === 'promax' ? 'Pro Max' : tier === 'pro' ? 'Pro' : 'Free';
        const target = tier === 'free' ? 'Pro or Pro Max' : 'Pro Max';
        sendError(res, HTTP.FORBIDDEN, `Tag limit reached (${rows.length}/${limit}). You are on the ${label} plan. Upgrade to ${target} for more.`);
        return true;
      }
    }
  } catch { /* allow on failure */ }
  return false;
}

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const userToken = extractTokenFromReq(req);

  if (req.method === 'POST') {
    if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    if (await checkTierLimit(cfg, userToken, res)) return;

    try {
      const body = req.body || {};
      const r = await fetch(restUrl(cfg, 'tags'), {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, userToken, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(pick(body)),
      });
      const text = await r.text();
      if (!r.ok) {
        if (body.name && isDuplicate(text)) {
          const existing = await lookupByName(cfg, body.name, cfg.serviceKey);
          if (existing) return sendOk(res, { data: existing });
        }
        return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: text });
      }
      const created = JSON.parse(text);
      return res.status(HTTP.CREATED).json({ success: true, data: Array.isArray(created) ? created[0] : created });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  if (req.method === 'GET') {
    if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    try {
      const r = await fetch(`${restUrl(cfg, 'tags')}?select=*,site_tags(count)`, { headers: buildHeaders(cfg.anonKey, userToken) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const raw = await r.json();
      const data = raw.map(({ site_tags: st, ...rest }) => ({ ...rest, site_count: st?.[0]?.count ?? 0 }));
      return sendOk(res, { data });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Only GET and POST are allowed');
}
