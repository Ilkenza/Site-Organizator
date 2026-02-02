/**
 * @fileoverview API endpoint for fetching dashboard statistics
 * Returns counts for sites, categories, and tags
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500
};

// Error Messages
const ERROR_MESSAGES = {
  METHOD_NOT_ALLOWED: 'Method not allowed',
  MISSING_ENV: 'SUPABASE_URL is required'
};

// Configuration
const STATS_CONFIG = {
  TABLES: ['sites', 'categories', 'tags'],
  SELECT_FIELD: 'id',
  COUNT_PREFERENCE: 'count=exact',
  DEFAULT_COUNT: 0
};

// Count regex pattern
const COUNT_REGEX = /\/(\d+)/;

/**
 * Build Supabase count request URL
 * @param {string} baseUrl - Supabase base URL
 * @param {string} table - Table name
 * @returns {string} Complete request URL
 */
const buildCountUrl = (baseUrl, table) => {
  return `${baseUrl}/rest/v1/${table}?select=${STATS_CONFIG.SELECT_FIELD}`;
};

/**
 * Build Supabase request headers
 * @param {string} apiKey - Supabase API key
 * @returns {Object} Request headers
 */
const buildHeaders = (apiKey) => {
  return {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Prefer': STATS_CONFIG.COUNT_PREFERENCE
  };
};

/**
 * Parse count from Content-Range header
 * @param {string|null} contentRange - Content-Range header value
 * @returns {number|null} Parsed count or null
 */
const parseContentRangeCount = (contentRange) => {
  if (!contentRange) return null;

  const match = contentRange.match(COUNT_REGEX);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Get count from response data fallback
 * @param {*} data - Response data
 * @returns {number} Count from data length
 */
const getCountFromData = (data) => {
  return Array.isArray(data) ? data.length : STATS_CONFIG.DEFAULT_COUNT;
};

/**
 * Fetch row count for a specific table
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - Supabase API key
 * @param {string} table - Table name
 * @returns {Promise<number>} Row count
 */
const fetchTableCount = async (baseUrl, apiKey, table) => {
  const url = buildCountUrl(baseUrl, table);
  const headers = buildHeaders(apiKey);

  const response = await fetch(url, { headers });

  // Try to get count from Content-Range header first
  const contentRange = response.headers.get('content-range');
  const headerCount = parseContentRangeCount(contentRange);

  if (headerCount !== null) {
    return headerCount;
  }

  // Fallback to counting array length
  const data = await response.json();
  return getCountFromData(data);
};

/**
 * Fetch all statistics in parallel
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - Supabase API key
 * @returns {Promise<Object>} Statistics object with counts
 */
const fetchAllStats = async (baseUrl, apiKey) => {
  const [sites, categories, tags] = await Promise.all([
    fetchTableCount(baseUrl, apiKey, 'sites'),
    fetchTableCount(baseUrl, apiKey, 'categories'),
    fetchTableCount(baseUrl, apiKey, 'tags')
  ]);

  return { sites, categories, tags };
};

/**
 * Build success response
 * @param {Object} stats - Statistics object
 * @returns {Object} Success response
 */
const buildSuccessResponse = (stats) => {
  return {
    success: true,
    stats
  };
};

/**
 * Build error response
 * @param {Error} error - Error object
 * @returns {Object} Error response with default stats
 */
const buildErrorResponse = (error) => {
  return {
    success: false,
    error: error.message,
    stats: {
      sites: STATS_CONFIG.DEFAULT_COUNT,
      categories: STATS_CONFIG.DEFAULT_COUNT,
      tags: STATS_CONFIG.DEFAULT_COUNT
    }
  };
};

/**
 * Handle GET request - fetch statistics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} apiKey - Supabase API key
 * @returns {Promise<void>}
 */
const handleGetRequest = async (req, res, baseUrl, apiKey) => {
  try {
    const stats = await fetchAllStats(baseUrl, apiKey);
    const response = buildSuccessResponse(stats);

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    console.error('Stats error:', error);
    const response = buildErrorResponse(error);

    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(response);
  }
};

/**
 * Main API handler for statistics
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.MISSING_ENV
    });
  }

  if (req.method !== 'GET') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
      error: ERROR_MESSAGES.METHOD_NOT_ALLOWED
    });
  }

  return await handleGetRequest(req, res, SUPABASE_URL, SUPABASE_KEY);
}
