import { useState } from 'react';
import { fetchAPI } from '../../lib/supabase';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import { TrashIcon, WarningIcon } from '../ui/Icons';

const RESET_OPTIONS = [
    {
        type: 'sites',
        label: 'Delete All Sites',
        description: 'Remove all saved sites and their category/tag associations',
        color: 'red',
    },
    {
        type: 'categories',
        label: 'Delete All Categories',
        description: 'Remove all categories (sites will become uncategorized)',
        color: 'orange',
    },
    {
        type: 'tags',
        label: 'Delete All Tags',
        description: 'Remove all tags from your account',
        color: 'amber',
    },
    {
        type: 'all',
        label: 'Reset Everything',
        description: 'Delete all sites, categories and tags — start fresh',
        color: 'red',
    },
];

const COLOR_MAP = {
    red: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        hoverBg: 'hover:bg-red-500/20',
        iconBg: 'bg-red-500/20',
    },
    orange: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        hoverBg: 'hover:bg-orange-500/20',
        iconBg: 'bg-orange-500/20',
    },
    amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        hoverBg: 'hover:bg-amber-500/20',
        iconBg: 'bg-amber-500/20',
    },
};

export default function DangerZoneSection({ onDeleteComplete }) {
    const {
        stats, totalSitesCount,
        fetchData, showToast,
    } = useDashboard();

    const [confirmType, setConfirmType] = useState(null);

    const activeOption = RESET_OPTIONS.find(o => o.type === confirmType);

    // ── DB-first delete, then refresh UI ────────────────────────────────

    const handleConfirmDelete = async () => {
        if (!confirmType) return;

        // Quick check: anything to delete?
        const hasData = (confirmType === 'sites' || confirmType === 'all') ? (stats?.sites || totalSitesCount) > 0 :
            (confirmType === 'categories') ? (stats?.categories) > 0 :
                (confirmType === 'tags') ? (stats?.tags) > 0 : false;

        if (!hasData) {
            showToast('Nothing to delete', 'info');
            setConfirmType(null);
            return;
        }

        const deleteType = confirmType;
        setConfirmType(null);

        // Delete from DB first (single fast call)
        try {
            const res = await fetchAPI('/reset', {
                method: 'POST',
                body: JSON.stringify({ type: deleteType }),
            });
            if (!res?.success) throw new Error(res?.error || 'Reset failed');

            // Refresh UI from server
            await fetchData();

            // Use server-returned counts (true totals)
            const counts = res.counts || {
                sites: res.deleted?.sites?.length || 0,
                categories: res.deleted?.categories?.length || 0,
                tags: res.deleted?.tags?.length || 0,
            };

            // Notify parent to show persistent undo toast
            onDeleteComplete?.({ type: deleteType, restoreData: res.deleted, counts });
        } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
        }
    };

    return (
        <>
            <div className="bg-app-bg-light border border-red-500/20 rounded-lg p-6 mt-6">
                <h2 className="text-lg font-semibold text-red-400 mb-1 flex items-center gap-2">
                    <WarningIcon className="w-5 h-5" />
                    Danger Zone
                </h2>
                <p className="text-sm text-app-text-secondary mb-5">
                    These actions permanently delete data. A short undo window is available after each action.
                </p>

                <div className="space-y-3">
                    {RESET_OPTIONS.map(option => {
                        const c = COLOR_MAP[option.color];
                        return (
                            <div
                                key={option.type}
                                className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${c.border} ${c.bg}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                                        <TrashIcon className={`w-4 h-4 ${c.text}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium ${c.text}`}>{option.label}</p>
                                        <p className="text-xs text-app-text-muted">{option.description}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfirmType(option.type)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0 ${c.border} ${c.text} ${c.hoverBg} disabled:opacity-50`}
                                >
                                    {option.type === 'all' ? 'Reset' : 'Delete'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Confirm Modal */}
            {confirmType && (
                <ConfirmModal
                    isOpen={!!confirmType}
                    onClose={() => setConfirmType(null)}
                    onConfirm={handleConfirmDelete}
                    title={activeOption?.label || 'Confirm'}
                    message={
                        confirmType === 'all'
                            ? 'This will delete ALL your sites, categories and tags. You will have a brief window to undo this action.'
                            : `This will delete all your ${confirmType}. You will have a brief window to undo this action.`
                    }
                    confirmText="Yes, delete"
                />
            )}

        </>
    );
}
