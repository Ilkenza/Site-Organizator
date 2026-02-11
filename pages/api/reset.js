/**
 * Bulk-delete all sites/categories/tags for current user.
 * POST /api/reset  Body: { type: 'sites'|'categories'|'tags'|'all' }
 * Returns deleted rows for undo restore.
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';
import { HTTP, configGuard, sendError, sendOk, methodGuard, buildHeaders } from './helpers/api-utils';

const VALID_TYPES = ['sites', 'categories', 'tags', 'all'];
const BATCH = 100;

function svcHeaders(config) {
    const key = config.serviceKey || config.anonKey;
    return buildHeaders(config.anonKey, key, { contentType: true, prefer: 'return=representation' });
}

function usrHeaders(config, token) {
    return buildHeaders(config.anonKey, token, { contentType: true, prefer: 'return=representation' });
}

async function selectAll(table, userId, config, token) {
    const url = `${config.url}/rest/v1/${table}?user_id=eq.${userId}&select=*`;
    const r = await fetch(url, { headers: usrHeaders(config, token) });
    if (!r.ok) throw new Error(`Failed to read ${table}: ${r.status}`);
    return r.json();
}

async function deleteAll(table, userId, config, token) {
    const url = `${config.url}/rest/v1/${table}?user_id=eq.${userId}`;
    const r = await fetch(url, { method: 'DELETE', headers: usrHeaders(config, token) });
    if (!r.ok) throw new Error(`Failed to delete ${table}: ${r.status} ${await r.text()}`);
    return r.json();
}

async function deleteJunction(table, column, ids, config) {
    if (!ids.length) return [];
    const h = svcHeaders(config);
    let all = [];
    for (let i = 0; i < ids.length; i += BATCH) {
        const inList = ids.slice(i, i + BATCH).map(id => `"${id}"`).join(',');
        const r = await fetch(`${config.url}/rest/v1/${table}?${column}=in.(${inList})`, { method: 'DELETE', headers: h });
        if (r.ok) all = all.concat(await r.json());
    }
    return all;
}

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;
    const config = configGuard(res);
    if (!config) return;

    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth.success) return sendError(res, HTTP.UNAUTHORIZED, auth.error);
    const { id: userId } = auth.user;
    const token = auth.token;

    const { type } = req.body || {};
    if (!type || !VALID_TYPES.includes(type))
        return sendError(res, HTTP.BAD_REQUEST, `Invalid type. Must be: ${VALID_TYPES.join(', ')}`);

    try {
        const d = { sites: [], categories: [], tags: [], site_categories: [], site_tags: [] };

        if (type === 'sites' || type === 'all') {
            const sites = await selectAll('sites', userId, config, token);
            const siteIds = sites.map(s => s.id);
            d.site_categories = await deleteJunction('site_categories', 'site_id', siteIds, config);
            d.site_tags = await deleteJunction('site_tags', 'site_id', siteIds, config);
            d.sites = await deleteAll('sites', userId, config, token);
        }
        if (type === 'categories' || type === 'all') {
            if (type === 'categories') {
                const cats = await selectAll('categories', userId, config, token);
                d.site_categories = await deleteJunction('site_categories', 'category_id', cats.map(c => c.id), config);
            }
            d.categories = await deleteAll('categories', userId, config, token);
        }
        if (type === 'tags' || type === 'all') {
            if (type === 'tags') {
                const tags = await selectAll('tags', userId, config, token);
                d.site_tags = await deleteJunction('site_tags', 'tag_id', tags.map(t => t.id), config);
            }
            d.tags = await deleteAll('tags', userId, config, token);
        }

        return sendOk(res, {
            deleted: d,
            counts: { sites: d.sites.length, categories: d.categories.length, tags: d.tags.length }
        });
    } catch (err) {
        console.error('[reset] Error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}