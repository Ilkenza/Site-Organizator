import { useCallback, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { SpinnerIcon, GlobeIcon, FolderIcon, TagIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';
import { extractDomain } from '../../lib/urlPatternUtils';

const PAGE_LIMIT = 5000;

function normalizeUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const host = parsed.hostname.replace(/^www\./i, '');
        const path = parsed.pathname.replace(/\/$/, '');
        return `${host}${path}`.toLowerCase();
    } catch {
        return trimmed.toLowerCase().replace(/\/$/, '');
    }
}

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

// Find similar names using normalized comparison
function normalizeName(name) {
    return (name || '').trim().toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u024F]/g, '') // strip non-alphanumeric (keep accented chars)
        ;
}

function findSimilarNames(items) {
    const groups = new Map();
    for (const item of items) {
        const key = normalizeName(item.name);
        if (!key) continue;
        const group = groups.get(key) || [];
        group.push(item);
        groups.set(key, group);
    }
    return Array.from(groups.entries())
        .map(([key, members]) => ({ key, members }))
        .filter(g => g.members.length > 1)
        .sort((a, b) => b.members.length - a.members.length);
}

export default function DuplicateDetectionSection() {
    const { categories, tags } = useDashboard();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [urlGroups, setUrlGroups] = useState([]);
    const [domainGroups, setDomainGroups] = useState([]);
    const [showDomains, setShowDomains] = useState(true);
    // Similar categories/tags
    const [similarCategories, setSimilarCategories] = useState([]);
    const [similarTags, setSimilarTags] = useState([]);
    const [catTagScanned, setCatTagScanned] = useState(false);

    const scanDuplicates = useCallback(async () => {
        setLoading(true);
        setError(null);
        setUrlGroups([]);
        setDomainGroups([]);
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
                })));
                hasMore = rows.length === PAGE_LIMIT;
                page += 1;
            }

            const urlDupes = buildGroups(allSites, site => normalizeUrl(site.url));
            const domainDupes = buildGroups(allSites, site => extractDomain(site.url || ''));
            setUrlGroups(urlDupes);
            setDomainGroups(domainDupes);
        } catch (err) {
            setError(err.message || 'Failed to scan duplicates');
        } finally {
            setLoading(false);
        }
    }, []);

    const scanCategoriesAndTags = useCallback(() => {
        setSimilarCategories(findSimilarNames(categories));
        setSimilarTags(findSimilarNames(tags));
        setCatTagScanned(true);
    }, [categories, tags]);

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            {/* --- Site Duplicate Detection --- */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <GlobeIcon className="w-5 h-5 text-app-accent" />
                    Duplicate Detection
                </h2>
                <button
                    onClick={scanDuplicates}
                    className="px-3 py-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors text-sm"
                >
                    {loading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : 'Scan Sites'}
                </button>
            </div>
            <p className="text-sm text-app-text-secondary mb-4">Find sites that appear multiple times by URL or domain.</p>

            {error && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
                    {error}
                </div>
            )}

            <label className="flex items-center gap-2 text-sm text-app-text-secondary mb-3">
                <input
                    type="checkbox"
                    className="accent-app-accent"
                    checked={showDomains}
                    onChange={(e) => setShowDomains(e.target.checked)}
                />
                Include domain duplicates
            </label>

            {!loading && urlGroups.length === 0 && (!showDomains || domainGroups.length === 0) && (
                <div className="text-sm text-app-text-tertiary">No duplicates detected.</div>
            )}

            {urlGroups.length > 0 && (
                <div className="space-y-2 mb-4">
                    <div className="text-xs text-app-text-tertiary uppercase tracking-wide">Exact URL duplicates</div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                        {urlGroups.slice(0, 10).map(group => (
                            <div key={group.key} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                <div className="text-xs text-app-text-secondary mb-1">{group.key} ({group.sites.length})</div>
                                <div className="space-y-1">
                                    {group.sites.map(site => (
                                        <div key={site.id} className="text-xs text-app-text-primary truncate">
                                            {site.name || site.url}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showDomains && domainGroups.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-app-text-tertiary uppercase tracking-wide">Domain duplicates</div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                        {domainGroups.slice(0, 10).map(group => (
                            <div key={group.key} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                <div className="text-xs text-app-text-secondary mb-1">{group.key} ({group.sites.length})</div>
                                <div className="space-y-1">
                                    {group.sites.map(site => (
                                        <div key={site.id} className="text-xs text-app-text-primary truncate">
                                            {site.name || site.url}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Similar Categories & Tags --- */}
            <div className="border-t border-app-border mt-6 pt-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-app-text-primary flex items-center gap-2">
                        <FolderIcon className="w-4 h-4 text-app-accent" />
                        <TagIcon className="w-4 h-4 text-app-accent" />
                        Similar Categories & Tags
                    </h3>
                    <button
                        onClick={scanCategoriesAndTags}
                        className="px-3 py-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors text-sm"
                    >
                        Scan
                    </button>
                </div>
                <p className="text-sm text-app-text-secondary mb-4">
                    Find categories and tags with identical or very similar names (e.g. &quot;React&quot; vs &quot;react&quot;, &quot;Web Dev&quot; vs &quot;webdev&quot;).
                </p>

                {catTagScanned && similarCategories.length === 0 && similarTags.length === 0 && (
                    <div className="text-sm text-app-text-tertiary">No similar categories or tags found.</div>
                )}

                {similarCategories.length > 0 && (
                    <div className="space-y-2 mb-4">
                        <div className="text-xs text-app-text-tertiary uppercase tracking-wide flex items-center gap-1.5">
                            <FolderIcon className="w-3 h-3" />
                            Similar categories ({similarCategories.length} groups)
                        </div>
                        <div className="space-y-2 max-h-48 overflow-auto">
                            {similarCategories.map(group => (
                                <div key={group.key} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.members.map(cat => (
                                            <span key={cat.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                                                style={{
                                                    backgroundColor: (cat.color || '#6b7280') + '20',
                                                    borderColor: (cat.color || '#6b7280') + '40',
                                                    color: cat.color || '#6b7280'
                                                }}>
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                                                {cat.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {similarTags.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs text-app-text-tertiary uppercase tracking-wide flex items-center gap-1.5">
                            <TagIcon className="w-3 h-3" />
                            Similar tags ({similarTags.length} groups)
                        </div>
                        <div className="space-y-2 max-h-48 overflow-auto">
                            {similarTags.map(group => (
                                <div key={group.key} className="bg-app-bg-dark/50 border border-app-border rounded-lg p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.members.map(tag => (
                                            <span key={tag.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                                                style={{
                                                    backgroundColor: (tag.color || '#5B8DEE') + '20',
                                                    borderColor: (tag.color || '#5B8DEE') + '40',
                                                    color: tag.color || '#5B8DEE'
                                                }}>
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#5B8DEE' }} />
                                                {tag.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
