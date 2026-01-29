export default async function handler(req, res) {
  // Allow GET and POST on this collection
  // GET — list sites; POST — create a site
  // Other methods are handled by the dynamic [id] route


  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ success: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment' });

  // Use user's token for authenticated requests (respects RLS), fallback to anon key for reads
  const KEY = userToken || SUPABASE_ANON_KEY;

  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Basic validation
      if (!body.name || !body.url || !body.pricing) return res.status(400).json({ success: false, error: 'Missing required fields: name, url, pricing' });
      if (!body.user_id) return res.status(400).json({ success: false, error: 'Missing user_id (you must be logged in to add a site)' });

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites`;
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(((b) => { const allowed = ['name', 'url', 'pricing', 'user_id', 'is_favorite']; const t = {}; for (const k of allowed) if (Object.prototype.hasOwnProperty.call(b, k)) t[k] = b[k]; return t; })(body))
      });

      const text = await r.text();
      if (!r.ok) {
        // Try graceful duplicate handling: if upstream returned a unique constraint error, lookup by URL
        try {
          const bodyUrl = body && body.url ? body.url : null;
          if (bodyUrl && /duplicate|unique|violat|already exists|duplicate key/i.test(text)) {
            const lookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?select=*&url=eq.${encodeURIComponent(bodyUrl)}`;
            try {
              const lookupRes = await fetch(lookupUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
              if (lookupRes.ok) {
                const rows = await lookupRes.json();
                if (rows && rows.length > 0) return res.status(409).json({ success: false, error: 'Site already exists', data: rows[0] });
              }
            } catch (lookupErr) {
              console.warn('site duplicate lookup failed', lookupErr);
            }
          }
        } catch (e) { console.warn('duplicate-site handling failed', e); }
        return res.status(502).json({ success: false, error: 'Upstream REST error', details: text });
      }

      const created = JSON.parse(text);
      const newSite = Array.isArray(created) ? created[0] : created;

      // Helper function to create error message for junction insert failures
      const createJunctionErrorMsg = (type, status, rollbackSuccess) => {
        const baseMsg = `Failed to save ${type} (Status ${status}). This might be a permissions issue. Please check that you have permission to create site-${type} relationships.`;
        if (rollbackSuccess) {
          return baseMsg;
        }
        return `${baseMsg} WARNING: Failed to rollback site - manual cleanup may be needed (site ID: ${newSite.id})`;
      };

      // Helper function to rollback (delete the site and any inserted junction records) if creation fails
      const rollbackSite = async (reason) => {
        try {
          console.error('Rolling back site creation due to:', reason);
          
          // First, try to delete any inserted site_tags
          try {
            const delTagUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?site_id=eq.${newSite.id}`;
            await fetch(delTagUrl, {
              method: 'DELETE',
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}` }
            });
            console.log('Deleted any inserted site_tags during rollback');
          } catch (err) {
            console.error('Failed to delete site_tags during rollback:', err);
          }

          // Then, try to delete any inserted site_categories
          try {
            const delCatUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?site_id=eq.${newSite.id}`;
            await fetch(delCatUrl, {
              method: 'DELETE',
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}` }
            });
            console.log('Deleted any inserted site_categories during rollback');
          } catch (err) {
            console.error('Failed to delete site_categories during rollback:', err);
          }

          // Finally, delete the site itself
          const deleteUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${newSite.id}`;
          const deleteRes = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}` }
          });
          if (deleteRes.ok) {
            console.log('Site rolled back successfully');
            return true;
          } else {
            const errText = await deleteRes.text();
            console.error('Rollback DELETE failed:', { status: deleteRes.status, body: errText });
            return false;
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback site:', rollbackErr);
          return false;
        }
      };

      // Attach tags (tag_ids) if provided
      if (Array.isArray(body.tag_ids) && body.tag_ids.length > 0) {
        try {
          const stUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags`;
          const payload = body.tag_ids.map(tag_id => ({ site_id: newSite.id, tag_id }));
          console.log('Inserting site_tags:', payload);
          const stRes = await fetch(stUrl, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) });
          if (!stRes.ok) {
            const errText = await stRes.text();
            console.error('site_tags insert failed:', { status: stRes.status, statusText: stRes.statusText, body: errText, payload });
            const rollbackSuccess = await rollbackSite('tag insertion failed');
            throw new Error(createJunctionErrorMsg('tags', stRes.status, rollbackSuccess));
          } else {
            const inserted = await stRes.json();
            console.log('site_tags inserted successfully:', inserted);
          }
        } catch (err) {
          console.error('site_tags insert error:', err);
          throw err;
        }
      }

      // Attach categories - support both category_ids (array of IDs) and categories (array of names)
      const categoryIds = body.category_ids || [];
      const categoryNames = body.categories || [];

      if (categoryIds.length > 0) {
        // Direct ID insertion
        try {
          const scUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories`;
          const toInsert = categoryIds.map(category_id => ({ site_id: newSite.id, category_id }));
          console.log('Inserting site_categories:', toInsert);
          const scRes = await fetch(scUrl, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(toInsert) });
          if (!scRes.ok) {
            const errText = await scRes.text();
            console.error('site_categories insert failed:', { status: scRes.status, statusText: scRes.statusText, body: errText, toInsert });
            const rollbackSuccess = await rollbackSite('category insertion failed');
            throw new Error(createJunctionErrorMsg('categories', scRes.status, rollbackSuccess));
          } else {
            const inserted = await scRes.json();
            console.log('site_categories inserted successfully:', inserted);
          }
        } catch (err) {
          console.error('site_categories insert error:', err);
          throw err;
        }
      } else if (categoryNames.length > 0) {
        // Resolve names to IDs first
        try {
          const encoded = categoryNames.map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
          const catUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id,name&name=in.(${encoded})`;
          const catRes = await fetch(catUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          if (!catRes.ok) {
            const errText = await catRes.text();
            console.error('Failed to lookup category names:', { status: catRes.status, body: errText });
            const rollbackSuccess = await rollbackSite('category name lookup failed');
            throw new Error(createJunctionErrorMsg('categories', catRes.status, rollbackSuccess));
          }
          
          const cats = await catRes.json();
          const nameToId = new Map(cats.map(c => [c.name, c.id]));
          const toInsert = [];
          categoryNames.forEach(name => {
            const cid = nameToId.get(name);
            if (cid) toInsert.push({ site_id: newSite.id, category_id: cid });
          });
          if (toInsert.length > 0) {
            console.log('Inserting site_categories (from names):', toInsert);
            const scUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories`;
            const scRes = await fetch(scUrl, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(toInsert) });
            if (!scRes.ok) {
              const errText = await scRes.text();
              console.error('site_categories insert failed:', { status: scRes.status, statusText: scRes.statusText, body: errText, toInsert });
              const rollbackSuccess = await rollbackSite('category insertion failed (from names)');
              throw new Error(createJunctionErrorMsg('categories', scRes.status, rollbackSuccess));
            } else {
              const inserted = await scRes.json();
              console.log('site_categories inserted successfully (from names):', inserted);
            }
          }
        } catch (err) {
          console.error('site_categories attach error (from names):', err);
          throw err;
        }
      }

      // Refetch the complete site with categories and tags
      try {
        const refetchUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=eq.${newSite.id}&select=*,categories_array:site_categories(category:categories(*)),tags_array:site_tags(tag:tags(*))`;
        console.log('Refetching complete site:', refetchUrl);
        const refetchRes = await fetch(refetchUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
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

          console.log('Complete site after creation:', JSON.stringify(completeSite, null, 2));
          return res.status(201).json({ success: true, data: completeSite });
        } else {
          const errText = await refetchRes.text();
          console.error('Failed to refetch complete site:', { status: refetchRes.status, statusText: refetchRes.statusText, body: errText });
          console.warn('Returning basic site data without categories/tags');
          return res.status(201).json({ success: true, data: newSite });
        }
      } catch (err) {
        console.error('Refetch complete site error:', err);
        return res.status(201).json({ success: true, data: newSite });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  try {
    // Support pagination and simple search
    const q = (req.query && req.query.q) ? String(req.query.q).trim() : null;
    let limit = req.query && req.query.limit ? parseInt(req.query.limit, 10) : 100;
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;
    if (limit > 500) limit = 500; // cap limit
    let page = req.query && req.query.page ? parseInt(req.query.page, 10) : 1;
    if (!Number.isFinite(page) || page <= 0) page = 1;
    const offset = (page - 1) * limit;

    let url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?select=*`;
    url += `&order=created_at.desc&limit=${limit}&offset=${offset}`;

    if (q) {
      const qEsc = encodeURIComponent(q.replace(/%/g, '%25'));
      const orFilter = `or=(name.ilike.*${qEsc}*,url.ilike.*${qEsc}*)`;
      url += `&${orFilter}`;
    }

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ success: false, error: 'Upstream REST error', details: text });
    }

    let data = await r.json();

    // If we have sites, fetch site_categories and site_tags and attach them to each site
    let scDebug = null; let stDebug = null;
    // Declare arrays in outer scope so debug counts at the end can see them
    let siteCategories = [];
    let siteTags = [];
    if (Array.isArray(data) && data.length > 0) {
      try {
        const siteIds = data.map(s => s.id);
        const rawInList = siteIds.map(id => `"${id}"`).join(',');
        const encodedInList = encodeURIComponent(rawInList);

        // Fetch site_categories with embedded category object (URL-encoded IN list)
        const scUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?select=*,category:categories(*)&site_id=in.(${encodedInList})`;
        siteCategories = [];
        try {
          const scRes = await fetch(scUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          const scText = await scRes.text();
          scDebug = { ok: scRes.ok, status: scRes.status, statusText: scRes.statusText, body: scText, url: scUrl };
          if (scRes.ok) {
            try { siteCategories = JSON.parse(scText); } catch (e) { siteCategories = []; scDebug.parseError = String(e); }
          } else {
            console.warn('site_categories fetch failed', scDebug);
          }
        } catch (err) { console.warn('site_categories fetch error', err); scDebug = { error: String(err) }; }

        // Build map site_id => categories[] (category objects)
        const categoriesBySite = new Map();
        (siteCategories || []).forEach(sc => {
          const arr = categoriesBySite.get(sc.site_id) || [];
          if (sc.category) arr.push(sc.category);
          categoriesBySite.set(sc.site_id, arr);
        });

        // Fetch site_tags with embedded tag object
        const stUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?select=*,tag:tags(*)&site_id=in.(${encodedInList})`;
        siteTags = [];
        try {
          const stRes = await fetch(stUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          const stText = await stRes.text();
          stDebug = { ok: stRes.ok, status: stRes.status, statusText: stRes.statusText, body: stText, url: stUrl };
          if (stRes.ok) {
            try { siteTags = JSON.parse(stText); } catch (e) { siteTags = []; stDebug.parseError = String(e); }
          } else {
            console.warn('site_tags fetch failed', stDebug);
          }
        } catch (err) { console.warn('site_tags fetch error', err); stDebug = { error: String(err) }; }

        // Build map site_id => tags[] (tag objects)
        const tagsBySite = new Map();
        (siteTags || []).forEach(st => {
          const arr = tagsBySite.get(st.site_id) || [];
          if (st.tag) arr.push(st.tag);
          tagsBySite.set(st.site_id, arr);
        });

        // Normalize string category/tag names into objects by resolving existing rows
        const categoryNames = new Set();
        const tagNames = new Set();

        data.forEach(site => {
          const rawCats = site.categories_array || site.categories || [];
          (Array.isArray(rawCats) ? rawCats : []).forEach(c => { if (typeof c === 'string' && c.trim()) categoryNames.add(c.trim()); });
          const rawTags = site.tags_array || site.tags || [];
          (Array.isArray(rawTags) ? rawTags : []).forEach(t => { if (typeof t === 'string' && t.trim()) tagNames.add(t.trim()); });
        });

        const nameToCategory = new Map();
        if (categoryNames.size > 0) {
          const enc = Array.from(categoryNames).map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
          const catLookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id,name,color&name=in.(${enc})`;
          const catLookupRes = await fetch(catLookupUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          if (catLookupRes.ok) {
            const catsFound = await catLookupRes.json();
            catsFound.forEach(c => nameToCategory.set(c.name, c));
          }
        }

        const nameToTag = new Map();
        if (tagNames.size > 0) {
          const enc = Array.from(tagNames).map(n => encodeURIComponent(n.replace(/\)/g, '\\)'))).join(',');
          const tagLookupUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=id,name,color&name=in.(${enc})`;
          const tagLookupRes = await fetch(tagLookupUrl, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          if (tagLookupRes.ok) {
            const tagsFound = await tagLookupRes.json();
            tagsFound.forEach(t => nameToTag.set(t.name, t));
          }
        }

        // Attach arrays to each site under expected keys (categories_array, tags_array), normalizing strings to objects when possible
        data = data.map(site => {
          const catsFromLinks = categoriesBySite.get(site.id) || [];
          const tagsFromLinks = tagsBySite.get(site.id) || [];

          // Prioritize relational data (catsFromLinks) over legacy text arrays (site.categories)
          const rawCats = catsFromLinks.length > 0 ? catsFromLinks : (site.categories_array || site.categories || []);
          const normalizedCats = (Array.isArray(rawCats) ? rawCats : []).map(c => {
            if (typeof c === 'string') return nameToCategory.get(c) || { name: c };
            return c;
          });

          const rawTags = tagsFromLinks.length > 0 ? tagsFromLinks : (site.tags_array || site.tags || []);
          const normalizedTags = (Array.isArray(rawTags) ? rawTags : []).map(t => {
            if (typeof t === 'string') return nameToTag.get(t) || { name: t };
            return t;
          });

          return Object.assign({}, site, {
            categories_array: normalizedCats,
            tags_array: normalizedTags
          });
        });
      } catch (err) {
        console.warn('site relations attach failed', err);
      }
    }

    // Compute counts and integrity details (compare parsed debug bodies when present)
    const siteCategoriesCount = Array.isArray(siteCategories) ? siteCategories.length : 0;
    const siteTagsCount = Array.isArray(siteTags) ? siteTags.length : 0;
    let scBodyCount = null;
    let stBodyCount = null;
    try { if (scDebug && typeof scDebug.body === 'string') scBodyCount = JSON.parse(scDebug.body).length; } catch (e) { scBodyCount = null; }
    try { if (stDebug && typeof stDebug.body === 'string') stBodyCount = JSON.parse(stDebug.body).length; } catch (e) { stBodyCount = null; }
    const countsMatch = (scBodyCount === null || scBodyCount === siteCategoriesCount) && (stBodyCount === null || stBodyCount === siteTagsCount);
    if (!countsMatch) console.warn('site counts mismatch', { siteCategoriesCount, scBodyCount, siteTagsCount, stBodyCount });
    return res.status(200).json({
      success: true,
      data,
      debug: {
        sitesCount: Array.isArray(data) ? data.length : 0,
        siteCategoriesCount,
        siteTagsCount,
        siteCategoriesDebug: scDebug,
        siteTagsDebug: stDebug,
        integrity: { siteCategoriesCount, scBodyCount, siteTagsCount, stBodyCount, countsMatch }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }

}