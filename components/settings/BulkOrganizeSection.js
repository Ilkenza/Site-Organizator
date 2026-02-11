import { useState, useCallback } from 'react';
import { SparklesIcon, SpinnerIcon, CheckCircleIcon, FolderIcon, TagIcon, GlobeIcon, RefreshIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { hasFeature, TIER_FREE, TIER_LABELS } from '../../lib/tierConfig';

const PHASE = { IDLE: 0, SCANNING: 1, PREVIEW: 2, APPLYING: 3, DONE: 4 };

export default function BulkOrganizeSection({ fetchData, showToast }) {
    const { user: currentUser } = useAuth();
    const tier = currentUser?.tier || TIER_FREE;
    const canAutoOrganize = hasFeature(tier, 'autoOrganize');
    const [phase, setPhase] = useState(PHASE.IDLE);
    const [stats, setStats] = useState(null);
    const [matches, setMatches] = useState([]);
    const [approvedIds, setApprovedIds] = useState(new Set());
    const [error, setError] = useState(null);
    const [applied, setApplied] = useState(0);

    const handleScan = useCallback(async () => {
        setPhase(PHASE.SCANNING);
        setError(null);
        setStats(null);
        setMatches([]);
        setApprovedIds(new Set());
        try {
            const data = await fetchAPI('/auto-organize?preview_limit=200');
            setStats(data);
            const preview = Array.isArray(data.preview) ? data.preview : [];
            setMatches(preview);
            setApprovedIds(new Set(preview.map(r => r.siteId)));
            setPhase(PHASE.PREVIEW);
        } catch (err) {
            setError(err.message);
            setPhase(PHASE.IDLE);
        }
    }, []);

    const handleApply = useCallback(async () => {
        if (approvedIds.size === 0) {
            showToast?.('No approved matches to apply', 'warning');
            return;
        }
        setPhase(PHASE.APPLYING);
        setError(null);
        try {
            const assignments = matches
                .filter(r => approvedIds.has(r.siteId))
                .map(r => ({
                    siteId: r.siteId,
                    categoryIds: r.categoryIds || [],
                    tagIds: r.tagIds || [],
                }));
            const data = await fetchAPI('/auto-organize', {
                method: 'POST',
                body: JSON.stringify({ assignments }),
            });
            setApplied(data.applied || 0);
            setPhase(PHASE.DONE);
            showToast?.(`Organized ${data.applied || 0} assignments`, 'success');
            setTimeout(() => fetchData?.(), 500);
        } catch (err) {
            setError(err.message);
            setPhase(PHASE.PREVIEW);
        }
    }, [approvedIds, fetchData, matches, showToast]);

    const handleReset = () => {
        setPhase(PHASE.IDLE);
        setStats(null);
        setMatches([]);
        setApprovedIds(new Set());
        setError(null);
        setApplied(0);
    };

    const toggleApprove = (siteId) => {
        setApprovedIds(prev => {
            const next = new Set(prev);
            if (next.has(siteId)) next.delete(siteId);
            else next.add(siteId);
            return next;
        });
    };

    const approveAll = () => {
        setApprovedIds(new Set(matches.map(r => r.siteId)));
    };

    const clearApproved = () => {
        setApprovedIds(new Set());
    };

    return (
        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-app-text-primary">Auto-Organize (Patterns)</h2>
            </div>

            <p className="text-sm text-app-text-secondary mb-4">
                Automatically categorize and tag your uncategorized sites using domain-based pattern matching.
            </p>

            {!canAutoOrganize && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <div className="text-sm text-amber-300 font-semibold">Pro required</div>
                    <div className="text-xs text-amber-300/80 mt-1">
                        Upgrade to {TIER_LABELS[tier] === 'Free' ? 'Pro' : 'Pro Max'} to use Auto-Organize.
                    </div>
                </div>
            )}

            {error && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
                    {error}
                </div>
            )}

            {phase === PHASE.IDLE && canAutoOrganize && (
                <button
                    onClick={handleScan}
                    className="px-4 py-2.5 bg-purple-900/30 border border-purple-700/40 text-purple-400 hover:bg-purple-900/50 hover:text-purple-300 rounded-lg transition-all font-medium flex items-center gap-2"
                >
                    <SparklesIcon className="w-4 h-4" />
                    Scan Uncategorized Sites
                </button>
            )}

            {phase === PHASE.SCANNING && canAutoOrganize && (
                <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Scanning your sites...
                </div>
            )}

            {phase === PHASE.PREVIEW && stats && canAutoOrganize && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <StatBox icon={<GlobeIcon className="w-4 h-4 text-blue-400" />} label="Uncategorized" value={stats.uncategorizedCount} />
                        <StatBox icon={<TagIcon className="w-4 h-4 text-green-400" />} label="Untagged" value={stats.untaggedCount} />
                        <StatBox icon={<FolderIcon className="w-4 h-4 text-yellow-400" />} label="Pattern Matches" value={stats.matchCount} />
                    </div>

                    {stats.uncategorizedCount === 0 ? (
                        <div className="text-sm text-green-400 flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4" />
                            All sites are categorized!
                        </div>
                    ) : (
                        <>
                            {matches.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm text-app-text-secondary font-medium">
                                        Review matches ({approvedIds.size}/{stats.matchCount} approved):
                                    </p>
                                    <div className="max-h-64 overflow-auto space-y-1 bg-app-bg-dark/50 rounded-lg p-3">
                                        {matches.map((r) => (
                                            <label key={r.siteId} className="text-xs flex items-center gap-2 text-app-text-secondary cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="accent-app-accent"
                                                    checked={approvedIds.has(r.siteId)}
                                                    onChange={() => toggleApprove(r.siteId)}
                                                />
                                                <span className="truncate flex-1 text-app-text-primary">{r.siteName || r.siteUrl}</span>
                                                {r.categoryNames?.length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-300 rounded text-[10px] shrink-0">
                                                        {r.categoryNames[0]}
                                                    </span>
                                                )}
                                                {r.tagNames?.length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-300 rounded text-[10px] shrink-0">
                                                        +{r.tagNames.length} tags
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                    {stats.matchCount > matches.length && (
                                        <div className="text-xs text-app-text-tertiary">
                                            Showing first {matches.length} matches. Narrow tags/categories to reduce noise.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {matches.length > 0 && (
                                    <button
                                        onClick={handleApply}
                                        disabled={approvedIds.size === 0}
                                        className={`px-4 py-2 border rounded-lg transition-all text-sm font-medium flex items-center gap-2 ${approvedIds.size === 0
                                            ? 'bg-app-bg-secondary border-app-border text-app-text-tertiary cursor-not-allowed'
                                            : 'bg-green-900/30 border-green-700/40 text-green-400 hover:bg-green-900/50 hover:text-green-300'
                                            }`}
                                    >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Apply {approvedIds.size} Approved
                                    </button>
                                )}
                                {matches.length > 0 && (
                                    <button
                                        onClick={approveAll}
                                        className="px-3 py-2 text-app-text-secondary hover:text-app-text-primary rounded-lg transition-all text-sm"
                                    >
                                        Approve all
                                    </button>
                                )}
                                {matches.length > 0 && (
                                    <button
                                        onClick={clearApproved}
                                        className="px-3 py-2 text-app-text-tertiary hover:text-app-text-secondary rounded-lg transition-all text-sm"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-app-text-tertiary hover:text-app-text-secondary rounded-lg transition-all text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {phase === PHASE.APPLYING && canAutoOrganize && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Applying assignments...
                </div>
            )}

            {phase === PHASE.DONE && canAutoOrganize && (
                <div className="space-y-3">
                    <div className="text-sm text-green-400 flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4" />
                        Done! {applied} assignments applied.
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-app-bg-dark border border-app-border text-app-text-secondary hover:text-app-text-primary rounded-lg transition-all text-sm flex items-center gap-2"
                    >
                        <RefreshIcon className="w-4 h-4" />
                        Run Again
                    </button>
                </div>
            )}
        </div>
    );
}

function StatBox({ icon, label, value }) {
    return (
        <div className="bg-app-bg-dark/50 rounded-lg p-3 flex items-center gap-3">
            {icon}
            <div>
                <div className="text-lg font-bold text-app-text-primary">{value}</div>
                <div className="text-xs text-app-text-tertiary">{label}</div>
            </div>
        </div>
    );
}
