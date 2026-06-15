/** Tags collection — GET all, POST create */

import {
  HTTP, configGuard, extractTokenFromReq, isDuplicate, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';
import { makePick, lookupByName, enforceTierLimit, parsePagination, totalCountFromRes } from './helpers/crud-utils';

const ALLOWED = ['name', 'color', 'is_needed'];
const pick = makePick(ALLOWED);

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const userToken = extractTokenFromReq(req);

  if (req.method === 'POST') {
    if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    if (await enforceTierLimit({ cfg, token: userToken, res, table: 'tags', limitKey: 'tags', label: 'Tag' })) return;

    try {
      const body = req.body || {};

      // Duplicate name check — return existing if same name already exists for this user
      if (body.name) {
        const existing = await lookupByName(cfg, 'tags', body.name, userToken);
        if (existing) return sendOk(res, { data: existing });
      }

      // Set user_id from JWT for RLS
      const jwt = decodeJwt(userToken);
      if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
      const payload = { ...pick(body), user_id: jwt.sub };

      const r = await fetch(restUrl(cfg, 'tags'), {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, userToken, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (!r.ok) {
        if (body.name && isDuplicate(text)) {
          const existing = await lookupByName(cfg, 'tags', body.name, cfg.serviceKey);
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
      const query = req.query || {};
      // Per-tag site count is on by default; pass counts=0 to skip the (heavier) aggregate.
      const wantCounts = query.counts !== '0';
      // Paginate only when asked — keeps the default call backward compatible (returns all).
      const paginated = query.page !== undefined || query.limit !== undefined;

      let url = `${restUrl(cfg, 'tags')}?select=${wantCounts ? '*,site_tags(count)' : '*'}`;
      if (query.q) {
        url += `&name=ilike.${encodeURIComponent(`%${query.q}%`)}`;
      }
      url += '&order=name.asc';

      const headers = buildHeaders(cfg.anonKey, userToken);
      if (paginated) {
        const { limit, offset } = parsePagination(query);
        url += `&limit=${limit}&offset=${offset}`;
        headers.Prefer = 'count=exact';
      }

      const r = await fetch(url, { headers });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const raw = await r.json();
      const data = wantCounts
        ? raw.map(({ site_tags: st, ...rest }) => ({ ...rest, site_count: st?.[0]?.count ?? 0 }))
        : raw;

      const result = { data };
      if (paginated) result.totalCount = totalCountFromRes(r, raw);
      return sendOk(res, result);
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Only GET and POST are allowed');
}
