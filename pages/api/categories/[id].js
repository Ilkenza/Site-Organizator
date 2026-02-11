/** Individual category — GET, PUT/PATCH, DELETE */

import {
  HTTP, configGuard, extractTokenFromReq, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from '../helpers/api-utils';

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const { id } = req.query;
  const token = extractTokenFromReq(req);
  const authToken = token || cfg.anonKey;
  const h = (opts) => buildHeaders(cfg.anonKey, authToken, opts);
  const url = `${restUrl(cfg, 'categories')}?id=eq.${id}`;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    try {
      const raw = req.body || {};
      const body = {};
      if (raw.name !== undefined) body.name = raw.name;
      if (raw.color !== undefined) body.color = raw.color;
      body.user_id = decodeJwt(token)?.sub;
      const r = await fetch(url, { method: 'PATCH', headers: h({ contentType: true, prefer: 'return=representation' }), body: JSON.stringify(body) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const d = await r.json();
      return sendOk(res, { data: Array.isArray(d) ? d[0] : d });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'DELETE') {
    if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    try {
      const dh = buildHeaders(cfg.anonKey, token);
      await fetch(`${restUrl(cfg, 'site_categories')}?category_id=eq.${id}`, { method: 'DELETE', headers: dh });
      const r = await fetch(url, { method: 'DELETE', headers: dh });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      return sendOk(res);
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(url, { headers: h() });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const rows = await r.json();
      return sendOk(res, { data: rows[0] || null });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
