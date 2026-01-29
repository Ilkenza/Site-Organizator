const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Basic URL health check with timeout and HEAD fallback to GET
async function checkUrl(url) {
    if (!url || typeof url !== 'string') return { ok: false, status: 'invalid' };
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        let res;
        try {
            // Try HEAD first to avoid downloading content
            res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
            if (!res || !res.ok) {
                // Fallback to GET in case HEAD isn't supported by the server
                res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
            }
        } finally {
            clearTimeout(timeout);
        }

        return { ok: !!(res && res.status >= 200 && res.status < 400), status: res ? res.status : 'no-response' };
    } catch (err) {
        return { ok: false, status: err.name === 'AbortError' ? 'timeout' : String(err) };
    }
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