import { useCallback, useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { SpinnerIcon, GlobeIcon, FolderIcon, TagIcon, TrashIcon, WarningIcon, ChevronDownIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';
import { extractDomain } from '../../lib/urlPatternUtils';

const PAGE_LIMIT = 5000;

// ── URL normalization ───────────────────────────────────────────────────────
// Tracking / analytics params to strip
const JUNK_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'ref', 'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid',
    'mc_cid', 'mc_eid', 'oly_anon_id', 'oly_enc_id',
    '_ga', '_gl', 'hsCtaTracking', 'hsa_acc', 'hsa_cam', 'hsa_grp',
    'hsa_ad', 'hsa_src', 'hsa_net', 'hsa_ver', 'hsa_kw', 'hsa_mt',
    'source', 'feature', 'app',
]);

function normalizeUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        const path = parsed.pathname.replace(/\/+$/, '') || '';
        // Strip junk query params, keep meaningful ones
        const cleaned = new URLSearchParams();
        for (const [k, v] of parsed.searchParams) {
            if (!JUNK_PARAMS.has(k.toLowerCase())) cleaned.set(k, v);
        }
        const qs = cleaned.toString();
        return `${host}${path}${qs ? '?' + qs : ''}`;
    } catch {
        return trimmed.toLowerCase().replace(/\/$/, '');
    }
}

// Extract base domain name without TLD (e.g. "fmoviesz" from "fmoviesz.to")
function extractBaseDomain(url) {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        const parts = host.split('.');
        // Handle subdomains like "ww4.fmovies.co" → "fmovies"
        if (parts.length >= 3 && /^(ww\d+|m|app|web|api|cdn|static)$/.test(parts[0])) parts.shift();
        // Remove TLD(s)
        if (parts.length >= 2) parts.pop(); // remove .com/.to/.sx
        if (parts.length >= 2 && parts[parts.length - 1].length <= 3) parts.pop(); // remove .co from .co.uk
        return parts.join('.') || host;
    } catch { return ''; }
}

// ── Grouping helpers ────────────────────────────────────────────────────────

function buildGroups(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!key) continue;
        const group = map.get(key) || [];
        group.push(item);
        map.set(key, group);
    }
    return Array.from(map.entries())
        .map(([key, sites]) => ({ key, sites }))
        .filter(g => g.sites.length > 1)
        .sort((a, b) => b.sites.length - a.sites.length);
}

// ── Fuzzy name matching ─────────────────────────────────────────────────────

// Levenshtein distance (optimized for short strings)
function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (a.length > b.length) [a, b] = [b, a];
    let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        const curr = [j];
        for (let i = 1; i <= a.length; i++) {
            curr[i] = a[i - 1] === b[j - 1]
                ? prev[i - 1]
                : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
        }
        prev = curr;
    }
    return prev[a.length];
}

function normalizeName(name) {
    return (name || '').trim().toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u024F]/g, '');
}

// Normalize for plural/suffix matching: "wireframes"→"wireframe", "tools"→"tool"
function stemName(name) {
    let s = normalizeName(name);
    if (s.endsWith('ies') && s.length > 5) s = s.slice(0, -3) + 'y';
    else if (s.endsWith('es') && s.length > 4) s = s.slice(0, -2);
    else if (s.endsWith('s') && s.length > 3) s = s.slice(0, -1);
    return s;
}

