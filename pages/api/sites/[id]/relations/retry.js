/** Retry/rebuild site relations — POST only */

import { parse } from 'url';
import { verifyUserFromAuthHeader } from '../../../helpers/auth-helpers';
import {
    HTTP, getSupabaseConfig, buildHeaders, restUrl, sendError, sendOk, methodGuard,
} from '../../../helpers/api-utils';

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;
    const { query: { id } } = parse(req.url, true);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const catIds = body.category_ids || body.categoryIds || [];
    const tagIds = body.tag_ids || body.tagIds || [];

    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth?.user) return sendError(res, HTTP.UNAUTHORIZED, 'Not authenticated');

    try {
        const cfg = getSupabaseConfig();
        if (!cfg) return sendError(res, HTTP.INTERNAL_ERROR, 'SUPABASE_URL missing');
        if (!cfg.serviceKey) return sendError(res, HTTP.INTERNAL_ERROR, 'Service role key not configured');

        // Verify ownership
        const r = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${id}&select=user_id`, { headers: buildHeaders(cfg.anonKey, auth.token) });
        if (!r.ok) return sendError(res, HTTP.BAD_REQUEST, 'Failed to fetch site owner');
        const owner = (await r.json())?.[0]?.user_id;
        if (owner !== auth.user.id) return sendError(res, HTTP.FORBIDDEN, 'Not site owner');

        const sH = buildHeaders(cfg.serviceKey, cfg.serviceKey);
        const sHc = buildHeaders(cfg.serviceKey, cfg.serviceKey, { contentType: true });

        // Delete + re-insert relations
        await Promise.all([
            fetch(`${restUrl(cfg, 'site_categories')}?site_id=eq.${id}`, { method: 'DELETE', headers: sH }),
            fetch(`${restUrl(cfg, 'site_tags')}?site_id=eq.${id}`, { method: 'DELETE', headers: sH }),
        ]);
        if (catIds.length) {
            const cr = await fetch(restUrl(cfg, 'site_categories'), { method: 'POST', headers: sHc, body: JSON.stringify(catIds.map(cid => ({ site_id: id, category_id: cid }))) });
            if (!cr.ok) return sendError(res, HTTP.INTERNAL_ERROR, 'Failed to insert site_categories', { details: await cr.text() });
        }
        if (tagIds.length) {
            const tr = await fetch(restUrl(cfg, 'site_tags'), { method: 'POST', headers: sHc, body: JSON.stringify(tagIds.map(tid => ({ site_id: id, tag_id: tid }))) });
            if (!tr.ok) return sendError(res, HTTP.INTERNAL_ERROR, 'Failed to insert site_tags', { details: await tr.text() });
        }

        // Refetch
        const sel = `*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
        const fr = await fetch(`${restUrl(cfg, 'sites')}?id=eq.${id}&select=${sel}`, { headers: sH });
        const site = (await fr.json())?.[0] || null;

        return sendOk(res, { data: site });
    } catch (err) {
        console.error('Retry relations error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message, err.details ? { details: err.details } : undefined);
    }
}
