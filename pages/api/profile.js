/** Profile API — GET/PUT/PATCH user profile. */

import { HTTP, configGuard, authGuard, decodeJwt, buildHeaders, sendError, sendOk } from './helpers/api-utils';

const ALLOWED_FIELDS = ['name', 'avatar_url'];

export default async function handler(req, res) {
    const config = configGuard(res);
    if (!config) return;

    const token = authGuard(req, res);
    if (!token) return;

    const payload = decodeJwt(token);
    if (!payload?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
    const userId = payload.sub;
    const baseUrl = config.url;

    try {
        if (req.method === 'GET') {
            const url = `${baseUrl}/rest/v1/profiles?id=eq.${userId}&select=id,name,avatar_url`;
            const r = await fetch(url, { headers: buildHeaders(config.anonKey, token) });
            if (!r.ok) throw new Error(await r.text());
            const rows = await r.json();
            return sendOk(res, { data: rows[0] || null });
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
            const body = req.body || {};
            const update = {};
            for (const k of ALLOWED_FIELDS) { if (body[k] !== undefined) update[k] = body[k]; }
            if (!Object.keys(update).length) return sendError(res, HTTP.BAD_REQUEST, 'No valid fields to update');

            const url = `${baseUrl}/rest/v1/profiles?id=eq.${userId}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers: buildHeaders(config.anonKey, token, { contentType: true, prefer: 'return=representation' }),
                body: JSON.stringify(update),
            });
            if (!r.ok) throw new Error(await r.text());
            const rows = await r.json();
            return sendOk(res, { data: rows[0] || null });
        }

        return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
    } catch (err) {
        console.error('[Profile API] Error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
