/**
 * Restore previously bulk-deleted data (undo).
 * POST /api/restore  Body: { sites, categories, tags, site_categories, site_tags }
 */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';
import {
    HTTP, configGuard, sendError, sendOk, methodGuard,
    batchInsert, buildHeaders,
} from './helpers/api-utils';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

function usrH(cfg, token) {
    return buildHeaders(cfg.anonKey, token, { contentType: true, prefer: 'return=representation,resolution=ignore-duplicates' });
}
function svcH(cfg) {
    return buildHeaders(cfg.anonKey, cfg.serviceKey, { contentType: true, prefer: 'return=representation,resolution=ignore-duplicates' });
}

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;
    const cfg = configGuard(res);
    if (!cfg) return;

    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth.success) return sendError(res, HTTP.UNAUTHORIZED, auth.error);
    const userId = auth.user.id;

    const { sites = [], categories = [], tags = [], site_categories = [], site_tags = [] } = req.body || {};
    const owned = (arr) => arr.filter(x => x.user_id === userId);

    try {
        const results = {};
        const errors = [];
        const uH = usrH(cfg, auth.token);
        const sH = svcH(cfg);

        if (categories.length) { const r = await batchInsert(cfg, 'categories', owned(categories), uH); results.categories = r.inserted; errors.push(...r.errors); }
        if (tags.length) { const r = await batchInsert(cfg, 'tags', owned(tags), uH); results.tags = r.inserted; errors.push(...r.errors); }
        if (sites.length) { const r = await batchInsert(cfg, 'sites', owned(sites), uH); results.sites = r.inserted; errors.push(...r.errors); }
        if (site_categories.length) { const r = await batchInsert(cfg, 'site_categories', site_categories, sH); results.site_categories = r.inserted; errors.push(...r.errors); }
        if (site_tags.length) { const r = await batchInsert(cfg, 'site_tags', site_tags, sH); results.site_tags = r.inserted; errors.push(...r.errors); }

        return sendOk(res, { restored: results, errors: errors.length ? errors : undefined });
    } catch (err) {
        console.error('[restore] Error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
