/** Rediscover — GET random forgotten sites, POST track site click */

import {
  HTTP, configGuard, extractTokenFromReq,
  buildHeaders, restUrl, sendError, sendOk, methodGuard, decodeJwt,
} from './helpers/api-utils';

function h(cfg, token, opts) { return buildHeaders(cfg.anonKey, token, opts); }

export default async function handler(req, res) {
  const cfg = configGuard(res); if (!cfg) return;
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  const token = extractTokenFromReq(req);
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Not authenticated');

  const jwt = decodeJwt(token);
  const userId = jwt?.sub;
  if (!userId) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');

  // POST — track a site click (update last_clicked_at)
  if (req.method === 'POST') {
    const { siteId } = req.body || {};
    if (!siteId) return sendError(res, HTTP.BAD_REQUEST, 'siteId required');

    const r = await fetch(
      `${restUrl(cfg, 'sites')}?id=eq.${siteId}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: h(cfg, token, { contentType: true, prefer: 'return=minimal' }),
        body: JSON.stringify({ last_clicked_at: new Date().toISOString() }),
      }
    );

    if (!r.ok) return sendError(res, HTTP.INTERNAL_ERROR, 'Failed to track click');
    return sendOk(res, { tracked: true });
  }

  // GET — fetch random forgotten sites (saved 30+ days ago, not clicked in 30+ days or never clicked)
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const daysThreshold = parseInt(req.query.days) || 30;
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();
  const ec = encodeURIComponent(cutoff);

  // Fetch sites that are old enough AND either never clicked or not clicked recently
  const query = [
    `user_id=eq.${userId}`,
    `created_at=lt.${ec}`,
    `or=(last_clicked_at.is.null,last_clicked_at.lt.${ec})`,
    'select=id,name,url,pricing,created_at,last_clicked_at,is_favorite,is_pinned',
    `limit=${limit}`,
    'order=created_at.asc',
  ].join('&');

  const r = await fetch(`${restUrl(cfg, 'sites')}?${query}`, {
    headers: h(cfg, token),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => '');
    console.error('Rediscover fetch error:', r.status, err);
    return sendError(res, HTTP.INTERNAL_ERROR, 'Failed to fetch forgotten sites');
  }

  const sites = await r.json();

  // Shuffle to make it feel random (since we can't ORDER BY random() in PostgREST)
  for (let i = sites.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sites[i], sites[j]] = [sites[j], sites[i]];
  }

  // Take only `limit` after shuffle (we may have fetched more for variety)
  const result = sites.slice(0, limit).map(s => ({
    ...s,
    days_since_saved: Math.floor((Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    days_since_clicked: s.last_clicked_at
      ? Math.floor((Date.now() - new Date(s.last_clicked_at).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }));

  return sendOk(res, { sites: result, total: sites.length });
}
