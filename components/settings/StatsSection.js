import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../context/AuthContext';

export default function StatsSection({ user, activeTab, showToast }) {
    const [stats, setStats] = useState({ sites: 0, categories: 0, tags: 0 });
    const [loadingStats, setLoadingStats] = useState(false);
    const [checkingLinks, setCheckingLinks] = useState(false);
    const [linkCheckResult, setLinkCheckResult] = useState(null);
    const [linkCheckError, setLinkCheckError] = useState(null);

    // Ignored/broken link handling (persisted in localStorage per user)
    const [ignoredLinks, setIgnoredLinks] = useState(new Set());
    const [showIgnored, setShowIgnored] = useState(false);

    const getIgnoreKey = useCallback(() => `link_ignored_${user?.id || 'anon'}`, [user?.id]);

    const loadIgnored = useCallback(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(getIgnoreKey()) : null;
            const arr = raw ? JSON.parse(raw) : [];
            setIgnoredLinks(new Set(Array.isArray(arr) ? arr : []));
        } catch (e) {
            setIgnoredLinks(new Set());
        }
    }, [getIgnoreKey]);

    const saveIgnored = (set) => {
        try {
            if (typeof window !== 'undefined') localStorage.setItem(getIgnoreKey(), JSON.stringify(Array.from(set)));
        } catch (e) { /* ignore */ }
    };

    const toggleIgnore = (id) => {
        if (!id) return;
        setIgnoredLinks(prev => {
            const ns = new Set(prev);
            if (ns.has(id)) ns.delete(id); else ns.add(id);
            saveIgnored(ns);
            return ns;
        });
    };

    // Reload ignored when opening settings or when user changes
    useEffect(() => {
        if (activeTab === 'settings') loadIgnored();
    }, [activeTab, loadIgnored]);

    // Fetch statistics for Settings panel
    const fetchStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const r = await fetch('/api/stats');
            if (!r.ok) throw new Error(await r.text());
            const json = await r.json();
            setStats(json.stats || { sites: 0, categories: 0, tags: 0 });
        } catch (err) {
            console.warn('Failed to fetch stats:', err);
            showToast && showToast('Failed to load stats', 'error');
        } finally {
            setLoadingStats(false);
        }
    }, [showToast]);

    // Compute displayed broken links based on ignored state
    const displayedBroken = linkCheckResult?.broken
        ? (showIgnored
            ? linkCheckResult.broken
            : linkCheckResult.broken.filter(b => !ignoredLinks.has(b.id)))
        : [];

    // Run broken-link health check for user's sites
    const runLinkCheck = async () => {
        setCheckingLinks(true);
        setLinkCheckResult(null);
        setLinkCheckError(null);
        try {
            const sess = await supabase.auth.getSession();
            const token = sess?.data?.session?.access_token;
            const r = await fetch('/api/links/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }
            });

            // Read text first to avoid unexpected end of JSON errors
            const text = await r.text();
            let json = null;
            if (text && text.trim()) {
                try { json = JSON.parse(text); } catch (e) { json = null; }
            }

            if (!r.ok) {
                const errMsg = json?.error || text || `HTTP ${r.status}`;
                console.error('Link check failed upstream:', r.status, errMsg);
                setLinkCheckError(errMsg);
                showToast && showToast(`Link check failed: ${errMsg}`, 'error');
            } else if (!json || !json.success) {
                const errMsg = json?.error || 'Invalid response from link check';
                setLinkCheckError(errMsg);
                showToast && showToast(`Link check failed: ${errMsg}`, 'error');
            } else {
                setLinkCheckResult(json);
                showToast && showToast(`Link check complete — ${json.brokenCount} broken`, json.brokenCount ? 'warning' : 'success');
            }
        } catch (err) {
            console.error('Link check client error:', err);
            setLinkCheckError(err.message);
            showToast && showToast(`Link check failed: ${err.message}`, 'error');
        } finally {
            setCheckingLinks(false);
        }
    };

    // Auto-refresh stats when opening settings
    useEffect(() => {
        if (activeTab === 'settings') fetchStats();
    }, [activeTab, fetchStats]);

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <svg className="w-5 h-5 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Statistics
                </h2>
                <button
                    onClick={async (e) => { e.preventDefault(); await fetchStats(); }}
                    title="Refresh statistics"
                    className="p-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors"
                >
                    {loadingStats ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 12h3m0 0a7 7 0 101.94-4.94L8 12" /></svg>
                    )}
                </button>
            </div>
            <p className="text-sm text-app-text-secondary mb-4">Overview of your content and link health.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-app-bg-secondary rounded-lg border border-app-border text-center">
                    <div className="text-xs text-app-text-secondary">Sites</div>
                    <div className="text-2xl font-semibold text-app-text-primary">{loadingStats ? '…' : stats.sites}</div>
                </div>
                <div className="p-3 bg-app-bg-secondary rounded-lg border border-app-border text-center">
                    <div className="text-xs text-app-text-secondary">Categories</div>
                    <div className="text-2xl font-semibold text-app-text-primary">{loadingStats ? '…' : stats.categories}</div>
                </div>
                <div className="p-3 bg-app-bg-secondary rounded-lg border border-app-border text-center">
                    <div className="text-xs text-app-text-secondary">Tags</div>
                    <div className="text-2xl font-semibold text-app-text-primary">{loadingStats ? '…' : stats.tags}</div>
                </div>
            </div>

            <div className="border-t border-app-border pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                    <h3 className="text-sm font-semibold text-app-text-primary flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Health Check
                    </h3>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-app-accent" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} />
                        <span className="text-xs text-app-text-secondary">Show ignored links</span>
                    </label>
                </div>
                <div className="space-y-3">
                    <button
                        onClick={async () => await runLinkCheck()}
                        disabled={checkingLinks}
                        className="w-full px-4 py-2.5 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] hover:bg-[#2A5A8A] hover:text-[#8DD0FF] rounded-lg disabled:opacity-50 transition-all font-medium flex items-center justify-center gap-2"
                    >
                        {checkingLinks ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                                        <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite" />
                                    </circle>
                                </svg>
                                Checking...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Check Links
                            </>
                        )}
                    </button>

                    {linkCheckResult && (
                        <div className="text-sm text-app-text-secondary bg-app-bg-secondary rounded-lg p-3 border border-app-border">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">
                                    {linkCheckResult.total} checked · <span className={linkCheckResult.brokenCount > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>{linkCheckResult.brokenCount} broken</span>
                                </span>
                            </div>
                            {typeof displayedBroken !== 'undefined' && (
                                <div className="text-xs text-app-text-tertiary ml-6">
                                    Showing {displayedBroken.length}{showIgnored ? ' (including ignored)' : ''}
                                </div>
                            )}
                        </div>
                    )}

                    {linkCheckError && (
                        <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Error: {String(linkCheckError)}</span>
                        </div>
                    )}
                </div>
            </div>

            {displayedBroken && displayedBroken.length > 0 && (
                <div className="mt-3 bg-app-bg-light border border-app-border rounded-lg p-3 max-h-52 overflow-auto space-y-2 ">
                    {displayedBroken.slice(0, 200).map(b => (
                        <div key={b.id || b.url} className={`flex items-center justify-between py-1  flex-col gap-3
                        ${ignoredLinks.has(b.id) ? 'opacity-60' : ''}`}>
                            <div className="text-sm">
                                <div className="font-medium text-app-text-primary">{b.name}</div>
                                <div className="text-xs text-app-text-tertiary">{b.url} — {b.status} {ignoredLinks.has(b.id) && <span className="ml-2 text-yellow-400">Ignored</span>}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a href={b.url} target="_blank" rel="noreferrer" className="text-app-accent hover:underline text-sm">Open</a>
                                <button onClick={() => toggleIgnore(b.id)} className={`text-sm px-2 py-1 rounded-md ${ignoredLinks.has(b.id) ? 'bg-app-bg-secondary text-app-text-secondary' : 'bg-app-bg-card text-app-text-primary hover:bg-app-bg-light'}`}>
                                    {ignoredLinks.has(b.id) ? 'Unignore' : 'Ignore'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
