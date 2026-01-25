export default async function handler(req, res) {
  // Allow GET and POST on this collection (create tag via POST)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log('[Tags API] Auth check:', {
    hasUserToken: !!userToken,
    tokenPreview: userToken ? userToken.substring(0, 20) + '...' : 'none',
    hasAnonKey: !!SUPABASE_ANON_KEY
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });
  }

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for public reads
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;

  if (req.method === 'POST') {
    // POST requires user authentication - can't create tags without valid user token
    if (!userToken) {
      console.log('[Tags API] POST rejected - no user token');
      return res.status(401).json({ success: false, error: 'Authentication required to create tags' });
    }

    try {
      const body = req.body || {};

      // Only include allowed fields (user_id may not exist in table)
      const allowedFields = ['name', 'color', 'user_id'];
      const filteredBody = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) {
          filteredBody[key] = body[key];
        }
      }

      console.log('[Tags API] Creating tag with user token:', filteredBody);

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags`;
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
      console.log('[Tags API] POST response:', r.status, text.substring(0, 200));

      if (!r.ok) {
        // Handle duplicate name: return existing tag if present
        try {
          const bodyName = (body && body.name) ? body.name : null;
          if (bodyName && /duplicate|unique|violat/i.test(text)) {
            const lookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=*&name=eq.${encodeURIComponent(bodyName)}`;
            const lookupRes = await fetch(lookupUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
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

  // GET - use user token if available for RLS, otherwise anon key
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=*`;
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
