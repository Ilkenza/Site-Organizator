/** Favorites API — GET favorite IDs, POST toggle favorite status. */

import { createClient } from '@supabase/supabase-js';
import { HTTP, configGuard, extractTokenFromReq, sendError, sendOk } from './helpers/api-utils';

function createSB(url, key, token) {
    return createClient(url, key, {
        global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    });
}

export default async function handler(req, res) {
    const cfg = configGuard(res);
    if (!cfg) return;

    const token = extractTokenFromReq(req);
    const sb = createSB(cfg.url, cfg.anonKey, token);

    try {
        if (req.method === 'GET') {
            const { data, error } = await sb.from('sites').select('id').eq('is_favorite', true);
            if (error) throw error;
            return res.status(HTTP.OK).json(data || []);
        }

        if (req.method === 'POST') {
            const { site_id } = req.body;
            if (!site_id) return sendError(res, HTTP.BAD_REQUEST, 'site_id is required');

            const { data, error } = await sb.from('sites').select('id, is_favorite').eq('id', site_id);
            if (error) throw error;
            const site = data?.[0];
            if (!site) return sendError(res, HTTP.NOT_FOUND, 'Site not found');

            const newStatus = !site.is_favorite;
            const { error: upErr } = await sb.from('sites').update({ is_favorite: newStatus }).eq('id', site_id).select('is_favorite');
            if (upErr) throw upErr;

            return res.status(HTTP.OK).json({ favorite: newStatus });
        }

        return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
    } catch (err) {
        console.error('Favorites API error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
