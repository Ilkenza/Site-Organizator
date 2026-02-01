export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for reads
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!userToken) return res.status(401).json({ success: false, error: 'Authentication required' });
    try {
      const body = req.body || {};

      // Auto-fix null user_id: extract user ID from token and ensure it's set
      if (userToken && !body.user_id) {
        try {
          const payload = JSON.parse(atob(userToken.split('.')[1]));
          if (payload.sub) {
            body.user_id = payload.sub;
          }
        } catch (e) {
          console.warn('Failed to extract user_id from token:', e);
        }
      }

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?id=eq.${id}`;
      const r = await fetch(url, { method: 'PATCH', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ success: false, error: 'Upstream REST error', upstreamStatus: r.status, upstreamStatusText: r.statusText, upstreamBody: text, requestBody: body });
      }
      const updated = await r.json();
      return res.status(200).json({ success: true, data: Array.isArray(updated) ? updated[0] : updated });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  if (req.method === 'DELETE') {
    if (!userToken) return res.status(401).json({ success: false, error: 'Authentication required' });
    try {
      // First delete all site_categories that use this category
      const delUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?category_id=eq.${id}`;
      const delRes = await fetch(delUrl, { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
      if (!delRes.ok) console.warn('Failed to delete site_categories:', await delRes.text());

      // Then delete the category itself
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?id=eq.${id}`;
      const r = await fetch(url, { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      return res.status(200).json({ success: true });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?id=eq.${id}`;
      const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      const rows = await r.json();
      return res.status(200).json({ success: true, data: rows[0] || null });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
