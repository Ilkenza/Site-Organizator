/** Public Share presets — create and fetch shareable links */

import crypto from 'crypto';
import {
    HTTP,
    buildHeaders,
    configGuard,
    decodeJwt,
    extractTokenFromReq,
    methodGuard,
    restUrl,
    sendError,
    sendOk,
    serviceHeaders,
} from './helpers/api-utils';

function h(cfg, token, opts) {
    return buildHeaders(cfg.anonKey, token, opts);
}

function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

function normalizeSite(site) {
    const categories = (site.categories_array || []).map(sc => sc.category || sc).filter(Boolean);
    const tags = (site.tags_array || []).map(st => st.tag || st).filter(Boolean);
    return { ...site, categories, tags, categories_array: undefined, tags_array: undefined };
}

async function fetchShareByToken(cfg, tokenValue) {
    const url = `${restUrl(cfg, 'share_tokens')}?select=id,name,token,user_id,category_ids,tag_ids&token=eq.${encodeURIComponent(tokenValue)}&limit=1`;
    const r = await fetch(url, { headers: serviceHeaders(cfg) });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] || null;
}

async function fetchSharedSites(cfg, share) {
    const catIds = Array.isArray(share.category_ids) ? share.category_ids : [];
    const tagIds = Array.isArray(share.tag_ids) ? share.tag_ids : [];

    let select = 'id,name,url,description,pricing,created_at';
    if (catIds.length > 0) select += ',categories_array:site_categories!inner(category:categories(id,name,color))';
    else select += ',categories_array:site_categories(category:categories(id,name,color))';
    if (tagIds.length > 0) select += ',tags_array:site_tags!inner(tag:tags(id,name,color))';
    else select += ',tags_array:site_tags(tag:tags(id,name,color))';

    let url = `${restUrl(cfg, 'sites')}?select=${encodeURIComponent(select)}&user_id=eq.${share.user_id}`;
    if (catIds.length > 0) {
        const enc = catIds.map(id => `"${id}"`).join(',');
        url += `&site_categories.category_id=in.(${enc})`;
    }
    if (tagIds.length > 0) {
        const enc = tagIds.map(id => `"${id}"`).join(',');
        url += `&site_tags.tag_id=in.(${enc})`;
    }
    url += '&order=created_at.desc';

    const r = await fetch(url, { headers: serviceHeaders(cfg) });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map(normalizeSite) : [];
}

export default async function handler(req, res) {
    const cfg = configGuard(res); if (!cfg) return;
    if (!methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;

    if (req.method === 'GET' && req.query.token) {
        const share = await fetchShareByToken(cfg, req.query.token);
        if (!share) return sendError(res, HTTP.NOT_FOUND, 'Shared sites have been deleted');

        const sites = await fetchSharedSites(cfg, share);
        return sendOk(res, { share: { id: share.id, name: share.name }, sites });
    }

    const token = extractTokenFromReq(req);
    if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    const jwt = decodeJwt(token);
    if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
    const userId = jwt.sub;

    if (req.method === 'GET') {
        try {
            const url = `${restUrl(cfg, 'share_tokens')}?select=id,name,token,category_ids,tag_ids,created_at&user_id=eq.${userId}&order=created_at.desc`;
            const r = await fetch(url, { headers: h(cfg, token) });
            if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
            const rows = await r.json();
            return sendOk(res, { presets: rows || [] });
        } catch (err) {
            return sendError(res, HTTP.INTERNAL_ERROR, err.message);
        }
    }

    if (req.method === 'POST') {
        const body = req.body || {};
        const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Shared Collection';
        const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];
        const tagIds = Array.isArray(body.tagIds) ? body.tagIds : [];

        const shareToken = generateToken();
        try {
            const insert = {
                user_id: userId,
                name,
                token: shareToken,
                category_ids: categoryIds,
                tag_ids: tagIds,
            };
            const r = await fetch(restUrl(cfg, 'share_tokens'), {
                method: 'POST',
                headers: h(cfg, token, { contentType: true, prefer: 'return=representation' }),
                body: JSON.stringify(insert),
            });
            const text = await r.text();
            if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: text });
            const created = JSON.parse(text);
            const row = Array.isArray(created) ? created[0] : created;
            return sendOk(res, { preset: row, link: `/share?token=${row.token}` }, HTTP.CREATED);
        } catch (err) {
            return sendError(res, HTTP.INTERNAL_ERROR, err.message);
        }
    }

    if (req.method === 'DELETE') {
        const id = req.query.id;
        if (!id) return sendError(res, HTTP.BAD_REQUEST, 'Missing share id');
        try {
            const url = `${restUrl(cfg, 'share_tokens')}?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}`;
            const r = await fetch(url, { method: 'DELETE', headers: h(cfg, token, { prefer: 'return=representation' }) });
            if (!r.ok) return sendError(res, HTTP.BAD_GATEWAY, 'Upstream REST error', { details: await r.text() });
            return sendOk(res, { deleted: true });
        } catch (err) {
            return sendError(res, HTTP.INTERNAL_ERROR, err.message);
        }
    }
}
