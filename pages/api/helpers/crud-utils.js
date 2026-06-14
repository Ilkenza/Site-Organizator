/**
 * Shared CRUD helpers for collection API routes
 * (categories, tags, notes, note-groups, courses, storage-items).
 *
 * Replaces the copy-pasted `pick` / `checkTierLimit` / `lookupByName` /
 * pagination / sort logic that previously lived in each route.
 */

import { TIER_LIMITS, TIER_LABELS } from '../../../lib/tierConfig';
import { HTTP, buildHeaders, restUrl, resolveTier, sendError } from './api-utils';

// ─── Pagination ───────────────────────────────────────────────────────────────
export const API_PAGINATION = { DEFAULT_LIMIT: 100, MAX_LIMIT: 5000 };

/** Parse `limit` / `page` query params into { limit, page, offset } (clamped). */
export function parsePagination(query = {}) {
  let limit = parseInt(query.limit, 10) || API_PAGINATION.DEFAULT_LIMIT;
  if (limit <= 0) limit = API_PAGINATION.DEFAULT_LIMIT;
  if (limit > API_PAGINATION.MAX_LIMIT) limit = API_PAGINATION.MAX_LIMIT;
  let page = parseInt(query.page, 10) || 1;
  if (page <= 0) page = 1;
  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────
/** Validate `sort_by` / `sort_order` against an allow-list; returns a PostgREST clause. */
export function parseSort(query = {}, validSorts = [], defaultSort = 'created_at') {
  const sortBy = validSorts.includes(query.sort_by) ? query.sort_by : defaultSort;
  const sortOrder = query.sort_order === 'asc' ? 'asc' : 'desc';
  return { sortBy, sortOrder, clause: `${sortBy}.${sortOrder}` };
}

// ─── Total count (PostgREST content-range) ─────────────────────────────────────
/** Extract the exact total row count from a PostgREST `content-range` header. */
export function totalCountFromRes(r, items) {
  const crh = r.headers.get('content-range');
  const parsed = crh ? parseInt(crh.match(/\/(\d+)/)?.[1], 10) : null;
  if (parsed != null && !Number.isNaN(parsed)) return parsed;
  return Array.isArray(items) ? items.length : 0;
}

// ─── Field picker ─────────────────────────────────────────────────────────────
/**
 * Build a `pick(body)` function that keeps only the allowed fields.
 * Pass an optional `transform(result, body)` for per-route validation/coercion.
 */
export function makePick(allowed, transform) {
  return (body = {}) => {
    const result = {};
    for (const k of allowed) {
      if (body[k] !== undefined) result[k] = body[k];
    }
    return transform ? transform(result, body) : result;
  };
}

// ─── Lookup row by unique name (upsert-on-duplicate flows) ─────────────────────
export async function lookupByName(cfg, table, name, token) {
  if (!name) return null;
  try {
    const r = await fetch(
      `${restUrl(cfg, table)}?select=*&name=eq.${encodeURIComponent(name)}`,
      { headers: buildHeaders(cfg.anonKey, token) }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

// ─── Tier-limit enforcement ────────────────────────────────────────────────────
function upgradeTarget(tier) {
  return tier === 'free' ? 'Pro or Pro Max' : 'Pro Max';
}

/**
 * Enforce the per-tier row limit for `table`. Sends a 403 and returns `true`
 * when the limit is reached; returns `false` when the request may proceed.
 *
 * @param {object}  opts
 * @param {object}  opts.cfg       Supabase config (from configGuard)
 * @param {string}  opts.token     user JWT
 * @param {object}  opts.res       Next.js response
 * @param {string}  opts.table     Supabase table name (e.g. 'storage_items')
 * @param {string}  opts.limitKey  TIER_LIMITS key (e.g. 'storageItems')
 * @param {string}  opts.label     Human noun for the error (e.g. 'Storage item')
 */
export async function enforceTierLimit({ cfg, token, res, table, limitKey, label }) {
  const { tier } = resolveTier(token);
  const limit = TIER_LIMITS[tier]?.[limitKey] ?? TIER_LIMITS.free[limitKey];
  if (limit === Infinity) return false;
  try {
    const r = await fetch(
      `${restUrl(cfg, table)}?select=id&limit=${limit + 1}`,
      { headers: buildHeaders(cfg.anonKey, token) }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows.length >= limit) {
        const tierLabel = TIER_LABELS[tier] || 'Free';
        sendError(
          res,
          HTTP.FORBIDDEN,
          `${label} limit reached (${rows.length}/${limit}). You are on the ${tierLabel} plan. Upgrade to ${upgradeTarget(tier)} for more.`
        );
        return true;
      }
    }
  } catch {
    /* allow on failure — never block a write because the count check failed */
  }
  return false;
}
