/** Export sites in JSON, CSV or HTML format */

import { createClient } from '@supabase/supabase-js';
import { HTTP, sendError, methodGuard, extractTokenFromReq, decodeJwt } from './helpers/api-utils';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = URL && KEY ? createClient(URL, KEY) : null;

const PAGE = 1000, BATCH = 100;

async function fetchAll(queryFn) {
    const all = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await queryFn(from, from + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...data);
        if (data.length < PAGE) break;
    }
    return all;
}

async function batchIn(table, select, col, ids) {
    if (!ids?.length) return [];
    const out = [];
    for (let i = 0; i < ids.length; i += BATCH) {
        const rows = await fetchAll((f, t) => supabase.from(table).select(select).in(col, ids.slice(i, i + BATCH)).range(f, t));
        out.push(...rows);
    }
    return out;
}

function enrichSites(sites, cats, tags, sc, st) {
    const catMap = new Map(cats.map(c => [c.id, c]));
    const tagMap = new Map(tags.map(t => [t.id, t]));
    return sites.map(s => ({
        ...s,
        categories_array: sc.filter(r => r.site_id === s.id).map(r => catMap.get(r.category_id)).filter(Boolean),
        tags_array: st.filter(r => r.site_id === s.id).map(r => tagMap.get(r.tag_id)).filter(Boolean),
    }));
}

const esc = v => (v || '').replace(/"/g, '""');
const escH = v => (v || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const names = arr => (arr || []).map(x => x?.name || '').join('; ');

function toCSV(sites) {
    const hdr = 'Name,URL,Category,Tags,Description,Pricing,Use Case,Favorite,Pinned,Needed';
    const rows = sites.map(s => `"${esc(s.name)}","${esc(s.url)}","${esc(names(s.categories_array))}","${esc(names(s.tags_array))}","${esc(s.description)}","${esc(s.pricing || '')}","${esc(s.use_case || '')}","${s.is_favorite ? 'Yes' : 'No'}","${s.is_pinned ? 'Yes' : 'No'}","${s.is_needed === true ? 'Yes' : s.is_needed === false ? 'No' : ''}"`);
    return [hdr, ...rows].join('\n');
}

function toHTML(sites) {
    const rows = sites.length ? sites.map(s => `<tr><td>${escH(s.name)}</td><td><a href="${s.url}">${escH(s.url)}</a></td><td>${names(s.categories_array)}</td><td>${names(s.tags_array)}</td><td>${escH(s.description)}</td><td>${escH(s.pricing || '')}</td><td>${escH(s.use_case || '')}</td><td>${s.is_favorite ? '⭐' : ''}</td><td>${s.is_pinned ? '📌' : ''}</td><td>${s.is_needed === true ? '✅' : s.is_needed === false ? '❌' : ''}</td></tr>`).join('') : '<tr><td colspan="10">No sites</td></tr>';
    return `<!DOCTYPE html><html><head><title>Sites Export</title><style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#4CAF50;color:#fff}tr:nth-child(even){background:#f2f2f2}a{color:#0066cc}</style></head><body><h1>Sites Export</h1><p>Exported on: ${new Date().toLocaleString()}</p><table><thead><tr><th>Name</th><th>URL</th><th>Category</th><th>Tags</th><th>Description</th><th>Pricing</th><th>Use Case</th><th>Favorite</th><th>Pinned</th><th>Needed</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'GET')) return;
    if (!supabase) return sendError(res, HTTP.INTERNAL_ERROR, 'Supabase not configured');

    const token = extractTokenFromReq(req);
    if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    const jwt = decodeJwt(token);
    const userId = jwt?.sub;
    if (!userId) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');

    try {
        const fmt = (req.query.format || 'json').toLowerCase();
        // Parse include param: which data to export (default: all)
        const includeRaw = (req.query.include || 'sites,categories,tags').toLowerCase().split(',').map(s => s.trim());
        const includeSites = includeRaw.includes('sites');
        const includeCategories = includeRaw.includes('categories');
        const includeTags = includeRaw.includes('tags');

        let sites = [], cats = [], tags = [], sc = [], st = [];

        if (includeSites) {
            sites = await fetchAll((f, t) => supabase.from('sites').select('*').eq('user_id', userId).range(f, t));
            const ids = sites.map(s => s.id);

            if (includeCategories) {
                sc = await batchIn('site_categories', 'site_id,category_id', 'site_id', ids);
                const cids = [...new Set(sc.map(r => r.category_id).filter(Boolean))];
                cats = cids.length ? await batchIn('categories', '*', 'id', cids) : [];
            }
            if (includeTags) {
                st = await batchIn('site_tags', 'site_id,tag_id', 'site_id', ids);
                const tids = [...new Set(st.map(r => r.tag_id).filter(Boolean))];
                tags = tids.length ? await batchIn('tags', '*', 'id', tids) : [];
            }
        } else {
            // No sites — fetch categories/tags directly if requested
            if (includeCategories) {
                cats = await fetchAll((f, t) => supabase.from('categories').select('*').eq('user_id', userId).range(f, t));
            }
            if (includeTags) {
                tags = await fetchAll((f, t) => supabase.from('tags').select('*').eq('user_id', userId).range(f, t));
            }
        }

        let enriched = includeSites ? enrichSites(sites, cats, tags, sc, st) : [];
        // Strip category/tag arrays from sites if those options are unchecked
        if (includeSites && (!includeCategories || !includeTags)) {
            enriched = enriched.map(s => {
                const copy = { ...s };
                if (!includeCategories) delete copy.categories_array;
                if (!includeTags) delete copy.tags_array;
                return copy;
            });
        }
        const ts = new Date().toISOString().split('T')[0];
        const prefix = [includeSites && 'sites', includeCategories && 'categories', includeTags && 'tags'].filter(Boolean).join('-');

        if (fmt === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${prefix}-export-${ts}.csv"`); return res.end(toCSV(enriched)); }
        if (fmt === 'html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${prefix}-export-${ts}.html"`); return res.end(toHTML(enriched)); }

        // JSON: build response based on what was requested
        const jsonResult = { version: '1.0', exportedAt: new Date().toISOString() };
        if (includeSites) jsonResult.sites = enriched;
        if (includeCategories) jsonResult.categories = cats;
        if (includeTags) jsonResult.tags = tags;
        return res.json(jsonResult);
    } catch (err) {
        console.error('Export error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, 'Export failed', { message: err.message });
    }
}
