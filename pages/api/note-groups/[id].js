/** Individual note group — GET, PUT/PATCH, DELETE */

import {
  HTTP, configGuard, extractTokenFromReq, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk, guardUUID,
} from '../helpers/api-utils';

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const { id } = req.query;
  if (!guardUUID(id, res)) return;
  const token = extractTokenFromReq(req);
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
  const h = (opts) => buildHeaders(cfg.anonKey, token, opts);
  const url = `${restUrl(cfg, 'note_groups')}?id=eq.${id}`;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const raw = req.body || {};
      const body = {};
      if (raw.name !== undefined) body.name = raw.name;
      if (raw.color !== undefined) body.color = raw.color;
      body.updated_at = new Date().toISOString();
      body.user_id = decodeJwt(token)?.sub;
      const r = await fetch(url, { method: 'PATCH', headers: h({ contentType: true, prefer: 'return=representation' }), body: JSON.stringify(body) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const d = await r.json();
      return sendOk(res, { data: Array.isArray(d) ? d[0] : d });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'DELETE') {
    try {
      // Unlink notes from this group (set group_id to null) before deleting
      await fetch(`${restUrl(cfg, 'notes')}?group_id=eq.${id}`, {
        method: 'PATCH',
        headers: h({ contentType: true }),
        body: JSON.stringify({ group_id: null }),
      });
      const r = await fetch(url, { method: 'DELETE', headers: h() });
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
