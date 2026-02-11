/** Link health check — HEAD→GET fallback with retry */

import { HTTP, getSupabaseConfig, extractTokenFromReq, buildHeaders, restUrl, sendError, sendOk } from '../helpers/api-utils';

const RETRIES = 2, T1 = 7000, T2 = 15000, CONC = 8;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36';
const ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function referer() {
    const s = process.env.NEXT_PUBLIC_SITE_URL, v = process.env.NEXT_PUBLIC_VERCEL_URL;
    return s || (v ? `https://${v}` : undefined);
}

function checkHeaders(ref, extra = {}) {
    const h = { 'User-Agent': UA, Accept: ACCEPT, 'Accept-Language': 'en-US,en;q=0.9' };
    if (ref) h.Referer = ref;
    return { ...h, ...extra };
}

async function checkUrl(url) {
    if (!url || typeof url !== 'string') return { ok: false, status: 'invalid' };
    const ref = referer();
    let lastErr = null;

    for (let a = 0; a < RETRIES; a++) {
        const ms = a === 0 ? T1 : T2;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        const hdr = checkHeaders(ref);

        try {
            let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: hdr });
            if (!res || res.status >= 400) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: hdr });
            if (res?.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: checkHeaders(ref, { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }) });
            clearTimeout(timer);
            if (res) { const ok = res.status >= 200 && res.status < 400; return { ok, status: res.status }; }
            lastErr = new Error('no-response');
        } catch (err) {
            clearTimeout(timer);
            lastErr = err;
            if (err.name === 'AbortError' && a === RETRIES - 1) return { ok: false, status: 'timeout' };
        }
    }
    return { ok: false, status: lastErr ? (lastErr.name === 'AbortError' ? 'timeout' : String(lastErr)) : 'failed' };
}

async function fetchSites(token, cfg) {
    if (!cfg) throw new Error('SUPABASE_URL / key missing');
    if (!token) throw new Error('Not authenticated');
    const all = [];
    for (let offset = 0; ; offset += 1000) {
        const url = restUrl(cfg, `sites?select=id,url,name&order=created_at.desc&limit=1000&offset=${offset}`);
        const r = await fetch(url, { headers: buildHeaders(cfg.anonKey, token) });
        if (!r.ok) { const t = await r.text(); const e = new Error('Upstream REST error'); e.details = t; throw e; }
        const data = await r.json();
        all.push(...(data || []).map(s => ({ id: s.id, url: s.url, name: s.name })));
        if (!data || data.length < 1000) break;
    }
    return all;
}

export default async function handler(req, res) {
    const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');

    const token = extractTokenFromReq(req);
    let sites = Array.isArray(req.body?.sites) ? req.body.sites : null;

    try {
        if (!sites) {
            try { sites = await fetchSites(token, getSupabaseConfig()); } catch (err) {
                const status = err.message === 'Not authenticated' ? HTTP.UNAUTHORIZED : err.message.includes('missing') ? HTTP.INTERNAL_ERROR : HTTP.BAD_GATEWAY;
                return sendError(res, status, err.message, err.details ? { details: err.details } : undefined);
            }
        }

        const results = [];
        for (let i = 0; i < sites.length; i += CONC) {
            const batch = await Promise.all(sites.slice(i, i + CONC).map(async s => {
                const c = await checkUrl(s.url);
                return { id: s.id, name: s.name, url: s.url, ok: c.ok, status: c.status };
            }));
            results.push(...batch);
        }

        const broken = results.filter(r => !r.ok);
        return sendOk(res, { total: results.length, brokenCount: broken.length, broken, results });
    } catch (err) {
        console.error('Link check failed:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || String(err));
    }
}