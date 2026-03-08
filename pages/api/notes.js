/** Notes collection — GET all (with filters/sort/pagination), POST create */

import {
  HTTP, configGuard, extractTokenFromReq, resolveTier, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';
import { TIER_LIMITS } from '../../lib/tierConfig';

const ALLOWED = ['name', 'description', 'group_id'];
const pick = (body) => Object.fromEntries(ALLOWED.filter(k => body[k] !== undefined).map(k => [k, body[k]]));

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 5000;

async function checkTierLimit(cfg, userToken, res) {
  const { tier } = resolveTier(userToken);
  const limit = TIER_LIMITS[tier]?.notes ?? TIER_LIMITS.free.notes;
  if (limit === Infinity) return false;
  try {
    const r = await fetch(`${restUrl(cfg, 'notes')}?select=id&limit=${limit + 1}`, { headers: buildHeaders(cfg.anonKey, userToken) });
    if (r.ok) {
      const rows = await r.json();
      if (rows.length >= limit) {
        sendError(res, HTTP.FORBIDDEN, `Note limit reached (${rows.length}/${limit}).`);
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
  if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');

  if (req.method === 'POST') {
    if (await checkTierLimit(cfg, userToken, res)) return;
    try {
      const body = req.body || {};
      const data = pick(body);
      // Handle null group_id explicitly
      if (data.group_id === '' || data.group_id === 'null') data.group_id = null;
      // Set user_id from JWT for RLS
      const jwt = decodeJwt(userToken);
      if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
      data.user_id = jwt.sub;

      const r = await fetch(restUrl(cfg, 'notes'), {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, userToken, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(data),
      });
      const text = await r.text();
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: text });
      const created = JSON.parse(text);
      return res.status(HTTP.CREATED).json({ success: true, data: Array.isArray(created) ? created[0] : created });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  if (req.method === 'GET') {
    try {
      const q = req.query || {};
      let limit = parseInt(q.limit, 10) || DEFAULT_LIMIT;
      if (limit <= 0) limit = DEFAULT_LIMIT;
      if (limit > MAX_LIMIT) limit = MAX_LIMIT;
      let page = parseInt(q.page, 10) || 1;
      if (page <= 0) page = 1;
      const offset = (page - 1) * limit;

      // Build query
      let queryUrl = `${restUrl(cfg, 'notes')}?select=*,note_groups(id,name,color)`;

      // Search filter
      if (q.q) {
        const search = encodeURIComponent(`%${q.q}%`);
        queryUrl += `&or=(name.ilike.${search},description.ilike.${search})`;
      }

      // Group filter
      if (q.group_id) {
        if (q.group_id === 'ungrouped') {
          queryUrl += '&group_id=is.null';
        } else {
          queryUrl += `&group_id=eq.${q.group_id}`;
        }
      }

      // Sort
      const validSorts = ['created_at', 'updated_at', 'name'];
      const sortBy = validSorts.includes(q.sort_by) ? q.sort_by : 'created_at';
      const sortOrder = q.sort_order === 'asc' ? 'asc' : 'desc';
      queryUrl += `&order=${sortBy}.${sortOrder}`;

      // Pagination
      queryUrl += `&limit=${limit}&offset=${offset}`;

      const r = await fetch(queryUrl, {
        headers: { ...buildHeaders(cfg.anonKey, userToken), Prefer: 'count=exact' },
      });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });

      const items = await r.json();
      const crh = r.headers.get('content-range');
      let total = crh ? parseInt(crh.match(/\/(\d+)/)?.[1], 10) : null;
      if (total == null) total = Array.isArray(items) ? items.length : 0;

      return sendOk(res, { data: items, totalCount: total });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
