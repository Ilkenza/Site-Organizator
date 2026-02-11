import { useState, useEffect, useCallback } from 'react';
import { ClockIcon, ExternalLinkIcon, RefreshIcon, GlobeIcon, TrashIcon, EyeOffIcon } from '../ui/Icons';
import { useDashboard } from '../../context/DashboardContext';
import { fetchAPI } from '../../lib/supabase';

const getFaviconUrl = (url) => {
    try {
        const u = new URL(url);
        if (u.hostname === 'localhost' || !u.hostname.includes('.')) return null;
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch { return null; }
};

export default function RediscoverSection() {
    const { deleteSite, showToast } = useDashboard();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalForgotten, setTotalForgotten] = useState(0);
    const [shuffling, setShuffling] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [imgErrors, setImgErrors] = useState({});
    const [removing, setRemoving] = useState(null); // siteId being animated out

    const removeFromList = (siteId) => {
        setRemoving(siteId);
        setTimeout(() => {
            setSites(prev => prev.filter(s => s.id !== siteId));
            setRemoving(null);
        }, 300);
    };

    const fetchForgotten = useCallback(async () => {
        try {
            const data = await fetchAPI('/rediscover?limit=5');
            if (data?.success) {
                setSites(data.sites || []);
                setTotalForgotten(data.total || 0);
            }
        } catch { /* silent */ }
        setLoading(false);
        setShuffling(false);
    }, []);

    useEffect(() => { fetchForgotten(); }, [fetchForgotten]);

    const handleShuffle = () => {
        setShuffling(true);
        fetchForgotten();
    };

    // Visit — open site + track click + remove from list
    const handleVisit = async (site) => {
        window.open(site.url, '_blank');
        removeFromList(site.id);
        try {
            await fetchAPI('/rediscover', {
                method: 'POST',
                body: JSON.stringify({ siteId: site.id }),
            });
        } catch { /* silent */ }
    };

    // Delete — permanently remove bookmark
    const handleDelete = async (site) => {
        removeFromList(site.id);
        try {
            await deleteSite(site.id);
            showToast(`Deleted "${site.name || 'Untitled'}"`, 'success');
        } catch {
            showToast('Failed to delete site', 'error');
            // Re-fetch to restore
            fetchForgotten();
        }
    };

    // Dismiss — keep bookmark but hide from Rediscover (resets the timer)
    const handleDismiss = async (site) => {
        removeFromList(site.id);
        try {
            await fetchAPI('/rediscover', {
                method: 'POST',
                body: JSON.stringify({ siteId: site.id }),
            });
        } catch { /* silent */ }
    };

    // Don't render if loading or no forgotten sites
    if (loading) return null;
    if (sites.length === 0) return null;

    return (
        <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 mb-1">
            <div className="bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/20 rounded-xl overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-500/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-app-text-primary">Rediscover</span>
                        <span className="text-xs text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                            {totalForgotten} forgotten
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); handleShuffle(); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleShuffle(); } }}
                            className="p-1 rounded-md hover:bg-app-bg-secondary transition-colors"
                            title="Show different bookmarks"
                        >
                            <RefreshIcon className={`w-3.5 h-3.5 text-app-text-secondary ${shuffling ? 'animate-spin' : ''}`} />
                        </span>
                        <svg
                            className={`w-4 h-4 text-app-text-secondary transition-transform ${collapsed ? '' : 'rotate-180'}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                {/* Subtitle */}
                {!collapsed && (
                    <p className="px-4 pb-2 -mt-1 text-xs text-app-text-secondary">
                        You haven&apos;t visited these in a while. Keep, revisit, or clean up.
                    </p>
                )}

                {/* Sites list */}
                {!collapsed && (
                    <div className="border-t border-amber-500/10 divide-y divide-app-border/30">
                        {sites.map((site) => (
                            <div
                                key={site.id}
                                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-app-bg-light/30 transition-all duration-300 group/item ${removing === site.id ? 'opacity-0 -translate-x-4 h-0 py-0 overflow-hidden' : 'opacity-100'}`}
                            >
                                {/* Favicon */}
                                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-app-bg-card flex items-center justify-center overflow-hidden">
                                    {site.url && !imgErrors[site.id] ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={getFaviconUrl(site.url)}
                                            alt=""
                                            width={20}
                                            height={20}
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                            className="w-5 h-5"
                                            onError={() => setImgErrors(prev => ({ ...prev, [site.id]: true }))}
                                        />
                                    ) : (
                                        <GlobeIcon className="w-4 h-4 text-app-accent/70" />
                                    )}
                                </div>

                                {/* Name + time */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-app-text-primary truncate">{site.name || 'Untitled'}</p>
                                    <p className="text-xs text-app-text-secondary">
                                        Saved {site.days_since_saved} days ago
                                        {site.days_since_clicked !== null && ` · visited ${site.days_since_clicked}d ago`}
                                    </p>
                                </div>

                                {/* Action buttons */}
                                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 sm:opacity-100 transition-opacity">
                                    {/* Visit */}
                                    <button
                                        onClick={() => handleVisit(site)}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-app-accent bg-app-accent/10 rounded-lg hover:bg-app-accent/20 transition-colors"
                                        title="Visit site"
                                    >
                                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Visit</span>
                                    </button>

                                    {/* Dismiss — hide from Rediscover, keep bookmark */}
                                    <button
                                        onClick={() => handleDismiss(site)}
                                        className="p-1.5 text-app-text-secondary hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                                        title="Not now — remind me later"
                                    >
                                        <EyeOffIcon className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDelete(site)}
                                        className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                        title="Delete bookmark"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
