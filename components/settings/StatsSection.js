import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { BarChartIcon, SpinnerIcon, CheckCircleIcon, CloseIcon, LinkIcon, InfoCircleIcon, ExclamationCircleIcon, CrownIcon } from '../ui/Icons';
import { hasFeature, TIER_FREE } from '../../lib/tierConfig';

export default function StatsSection({ user, activeTab, showToast }) {
    const { user: currentUser } = useAuth();
    const tier = currentUser?.tier || TIER_FREE;
    const canCheckLinks = hasFeature(tier, 'linkHealthCheck');
    const [stats, setStats] = useState({ sites: 0, categories: 0, tags: 0 });
    const [loadingStats, setLoadingStats] = useState(false);

    // Link check state from context — survives tab switches
    const { checkingLinks, linkCheckResult, linkCheckError, linkCheckProgress, runLinkCheck, cancelLinkCheck } = useDashboard();

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
            const sess = await supabase.auth.getSession();
            const token = sess?.data?.session?.access_token;
            const r = await fetch('/api/stats', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
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

    // Wrap context runLinkCheck with toast notifications
    const handleRunLinkCheck = async () => {
        await runLinkCheck();
    };

    // Show toast when link check completes (result or error changes)
    useEffect(() => {
        if (linkCheckResult && activeTab === 'settings') {
            const msg = linkCheckResult.partial
                ? `Link check cancelled — ${linkCheckResult.total} checked, ${linkCheckResult.brokenCount} broken`
                : `Link check complete — ${linkCheckResult.brokenCount} broken`;
            showToast && showToast(
                msg,
                linkCheckResult.brokenCount ? 'warning' : 'success'
            );
        }
    }, [linkCheckResult]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (linkCheckError && activeTab === 'settings') {
            showToast && showToast(`Link check failed: ${linkCheckError}`, 'error');
        }
    }, [linkCheckError]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-refresh stats when opening settings
    useEffect(() => {
        if (activeTab === 'settings') fetchStats();
    }, [activeTab, fetchStats]);

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <BarChartIcon className="w-5 h-5 text-app-accent" />
                    Statistics
                </h2>
                <button
                    onClick={fetchStats}
                    title="Refresh statistics"
                    className="p-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors"
                >
                    {loadingStats ? (
                        <SpinnerIcon className="w-4 h-4 animate-spin" />
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
                        <CheckCircleIcon className="w-4 h-4 text-green-400" />
                        Health Check
                    </h3>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-app-accent" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} />
                        <span className="text-xs text-app-text-secondary">Show ignored links</span>
                    </label>
                </div>
                <div className="space-y-3">
                    {checkingLinks ? (
                        <div className="space-y-2">
                            <button
                                onClick={cancelLinkCheck}
                                className="w-full px-4 py-2.5 bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50 hover:text-red-300 rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                            >
                                <CloseIcon className="w-4 h-4" />
                                Cancel Check
                            </button>
                            {linkCheckProgress && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-app-text-muted">
                                        <span>{linkCheckProgress.checked}/{linkCheckProgress.total} checked</span>
                                        <span>
                                            {linkCheckProgress.etaMs > 0
                                                ? linkCheckProgress.etaMs >= 60000
                                                    ? `~${Math.ceil(linkCheckProgress.etaMs / 60000)} min left`
                                                    : `~${Math.ceil(linkCheckProgress.etaMs / 1000)}s left`
                                                : linkCheckProgress.checked >= linkCheckProgress.total
                                                    ? 'Finishing…'
                                                    : 'Calculating…'}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-app-bg-primary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-app-accent rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${Math.round((linkCheckProgress.checked / linkCheckProgress.total) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        canCheckLinks ? (
                            <button
                                onClick={handleRunLinkCheck}
                                className="w-full px-4 py-2.5 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] hover:bg-[#2A5A8A] hover:text-[#8DD0FF] rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                            >
                                <LinkIcon className="w-4 h-4" />
                                Check Links
                            </button>
                        ) : (
                            <div className="w-full px-4 py-2.5 bg-amber-900/10 border border-amber-700/30 text-amber-400/80 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                                <CrownIcon className="w-4 h-4" gradient />
                                <span className="text-sm">Link Health Check requires Pro</span>
                            </div>
                        )
                    )}

                    {linkCheckResult && (
                        <div className="text-sm text-app-text-secondary bg-app-bg-secondary rounded-lg p-3 border border-app-border">
                            <div className="flex items-center gap-2 mb-1">
                                <InfoCircleIcon className="w-4 h-4 text-blue-400" />
                                <span className="font-medium">
                                    {linkCheckResult.total} checked{linkCheckResult.partial ? ' (partial)' : ''} · <span className={linkCheckResult.brokenCount > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>{linkCheckResult.brokenCount} broken</span>
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
                            <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Error: {String(linkCheckError)}</span>
                        </div>
                    )}
                </div>
            </div>

            {displayedBroken && displayedBroken.length > 0 && (
                <div className="mt-3 bg-app-bg-light border border-app-border rounded-lg p-3 max-h-52 overflow-auto space-y-2 ">
                    {displayedBroken.slice(0, 200).map(b => (
                        <div key={b.id || b.url} className={`flex items-center justify-between py-1 flex-col gap-3 ${ignoredLinks.has(b.id) ? 'opacity-60' : ''}`}>
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
