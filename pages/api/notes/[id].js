/** Individual note — GET, PUT/PATCH, DELETE */

import {
  HTTP, configGuard, extractTokenFromReq,
  buildHeaders, restUrl, sendError, sendOk, guardUUID,
} from '../helpers/api-utils';

const ALLOWED = ['name', 'description', 'group_id'];
const pick = (body) => {
  const result = {};
  for (const k of ALLOWED) {
    if (body[k] !== undefined) result[k] = body[k];
  }
  // Handle null group_id
  if (result.group_id === '' || result.group_id === 'null') result.group_id = null;
  return result;
};

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const { id } = req.query;
  if (!guardUUID(id, res)) return;
  const token = extractTokenFromReq(req);
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
  const h = (opts) => buildHeaders(cfg.anonKey, token, opts);
  const url = `${restUrl(cfg, 'notes')}?id=eq.${id}`;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const filtered = pick(req.body || {});
      filtered.updated_at = new Date().toISOString();
      const r = await fetch(url, {
        method: 'PATCH',
        headers: h({ contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(filtered),
      });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const d = await r.json();
      // Refetch with group info
      const refetch = await fetch(`${restUrl(cfg, 'notes')}?id=eq.${id}&select=*,note_groups(id,name,color)`, { headers: h() });
      if (refetch.ok) {
        const rows = await refetch.json();
        if (rows[0]) return sendOk(res, { data: rows[0] });
      }
      return sendOk(res, { data: Array.isArray(d) ? d[0] : d });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'DELETE') {
    try {
      const r = await fetch(url, { method: 'DELETE', headers: h() });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      return sendOk(res);
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${restUrl(cfg, 'notes')}?id=eq.${id}&select=*,note_groups(id,name,color)`, { headers: h() });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const rows = await r.json();
      return sendOk(res, { data: rows[0] || null });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
