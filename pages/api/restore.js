/**
 * @fileoverview API endpoint for restoring previously bulk-deleted data (undo).
 * Re-inserts sites, categories, tags and their junction rows.
 *
 * POST /api/restore
 * Body: { sites: [...], categories: [...], tags: [...], site_categories: [...], site_tags: [...] }
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';

// ─── Constants ──────────────────────────────────────────────────────────────

const HTTP = { OK: 200, BAD_REQUEST: 400, UNAUTHORIZED: 401, METHOD_NOT_ALLOWED: 405, INTERNAL_ERROR: 500 };

function getConfig() {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/^["']|["']$/g, '');
    if (!url || !anonKey) return null;
    return { url, anonKey, serviceKey };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildHeaders(config, token) {
    const key = config.serviceKey || config.anonKey;
    return {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${token || key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=ignore-duplicates',
    };
}

function serviceHeaders(config) {
    const key = config.serviceKey || config.anonKey;
    return {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=ignore-duplicates',
    };
}

/** Batch-insert rows into a Supabase table. */
async function batchInsert(table, rows, config, hdrs) {
    if (!rows || !rows.length) return { inserted: 0, errors: [] };
    const BATCH = 100;
    let inserted = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const url = `${config.url}/rest/v1/${table}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify(batch),
        });
        if (res.ok) {
            const data = await res.json();
            inserted += Array.isArray(data) ? data.length : 1;
        } else {
            const errText = await res.text();
            console.error(`[restore] Failed to insert into ${table}:`, res.status, errText);
            errors.push({ table, status: res.status, details: errText });
        }
    }
    return { inserted, errors };
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

    const { sites = [], categories = [], tags = [], site_categories = [], site_tags = [] } = req.body || {};

    // Security: only restore data belonging to the authenticated user
    const ownedSites = sites.filter(s => s.user_id === userId);
    const ownedCategories = categories.filter(c => c.user_id === userId);
    const ownedTags = tags.filter(t => t.user_id === userId);

    try {
        const results = {};
        const allErrors = [];

        // 1. Restore categories first (sites may reference them)
        if (ownedCategories.length) {
            const r = await batchInsert('categories', ownedCategories, config, buildHeaders(config, token));
            results.categories = r.inserted;
            allErrors.push(...r.errors);
        }

        // 2. Restore tags
        if (ownedTags.length) {
            const r = await batchInsert('tags', ownedTags, config, buildHeaders(config, token));
            results.tags = r.inserted;
            allErrors.push(...r.errors);
        }

        // 3. Restore sites
        if (ownedSites.length) {
            const r = await batchInsert('sites', ownedSites, config, buildHeaders(config, token));
            results.sites = r.inserted;
            allErrors.push(...r.errors);
        }

        // 4. Restore junction rows (use service key to bypass RLS on junction tables)
        if (site_categories.length) {
            const r = await batchInsert('site_categories', site_categories, config, serviceHeaders(config));
            results.site_categories = r.inserted;
            allErrors.push(...r.errors);
        }

        if (site_tags.length) {
            const r = await batchInsert('site_tags', site_tags, config, serviceHeaders(config));
            results.site_tags = r.inserted;
            allErrors.push(...r.errors);
        }

        return res.status(HTTP.OK).json({
            success: true,
            restored: results,
            errors: allErrors.length ? allErrors : undefined,
        });
    } catch (err) {
        console.error('[restore API] Error:', err);
        return res.status(HTTP.INTERNAL_ERROR).json({ success: false, error: err.message });
    }
}
