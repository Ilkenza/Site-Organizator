/** Dashboard statistics — counts + insights for pricing, categories, and growth. */

import {
  HTTP,
  buildHeaders,
  configGuard,
  decodeJwt,
  extractTokenFromReq,
  methodGuard,
  resolveTier,
  restUrl,
  sendError,
  sendOk,
} from './helpers/api-utils';
import { hasFeature } from '../../lib/tierConfig';

const BATCH = 1000;

function h(cfg, token, opts) {
  return buildHeaders(cfg.anonKey, token, opts);
}

function parseCount(r) {
  const range = r.headers.get('content-range');
  if (range) {
    const m = range.match(/\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

async function fetchCount(cfg, token, table, filters = []) {
  let url = `${restUrl(cfg, table)}?select=id`;
  filters.forEach(f => { url += `&${f}`; });
  const r = await fetch(url, { headers: h(cfg, token, { prefer: 'count=exact' }) });
  if (!r.ok) throw new Error(await r.text());
  const count = parseCount(r);
  if (count !== null) return count;
  const data = await r.json();
  return Array.isArray(data) ? data.length : 0;
}

async function fetchAll(cfg, token, table, select, filters = []) {
  const all = [];
  for (let offset = 0; ; offset += BATCH) {
    let url = `${restUrl(cfg, table)}?select=${encodeURIComponent(select)}&limit=${BATCH}&offset=${offset}`;
    filters.forEach(f => { url += `&${f}`; });
    const r = await fetch(url, { headers: h(cfg, token) });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    all.push(...data);
    if (!Array.isArray(data) || data.length < BATCH) break;
  }
  return all;
}

function pricingBuckets(rows) {
  const buckets = {
    fully_free: 0,
    freemium: 0,
    free_trial: 0,
    paid: 0,
    unknown: 0,
  };

  for (const row of rows) {
    const key = (row?.pricing || '').toLowerCase();
    if (buckets[key] !== undefined) buckets[key] += 1;
    else buckets.unknown += 1;
  }

  return [
    { key: 'fully_free', label: 'Fully Free', count: buckets.fully_free },
    { key: 'freemium', label: 'Freemium', count: buckets.freemium },
    { key: 'free_trial', label: 'Free Trial', count: buckets.free_trial },
    { key: 'paid', label: 'Paid', count: buckets.paid },
    { key: 'unknown', label: 'Unknown', count: buckets.unknown },
  ];
}

function topCategories(rows) {
  const counts = new Map();
  for (const row of rows) {
    const id = row?.category_id;
    if (!id) continue;
    const name = row?.category?.name || 'Unknown';
    const entry = counts.get(id) || { categoryId: id, name, count: 0 };
    entry.count += 1;
    counts.set(id, entry);
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function topTags(rows) {
  const counts = new Map();
  for (const row of rows) {
    const id = row?.tag_id;
    if (!id) continue;
    const name = row?.tag?.name || 'Unknown';
    const entry = counts.get(id) || { tagId: id, name, count: 0 };
    entry.count += 1;
    counts.set(id, entry);
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function monthRanges() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startThis = new Date(Date.UTC(y, m, 1));
  const startNext = new Date(Date.UTC(y, m + 1, 1));
  const startPrev = new Date(Date.UTC(y, m - 1, 1));
  return {
    thisStart: startThis.toISOString(),
    thisEnd: startNext.toISOString(),
    prevStart: startPrev.toISOString(),
    prevEnd: startThis.toISOString(),
  };
}

export default async function handler(req, res) {
  const cfg = configGuard(res); if (!cfg) return;
  if (!methodGuard(req, res, 'GET')) return;

  const token = extractTokenFromReq(req);
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
  const jwt = decodeJwt(token);
  if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
  const userId = jwt.sub;
  const { tier } = resolveTier(jwt);
  if (!hasFeature(tier, 'statsInsights')) {
    return sendError(res, HTTP.FORBIDDEN, 'Pro plan required for stats insights');
  }

  try {
    const [sites, categories, tags] = await Promise.all([
      fetchCount(cfg, token, 'sites', [`user_id=eq.${userId}`]),
      fetchCount(cfg, token, 'categories', [`user_id=eq.${userId}`]),
      fetchCount(cfg, token, 'tags', [`user_id=eq.${userId}`]),
    ]);

    const { thisStart, thisEnd, prevStart, prevEnd } = monthRanges();
    const [addedThisMonth, addedLastMonth] = await Promise.all([
      fetchCount(cfg, token, 'sites', [
        `user_id=eq.${userId}`,
        `created_at=gte.${encodeURIComponent(thisStart)}`,
        `created_at=lt.${encodeURIComponent(thisEnd)}`,
      ]),
      fetchCount(cfg, token, 'sites', [
        `user_id=eq.${userId}`,
        `created_at=gte.${encodeURIComponent(prevStart)}`,
        `created_at=lt.${encodeURIComponent(prevEnd)}`,
      ]),
    ]);

    const pricingRows = await fetchAll(cfg, token, 'sites', 'pricing', [`user_id=eq.${userId}`]);
    const pricingDistribution = pricingBuckets(pricingRows);

    const categoryRows = await fetchAll(
      cfg,
      token,
      'site_categories',
      'category_id,category:categories(name,user_id)',
      [`category.user_id=eq.${userId}`]
    );
    const topCategoriesList = topCategories(categoryRows);

    const tagRows = await fetchAll(
      cfg,
      token,
      'site_tags',
      'tag_id,tag:tags(name,user_id)',
      [`tag.user_id=eq.${userId}`]
    );
    const topTagsList = topTags(tagRows);

    const recentUrl = `${restUrl(cfg, 'sites')}?select=${encodeURIComponent('id,name,url,created_at')}&user_id=eq.${userId}&order=created_at.desc&limit=5`;
    const recentRes = await fetch(recentUrl, { headers: h(cfg, token) });
    const recentSites = recentRes.ok ? await recentRes.json() : [];

    return sendOk(res, {
      stats: {
        sites,
        categories,
        tags,
        pricingDistribution,
        topCategories: topCategoriesList,
        topTags: topTagsList,
        addedThisMonth,
        addedLastMonth,
        recentSites,
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return sendError(res, HTTP.INTERNAL_ERROR, error.message, {
      stats: {
        sites: 0,
        categories: 0,
        tags: 0,
        pricingDistribution: [],
        topCategories: [],
        addedThisMonth: 0,
        addedLastMonth: 0,
      }
    });
  }
}
