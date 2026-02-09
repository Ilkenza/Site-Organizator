/**
 * @fileoverview API endpoint for bulk-deleting specific items by IDs.
 * 
 * POST /api/bulk-delete
 * Body: { type: 'sites' | 'categories' | 'tags', ids: [uuid, ...] }
 * 
 * Deletes items + their junction rows. Returns { success: true, deleted: count }.
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';

const HTTP = { OK: 200, BAD_REQUEST: 400, UNAUTHORIZED: 401, METHOD_NOT_ALLOWED: 405, INTERNAL_ERROR: 500 };
const BATCH = 100;

function getConfig() {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/^["']|["']$/g, '');
    if (!url || !anonKey) return null;
    return { url, anonKey, serviceKey };
}

function buildHeaders(config, token) {
    return {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${token || config.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
}

function serviceHeaders(config) {
    const key = config.serviceKey || config.anonKey;
    return {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
}

/** Batch-delete rows by ID from a table. Uses user token for RLS. */
async function batchDeleteByIds(table, idColumn, ids, config, hdrs) {
    let total = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const inList = batch.map(id => `"${id}"`).join(',');
        const url = `${config.url}/rest/v1/${table}?${idColumn}=in.(${inList})`;
        const res = await fetch(url, { method: 'DELETE', headers: hdrs });
        if (res.ok) {
            const rows = await res.json();
            total += Array.isArray(rows) ? rows.length : 0;
        } else {
            const err = await res.text();
            console.error(`[bulk-delete] Failed to delete from ${table}:`, res.status, err);
        }
    }
    return total;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(HTTP.METHOD_NOT_ALLOWED).json({ success: false, error: 'Method not allowed' });
    }

    const config = getConfig();
    if (!config) {
        return res.status(HTTP.INTERNAL_ERROR).json({ success: false, error: 'Missing Supabase env vars' });
    }

    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth.success) {
        return res.status(HTTP.UNAUTHORIZED).json({ success: false, error: auth.error });
    }
    const token = auth.token;

    const { type, ids } = req.body || {};
    if (!type || !['sites', 'categories', 'tags'].includes(type)) {
        return res.status(HTTP.BAD_REQUEST).json({ success: false, error: 'type must be sites, categories, or tags' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(HTTP.BAD_REQUEST).json({ success: false, error: 'ids must be a non-empty array' });
    }

    try {
        const svcHdrs = serviceHeaders(config);
        const userHdrs = buildHeaders(config, token);

        if (type === 'sites') {
            // Delete junction rows first (service key bypasses RLS)
            await batchDeleteByIds('site_categories', 'site_id', ids, config, svcHdrs);
            await batchDeleteByIds('site_tags', 'site_id', ids, config, svcHdrs);
            // Delete sites (user token for RLS)
            const count = await batchDeleteByIds('sites', 'id', ids, config, userHdrs);
            return res.status(HTTP.OK).json({ success: true, deleted: count });
        }

        if (type === 'categories') {
            await batchDeleteByIds('site_categories', 'category_id', ids, config, svcHdrs);
            const count = await batchDeleteByIds('categories', 'id', ids, config, userHdrs);
            return res.status(HTTP.OK).json({ success: true, deleted: count });
        }

        if (type === 'tags') {
            await batchDeleteByIds('site_tags', 'tag_id', ids, config, svcHdrs);
            const count = await batchDeleteByIds('tags', 'id', ids, config, userHdrs);
            return res.status(HTTP.OK).json({ success: true, deleted: count });
        }
    } catch (err) {
        console.error('[bulk-delete] Error:', err);
        return res.status(HTTP.INTERNAL_ERROR).json({ success: false, error: err.message });
    }
}
