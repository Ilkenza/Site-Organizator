export default async function handler(req, res) {
  const { name } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_KEY)) return res.status(500).json({ success: false, error: 'SUPABASE_URL and at least one Supabase key (anon or service) must be set in environment' });
  const KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

  try {
    // Find category id by name (use quoted value to avoid REST filter parsing issues)
    const quotedName = '"' + name + '"';
    const catUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id&name=eq.${encodeURIComponent(quotedName)}`;
    const catRes = await fetch(catUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
    if (!catRes.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await catRes.text(), requestedName: name, catUrl });
    let cats = await catRes.json();

    // If no category was found, try safe fallbacks (unquoted eq, and case-insensitive ilike) and return diagnostics
    if (!cats || cats.length === 0) {
      const tried = [{ type: 'quoted', url: catUrl, rows: Array.isArray(cats) ? cats.length : (cats ? (cats.length || null) : 0) }];
      try {
        const unqUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id&name=eq.${encodeURIComponent(name)}`;
        const unqRes = await fetch(unqUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
        let unqRows = null;
        try { unqRows = unqRes.ok ? await unqRes.json() : null; } catch (e) { unqRows = null; }
        tried.push({ type: 'unquoted', url: unqUrl, ok: unqRes.ok, rows: unqRows ? unqRows.length : null });
        if (unqRows && unqRows.length > 0) cats = unqRows;
      } catch (e) { tried.push({ type: 'unquoted', error: String(e) }); }

      if (!cats || cats.length === 0) {
        try {
          // ilike may be more forgiving for case or hidden chars
          const ilikeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id&name=ilike.${encodeURIComponent(name)}`;
          const ilikeRes = await fetch(ilikeUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
          let ilikeRows = null;
          try { ilikeRows = ilikeRes.ok ? await ilikeRes.json() : null; } catch (e) { ilikeRows = null; }
          tried.push({ type: 'ilike', url: ilikeUrl, ok: ilikeRes.ok, rows: ilikeRows ? ilikeRows.length : null });
          if (ilikeRows && ilikeRows.length > 0) cats = ilikeRows;
        } catch (e) { tried.push({ type: 'ilike', error: String(e) }); }
      }

      if (!cats || cats.length === 0) return res.status(200).json({ success: true, data: [], requestedName: name, catUrl, tried });
    }

    const categoryId = cats[0].id;

    // Get site_ids from site_categories
    const scUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?select=site_id&category_id=eq.${categoryId}`;
    const scRes = await fetch(scUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
    if (!scRes.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await scRes.text() });
    const scRows = await scRes.json();
    const siteIds = scRows.map(r => r.site_id);
    if (!siteIds || siteIds.length === 0) return res.status(200).json({ success: true, data: [] });

    // Quote ids only when necessary (strings/uuids); leave numeric ids unquoted to match Supabase typing
    const inList = siteIds.map(id => {
      const s = String(id);
      return /^[0-9]+$/.test(s) ? s : `"${s}"`;
    }).join(',');
    const sitesUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?id=in.(${inList})&select=*`;
    const sitesRes = await fetch(sitesUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
    if (!sitesRes.ok) return res.status(502).json({ success: false, error: 'Upstream REST error', details: await sitesRes.text() });
    const sites = await sitesRes.json();

    if (!sites || (Array.isArray(sites) && sites.length === 0)) {
      return res.status(200).json({ success: true, data: [], requestedName: name, category: cats[0] || null, siteIds, siteCategories: scRows, siteCategoriesCount: scRows.length, sitesUrl });
    }

    // Enrich sites with categories_array and tags_array (server-side)
    try {
      const siteIdsList = sites.map(s => s.id);
      const rawInList = siteIdsList.map(id => `"${id}"`).join(',');
      const encodedInList = encodeURIComponent(rawInList);

      const scUrl2 = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories?select=*,category:categories(*)&site_id=in.(${encodedInList})`;
      let siteCategories = [];
      let scDebug = {};
      try {
        const scRes2 = await fetch(scUrl2, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
        const scText = await scRes2.text();
        scDebug = { ok: scRes2.ok, status: scRes2.status, statusText: scRes2.statusText, body: scText, url: scUrl2 };
        if (scRes2.ok) {
          try { siteCategories = JSON.parse(scText); } catch (e) { siteCategories = []; scDebug.parseError = String(e); }
        }
      } catch (e) { scDebug = { error: String(e) }; }

      const stUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags?select=*,tag:tags(*)&site_id=in.(${encodedInList})`;
      let siteTags = [];
      let stDebug = {};
      try {
        const stRes2 = await fetch(stUrl, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
        const stText = await stRes2.text();
        stDebug = { ok: stRes2.ok, status: stRes2.status, statusText: stRes2.statusText, body: stText, url: stUrl };
        if (stRes2.ok) {
          try { siteTags = JSON.parse(stText); } catch (e) { siteTags = []; stDebug.parseError = String(e); }
        }
      } catch (e) { stDebug = { error: String(e) }; }

      // Build maps
      const categoriesBySite = new Map();
      (siteCategories || []).forEach(sc => {
        const arr = categoriesBySite.get(sc.site_id) || [];
        if (sc.category) arr.push(sc.category);
        categoriesBySite.set(sc.site_id, arr);
      });
      const tagsBySite = new Map();
      (siteTags || []).forEach(st => {
        const arr = tagsBySite.get(st.site_id) || [];
        if (st.tag) arr.push(st.tag);
        tagsBySite.set(st.site_id, arr);
      });

      const enriched = sites.map(site => {
        const catsFromLinks = categoriesBySite.get(site.id) || [];
        const tagsFromLinks = tagsBySite.get(site.id) || [];
        const rawCats = site.categories_array || site.categories || catsFromLinks;
        const normalizedCats = (Array.isArray(rawCats) ? rawCats : []).map(c => (typeof c === 'string' ? { name: c } : c));
        const rawTags = site.tags_array || site.tags || tagsFromLinks;
        const normalizedTags = (Array.isArray(rawTags) ? rawTags : []).map(t => (typeof t === 'string' ? { name: t } : t));
        return Object.assign({}, site, { categories_array: normalizedCats, tags_array: normalizedTags });
      });

      const siteCategoriesCount = Array.isArray(siteCategories) ? siteCategories.length : 0;
      const siteTagsCount = Array.isArray(siteTags) ? siteTags.length : 0;
      let scBodyCount = null, stBodyCount = null;
      try { if (scDebug && typeof scDebug.body === 'string') scBodyCount = JSON.parse(scDebug.body).length; } catch (e) { scBodyCount = null; }
      try { if (stDebug && typeof stDebug.body === 'string') stBodyCount = JSON.parse(stDebug.body).length; } catch (e) { stBodyCount = null; }
      const countsMatch = (scBodyCount === null || scBodyCount === siteCategoriesCount) && (stBodyCount === null || stBodyCount === siteTagsCount);

      // Include resolved category info so callers can see what the server matched
      return res.status(200).json({ success: true, category: cats[0] || null, requestedName: name, data: enriched, debug: { siteCategoriesCount, siteTagsCount, siteIds: siteIdsList, siteCategories: siteCategories, siteCategoriesDebug: scDebug, siteTagsDebug: stDebug, sitesUrl, sitesCount: Array.isArray(enriched) ? enriched.length : 0, integrity: { siteCategoriesCount, scBodyCount, siteTagsCount, stBodyCount, countsMatch } } });
    } catch (err) {
      console.warn('category -> sites enrichment failed', err);
      return res.status(200).json({ success: true, data: sites });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
}
