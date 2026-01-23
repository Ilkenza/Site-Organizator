export default async function handler(req, res) {
  // Allow GET and POST on this collection (create tag via POST)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_KEY)) return res.status(500).json({ success: false, error: 'SUPABASE_URL and at least one Supabase key (anon or service) must be set in environment' });

  const KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags`;
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(body)
      });

      const text = await r.text();
      if (!r.ok) {
        // Handle duplicate name: return existing tag if present
        try {
          const bodyName = (body && body.name) ? body.name : null;
          if (bodyName && /duplicate|unique|violat/i.test(text)) {
            const lookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=*&name=eq.${encodeURIComponent(bodyName)}`;
            const lookupRes = await fetch(lookupUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
            if (lookupRes.ok) {
              const rows = await lookupRes.json();
              if (rows && rows.length > 0) return res.status(200).json({ success: true, data: rows[0] });
            }
          }
        } catch (lookupErr) {
          console.warn('tag duplicate lookup failed', lookupErr);
        }

        return res.status(502).json({ success: false, error: 'Upstream REST error', details: text });
      }

      const created = JSON.parse(text);
      return res.status(201).json({ success: true, data: Array.isArray(created) ? created[0] : created });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=*`;
    const r = await fetch(url, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ success: false, error: 'Upstream REST error', details: text });
    }

    const data = await r.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
}
