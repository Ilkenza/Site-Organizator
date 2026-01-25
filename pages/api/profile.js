// API endpoint for fetching/updating user profile
// Uses user's JWT token for RLS compliance

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Extract user's JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ success: false, error: 'Supabase config missing' });
    }

    if (!userToken) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Decode JWT to get user ID (JWT payload is base64 encoded)
    let userId;
    try {
        const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        userId = payload.sub;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Invalid token - no user ID' });
        }
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid token format' });
    }

    if (req.method === 'GET') {
        try {
            const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}&select=id,name,avatar_url`;
            const r = await fetch(url, {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${userToken}`,
                    Accept: 'application/json'
                }
            });

            if (!r.ok) {
                const text = await r.text();
                console.error('[Profile API] Fetch error:', r.status, text);
                return res.status(502).json({ success: false, error: 'Failed to fetch profile', details: text });
            }

            const rows = await r.json();
            const profile = rows[0] || null;

            return res.status(200).json({ success: true, data: profile });
        } catch (err) {
            console.error('[Profile API] Error:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
        try {
            const body = req.body || {};

            // Only allow updating name and avatar_url
            const allowedFields = ['name', 'avatar_url'];
            const updateData = {};
            for (const key of allowedFields) {
                if (body[key] !== undefined) {
                    updateData[key] = body[key];
                }
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ success: false, error: 'No valid fields to update' });
            }

            const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${userToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(updateData)
            });

            if (!r.ok) {
                const text = await r.text();
                console.error('[Profile API] Update error:', r.status, text);
                return res.status(502).json({ success: false, error: 'Failed to update profile', details: text });
            }

            const updated = await r.json();
            return res.status(200).json({ success: true, data: updated[0] || null });
        } catch (err) {
            console.error('[Profile API] Error:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
}
