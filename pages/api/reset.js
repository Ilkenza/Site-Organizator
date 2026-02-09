/**
 * @fileoverview API endpoint for bulk-deleting all sites, categories, or tags for the current user.
 * Returns the deleted rows so the client can offer an "Undo" restore.
 *
 * POST /api/reset
 * Body: { type: 'sites' | 'categories' | 'tags' | 'all' }
 *
 * Response: { success: true, deleted: { sites: [...], categories: [...], tags: [...], site_categories: [...], site_tags: [...] } }
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';

// ─── Constants ──────────────────────────────────────────────────────────────

const HTTP = { OK: 200, BAD_REQUEST: 400, UNAUTHORIZED: 401, METHOD_NOT_ALLOWED: 405, INTERNAL_ERROR: 500 };

const VALID_TYPES = ['sites', 'categories', 'tags', 'all'];

function getConfig() {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/^["']|["']$/g, '');
    if (!url || !anonKey) return null;
    return { url, anonKey, serviceKey };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build standard Supabase REST headers using the service role key (bypasses RLS). */
function headers(config, token) {
    const key = config.serviceKey || config.anonKey;
    return {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${token || key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
}

/** SELECT rows from a table filtered by user_id. */
async function selectAll(table, userId, config, token) {
    const url = `${config.url}/rest/v1/${table}?user_id=eq.${userId}&select=*`;
    const res = await fetch(url, { headers: headers(config, token) });
    if (!res.ok) throw new Error(`Failed to read ${table}: ${res.status}`);
    return res.json();
}

/** Delete all rows from a table filtered by user_id. Returns deleted rows. */
async function deleteAll(table, userId, config, token) {
    const url = `${config.url}/rest/v1/${table}?user_id=eq.${userId}`;
    const res = await fetch(url, { method: 'DELETE', headers: headers(config, token) });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to delete ${table}: ${res.status} ${err}`);
    }
    // Prefer: return=representation gives us the deleted rows back
    return res.json();
}

/** Delete junction rows (site_categories / site_tags) for a list of site IDs. Returns deleted rows. */
async function deleteJunction(table, siteIds, config) {
    if (!siteIds.length) return [];
    const key = config.serviceKey || config.anonKey;
    const h = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };

    // Batch in groups of 100 to avoid URL length limits
    const BATCH = 100;
    let all = [];
    for (let i = 0; i < siteIds.length; i += BATCH) {
        const batch = siteIds.slice(i, i + BATCH);
        const inList = batch.map(id => `"${id}"`).join(',');
        const url = `${config.url}/rest/v1/${table}?site_id=in.(${inList})`;
        const res = await fetch(url, { method: 'DELETE', headers: h });
        if (res.ok) {
            const rows = await res.json();
            all = all.concat(rows);
        }
    }
    return all;
}

/** Delete junction rows by category IDs (for when we only delete categories, not sites). */
async function deleteJunctionByCategoryIds(categoryIds, config) {
    if (!categoryIds.length) return [];
    const key = config.serviceKey || config.anonKey;
    const h = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
    const BATCH = 100;
    let all = [];
    for (let i = 0; i < categoryIds.length; i += BATCH) {
        const batch = categoryIds.slice(i, i + BATCH);
        const inList = batch.map(id => `"${id}"`).join(',');
        const url = `${config.url}/rest/v1/site_categories?category_id=in.(${inList})`;
        const res = await fetch(url, { method: 'DELETE', headers: h });
        if (res.ok) {
            const rows = await res.json();
            all = all.concat(rows);
        }
    }
    return all;
}

/** Delete junction rows by tag IDs (for when we only delete tags, not sites). */
async function deleteJunctionByTagIds(tagIds, config) {
    if (!tagIds.length) return [];
    const key = config.serviceKey || config.anonKey;
    const h = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
    const BATCH = 100;
    let all = [];
    for (let i = 0; i < tagIds.length; i += BATCH) {
        const batch = tagIds.slice(i, i + BATCH);
        const inList = batch.map(id => `"${id}"`).join(',');
        const url = `${config.url}/rest/v1/site_tags?tag_id=in.(${inList})`;
        const res = await fetch(url, { method: 'DELETE', headers: h });
        if (res.ok) {
            const rows = await res.json();
            all = all.concat(rows);
        }
    }
    return all;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(HTTP.METHOD_NOT_ALLOWED).json({ success: false, error: 'Method not allowed' });
    }

    const config = getConfig();
    if (!config) {
        return res.status(HTTP.INTERNAL_ERROR).json({ success: false, error: 'Missing Supabase env vars' });
    }

    // Auth
    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth.success) {
        return res.status(HTTP.UNAUTHORIZED).json({ success: false, error: auth.error });
    }
    const userId = auth.user.id;
    const token = auth.token;

    const { type } = req.body || {};
    if (!type || !VALID_TYPES.includes(type)) {
        return res.status(HTTP.BAD_REQUEST).json({ success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    try {
        const deleted = { sites: [], categories: [], tags: [], site_categories: [], site_tags: [] };

        if (type === 'sites' || type === 'all') {
            // First read sites to get IDs for junction cleanup
            const existingSites = await selectAll('sites', userId, config, token);
            const siteIds = existingSites.map(s => s.id);

            // Delete junctions first (service key to bypass RLS)
            deleted.site_categories = await deleteJunction('site_categories', siteIds, config);
            deleted.site_tags = await deleteJunction('site_tags', siteIds, config);

            // Delete sites
            deleted.sites = await deleteAll('sites', userId, config, token);
        }

        if (type === 'categories' || type === 'all') {
            if (type === 'categories') {
                // Need to remove junction rows for these categories first
                const existingCats = await selectAll('categories', userId, config, token);
                const catIds = existingCats.map(c => c.id);
                deleted.site_categories = await deleteJunctionByCategoryIds(catIds, config);
            }
            deleted.categories = await deleteAll('categories', userId, config, token);
        }

        if (type === 'tags' || type === 'all') {
            if (type === 'tags') {
                // Need to remove junction rows for these tags first
                const existingTags = await selectAll('tags', userId, config, token);
                const tagIds = existingTags.map(t => t.id);
                deleted.site_tags = await deleteJunctionByTagIds(tagIds, config);
            }
            deleted.tags = await deleteAll('tags', userId, config, token);
        }

        const counts = {
            sites: deleted.sites.length,
            categories: deleted.categories.length,
            tags: deleted.tags.length,
        };

        return res.status(HTTP.OK).json({ success: true, deleted, counts });
    } catch (err) {
        console.error('[reset API] Error:', err);
        return res.status(HTTP.INTERNAL_ERROR).json({ success: false, error: err.message });
    }
}
