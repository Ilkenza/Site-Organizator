/**
 * @fileoverview Link health check API with retry logic and HEAD/GET fallback
 */

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Constants
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500,
    BAD_GATEWAY: 502,
};

const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method not allowed',
    MISSING_CONFIG: 'SUPABASE_URL / key missing',
    NOT_AUTHENTICATED: 'Not authenticated',
    UPSTREAM_ERROR: 'Upstream REST error',
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CHECK_CONFIG = {
    MAX_RETRIES: 2,
    TIMEOUT_FIRST: 7000,
    TIMEOUT_RETRY: 15000,
    CONCURRENCY: 8,
    STATUS_MIN_OK: 200,
    STATUS_MAX_OK: 400,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
};

const REQUEST_HEADERS = {
    ACCEPT: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ACCEPT_LANGUAGE: 'en-US,en;q=0.9',
};

const STATUS_TYPES = {
    INVALID: 'invalid',
    TIMEOUT: 'timeout',
    FAILED: 'failed',
    NO_RESPONSE: 'no-response',
};

// Helper Functions

/**
 * Get referer URL from environment
 * @returns {string|undefined} Referer URL or undefined
 */
function getReferer() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
    if (siteUrl) return siteUrl;
    if (vercelUrl) return `https://${vercelUrl}`;
    return undefined;
}

/**
 * Build request headers for link checking
 * @param {string|undefined} referer - Referer URL
 * @param {Object} [extra={}] - Additional headers
 * @returns {Object} Headers object
 */
function buildCheckHeaders(referer, extra = {}) {
    const headers = {
        'User-Agent': CHECK_CONFIG.USER_AGENT,
        'Accept': REQUEST_HEADERS.ACCEPT,
        'Accept-Language': REQUEST_HEADERS.ACCEPT_LANGUAGE,
    };
    if (referer) headers['Referer'] = referer;
    return { ...headers, ...extra };
}

/**
 * Get timeout duration based on attempt number
 * @param {number} attempt - Attempt number (0-indexed)
 * @returns {number} Timeout in milliseconds
 */
function getTimeoutForAttempt(attempt) {
    return attempt === 0 ? CHECK_CONFIG.TIMEOUT_FIRST : CHECK_CONFIG.TIMEOUT_RETRY;
}

/**
 * Create abort controller with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Object} Object with controller and timeout ID
 */
function createAbortController(timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeout };
}

/**
 * Check if status code is successful
 * @param {number} status - HTTP status code
 * @returns {boolean} True if status is successful
 */
function isStatusOk(status) {
    return status >= CHECK_CONFIG.STATUS_MIN_OK && status < CHECK_CONFIG.STATUS_MAX_OK;
}

/**
 * Perform fetch with method and headers
 * @param {string} url - URL to fetch
 * @param {string} method - HTTP method
 * @param {AbortSignal} signal - Abort signal
 * @param {Object} headers - Request headers
 * @returns {Promise<Response>} Fetch response
 */
async function performFetch(url, method, signal, headers) {
    return await fetch(url, { method, redirect: 'follow', signal, headers });
}

/**
 * Try different fetch strategies (HEAD, GET, GET with no-cache)
 * @param {string} url - URL to check
 * @param {AbortSignal} signal - Abort signal
 * @param {Object} headers - Base headers
 * @returns {Promise<Response|null>} Response or null
 */
async function tryFetchStrategies(url, signal, headers) {
    // Try HEAD first
    let res = await performFetch(url, 'HEAD', signal, headers);

    // If HEAD fails (4xx or 5xx), try GET
    if (!res || res.status >= CHECK_CONFIG.STATUS_MAX_OK) {
        res = await performFetch(url, 'GET', signal, headers);

        // If still 403, try GET with cache-control to bypass CDN
        if (res && res.status === HTTP_STATUS.FORBIDDEN) {
            const noCacheHeaders = buildCheckHeaders(headers.Referer, {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            });
            res = await performFetch(url, 'GET', signal, noCacheHeaders);
        }
    }

    return res;
}

/**
 * Perform single check attempt
 * @param {string} url - URL to check
 * @param {number} attempt - Attempt number
 * @param {string|undefined} referer - Referer URL
 * @returns {Promise<Object|null>} Result object or null to retry
 */
