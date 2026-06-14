/** Storage items collection — GET all (with filters/sort/pagination), POST create */

import {
  HTTP, configGuard, extractTokenFromReq, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';
import { makePick, enforceTierLimit, parsePagination, parseSort, totalCountFromRes } from './helpers/crud-utils';

const ALLOWED = ['name', 'location', 'link', 'type', 'description'];
const pick = makePick(ALLOWED);
const VALID_SORTS = ['created_at', 'updated_at', 'name', 'location', 'type'];

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const userToken = extractTokenFromReq(req);
  if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');

  if (req.method === 'POST') {
    if (await enforceTierLimit({ cfg, token: userToken, res, table: 'storage_items', limitKey: 'storageItems', label: 'Storage item' })) return;
    try {
      const body = req.body || {};
      const data = pick(body);
      const jwt = decodeJwt(userToken);
      if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
      data.user_id = jwt.sub;

      const r = await fetch(restUrl(cfg, 'storage_items'), {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, userToken, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(data),
      });
      const text = await r.text();
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: text });
      const created = JSON.parse(text);
      const item = Array.isArray(created) ? created[0] : created;

      // Sync tags if provided
      const tagIds = body.tagIds;
      if (Array.isArray(tagIds) && tagIds.length > 0 && item.id) {
        const rows = tagIds.map(tag_id => ({ storage_item_id: item.id, tag_id }));
        await fetch(restUrl(cfg, 'storage_item_tags'), {
          method: 'POST',
          headers: buildHeaders(cfg.anonKey, userToken, { contentType: true }),
          body: JSON.stringify(rows),
        }).catch(() => { });
      }

      item.tags_array = (tagIds || []).map(id => ({ id }));
      return res.status(HTTP.CREATED).json({ success: true, data: item });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  if (req.method === 'GET') {
    try {
      const q = req.query || {};
      const { limit, offset } = parsePagination(q);

      let queryUrl = `${restUrl(cfg, 'storage_items')}?select=*`;

      if (q.q) {
        const search = encodeURIComponent(`%${q.q}%`);
        queryUrl += `&or=(name.ilike.${search},location.ilike.${search},description.ilike.${search})`;
      }

      if (q.location) {
        queryUrl += `&location=eq.${encodeURIComponent(q.location)}`;
      }
      if (q.type) {
        queryUrl += `&type=cs.{${encodeURIComponent(q.type)}}`;
      }

      const { clause } = parseSort(q, VALID_SORTS);
      queryUrl += `&order=${clause}`;

      queryUrl += `&limit=${limit}&offset=${offset}`;

      const r = await fetch(queryUrl, {
        headers: { ...buildHeaders(cfg.anonKey, userToken), Prefer: 'count=exact' },
      });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });

      const items = await r.json();
      const total = totalCountFromRes(r, items);

      // Fetch tags for all items
      if (Array.isArray(items) && items.length > 0) {
        const ids = items.map(i => i.id);
        const tagRes = await fetch(
          `${restUrl(cfg, 'storage_item_tags')}?storage_item_id=in.(${ids.join(',')})&select=storage_item_id,tag_id,tags(id,name,color)`,
          { headers: buildHeaders(cfg.anonKey, userToken) }
        ).catch(() => null);
        if (tagRes?.ok) {
          const tagRows = await tagRes.json();
          const tagMap = {};
          tagRows.forEach(row => {
            if (!tagMap[row.storage_item_id]) tagMap[row.storage_item_id] = [];
            if (row.tags) tagMap[row.storage_item_id].push(row.tags);
          });
          items.forEach(item => { item.tags_array = tagMap[item.id] || []; });
        } else {
          items.forEach(item => { item.tags_array = []; });
        }
      }

      return sendOk(res, { data: items, totalCount: total });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
