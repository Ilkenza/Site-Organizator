/** Courses collection — GET all (with filters/sort/pagination), POST create */

import {
  HTTP, configGuard, extractTokenFromReq, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';
import { makePick, enforceTierLimit, parsePagination, parseSort, totalCountFromRes } from './helpers/crud-utils';

const ALLOWED = ['name', 'platform', 'link', 'status', 'progress', 'category', 'notes_text'];
const VALID_STATUSES = ['not_started', 'in_progress', 'completed'];
const VALID_SORTS = ['created_at', 'updated_at', 'name', 'platform', 'status', 'progress'];

const pick = makePick(ALLOWED, (result) => {
  // Validate status
  if (result.status && !VALID_STATUSES.includes(result.status)) delete result.status;
  // Clamp progress to 0–100
  if (result.progress !== undefined) {
    result.progress = Math.max(0, Math.min(100, parseInt(result.progress, 10) || 0));
  }
  return result;
});

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const userToken = extractTokenFromReq(req);
  if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');

  if (req.method === 'POST') {
    if (await enforceTierLimit({ cfg, token: userToken, res, table: 'courses', limitKey: 'courses', label: 'Course' })) return;
    try {
      const body = req.body || {};
      const data = pick(body);
      const jwt = decodeJwt(userToken);
      if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
      data.user_id = jwt.sub;

      const r = await fetch(restUrl(cfg, 'courses'), {
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
      const { limit, offset } = parsePagination(q);

      let queryUrl = `${restUrl(cfg, 'courses')}?select=*`;

      if (q.q) {
        const search = encodeURIComponent(`%${q.q}%`);
        queryUrl += `&or=(name.ilike.${search},platform.ilike.${search},category.ilike.${search})`;
      }

      if (q.status && VALID_STATUSES.includes(q.status)) {
        queryUrl += `&status=eq.${q.status}`;
      }
      if (q.platform) {
        queryUrl += `&platform=eq.${encodeURIComponent(q.platform)}`;
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

      return sendOk(res, { data: items, totalCount: total });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
