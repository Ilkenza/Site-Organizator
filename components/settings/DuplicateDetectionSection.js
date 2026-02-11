import { useCallback, useState } from 'react';
import { SpinnerIcon, GlobeIcon } from '../ui/Icons';
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

export default function DuplicateDetectionSection() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [urlGroups, setUrlGroups] = useState([]);
    const [domainGroups, setDomainGroups] = useState([]);
    const [showDomains, setShowDomains] = useState(true);

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

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <GlobeIcon className="w-5 h-5 text-app-accent" />
                    Duplicate Detection
                </h2>
                <button
                    onClick={scanDuplicates}
                    className="px-3 py-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors text-sm"
                >
                    {loading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : 'Scan'}
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
        </div>
    );
}
