const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Robust URL health check with retries, browser-like headers and HEAD->GET fallback
async function checkUrl(url) {
    if (!url || typeof url !== 'string') return { ok: false, status: 'invalid' };

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36';
    const referer = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL ? (process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) : undefined;

    const maxRetries = 2;
    let lastErr = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const timeoutMs = attempt === 0 ? 7000 : 15000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const headers = {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        };
        if (referer) headers['Referer'] = referer;

        try {
            let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });

            // If HEAD is not allowed or returns non-2xx, try GET
            if (!res || res.status >= 400) {
                // In some cases servers return 403 for HEAD but allow GET; try GET
                res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });

                // If still 403, try GET with cache-control/pragmas to bypass CDN edge caches
                if (res && res.status === 403) {
                    const extraHeaders = { ...headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
                    res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: extraHeaders });
                }
            }

            clearTimeout(timeout);

            if (res) {
                const ok = res.status >= 200 && res.status < 400;
                if (!ok) console.warn('Link check upstream status', { url, status: res.status, attempt });
                return { ok, status: res.status };
            }

            // If no response, continue to retry
            lastErr = new Error('no-response');
        } catch (err) {
            clearTimeout(timeout);
            lastErr = err;
            // If timeout, classify as timeout immediately on last attempt
            if (err.name === 'AbortError') {
                if (attempt === maxRetries - 1) return { ok: false, status: 'timeout' };
            }
            // otherwise, retry if attempts remain
        }
    }

    return { ok: false, status: lastErr ? (lastErr.name === 'AbortError' ? 'timeout' : String(lastErr)) : 'failed' };
}

export default async function handler(req, res) {
    // Allow preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userToken = req.headers.authorization?.replace('Bearer ', '') || null;
    let sites = Array.isArray(req.body?.sites) ? req.body.sites : null;

    try {
        if (!sites) {
            // If client didn't provide sites, fetch user's sites (requires Authorization header forwarded)
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ success: false, error: 'SUPABASE_URL / key missing' });
            if (!userToken) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?select=*&order=created_at.desc`;
            const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
            if (!r.ok) {
                const txt = await r.text();
                return res.status(502).json({ success: false, error: 'Upstream REST error', details: txt });
            }
            const data = await r.json();
            sites = (Array.isArray(data) ? data : []).map(s => ({ id: s.id, url: s.url, name: s.name }));
        }

        // Limit concurrency to avoid spikes
        const concurrency = 8;
        const results = [];

        for (let i = 0; i < sites.length; i += concurrency) {
            const batch = sites.slice(i, i + concurrency);
            // Map each site to a check promise
            const batchResults = await Promise.all(batch.map(async (s) => {
                const chk = await checkUrl(s.url);
                return {
                    id: s.id,
                    name: s.name,
                    url: s.url,
                    ok: chk.ok,
                    status: chk.status
                };
            }));
            results.push(...batchResults);
        }

        const broken = results.filter(r => !r.ok);
        return res.status(200).json({ success: true, total: results.length, brokenCount: broken.length, broken, results });
    } catch (err) {
        console.error('Link check failed:', err);
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
}