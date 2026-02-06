/**
 * @fileoverview API endpoint for fetching dashboard statistics
 * Returns counts for sites, categories, and tags for the authenticated user
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500
};

// Configuration
const STATS_CONFIG = {
  TABLES: ['sites', 'categories', 'tags'],
  DEFAULT_COUNT: 0
};

/**
 * Fetch row count for a specific table filtered by user_id
 */
const fetchTableCount = async (baseUrl, apiKey, table, userId) => {
  const url = `${baseUrl}/rest/v1/${table}?select=id&user_id=eq.${userId}`;
  const response = await fetch(url, {
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Prefer': 'count=exact'
    }
  });

  const contentRange = response.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  const data = await response.json();
  return Array.isArray(data) ? data.length : STATS_CONFIG.DEFAULT_COUNT;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, error: 'SUPABASE_URL is required' });
  }

  // Authenticate user
  const auth = await verifyUserFromAuthHeader(req.headers.authorization);
  if (!auth.success) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: auth.error });
  }

  const userId = auth.user.id;

  try {
    const [sites, categories, tags] = await Promise.all([
      fetchTableCount(SUPABASE_URL, SUPABASE_KEY, 'sites', userId),
      fetchTableCount(SUPABASE_URL, SUPABASE_KEY, 'categories', userId),
      fetchTableCount(SUPABASE_URL, SUPABASE_KEY, 'tags', userId)
    ]);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      stats: { sites, categories, tags }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: error.message,
      stats: { sites: 0, categories: 0, tags: 0 }
    });
  }
}
