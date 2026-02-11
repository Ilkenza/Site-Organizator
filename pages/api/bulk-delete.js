/** Bulk-delete items by IDs. POST { type: 'sites'|'categories'|'tags', ids: [...] } */

import { verifyUserFromAuthHeader } from './helpers/auth-helpers';
import { HTTP, configGuard, sendError, sendOk, methodGuard, batchDelete, userHeaders, serviceHeaders } from './helpers/api-utils';

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;

    const config = configGuard(res);
    if (!config) return;

    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth.success) return sendError(res, HTTP.UNAUTHORIZED, auth.error);

    const { type, ids } = req.body || {};
    if (!type || !['sites', 'categories', 'tags'].includes(type))
        return sendError(res, HTTP.BAD_REQUEST, 'type must be sites, categories, or tags');
    if (!Array.isArray(ids) || !ids.length)
        return sendError(res, HTTP.BAD_REQUEST, 'ids must be a non-empty array');

    try {
        const svcH = serviceHeaders(config, { prefer: 'return=representation' });
        const usrH = userHeaders(config, auth.token, { prefer: 'return=representation' });

        if (type === 'sites') {
            await batchDelete(config, 'site_categories', 'site_id', ids, svcH);
            await batchDelete(config, 'site_tags', 'site_id', ids, svcH);
            const count = await batchDelete(config, 'sites', 'id', ids, usrH);
            return sendOk(res, { deleted: count });
        }
        if (type === 'categories') {
            await batchDelete(config, 'site_categories', 'category_id', ids, svcH);
            const count = await batchDelete(config, 'categories', 'id', ids, usrH);
            return sendOk(res, { deleted: count });
        }
        if (type === 'tags') {
            await batchDelete(config, 'site_tags', 'tag_id', ids, svcH);
            const count = await batchDelete(config, 'tags', 'id', ids, usrH);
            return sendOk(res, { deleted: count });
        }
    } catch (err) {
        console.error('[bulk-delete] Error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
