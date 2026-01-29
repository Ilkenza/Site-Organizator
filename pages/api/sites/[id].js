export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log('[Sites/ID API] Auth check:', {
    id,
    method: req.method,
    hasUserToken: !!userToken,
    tokenPreview: userToken ? userToken.substring(0, 20) + '...' : 'none'
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY });
    return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });
  }

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for reads
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;

  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}`;
      const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, Accept: 'application/json' } });
      if (!r.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await r.text() });
      const rows = await r.json();
      return res.status(200).json({ success: true, data: rows[0] || null });
    } catch (err) { return res.status(500).json({ success: false, error: err.message || String(err) }); }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = req.body || {};

      // Extract category_ids and tag_ids before sending to Supabase
      const { category_ids, tag_ids, ...siteData } = body;

      // Update the site itself (only allowed fields)
      const allowedFields = ['name', 'url', 'pricing', 'is_favorite'];
      const filteredData = {};
      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(siteData, key)) {
          filteredData[key] = siteData[key];
        }
      }

      // Add updated_at timestamp
      filteredData.updated_at = new Date().toISOString();

      console.log('Updating site:', id, 'with data:', filteredData);

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(filteredData)
      });
      if (!r.ok) {
        const errorText = await r.text();
        console.error('Supabase PATCH error:', r.status, errorText);
        return res.status(502).json({ success: false, error: 'Upstream REST error', status: r.status, details: errorText });
      }
      const updated = await r.json();
      console.log('Supabase PATCH response:', updated);
      const updatedSite = Array.isArray(updated) ? updated[0] : updated;
      console.log('Updated site to return:', updatedSite);

      // Update categories if provided
      if (Array.isArray(category_ids)) {
        try {
          // Delete existing site_categories
          const delCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?site_id=eq.${id}`;
          const delCatRes = await fetch(delCatUrl, { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}` } });
          if (!delCatRes.ok) {
            const errText = await delCatRes.text();
            console.error('Failed to delete site_categories:', delCatRes.status, errText);
          } else {
            console.log('Deleted existing site_categories for site:', id);
          }

          // Insert new categories
          if (category_ids.length > 0) {
            const catPayload = category_ids.map(category_id => ({ site_id: id, category_id }));
            console.log('Inserting categories:', catPayload);
            const insCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories`;
            const insCatRes = await fetch(insCatUrl, {
              method: 'POST',
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(catPayload)
            });
            if (!insCatRes.ok) {
              const errText = await insCatRes.text();
              console.error('Failed to insert site_categories:', insCatRes.status, errText);
            } else {
              console.log('Inserted', category_ids.length, 'categories for site:', id);
            }
          }
        } catch (err) { console.error('Exception updating categories:', err); }
      }

      // Update tags if provided
      if (Array.isArray(tag_ids)) {
        try {
          // Delete existing site_tags
          const delTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?site_id=eq.${id}`;
          const delTagRes = await fetch(delTagUrl, { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}` } });
          if (!delTagRes.ok) {
            const errText = await delTagRes.text();
            console.error('Failed to delete site_tags:', delTagRes.status, errText);
          } else {
            console.log('Deleted existing site_tags for site:', id);
          }

          // Insert new tags
          if (tag_ids.length > 0) {
            const tagPayload = tag_ids.map(tag_id => ({ site_id: id, tag_id }));
            console.log('Inserting tags:', tagPayload);
            const insTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags`;
            const insTagRes = await fetch(insTagUrl, {
              method: 'POST',
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(tagPayload)
            });
            if (!insTagRes.ok) {
              const errText = await insTagRes.text();
              console.error('Failed to insert site_tags:', insTagRes.status, errText);
            } else {
              console.log('Inserted', tag_ids.length, 'tags for site:', id);
            }
          }
        } catch (err) { console.error('Exception updating tags:', err); }
      }

      // Refetch the site with all related data
      const refetchUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}&select=*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
      const refetchRes = await fetch(refetchUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
      if (refetchRes.ok) {
        const refetchData = await refetchRes.json();
        const completeSite = Array.isArray(refetchData) ? refetchData[0] : refetchData;

        // Transform categories_array and tags_array to flat format
        if (completeSite?.categories_array) {
          completeSite.categories_array = completeSite.categories_array.map(sc => sc.category).filter(Boolean);
        }
        if (completeSite?.tags_array) {
          completeSite.tags_array = completeSite.tags_array.map(st => st.tag).filter(Boolean);
        }

        console.log('Complete site after update:', completeSite);
        return res.status(200).json({ success: true, data: completeSite });
      } else {
        const errorText = await refetchRes.text();
        return res.status(502).json({ success: false, error: 'Failed to refetch site', details: errorText });
      }
    } catch (err) {
      console.error('PUT/PATCH exception:', err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  if (req.method === 'DELETE') {
    try {
      console.log('Deleting site:', id);
      console.log('Using auth:', userToken ? 'USER_TOKEN' : 'ANON_KEY');

      // First, delete related site_categories
      try {
        const delCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?site_id=eq.${id}`;
        await fetch(delCatUrl, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}` }
        });
        console.log('Deleted site_categories for site:', id);
      } catch (err) {
        console.warn('Failed to delete site_categories:', err);
      }

      // Then, delete related site_tags
      try {
        const delTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?site_id=eq.${id}`;
        await fetch(delTagUrl, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}` }
        });
        console.log('Deleted site_tags for site:', id);
      } catch (err) {
        console.warn('Failed to delete site_tags:', err);
      }

      // Now delete the site itself
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}`;
      console.log('Deleting site from database, URL:', url);
      const r = await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
          Accept: 'application/json'
        }
      });
      console.log('Delete response status:', r.status, r.statusText);
      if (!r.ok) {
        const errorText = await r.text();
        console.error('Supabase DELETE error:', r.status, errorText);
        return res.status(502).json({ success: false, error: 'Upstream REST error', status: r.status, details: errorText });
      }
      console.log('Site deleted successfully:', id);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE exception:', err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
