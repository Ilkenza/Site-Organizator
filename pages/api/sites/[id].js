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

  console.log('[Sites/ID API] Service key check:', {
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY });
    return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });
  }

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for reads
  const AUTH_TOKEN = userToken || SUPABASE_ANON_KEY;

  // Determine key to use for relation updates. If the requester is the site owner,
  // prefer using the service role key to avoid RLS blocking relation writes.
  let REL_KEY = userToken || SUPABASE_ANON_KEY;
  try {
    if (userToken && id) {
      // Parse token to get user id
      let userSub = null;
      try { userSub = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString())?.sub; } catch (e) { /* ignore */ }

      if (userSub) {
        const ownerUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${id}&select=user_id`;
        const ownerRes = await fetch(ownerUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, Accept: 'application/json' } });
        if (ownerRes.ok) {
          const ownerRows = await ownerRes.json();
          if (ownerRows && ownerRows[0] && ownerRows[0].user_id === userSub) {
            const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
            REL_KEY = rawServiceKey ? rawServiceKey.replace(/^["']|["']$/g, '') : SUPABASE_ANON_KEY;
            console.log('[Sites/ID API] REL_KEY set to:', REL_KEY === SUPABASE_ANON_KEY ? 'anon' : 'service_role');
            if (REL_KEY === SUPABASE_ANON_KEY) {
              console.warn('[Sites/ID API] No service role key configured - falling back to anon key. Relation writes may be blocked by RLS.');
              // NOTE: warnings.push() removed - warnings array not yet defined at this point
              // The warning about missing service role key will be logged above instead
            } else {
              console.log('[Sites/ID API] Using service role key for relation updates for site owner:', id);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Sites/ID API] Owner check for relation updates failed:', e);
  }

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

      console.log('[Sites/ID API PUT] === START ===');
      console.log('[Sites/ID API PUT] Site ID:', id);
      console.log('[Sites/ID API PUT] REL_KEY type:', REL_KEY === SUPABASE_ANON_KEY ? 'anon' : 'service_role');
      console.log('[Sites/ID API PUT] category_ids received:', body.category_ids || category_ids);
      console.log('[Sites/ID API PUT] tag_ids received:', body.tag_ids || tag_ids);

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

      const warnings = [];

      // Update categories if provided
      if (Array.isArray(category_ids)) {
        try {
          // Delete existing site_categories
          const delCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?site_id=eq.${id}`;
          const delCatRes = await fetch(delCatUrl, { method: 'DELETE', headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}` } });
          if (!delCatRes.ok) {
            const errText = await delCatRes.text();
            console.error('Failed to delete site_categories:', delCatRes.status, errText);
            warnings.push({ stage: 'delete_site_categories', status: delCatRes.status, details: errText });
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
              headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(catPayload)
            });
            console.log('[Sites/ID API PUT] site_categories insert response status:', insCatRes.status, insCatRes.ok ? 'OK' : 'FAILED');
            if (!insCatRes.ok) {
              const errText = await insCatRes.text();
              console.error('Failed to insert site_categories:', insCatRes.status, errText);
              if (insCatRes.status === 401 || (errText && errText.includes('42501'))) {
                console.warn('[Sites/ID API] Relation insert likely blocked by RLS; REL_KEY type:', REL_KEY === SUPABASE_ANON_KEY ? 'anon' : 'service');
                console.warn('Upstream response for site_categories insert:', errText);
              }
              warnings.push({ stage: 'insert_site_categories', status: insCatRes.status, details: errText });
            } else {
              console.log('[Sites/ID API PUT] Inserted', category_ids.length, 'categories for site:', id);
            }
          }
        } catch (err) { console.error('Exception updating categories:', err); warnings.push({ stage: 'exception_update_categories', error: String(err) }); }
      }

      // Update tags if provided
      if (Array.isArray(tag_ids)) {
        try {
          // Delete existing site_tags
          const delTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?site_id=eq.${id}`;
          const delTagRes = await fetch(delTagUrl, { method: 'DELETE', headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}` } });
          if (!delTagRes.ok) {
            const errText = await delTagRes.text();
            console.error('Failed to delete site_tags:', delTagRes.status, errText);
            warnings.push({ stage: 'delete_site_tags', status: delTagRes.status, details: errText });
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
              headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(tagPayload)
            });
            console.log('[Sites/ID API PUT] site_tags insert response status:', insTagRes.status, insTagRes.ok ? 'OK' : 'FAILED');
            if (!insTagRes.ok) {
              const errText = await insTagRes.text();
              console.error('Failed to insert site_tags:', insTagRes.status, errText);
              if (insTagRes.status === 401 || (errText && errText.includes('42501'))) {
                console.warn('[Sites/ID API] Relation insert likely blocked by RLS; REL_KEY type:', REL_KEY === SUPABASE_ANON_KEY ? 'anon' : 'service');
                console.warn('Upstream response for site_tags insert:', errText);
              }
              warnings.push({ stage: 'insert_site_tags', status: insTagRes.status, details: errText });
            } else {
              console.log('[Sites/ID API PUT] Inserted', tag_ids.length, 'tags for site:', id);
            }
          }
        } catch (err) { console.error('Exception updating tags:', err); warnings.push({ stage: 'exception_update_tags', error: String(err) }); }
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
        return res.status(200).json({ success: true, data: completeSite, warnings: warnings && warnings.length ? warnings : undefined });
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
