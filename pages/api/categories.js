export default async function handler(req, res) {
  // Allow GET and POST on this collection (create category via POST)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });
  }

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for public reads
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;

  if (req.method === 'POST') {
    // POST requires user authentication - can't create categories without valid user token
    if (!userToken) {
      return res.status(401).json({ success: false, error: 'Authentication required to create categories' });
    }

    try {
      const body = req.body || {};

      // Only include allowed fields (user_id may not exist in table)
      const allowedFields = ['name', 'color', 'display_order', 'user_id'];
      const filteredBody = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) {
          filteredBody[key] = body[key];
        }
      }

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories`;
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(filteredBody)
      });

      const text = await r.text();

      if (!r.ok) {
        // Handle duplicate name attempt: return existing category if present
        try {
          const bodyName = (body && body.name) ? body.name : null;
          if (bodyName && /duplicate|unique|violat/i.test(text)) {
            const lookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=*&name=eq.${encodeURIComponent(bodyName)}`;
            const lookupRes = await fetch(lookupUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
            if (lookupRes.ok) {
              const rows = await lookupRes.json();
              if (rows && rows.length > 0) return res.status(200).json({ success: true, data: rows[0] });
            }
          }
        } catch (lookupErr) {
        }

        return res.status(502).json({ success: false, error: 'Upstream REST error', details: text });
      }

      const created = JSON.parse(text);
      return res.status(201).json({ success: true, data: Array.isArray(created) ? created[0] : created });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // GET - use user token if available for RLS, otherwise anon key
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=*`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${AUTH_TOKEN}`,
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
