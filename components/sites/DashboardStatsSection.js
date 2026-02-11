import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChartIcon, RefreshIcon, SpinnerIcon, FolderIcon, TagIcon, GlobeIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { hasFeature, TIER_FREE, TIER_LABELS } from '../../lib/tierConfig';

const PRICING_META = {
    fully_free: { label: 'Fully Free', bg: 'bg-pricing-fullyFree', text: 'text-pricing-fullyFreeText' },
    freemium: { label: 'Freemium', bg: 'bg-pricing-freemium', text: 'text-pricing-freemiumText' },
    free_trial: { label: 'Free Trial', bg: 'bg-pricing-freeTrial', text: 'text-pricing-freeTrialText' },
    paid: { label: 'Paid', bg: 'bg-pricing-paid', text: 'text-pricing-paidText' },
    unknown: { label: 'Unknown', bg: 'bg-app-bg-secondary', text: 'text-app-text-tertiary' },
};

export default function DashboardStatsSection() {
    const { user: currentUser } = useAuth();
    const tier = currentUser?.tier || TIER_FREE;
    const canView = hasFeature(tier, 'statsInsights');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadStats = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAPI('/stats');
            setStats(data?.stats || null);
        } catch (err) {
            setError(err.message || 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const pricing = useMemo(() => {
        const list = stats?.pricingDistribution || [];
        return list.map(item => ({
            key: item.key,
            count: item.count || 0,
            label: PRICING_META[item.key]?.label || item.label || item.key,
            bg: PRICING_META[item.key]?.bg || 'bg-app-bg-secondary',
            text: PRICING_META[item.key]?.text || 'text-app-text-tertiary',
        }));
    }, [stats]);

    const topCategories = stats?.topCategories || [];
    const addedThisMonth = stats?.addedThisMonth || 0;
    const addedLastMonth = stats?.addedLastMonth || 0;
    const delta = addedThisMonth - addedLastMonth;
    const deltaLabel = delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta}`;

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-app-text-primary flex items-center gap-2">
                    <BarChartIcon className="w-5 h-5 text-app-accent" />
                    Dashboard Insights
                </h2>
                <button
                    onClick={loadStats}
                    title="Refresh insights"
                    className="p-2 rounded-lg bg-app-bg-secondary hover:bg-app-bg-light text-app-text-secondary transition-colors"
                >
                    {loading ? (
                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshIcon className="w-4 h-4" />
                    )}
                </button>
            </div>
            <p className="text-sm text-app-text-secondary mb-4">Pricing mix, top categories, and growth trends.</p>

            {!canView && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <div className="text-sm text-amber-300 font-semibold">Pro required</div>
                    <div className="text-xs text-amber-300/80 mt-1">
                        Upgrade to {TIER_LABELS[tier] === 'Free' ? 'Pro' : 'Pro Max'} to see dashboard insights.
                    </div>
                </div>
            )}

            {error && canView && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
                    {error}
                </div>
            )}

            {canView && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-app-bg-dark/50 rounded-lg border border-app-border p-3">
                        <div className="text-xs text-app-text-tertiary mb-2 flex items-center gap-2">
                            <TagIcon className="w-3.5 h-3.5" />
                            Pricing Model Distribution
                        </div>
                        <div className="space-y-2">
                            {pricing.length === 0 && !loading && (
                                <div className="text-xs text-app-text-muted">No pricing data yet.</div>
                            )}
                            {pricing.map(item => (
                                <div key={item.key} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${item.bg}`} />
                                        <span className="text-app-text-secondary">{item.label}</span>
                                    </div>
                                    <span className={`${item.text} font-semibold`}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-app-bg-dark/50 rounded-lg border border-app-border p-3">
                        <div className="text-xs text-app-text-tertiary mb-2 flex items-center gap-2">
                            <FolderIcon className="w-3.5 h-3.5" />
                            Top Categories
                        </div>
                        <div className="space-y-2">
                            {topCategories.length === 0 && !loading && (
                                <div className="text-xs text-app-text-muted">No category usage yet.</div>
                            )}
                            {topCategories.map(item => (
                                <div key={item.categoryId} className="flex items-center justify-between text-xs">
                                    <span className="text-app-text-secondary truncate">{item.name}</span>
                                    <span className="text-app-text-primary font-semibold">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-app-bg-dark/50 rounded-lg border border-app-border p-3">
                        <div className="text-xs text-app-text-tertiary mb-2 flex items-center gap-2">
                            <GlobeIcon className="w-3.5 h-3.5" />
                            Sites Added
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-app-text-secondary">This month</span>
                                <span className="text-lg font-semibold text-app-text-primary">{loading ? '…' : addedThisMonth}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-app-text-secondary">Last month</span>
                                <span className="text-sm font-semibold text-app-text-secondary">{loading ? '…' : addedLastMonth}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-app-text-secondary">Delta</span>
                                <span className={`text-sm font-semibold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-app-text-tertiary'}`}>
                                    {loading ? '…' : deltaLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
