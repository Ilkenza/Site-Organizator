/** Individual storage item — GET, PUT/PATCH, DELETE */

import {
  HTTP, configGuard, extractTokenFromReq,
  buildHeaders, restUrl, sendError, sendOk, guardUUID,
} from '../helpers/api-utils';

const ALLOWED = ['name', 'location', 'link', 'type', 'description'];
const pick = (body) => {
  const result = {};
  for (const k of ALLOWED) {
    if (body[k] !== undefined) result[k] = body[k];
  }
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
  const url = `${restUrl(cfg, 'storage_items')}?id=eq.${id}`;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const filtered = pick(body);
      filtered.updated_at = new Date().toISOString();
      const r = await fetch(url, {
        method: 'PATCH',
        headers: h({ contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(filtered),
      });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const d = await r.json();
      const item = Array.isArray(d) ? d[0] : d;

      // Sync tags if provided
      const tagIds = body.tagIds;
      if (Array.isArray(tagIds)) {
        // Delete existing junction rows
        await fetch(`${restUrl(cfg, 'storage_item_tags')}?storage_item_id=eq.${id}`, {
          method: 'DELETE',
          headers: h(),
        }).catch(() => { });
        // Insert new ones
        if (tagIds.length > 0) {
          const rows = tagIds.map(tag_id => ({ storage_item_id: id, tag_id }));
          await fetch(restUrl(cfg, 'storage_item_tags'), {
            method: 'POST',
            headers: h({ contentType: true }),
            body: JSON.stringify(rows),
          }).catch(() => { });
        }
        item.tags_array = tagIds.map(tid => ({ id: tid }));
      }

      return sendOk(res, { data: item });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  if (req.method === 'DELETE') {
    try {
      // Delete junction rows first
      await fetch(`${restUrl(cfg, 'storage_item_tags')}?storage_item_id=eq.${id}`, {
        method: 'DELETE',
        headers: h(),
      }).catch(() => { });
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
      const item = rows[0] || null;
      if (item) {
        const tagRes = await fetch(
          `${restUrl(cfg, 'storage_item_tags')}?storage_item_id=eq.${id}&select=tag_id,tags(id,name,color)`,
          { headers: h() }
        ).catch(() => null);
        if (tagRes?.ok) {
          const tagRows = await tagRes.json();
          item.tags_array = tagRows.map(r => r.tags).filter(Boolean);
        } else {
          item.tags_array = [];
        }
      }
      return sendOk(res, { data: item });
    } catch (err) { return sendError(res, HTTP.INTERNAL_ERROR, err.message); }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
