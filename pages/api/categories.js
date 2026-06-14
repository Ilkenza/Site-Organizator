/** Categories collection — GET all, POST create */

import {
  HTTP, configGuard, extractTokenFromReq, isDuplicate, decodeJwt,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';
import { makePick, lookupByName, enforceTierLimit } from './helpers/crud-utils';

const ALLOWED = ['name', 'color', 'display_order', 'is_needed'];
const pick = makePick(ALLOWED);

export default async function handler(req, res) {
  const cfg = configGuard(res);
  if (!cfg) return;
  const userToken = extractTokenFromReq(req);

  if (req.method === 'POST') {
    if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    if (await enforceTierLimit({ cfg, token: userToken, res, table: 'categories', limitKey: 'categories', label: 'Category' })) return;

    try {
      const body = req.body || {};

      // Duplicate name check — return existing if same name already exists for this user
      if (body.name) {
        const existing = await lookupByName(cfg, 'categories', body.name, userToken);
        if (existing) return sendOk(res, { data: existing });
      }

      // Set user_id from JWT for RLS
      const jwt = decodeJwt(userToken);
      if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
      const payload = { ...pick(body), user_id: jwt.sub };

      const r = await fetch(restUrl(cfg, 'categories'), {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, userToken, { contentType: true, prefer: 'return=representation' }),
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (!r.ok) {
        if (body.name && isDuplicate(text)) {
          const existing = await lookupByName(cfg, 'categories', body.name, cfg.serviceKey);
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
      const r = await fetch(`${restUrl(cfg, 'categories')}?select=*,site_categories(count)`, { headers: buildHeaders(cfg.anonKey, userToken) });
      if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
      const raw = await r.json();
      const data = raw.map(({ site_categories: sc, ...rest }) => ({ ...rest, site_count: sc?.[0]?.count ?? 0 }));
      return sendOk(res, { data });
    } catch (err) {
      return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
  }

  return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
}
