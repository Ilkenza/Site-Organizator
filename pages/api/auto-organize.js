/** Auto-organize uncategorized sites using local patterns only */

import {
    HTTP,
    configGuard,
    extractTokenFromReq,
    decodeJwt,
    buildHeaders,
    restUrl,
    sendError,
    sendOk,
    methodGuard,
    batchInsert,
    serviceHeaders,
    resolveTier,
} from './helpers/api-utils';
import { hasFeature } from '../../lib/tierConfig';
import { extractDomain, matchesPattern, matchToExisting } from '../../lib/urlPatternUtils';

function h(cfg, token, opts) { return buildHeaders(cfg.anonKey, token, opts); }

async function fetchUncategorized(cfg, token) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
        const sel = encodeURIComponent('id,name,url,site_categories!left(category_id)');
        const url = `${restUrl(cfg, 'sites')}?select=${sel}&site_categories=is.null&order=created_at.desc&limit=1000&offset=${offset}`;
        const r = await fetch(url, { headers: h(cfg, token) });
        if (!r.ok) break;
        const data = await r.json();
        all.push(...data.map(s => ({ id: s.id, name: s.name || '', url: s.url || '' })));
        if (data.length < 1000) break;
    }
    return all;
}

async function fetchUntagged(cfg, token) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
        const sel = encodeURIComponent('id,name,url,site_tags!left(tag_id)');
        const url = `${restUrl(cfg, 'sites')}?select=${sel}&site_tags=is.null&order=created_at.desc&limit=1000&offset=${offset}`;
        const r = await fetch(url, { headers: h(cfg, token) });
        if (!r.ok) break;
        const data = await r.json();
        all.push(...data.map(s => ({ id: s.id, name: s.name || '', url: s.url || '' })));
        if (data.length < 1000) break;
    }
    return all;
}

async function fetchUserCatsAndTags(cfg, token) {
    const [catsRes, tagsRes] = await Promise.all([
        fetch(`${restUrl(cfg, 'categories')}?select=id,name,color&order=name.asc&limit=500`, { headers: h(cfg, token) }),
        fetch(`${restUrl(cfg, 'tags')}?select=id,name,color&order=name.asc&limit=1000`, { headers: h(cfg, token) }),
    ]);
    const cats = catsRes.ok ? await catsRes.json() : [];
    const tags = tagsRes.ok ? await tagsRes.json() : [];
    return { categories: cats, tags };
}

function matchNamesByDomain(domain, entities) {
    const matches = new Set();
    const lowerDomain = (domain || '').toLowerCase();
    if (!lowerDomain) return [];

    for (const ent of entities) {
        const raw = (ent?.name || '').trim();
        if (!raw || raw.length <= 2) continue;
        const name = raw.toLowerCase();
        const words = name.split(/\s+/).filter(w => w.length > 2);
        const patterns = words.length > 1 ? [name, ...words] : [name];
        for (const p of patterns) {
            if (matchesPattern(lowerDomain, p)) {
                matches.add(raw);
                break;
            }
        }
    }

    return Array.from(matches);
}

function extractPathText(url) {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return `${parsed.pathname || ''} ${parsed.search || ''}`.toLowerCase();
    } catch {
        return '';
    }
}

function matchNamesByText(text, entities) {
    const matches = new Set();
    const lowerText = (text || '').toLowerCase();
    if (!lowerText) return [];

    for (const ent of entities) {
        const raw = (ent?.name || '').trim();
        if (!raw || raw.length <= 2) continue;
        const name = raw.toLowerCase();
        const words = name.split(/\s+/).filter(w => w.length > 2);
        const patterns = words.length > 1 ? [name, ...words] : [name];
        for (const p of patterns) {
            if (matchesPattern(lowerText, p)) {
                matches.add(raw);
                break;
            }
        }
    }

    return Array.from(matches);
}

function localMatch(sites, categories, tags) {
    const results = [];
    for (const site of sites) {
        const domain = extractDomain(site.url || '').toLowerCase();
        const pathText = extractPathText(site.url || '');
        const matchedCatNames = matchNamesByDomain(domain, categories);
        const matchedTagNames = matchNamesByText(pathText, tags);
        const categoryIds = matchToExisting(matchedCatNames, categories);
        const tagIds = matchToExisting(matchedTagNames, tags);

        if (categoryIds.length > 0 || tagIds.length > 0) {
            results.push({
                siteId: site.id,
                siteName: site.name,
                siteUrl: site.url,
                categoryIds,
                categoryNames: matchedCatNames,
                tagIds,
                tagNames: matchedTagNames,
                categorySource: 'domain',
                tagSource: 'path',
                source: 'pattern',
            });
        }
    }
    return results;
}

async function applyAssignments(cfg, assignments) {
    const prefer = 'return=representation,resolution=ignore-duplicates';
    const svcHeaders = serviceHeaders(cfg, { contentType: true, prefer });

    const catRows = [];
    const tagRows = [];
    for (const a of assignments) {
        for (const catId of (a.categoryIds || [])) {
            catRows.push({ site_id: a.siteId, category_id: catId });
        }
        for (const tagId of (a.tagIds || [])) {
            tagRows.push({ site_id: a.siteId, tag_id: tagId });
        }
    }

    const catInsert = await batchInsert(cfg, 'site_categories', catRows, svcHeaders);
    const tagInsert = await batchInsert(cfg, 'site_tags', tagRows, svcHeaders);

    return {
        applied: (catInsert.inserted || 0) + (tagInsert.inserted || 0),
        errors: [...(catInsert.errors || []), ...(tagInsert.errors || [])],
    };
}

export default async function handler(req, res) {
    const cfg = configGuard(res); if (!cfg) return;
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    const token = extractTokenFromReq(req);
    if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'Not authenticated');
    const jwt = decodeJwt(token);
    if (!jwt?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
    const { tier } = resolveTier(jwt);
    if (!hasFeature(tier, 'autoOrganize')) {
        return sendError(res, HTTP.FORBIDDEN, 'Pro plan required for auto-organize');
    }

    const { categories, tags } = await fetchUserCatsAndTags(cfg, token);

    if (req.method === 'GET') {
        const previewLimit = Math.min(parseInt(req.query.preview_limit, 10) || 200, 500);
        const [uncategorized, untagged] = await Promise.all([
            fetchUncategorized(cfg, token),
            fetchUntagged(cfg, token),
        ]);

        const localResults = localMatch(uncategorized, categories, tags);

        return sendOk(res, {
            uncategorizedCount: uncategorized.length,
            untaggedCount: untagged.length,
            matchCount: localResults.length,
            categoriesCount: categories.length,
            tagsCount: tags.length,
            preview: localResults.slice(0, previewLimit),
        });
    }

    const [uncategorized, _untagged] = await Promise.all([
        fetchUncategorized(cfg, token),
        fetchUntagged(cfg, token),
    ]);

    const localResults = localMatch(uncategorized, categories, tags);
    const bodyAssignments = Array.isArray(req.body?.assignments) ? req.body.assignments : null;
    const allAssignments = bodyAssignments || localResults.map(r => ({
        siteId: r.siteId,
        categoryIds: r.categoryIds || [],
        tagIds: r.tagIds || [],
    }));

    if (allAssignments.length === 0) {
        return sendOk(res, { applied: 0, total: 0 });
    }

    const { applied, errors } = await applyAssignments(cfg, allAssignments);

    if (errors.length > 0) {
        return sendError(res, HTTP.BAD_GATEWAY, 'Failed to apply some assignments', { applied, errors });
    }

    return sendOk(res, { applied, total: allAssignments.length });
}
