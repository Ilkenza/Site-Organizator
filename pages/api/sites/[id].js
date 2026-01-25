export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  // Use service key if available (bypasses RLS), otherwise anon key
  const SUPABASE_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY });
    return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_KEY must be set in environment' });
  }

  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}`;
      const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' } });
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
      const allowedFields = ['name', 'url', 'pricing'];
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
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
          await fetch(delCatUrl, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });

          // Insert new categories
          if (category_ids.length > 0) {
            const catPayload = category_ids.map(category_id => ({ site_id: id, category_id }));
            const insCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories`;
            await fetch(insCatUrl, {
              method: 'POST',
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(catPayload)
            });
          }
        } catch (err) { console.warn('Failed to update categories:', err); }
      }

      // Update tags if provided
      if (Array.isArray(tag_ids)) {
        try {
          // Delete existing site_tags
          const delTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?site_id=eq.${id}`;
          await fetch(delTagUrl, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });

          // Insert new tags
          if (tag_ids.length > 0) {
            const tagPayload = tag_ids.map(tag_id => ({ site_id: id, tag_id }));
            const insTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags`;
            await fetch(insTagUrl, {
              method: 'POST',
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(tagPayload)
            });
          }
        } catch (err) { console.warn('Failed to update tags:', err); }
      }

      // Refetch the site with all related data
      const refetchUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}&select=*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
      const refetchRes = await fetch(refetchUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' } });
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
      console.log('Using key type:', SUPABASE_SERVICE_KEY ? 'SERVICE_KEY' : 'ANON_KEY');

      // First, delete related site_categories
      try {
        const delCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?site_id=eq.${id}`;
        await fetch(delCatUrl, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
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
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
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
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
