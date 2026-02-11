/**
 * Shared API utilities — eliminates duplication across all API routes.
 */

// ─── HTTP Status Codes ──────────────────────────────────────────────────────
export const HTTP = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    TOO_MANY: 429,
    INTERNAL_ERROR: 500,
    BAD_GATEWAY: 502,
};

// ─── Supabase Config ────────────────────────────────────────────────────────
let _cachedConfig = null;

export function getSupabaseConfig() {
    if (_cachedConfig) return _cachedConfig;
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/^["']|["']$/g, '');
    if (!url || !anonKey) return null;
    _cachedConfig = { url, anonKey, serviceKey: serviceKey || anonKey };
    return _cachedConfig;
}

// ─── Token Extraction ───────────────────────────────────────────────────────
export function extractToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}

export function extractTokenFromReq(req) {
    return extractToken(req.headers.authorization);
}

// ─── JWT Decoding ───────────────────────────────────────────────────────────
export function decodeJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

// ─── Tier Resolution ────────────────────────────────────────────────────────
const ADMIN_EMAILS_CACHE = { val: null };

function getAdminEmails() {
    if (ADMIN_EMAILS_CACHE.val) return ADMIN_EMAILS_CACHE.val;
    ADMIN_EMAILS_CACHE.val = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return ADMIN_EMAILS_CACHE.val;
}

export { getAdminEmails };

export function resolveTier(token) {
    const payload = typeof token === 'string' ? decodeJwt(token) : token;
    if (!payload) return { tier: 'free', userId: null, isAdmin: false };

    const meta = payload.user_metadata || {};
    let tier = meta.tier || (meta.is_pro ? 'pro' : 'free');
    const email = (payload.email || '').toLowerCase();
    const isAdmin = getAdminEmails().includes(email);
    if (isAdmin) tier = 'promax';

    return { tier, userId: payload.sub || null, isAdmin, email };
}

// ─── Supabase Headers ───────────────────────────────────────────────────────
export function buildHeaders(apiKey, authToken, { contentType = false, prefer = '' } = {}) {
    const h = {
        apikey: apiKey,
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
    };
    if (contentType) h['Content-Type'] = 'application/json';
    if (prefer) h.Prefer = prefer;
    return h;
}

/** Headers using user token for RLS */
export function userHeaders(config, token, opts) {
    return buildHeaders(config.anonKey, token, opts);
}

/** Headers using service key (bypasses RLS) */
export function serviceHeaders(config, opts = {}) {
    return buildHeaders(config.anonKey, config.serviceKey, opts);
}

// ─── Supabase REST URL ──────────────────────────────────────────────────────
export function restUrl(config, path) {
    return `${config.url}/rest/v1/${path}`;
}

// ─── Response Helpers ───────────────────────────────────────────────────────
export function sendError(res, status, error, extra) {
    return res.status(status).json({ success: false, error, ...extra });
}

export function sendOk(res, data, status = HTTP.OK) {
    return res.status(status).json({ success: true, ...data });
}

// ─── Method Guard ───────────────────────────────────────────────────────────
export function methodGuard(req, res, allowed) {
    const methods = Array.isArray(allowed) ? allowed : [allowed];
    if (!methods.includes(req.method)) {
        sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
        return false;
    }
    return true;
}

// ─── Config Guard ───────────────────────────────────────────────────────────
export function configGuard(res) {
    const config = getSupabaseConfig();
    if (!config) {
        sendError(res, HTTP.INTERNAL_ERROR, 'Missing Supabase configuration');
        return null;
    }
    return config;
}

// ─── Auth Guard ─────────────────────────────────────────────────────────────
export function authGuard(req, res) {
    const token = extractTokenFromReq(req);
    if (!token) {
        sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
        return null;
    }
    return token;
}

// ─── Batch Helpers ──────────────────────────────────────────────────────────
export async function batchDelete(config, table, column, ids, headers) {
    const BATCH = 100;
    let total = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const inList = batch.map(id => `"${id}"`).join(',');
        const url = `${config.url}/rest/v1/${table}?${column}=in.(${inList})`;
        const r = await fetch(url, { method: 'DELETE', headers });
        if (r.ok) {
            const rows = await r.json();
            total += Array.isArray(rows) ? rows.length : 0;
        }
    }
    return total;
}

export async function batchInsert(config, table, rows, headers) {
    if (!rows?.length) return { inserted: 0, errors: [] };
    const BATCH = 100;
    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const url = `${config.url}/rest/v1/${table}`;
        const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(batch) });
        if (r.ok) {
            const data = await r.json();
            inserted += Array.isArray(data) ? data.length : 1;
        } else {
            const err = await r.text();
            errors.push({ table, status: r.status, details: err });
        }
    }
    return { inserted, errors };
}

// ─── Duplicate Detection ────────────────────────────────────────────────────
export const DUPLICATE_PATTERN = /duplicate|unique|violat|23505|already exists/i;
export function isDuplicate(text) { return DUPLICATE_PATTERN.test(text); }
