// pages/api/import.js
// Accepts JSON: { rows: [{ name, url, pricing, category, tag, created_at }], options: { createMissing: true } }
// Processes rows in chunks synchronously, returns report

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });


  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const REL_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  // Extract user's JWT token from Authorization header (sent by fetchAPI)
  const authHeader = req.headers.authorization;
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ success: false, error: 'Supabase config missing' });
  if (!userToken) return res.status(401).json({ success: false, error: 'Authentication required for import' });

  const KEY = userToken;

  const payload = req.body || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const userId = payload.userId;
  const options = payload.options || { createMissing: true };
  const chunkSize = payload.chunkSize && Number.isFinite(Number(payload.chunkSize)) ? Math.max(50, Number(payload.chunkSize)) : 200;


  if (!rows.length) return res.status(400).json({ success: false, error: 'No rows provided' });
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

  // helpers
  const normName = s => (s || '').toString().trim();
  const splitNames = v => {
    if (!v && v !== 0) return [];
    return v.toString().split(/[,;|\n]+/).map(x => normName(x)).filter(Boolean);
  }

  // caching lookups inside import
  const catNameToObj = new Map(); // name -> {id,name}
  const tagNameToObj = new Map();

  const report = { created: [], attached: [], skipped: [], errors: [] };

  const fetchJson = async (url, opts) => {
    const r = await fetch(url, opts);
    const text = await r.text();
    try { return { ok: r.ok, status: r.status, body: text, json: r.ok ? JSON.parse(text) : null }; } catch (e) { return { ok: r.ok, status: r.status, body: text, json: null }; }
  }

  // Preload existing categories and tags to reduce roundtrips
  async function preloadCategoriesAndTags() {
    try {
      const catRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id,name&user_id=eq.${userId}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (catRes.ok) {
        const cats = await catRes.json();
        (cats || []).forEach(c => catNameToObj.set((c.name || '').toLowerCase(), c));
      }
    } catch (e) { /* ignore */ }
    try {
      const tagRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=id,name&user_id=eq.${userId}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (tagRes.ok) {
        const tags = await tagRes.json();
        (tags || []).forEach(t => tagNameToObj.set((t.name || '').toLowerCase(), t));
      }
    } catch (e) { /* ignore */ }
  }

  // Create missing categories/tags one by one (keep it simple and resilient)
  async function ensureCategoryByName(name) {
    const key = (name || '').toLowerCase();
    if (catNameToObj.has(key)) {
      return catNameToObj.get(key);
    }
    if (!options.createMissing) {
      return null;
    }
    // try insert
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories`;
      const r = await fetch(url, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ name: name, color: '#6CBBFB', user_id: userId }) });
      const txt = await r.text();
      if (r.ok) {
        const j = JSON.parse(txt);
        if (Array.isArray(j) && j.length > 0) {
          catNameToObj.set(key, j[0]);
          return j[0];
        }
      }
      // if not ok, try to lookup (maybe created concurrently)
      const lookup = await fetchJson(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/categories?select=id,name&name=eq.${encodeURIComponent(name)}&user_id=eq.${userId}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (lookup.ok && Array.isArray(lookup.json) && lookup.json.length > 0) {
        catNameToObj.set(key, lookup.json[0]);
        return lookup.json[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function ensureTagByName(name) {
    const key = (name || '').toLowerCase();
    if (tagNameToObj.has(key)) {
      return tagNameToObj.get(key);
    }
    if (!options.createMissing) {
      return null;
    }
    try {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags`;
      const r = await fetch(url, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ name: name, color: '#D98BAC', user_id: userId }) });
      const txt = await r.text();
      if (r.ok) {
        const j = JSON.parse(txt);
        if (Array.isArray(j) && j.length > 0) {
          tagNameToObj.set(key, j[0]);
          return j[0];
        }
      }
      const lookup = await fetchJson(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tags?select=id,name&name=eq.${encodeURIComponent(name)}&user_id=eq.${userId}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
      if (lookup.ok && Array.isArray(lookup.json) && lookup.json.length > 0) {
        tagNameToObj.set(key, lookup.json[0]);
        return lookup.json[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Check existing sites by URL for a set of urls
  async function lookupSitesByUrls(urls) {
    const uniq = Array.from(new Set(urls.map(u => (u || '').trim()))).filter(Boolean);
    if (uniq.length === 0) return {};
    const inList = uniq.map(u => `"${u}"`).join(',');
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites?select=*&url=in.(${inList})`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
    if (!r.ok) return {};
    const j = await r.json();
    const out = {};
    (j || []).forEach(s => { if (s && s.url) out[(s.url || '').trim()] = s; });
    return out;
  }

  // Insert sites in batch (rows array has normalized fields)
  async function insertSitesBatch(rowsToInsert) {
    if (!rowsToInsert || rowsToInsert.length === 0) return [];
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sites`;
    const r = await fetch(url, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(rowsToInsert) });
    const text = await r.text();
    if (!r.ok) throw new Error(`Insert failed: ${text}`);
    const j = JSON.parse(text);
    return Array.isArray(j) ? j : (j ? [j] : []);
  }

  // Attach relations in batch
  async function attachSiteCategories(rows) {
    if (!rows || rows.length === 0) {
      return;
    }
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_categories`;
    // rows: { site_id, category_id }
    await fetch(url, { method: 'POST', headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
  }
  async function attachSiteTags(rows) {
    if (!rows || rows.length === 0) {
      return;
    }
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_tags`;
    await fetch(url, { method: 'POST', headers: { apikey: REL_KEY, Authorization: `Bearer ${REL_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
  }

  try {
    await preloadCategoriesAndTags();

    // process in chunks
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      // normalize rows
      const normRows = chunk.map((r, idx) => ({
        _origIndex: i + idx,
        name: normName(r.name || r.title || r.Name || ''),
        url: normName(r.url || r.URL || r.link || ''),
        pricing: normName(r.pricing || r.pricing_model || r.pricingModel || '') || null,
        categories: splitNames(r.category || r.categories || r.Category || ''),
        tags: splitNames(r.tag || r.tags || r.Tag || ''),
        created_at: r.created_at || r.createdAt || null
      }));



      // lookup existing sites by URL
      const urls = normRows.map(r => r.url).filter(Boolean);
      const existingSites = await lookupSitesByUrls(urls);

      // prepare lists for creation
      const toCreateSites = [];

      for (const nr of normRows) {
        if (!nr.url) { report.errors.push({ row: nr._origIndex, error: 'Missing URL' }); continue; }
        if (existingSites[nr.url]) {
          report.skipped.push({ row: nr._origIndex, error: 'Site already exists', existing: existingSites[nr.url] });
          continue;
        }

        // ensure categories/tags exist
        const cats = [];
        for (const cname of nr.categories) {
          const c = await ensureCategoryByName(cname);
          if (c) {
            cats.push(c);
          }
        }
        const tags = [];
        for (const tname of nr.tags) {
          const t = await ensureTagByName(tname);
          if (t) {
            tags.push(t);
          }
        }

        toCreateSites.push({ nr, cats, tags });
      }

      // Insert sites in batch
      const siteInserts = toCreateSites.map(x => ({
        name: x.nr.name || '',
        url: x.nr.url,
        pricing: x.nr.pricing || null,
        created_at: x.nr.created_at || null,
        user_id: userId
      }));
      let createdSites = [];
      try {
        createdSites = await insertSitesBatch(siteInserts);
      } catch (err) {
        // fallback: try single inserts to get per-row errors
        for (let j = 0; j < siteInserts.length; j++) {
          const s = siteInserts[j];
          try {
            const created = await insertSitesBatch([s]);
            if (created && created.length > 0) createdSites.push(created[0]);
          } catch (e) {
            const origIndex = toCreateSites[j] && toCreateSites[j].nr && toCreateSites[j].nr._origIndex;
            report.errors.push({ row: origIndex, error: e.message });
          }
        }
      }

      // Attach relations
      const scRows = [];
      const stRows = [];
      for (let k = 0; k < createdSites.length; k++) {
        const site = createdSites[k];
        const ctx = toCreateSites[k];
        if (!site || !site.id) {
          continue;
        }
        // categories
        (ctx.cats || []).forEach(c => scRows.push({ site_id: site.id, category_id: c.id }));
        // tags
        (ctx.tags || []).forEach(t => stRows.push({ site_id: site.id, tag_id: t.id }));
        report.created.push({ row: ctx.nr._origIndex, site });
      }

      try { await attachSiteCategories(scRows); } catch (e) { console.error('attachSiteCategories error:', e); }
      try { await attachSiteTags(stRows); } catch (e) { console.error('attachSiteTags error:', e); }

    }

    return res.status(200).json({ success: true, report });
  } catch (err) {
    console.error('import failed', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
}
