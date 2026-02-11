/** Pinned sites API — GET pinned list, POST toggle pin status. */

import { createClient } from '@supabase/supabase-js';
import { HTTP, configGuard, extractTokenFromReq, sendError } from './helpers/api-utils';

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
            const { data, error } = await sb.from('sites').select('id')
                .eq('is_pinned', true).order('pin_position', { ascending: true });
            if (error) throw error;
            return res.status(HTTP.OK).json(data || []);
        }

        if (req.method === 'POST') {
            const { site_id } = req.body;
            if (!site_id) return sendError(res, HTTP.BAD_REQUEST, 'site_id is required');

            const { data, error } = await sb.from('sites')
                .select('id, is_pinned, pin_position').eq('id', site_id.toString());
            if (error) throw error;
            const site = data?.[0];
            if (!site) return sendError(res, HTTP.NOT_FOUND, 'Site not found');

            if (site.is_pinned) {
                const { error: e } = await sb.from('sites')
                    .update({ is_pinned: false, pin_position: 0 }).eq('id', site_id.toString());
                if (e) throw e;
                return res.status(HTTP.OK).json({ pinned: false });
            }

            // Get max position for next pin
            const { data: maxData } = await sb.from('sites').select('pin_position')
                .eq('is_pinned', true).order('pin_position', { ascending: false }).limit(1);
            const maxPos = maxData?.[0]?.pin_position ?? -1;

            const { error: e } = await sb.from('sites')
                .update({ is_pinned: true, pin_position: maxPos + 1 }).eq('id', site_id.toString());
            if (e) throw e;
            return res.status(HTTP.OK).json({ pinned: true });
        }

        return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
    } catch (err) {
        console.error('Pinned API error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