async function performCheckAttempt(url, attempt, referer) {
    const timeoutMs = getTimeoutForAttempt(attempt);
    const { controller, timeout } = createAbortController(timeoutMs);
    const headers = buildCheckHeaders(referer);

    try {
        const res = await tryFetchStrategies(url, controller.signal, headers);
        clearTimeout(timeout);

        if (res) {
            const ok = isStatusOk(res.status);
            if (!ok) {
                console.warn('Link check upstream status', { url, status: res.status, attempt });
            }
            return { ok, status: res.status };
        }

        // No response, return null to retry
        return null;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Robust URL health check with retries, browser-like headers and HEAD->GET fallback
 * @param {string} url - URL to check
 * @returns {Promise<Object>} Check result with ok and status
 */
async function checkUrl(url) {
    if (!url || typeof url !== 'string') {
        return { ok: false, status: STATUS_TYPES.INVALID };
    }

    const referer = getReferer();
    let lastErr = null;

    for (let attempt = 0; attempt < CHECK_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const result = await performCheckAttempt(url, attempt, referer);
            if (result) return result;

            // No response, continue to retry
            lastErr = new Error(STATUS_TYPES.NO_RESPONSE);
        } catch (err) {
            lastErr = err;
            // If timeout on last attempt, return immediately
            if (err.name === 'AbortError' && attempt === CHECK_CONFIG.MAX_RETRIES - 1) {
                return { ok: false, status: STATUS_TYPES.TIMEOUT };
            }
            // Otherwise, retry if attempts remain
        }
    }

    // All retries exhausted
    const status = lastErr
        ? (lastErr.name === 'AbortError' ? STATUS_TYPES.TIMEOUT : String(lastErr))
        : STATUS_TYPES.FAILED;
    return { ok: false, status };
}

/**
 * Set CORS headers on response
 * @param {Object} res - Next.js response object
 */
function setCorsHeaders(res) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
}

/**
 * Extract user token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} Token or null
 */
function extractUserToken(headers) {
    return headers.authorization?.replace('Bearer ', '') || null;
}

/**
 * Fetch sites from Supabase for authenticated user
 * @param {string} userToken - User JWT token
 * @returns {Promise<Array>} Array of sites
 */
async function fetchUserSites(userToken) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(ERROR_MESSAGES.MISSING_CONFIG);
    }
    if (!userToken) {
        throw new Error(ERROR_MESSAGES.NOT_AUTHENTICATED);
    }

    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?select=*&order=created_at.desc`;
    const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/json',
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
        const details = await response.text();
        const error = new Error(ERROR_MESSAGES.UPSTREAM_ERROR);
        error.details = details;
        throw error;
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(s => ({
        id: s.id,
        url: s.url,
        name: s.name,
    }));
}

/**
 * Check multiple sites in batches with concurrency control
 * @param {Array} sites - Array of sites to check
 * @returns {Promise<Array>} Array of check results
 */
async function checkSitesInBatches(sites) {
    const results = [];

    for (let i = 0; i < sites.length; i += CHECK_CONFIG.CONCURRENCY) {
        const batch = sites.slice(i, i + CHECK_CONFIG.CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (site) => {
                const check = await checkUrl(site.url);
                return {
                    id: site.id,
                    name: site.name,
                    url: site.url,
                    ok: check.ok,
                    status: check.status,
                };
            })
        );
        results.push(...batchResults);
    }

    return results;
}

/**
 * Build success response with check results
 * @param {Array} results - Check results
 * @returns {Object} Success response object
 */
function buildSuccessResponse(results) {
    const broken = results.filter(r => !r.ok);
    return {
        success: true,
        total: results.length,
        brokenCount: broken.length,
        broken,
        results,
    };
}

/**
 * Build error response
 * @param {string} error - Error message
 * @param {string} [details] - Optional error details
 * @returns {Object} Error response object
 */
function buildErrorResponse(error, details) {
    const response = { success: false, error };
    if (details) response.details = details;
    return response;
}

// Main Handler

/**
 * Link check API handler - checks health of multiple URLs
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 */
export default async function handler(req, res) {
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(HTTP_STATUS.OK).end();
    }

    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
            buildErrorResponse(ERROR_MESSAGES.METHOD_NOT_ALLOWED)
        );
    }

    const userToken = extractUserToken(req.headers);
    let sites = Array.isArray(req.body?.sites) ? req.body.sites : null;

    try {
        // Fetch user's sites if not provided in request body
        if (!sites) {
            try {
                sites = await fetchUserSites(userToken);
            } catch (err) {
                const status = err.message === ERROR_MESSAGES.NOT_AUTHENTICATED
                    ? HTTP_STATUS.UNAUTHORIZED
                    : err.message === ERROR_MESSAGES.MISSING_CONFIG
                        ? HTTP_STATUS.INTERNAL_ERROR
                        : HTTP_STATUS.BAD_GATEWAY;
                return res.status(status).json(
                    buildErrorResponse(err.message, err.details)
                );
            }
        }

        // Check all sites in batches
        const results = await checkSitesInBatches(sites);

        return res.status(HTTP_STATUS.OK).json(buildSuccessResponse(results));
    } catch (err) {
        console.error('Link check failed:', err);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
            buildErrorResponse(err.message || String(err))
        );
    }
}