import { parse } from 'url';
import { verifyUserFromAuthHeader } from '../../helpers/auth-helpers';

export default async function handler(req, res) {
    const { query: { id } } = parse(req.url, true);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Expect body with category_ids and tag_ids arrays
    let body = {};
    try {
        body = req.body || JSON.parse(req.body);
    } catch (e) { /* ignore parse error */ }

    const category_ids = Array.isArray(body.category_ids) ? body.category_ids : (Array.isArray(body.categoryIds) ? body.categoryIds : []);
    const tag_ids = Array.isArray(body.tag_ids) ? body.tag_ids : (Array.isArray(body.tagIds) ? body.tagIds : []);

    // Authenticate user from Authorization header
    const auth = await verifyUserFromAuthHeader(req.headers.authorization);
    if (!auth || !auth.user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    // Fetch site to confirm ownership
    try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!SUPABASE_URL) return res.status(500).json({ success: false, error: 'SUPABASE_URL missing' });

        const ownerUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}&select=user_id`;
        const ownerRes = await fetch(ownerUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.token}`, Accept: 'application/json' } });
        if (!ownerRes.ok) return res.status(400).json({ success: false, error: 'Failed to fetch site owner' });
        const ownerJson = await ownerRes.json();
        const siteOwner = ownerJson?.[0]?.user_id;
        if (siteOwner !== auth.user.id) return res.status(403).json({ success: false, error: 'Not site owner' });

        // Check for service role key
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
        if (!SERVICE_KEY) return res.status(400).json({ success: false, error: 'Service role key not configured' });

        const SUPABASE_URL_BASE = SUPABASE_URL.replace(/\/$/, '');

        // Delete existing relations then insert provided ones
        const delCatUrl = `${SUPABASE_URL_BASE}/rest/v1/site_categories?site_id=eq.${id}`;
        await fetch(delCatUrl, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });

        if (category_ids.length) {
            const insCatUrl = `${SUPABASE_URL_BASE}/rest/v1/site_categories`;
            const toInsert = category_ids.map(category_id => ({ site_id: id, category_id }));
            const insCatRes = await fetch(insCatUrl, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(toInsert) });
            if (!insCatRes.ok) {
                const errText = await insCatRes.text();
                return res.status(500).json({ success: false, error: 'Failed to insert site_categories', details: errText });
            }
        }

        const delTagUrl = `${SUPABASE_URL_BASE}/rest/v1/site_tags?site_id=eq.${id}`;
        await fetch(delTagUrl, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });

        if (tag_ids.length) {
            const insTagUrl = `${SUPABASE_URL_BASE}/rest/v1/site_tags`;
            const toInsert = tag_ids.map(tag_id => ({ site_id: id, tag_id }));
            const insTagRes = await fetch(insTagUrl, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(toInsert) });
            if (!insTagRes.ok) {
                const errText = await insTagRes.text();
                return res.status(500).json({ success: false, error: 'Failed to insert site_tags', details: errText });
            }
        }

        // Refetch complete site with relations
        const refetchUrl = `${SUPABASE_URL_BASE}/rest/v1/sites?id=eq.${id}&select=*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
        const refetchRes = await fetch(refetchUrl, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } });
        const refetchJson = await refetchRes.json();

        return res.status(200).json({ success: true, data: refetchJson?.[0] || null });
    } catch (err) {
        console.error('Retry relations error:', err);
        return res.status(500).json({ success: false, error: String(err) });
    }
}
