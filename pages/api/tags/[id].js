export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_KEY)) return res.status(500).json({ success: false, error: 'SUPABASE_URL and at least one Supabase key (anon or service) must be set in environment' });
  const KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?id=eq.${id}`;
      const r = await fetch(url, { method: 'PATCH', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      const updated = await r.json();
      return res.status(200).json({ success: true, data: Array.isArray(updated) ? updated[0] : updated });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  if (req.method === 'DELETE') {
    try {
      // First delete all site_tags that use this tag
      const delUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?tag_id=eq.${id}`;
      const delRes = await fetch(delUrl, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (!delRes.ok) console.warn('Failed to delete site_tags:', await delRes.text());

      // Then delete the tag itself
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?id=eq.${id}`;
      const r = await fetch(url, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      return res.status(200).json({ success: true });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?id=eq.${id}`;
      const r = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      const rows = await r.json();
      return res.status(200).json({ success: true, data: rows[0] || null });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