// Find groups of similar names: exact match, stem match, and fuzzy (Levenshtein ≤ 2)
function findSimilarNames(items, maxDist = 2) {
    const groups = new Map();
    const assigned = new Set();

    // Phase 1: exact normalized match
    const normMap = new Map();
    for (const item of items) {
        const key = normalizeName(item.name);
        if (!key) continue;
        const arr = normMap.get(key) || [];
        arr.push(item);
        normMap.set(key, arr);
    }
    for (const [key, members] of normMap) {
        if (members.length > 1) {
            groups.set(key, { members, matchType: 'exact' });
            members.forEach(m => assigned.add(m.id));
        }
    }

    // Phase 2: stem match (plural/suffix variants)
    const stemMap = new Map();
    for (const item of items) {
        if (assigned.has(item.id)) continue;
        const key = stemName(item.name);
        if (!key) continue;
        const arr = stemMap.get(key) || [];
        arr.push(item);
        stemMap.set(key, arr);
    }
    for (const [key, members] of stemMap) {
        if (members.length > 1) {
            groups.set('stem:' + key, { members, matchType: 'plural' });
            members.forEach(m => assigned.add(m.id));
        }
    }

    // Phase 3: fuzzy Levenshtein on remaining items
    const remaining = items.filter(i => !assigned.has(i.id) && normalizeName(i.name).length > 3);
    const fuzzyGroups = [];
    const fuzzyAssigned = new Set();
    for (let i = 0; i < remaining.length; i++) {
        if (fuzzyAssigned.has(remaining[i].id)) continue;
        const group = [remaining[i]];
        const nameA = normalizeName(remaining[i].name);
        for (let j = i + 1; j < remaining.length; j++) {
            if (fuzzyAssigned.has(remaining[j].id)) continue;
            const nameB = normalizeName(remaining[j].name);
            // Skip if lengths differ too much
            if (Math.abs(nameA.length - nameB.length) > maxDist) continue;
            if (levenshtein(nameA, nameB) <= maxDist) {
                group.push(remaining[j]);
                fuzzyAssigned.add(remaining[j].id);
            }
        }
        if (group.length > 1) {
            fuzzyAssigned.add(remaining[i].id);
            fuzzyGroups.push({ members: group, matchType: 'fuzzy' });
        }
    }
    for (const fg of fuzzyGroups) {
        const key = 'fuzzy:' + normalizeName(fg.members[0].name);
        groups.set(key, fg);
    }

    return Array.from(groups.values())
        .sort((a, b) => b.members.length - a.members.length);
}

