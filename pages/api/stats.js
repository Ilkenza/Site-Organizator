/** Dashboard statistics — counts for sites, categories, tags. */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';
import { HTTP, sendError, sendOk, methodGuard } from './helpers/api-utils';

async function fetchCount(baseUrl, apiKey, table, userId) {
  const url = `${baseUrl}/rest/v1/${table}?select=id&user_id=eq.${userId}`;
  const r = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Prefer: 'count=exact' }
  });
  const range = r.headers.get('content-range');
  if (range) { const m = range.match(/\/(\d+)/); if (m) return parseInt(m[1], 10); }
  const data = await r.json();
  return Array.isArray(data) ? data.length : 0;
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL) return sendError(res, HTTP.INTERNAL_ERROR, 'SUPABASE_URL is required');

  const auth = await verifyUserFromAuthHeader(req.headers.authorization);
  if (!auth.success) return sendError(res, HTTP.UNAUTHORIZED, auth.error);

  try {
    const [sites, categories, tags] = await Promise.all([
      fetchCount(SUPABASE_URL, KEY, 'sites', auth.user.id),
      fetchCount(SUPABASE_URL, KEY, 'categories', auth.user.id),
      fetchCount(SUPABASE_URL, KEY, 'tags', auth.user.id),
    ]);
    return sendOk(res, { stats: { sites, categories, tags } });
  } catch (error) {
    console.error('Stats error:', error);
    return sendError(res, HTTP.INTERNAL_ERROR, error.message, { stats: { sites: 0, categories: 0, tags: 0 } });
  }
}
