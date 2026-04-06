/** Sidebar counts — returns all filter counts in a single API call */

import {
  HTTP, configGuard, authGuard,
  buildHeaders, restUrl, sendError, sendOk,
} from './helpers/api-utils';

function h(cfg, token, prefer) {
  return buildHeaders(cfg.anonKey, token, { prefer: prefer || 'count=exact' });
}

async function getCount(cfg, token, path) {
  try {
    const r = await fetch(path, { headers: h(cfg, token) });
    if (!r.ok) return 0;
    const crh = r.headers.get('content-range');
    return crh ? parseInt(crh.match(/\/(\d+)/)?.[1], 10) || 0 : 0;
  } catch { return 0; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
  const cfg = configGuard(res);
  if (!cfg) return;
  const token = authGuard(req, res);
  if (!token) return;

  const base = restUrl(cfg, 'sites');
  const q = `?select=id&limit=0`;

  const [
    total, favorites, uncategorized, untagged,
    manual, bookmarks, notion, file,
    fullyFree, freemium, freeTrial, paid,
    needed, notNeeded,
    usedDesktop, usedMobile, usedBoth, usedWeb
  ] = await Promise.all([
    getCount(cfg, token, `${base}${q}`),
    getCount(cfg, token, `${base}${q}&is_favorite=eq.true`),
    getCount(cfg, token, `${base}?select=id,site_categories!left(category_id)&site_categories=is.null&limit=0`),
    getCount(cfg, token, `${base}?select=id,site_tags!left(tag_id)&site_tags=is.null&limit=0`),
    getCount(cfg, token, `${base}${q}&import_source=eq.manual`),
    getCount(cfg, token, `${base}${q}&import_source=eq.bookmarks`),
    getCount(cfg, token, `${base}${q}&import_source=eq.notion`),
    getCount(cfg, token, `${base}${q}&import_source=eq.file`),
    getCount(cfg, token, `${base}${q}&pricing=eq.fully_free`),
    getCount(cfg, token, `${base}${q}&pricing=eq.freemium`),
    getCount(cfg, token, `${base}${q}&pricing=eq.free_trial`),
    getCount(cfg, token, `${base}${q}&pricing=eq.paid`),
    getCount(cfg, token, `${base}${q}&is_needed=eq.true`),
    getCount(cfg, token, `${base}${q}&or=(is_needed.eq.false,is_needed.is.null)`),
    getCount(cfg, token, `${base}${q}&used_on=eq.desktop`),
    getCount(cfg, token, `${base}${q}&used_on=eq.mobile`),
    getCount(cfg, token, `${base}${q}&used_on=eq.both`),
    getCount(cfg, token, `${base}${q}&used_on=eq.web`),
  ]);

  return sendOk(res, {
    total,
    favorites,
    uncategorized,
    untagged,
    importSources: { manual, bookmarks, notion, file },
    pricingCounts: { fully_free: fullyFree, freemium, free_trial: freeTrial, paid },
    neededCounts: { needed, not_needed: notNeeded },
    usedOnCounts: { desktop: usedDesktop, mobile: usedMobile, both: usedBoth, web: usedWeb },
  });
}