// ── UI sub-components ───────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, count, badge, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-app-border rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-app-bg-light/50 transition-colors"
            >
                {icon}
                <span className="font-medium text-app-text-primary flex-1">{title}</span>
                {badge}
                {count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-app-accent/20 text-app-accent font-medium">
                        {count}
                    </span>
                )}
                <ChevronDownIcon className={`w-4 h-4 text-app-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
        </div>
    );
}

function MatchTypeBadge({ type }) {
    const map = {
        exact: { label: 'Exact', color: 'text-red-400 bg-red-500/20' },
        plural: { label: 'Plural', color: 'text-amber-400 bg-amber-500/20' },
        fuzzy: { label: 'Fuzzy', color: 'text-blue-400 bg-blue-500/20' },
    };
    const { label, color } = map[type] || map.fuzzy;
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

function SeverityBadge({ count }) {
    if (count === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Clean</span>;
    if (count <= 5) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">{count} found</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">{count} found</span>;
}

export default function DuplicateDetectionSection() {
    const { categories, tags, deleteSite, deleteCategory, deleteTag } = useDashboard();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null); // { urlGroups, domainGroups, baseDomainGroups, nameGroups }
    const [showDomains, setShowDomains] = useState(true);
    const [showBaseDomains, setShowBaseDomains] = useState(true);
    const [showSiteNames, setShowSiteNames] = useState(true);
    // Similar categories/tags (fuzzy)
    const [similarCategories, setSimilarCategories] = useState([]);
    const [similarTags, setSimilarTags] = useState([]);
    const [catTagScanned, setCatTagScanned] = useState(false);
    // Deleting state
    const [deleting, setDeleting] = useState(new Set());

    const scanDuplicates = useCallback(async () => {
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const allSites = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const res = await fetchAPI(`/sites?fields=minimal&limit=${PAGE_LIMIT}&page=${page}`);
                const rows = Array.isArray(res?.data) ? res.data : [];
                allSites.push(...rows.map(s => ({
                    id: s.id,
                    name: s.name,
                    url: s.url,
                    import_source: s.import_source,
                    is_needed: s.is_needed,
                    created_at: s.created_at,
                })));
                hasMore = rows.length === PAGE_LIMIT;
                page += 1;
            }

            const urlGroups = buildGroups(allSites, site => normalizeUrl(site.url));
            const domainGroups = buildGroups(allSites, site => extractDomain(site.url || ''));
            const baseDomainGroups = buildGroups(allSites, site => extractBaseDomain(site.url || ''));
            const nameGroups = buildGroups(allSites, site => normalizeName(site.name));

            setResults({ urlGroups, domainGroups, baseDomainGroups, nameGroups, totalSites: allSites.length });
        } catch (err) {
            setError(err.message || 'Failed to scan duplicates');
        } finally {
            setLoading(false);
        }
    }, []);

    const scanCategoriesAndTags = useCallback(() => {
        setSimilarCategories(findSimilarNames(categories, 2));
        setSimilarTags(findSimilarNames(tags, 2));
        setCatTagScanned(true);
    }, [categories, tags]);

    const handleDeleteSite = useCallback(async (id, _name) => {
        if (deleting.has(id)) return;
        setDeleting(prev => new Set(prev).add(id));
        try {
            await deleteSite(id);
            // Remove from results
            setResults(prev => {
                if (!prev) return prev;
                const remove = (groups) => groups
                    .map(g => ({ ...g, sites: g.sites.filter(s => s.id !== id) }))
                    .filter(g => g.sites.length > 1);
                return {
                    ...prev,
                    urlGroups: remove(prev.urlGroups),
                    domainGroups: remove(prev.domainGroups),
                    baseDomainGroups: remove(prev.baseDomainGroups),
                    nameGroups: remove(prev.nameGroups),
                };
            });
        } catch { /* toast already shown by deleteSite */ }
        setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, [deleteSite, deleting]);

    const handleDeleteCategory = useCallback(async (id) => {
        if (deleting.has(id)) return;
        setDeleting(prev => new Set(prev).add(id));
        try {
            await deleteCategory(id);
            setSimilarCategories(prev =>
                prev.map(g => ({ ...g, members: g.members.filter(m => m.id !== id) })).filter(g => g.members.length > 1)
            );
        } catch { /* toast already shown */ }
        setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, [deleteCategory, deleting]);

    const handleDeleteTag = useCallback(async (id) => {
        if (deleting.has(id)) return;
        setDeleting(prev => new Set(prev).add(id));
        try {
            await deleteTag(id);
            setSimilarTags(prev =>
                prev.map(g => ({ ...g, members: g.members.filter(m => m.id !== id) })).filter(g => g.members.length > 1)
            );
        } catch { /* toast already shown */ }
        setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, [deleteTag, deleting]);

    // Summary stats
    const summary = useMemo(() => {
        if (!results) return null;
        const urlDupes = results.urlGroups.reduce((n, g) => n + g.sites.length - 1, 0);
        const domainDupes = results.domainGroups.reduce((n, g) => n + g.sites.length, 0);
        const baseDomainDupes = results.baseDomainGroups.reduce((n, g) => n + g.sites.length, 0);
        const nameDupes = results.nameGroups.reduce((n, g) => n + g.sites.length - 1, 0);
        return { urlDupes, domainDupes, baseDomainDupes, nameDupes, total: results.totalSites };
    }, [results]);

    const catTagSummary = useMemo(() => {
        if (!catTagScanned) return null;
        return {
            catGroups: similarCategories.length,
            tagGroups: similarTags.length,
            catItems: similarCategories.reduce((n, g) => n + g.members.length, 0),
            tagItems: similarTags.reduce((n, g) => n + g.members.length, 0),
        };
    }, [catTagScanned, similarCategories, similarTags]);

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <GlobeIcon className="w-5 h-5 text-app-accent" />
                    Duplicate Detection
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={scanCategoriesAndTags}
                        className="px-3 py-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors text-sm"
                    >
                        Scan Names
                    </button>
                    <button
                        onClick={scanDuplicates}
                        disabled={loading}
                        className="px-3 py-2 rounded-lg bg-app-accent/20 hover:bg-app-accent/30 text-app-accent transition-colors text-sm font-medium"
                    >
                        {loading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : 'Scan Sites'}
                    </button>
                </div>
            </div>
            <p className="text-sm text-app-text-secondary mb-4">
                Find duplicate and similar sites, categories, and tags. Click the trash icon to delete duplicates.
            </p>

            {error && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">{error}</div>
            )}

            {/* Summary stats */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-red-400">{summary.urlDupes}</div>
                        <div className="text-[10px] text-app-text-tertiary uppercase">URL Dupes</div>
                    </div>
                    <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-amber-400">{results.baseDomainGroups.length}</div>
                        <div className="text-[10px] text-app-text-tertiary uppercase">Similar Domains</div>
                    </div>
                    <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-blue-400">{summary.nameDupes}</div>
                        <div className="text-[10px] text-app-text-tertiary uppercase">Name Dupes</div>
                    </div>
                    <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-app-text-primary">{summary.total}</div>
                        <div className="text-[10px] text-app-text-tertiary uppercase">Total Sites</div>
                    </div>
                </div>
            )}

            {/* Filter toggles */}
            {results && (
                <div className="flex flex-wrap gap-3 mb-4 text-sm text-app-text-secondary">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="accent-app-accent" checked={showDomains}
                            onChange={(e) => setShowDomains(e.target.checked)} />
                        Domain groups
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="accent-app-accent" checked={showBaseDomains}
                            onChange={(e) => setShowBaseDomains(e.target.checked)} />
                        Similar domains (different TLD)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="accent-app-accent" checked={showSiteNames}
                            onChange={(e) => setShowSiteNames(e.target.checked)} />
                        Same name
                    </label>
                </div>
            )}

            {/* Site duplicate results */}
            {results && (
                <div className="space-y-3 mb-6">
                    {/* Exact URL duplicates */}
                    <CollapsibleSection
                        title="Exact URL Duplicates"
                        icon={<WarningIcon className="w-4 h-4 text-red-400" />}
                        count={results.urlGroups.length}
                        badge={<SeverityBadge count={results.urlGroups.length} />}
                        defaultOpen={results.urlGroups.length > 0}
                    >
                        {results.urlGroups.length === 0 ? (
                            <div className="text-xs text-app-text-tertiary py-1">No exact URL duplicates found.</div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-auto">
                                {results.urlGroups.map(group => (
                                    <SiteGroupCard key={group.key} group={group} label={group.key}
                                        deleting={deleting} onDelete={handleDeleteSite} />
                                ))}
                            </div>
                        )}
                    </CollapsibleSection>

                    {/* Domain duplicates */}
                    {showDomains && (
                        <CollapsibleSection
                            title="Same Domain"
                            icon={<GlobeIcon className="w-4 h-4 text-amber-400" />}
                            count={results.domainGroups.length}
                            badge={<SeverityBadge count={results.domainGroups.length} />}
                        >
                            {results.domainGroups.length === 0 ? (
                                <div className="text-xs text-app-text-tertiary py-1">No domain groups found.</div>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-auto">
                                    {results.domainGroups.map(group => (
                                        <SiteGroupCard key={group.key} group={group} label={group.key}
                                            deleting={deleting} onDelete={handleDeleteSite} />
                                    ))}
                                </div>
                            )}
                        </CollapsibleSection>
                    )}

                    {/* Similar base domain (different TLD) */}
                    {showBaseDomains && (
                        <CollapsibleSection
                            title="Similar Domain (Different TLD)"
                            icon={<GlobeIcon className="w-4 h-4 text-blue-400" />}
                            count={results.baseDomainGroups.length}
                            badge={<SeverityBadge count={results.baseDomainGroups.length} />}
                        >
                            {results.baseDomainGroups.length === 0 ? (
                                <div className="text-xs text-app-text-tertiary py-1">No similar domains found.</div>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-auto">
                                    {results.baseDomainGroups.map(group => (
                                        <SiteGroupCard key={group.key} group={group}
                                            label={`${group.key}.*`}
                                            deleting={deleting} onDelete={handleDeleteSite} />
                                    ))}
                                </div>
                            )}
                        </CollapsibleSection>
                    )}

                    {/* Same name, different URL */}
                    {showSiteNames && (
                        <CollapsibleSection
                            title="Same Name, Different URL"
                            icon={<GlobeIcon className="w-4 h-4 text-purple-400" />}
                            count={results.nameGroups.length}
                            badge={<SeverityBadge count={results.nameGroups.length} />}
                        >
                            {results.nameGroups.length === 0 ? (
                                <div className="text-xs text-app-text-tertiary py-1">No name duplicates found.</div>
                            ) : (
                                <div className="space-y-2 max-h-72 overflow-auto">
                                    {results.nameGroups.map(group => (
                                        <SiteGroupCard key={group.key} group={group}
                                            label={group.sites[0]?.name || group.key}
                                            deleting={deleting} onDelete={handleDeleteSite} />
                                    ))}
                                </div>
                            )}
                        </CollapsibleSection>
                    )}
                </div>
            )}

            {!results && !loading && (
                <div className="text-sm text-app-text-tertiary mb-6">Click &quot;Scan Sites&quot; to find duplicate and similar sites.</div>
            )}

            {/* ── Similar Categories & Tags ── */}
            <div className="border-t border-app-border mt-2 pt-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <FolderIcon className="w-4 h-4 text-app-accent" />
                    <TagIcon className="w-4 h-4 text-app-accent" />
                    <h3 className="text-base font-semibold text-app-text-primary">Similar Categories & Tags</h3>
                </div>
                <p className="text-sm text-app-text-secondary mb-3">
                    Finds exact matches, plural variants (Wireframe/Wireframes), and fuzzy typos (Pallete/Palette). Click trash to delete.
                </p>

                {/* Cat/Tag summary */}
                {catTagSummary && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                            <div className="text-lg font-bold text-amber-400">{catTagSummary.catGroups}</div>
                            <div className="text-[10px] text-app-text-tertiary uppercase">Category Groups</div>
                        </div>
                        <div className="bg-app-bg-dark/50 rounded-lg p-2.5 text-center">
                            <div className="text-lg font-bold text-blue-400">{catTagSummary.tagGroups}</div>
                            <div className="text-[10px] text-app-text-tertiary uppercase">Tag Groups</div>
                        </div>
                    </div>
                )}

                {catTagScanned && similarCategories.length === 0 && similarTags.length === 0 && (
                    <div className="text-sm text-app-text-tertiary">No similar categories or tags found.</div>
                )}

                {!catTagScanned && (
                    <div className="text-sm text-app-text-tertiary">Click &quot;Scan Names&quot; to find similar categories and tags.</div>
                )}

                {/* Similar categories */}
                {similarCategories.length > 0 && (
                    <CollapsibleSection
                        title="Similar Categories"
                        icon={<FolderIcon className="w-4 h-4 text-amber-400" />}
                        count={similarCategories.length}
                        badge={<SeverityBadge count={similarCategories.length} />}
                        defaultOpen
                    >
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {similarCategories.map((group, idx) => (
                                <div key={idx} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MatchTypeBadge type={group.matchType} />
                                        <span className="text-[10px] text-app-text-tertiary">{group.members.length} items</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.members.map(cat => (
                                            <span key={cat.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border group/chip"
                                                style={{
                                                    backgroundColor: (cat.color || '#6b7280') + '20',
                                                    borderColor: (cat.color || '#6b7280') + '40',
                                                    color: cat.color || '#6b7280'
                                                }}>
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                                                {cat.name}
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.id)}
                                                    disabled={deleting.has(cat.id)}
                                                    className="opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
                                                    title={`Delete "${cat.name}"`}
                                                >
                                                    {deleting.has(cat.id) ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : <TrashIcon className="w-3 h-3" />}
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                )}

                {/* Similar tags */}
                {similarTags.length > 0 && (
                    <CollapsibleSection
                        title="Similar Tags"
                        icon={<TagIcon className="w-4 h-4 text-blue-400" />}
                        count={similarTags.length}
                        badge={<SeverityBadge count={similarTags.length} />}
                        defaultOpen
                    >
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {similarTags.map((group, idx) => (
                                <div key={idx} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MatchTypeBadge type={group.matchType} />
                                        <span className="text-[10px] text-app-text-tertiary">{group.members.length} items</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.members.map(tag => (
                                            <span key={tag.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border group/chip"
                                                style={{
                                                    backgroundColor: (tag.color || '#5B8DEE') + '20',
                                                    borderColor: (tag.color || '#5B8DEE') + '40',
                                                    color: tag.color || '#5B8DEE'
                                                }}>
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#5B8DEE' }} />
                                                {tag.name}
                                                <button
                                                    onClick={() => handleDeleteTag(tag.id)}
                                                    disabled={deleting.has(tag.id)}
                                                    className="opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
                                                    title={`Delete "${tag.name}"`}
                                                >
                                                    {deleting.has(tag.id) ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : <TrashIcon className="w-3 h-3" />}
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                )}
            </div>
        </div>
    );
}

// ── Site group card with delete buttons ─────────────────────────────────────

function SiteGroupCard({ group, label, deleting, onDelete }) {
    return (
        <div className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
            <div className="text-xs text-app-text-secondary mb-1.5 font-medium truncate">{label} <span className="text-app-text-tertiary">({group.sites.length})</span></div>
            <div className="space-y-1">
                {group.sites.map(site => (
                    <div key={site.id} className="flex items-center gap-2 group/row">
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-app-text-primary truncate">{site.name || '(untitled)'}</div>
                            <div className="text-[10px] text-app-text-tertiary truncate">{site.url}</div>
                        </div>
                        {site.import_source && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-app-bg-light text-app-text-tertiary flex-shrink-0">
                                {site.import_source}
                            </span>
                        )}
                        {site.is_needed && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">needed</span>
                        )}
                        <button
                            onClick={() => onDelete(site.id, site.name)}
                            disabled={deleting.has(site.id)}
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-app-text-tertiary flex-shrink-0"
                            title={`Delete "${site.name}"`}
                        >
                            {deleting.has(site.id) ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
