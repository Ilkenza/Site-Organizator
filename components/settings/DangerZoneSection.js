import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchAPI } from '../../lib/supabase';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import Modal from '../ui/Modal';
import { TrashIcon, WarningIcon, LogoutIcon } from '../ui/Icons';

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

export default function DangerZoneSection({ onDeleteComplete, signOut }) {
    const {
        stats, totalSitesCount,
        fetchData, showToast,
    } = useDashboard();

    const [confirmType, setConfirmType] = useState(null);

    // Delete account state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteSuccessModal, setDeleteSuccessModal] = useState(false);
    const [deleteErrorModal, setDeleteErrorModal] = useState({ isOpen: false, message: '' });

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

    // Delete account handler
    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            setDeleteErrorModal({ isOpen: true, message: 'Please type DELETE to confirm' });
            return;
        }

        setDeleteLoading(true);
        try {
            const { error } = await supabase.rpc('delete_user');
            if (error) throw error;

            setDeleteModalOpen(false);
            setDeleteSuccessModal(true);
            setTimeout(async () => {
                await signOut();
            }, 2000);
        } catch (err) {
            console.error('Delete account error:', err);
            setDeleteErrorModal({ isOpen: true, message: err.message || 'Failed to delete account' });
            setDeleteLoading(false);
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

                {/* Data section */}
                <div className="mb-5">
                    <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">Data</h3>
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

                {/* Account section */}
                <div>
                    <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-3">Account</h3>
                    <div className="space-y-3">
                        {/* Sign Out */}
                        <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-app-border bg-app-bg-secondary">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-app-bg-light flex items-center justify-center flex-shrink-0">
                                    <LogoutIcon className="w-4 h-4 text-app-text-secondary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-app-text-primary">Sign Out</p>
                                    <p className="text-xs text-app-text-muted">Sign out from this device</p>
                                </div>
                            </div>
                            <button
                                onClick={signOut}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-app-border text-app-text-secondary hover:bg-app-bg-light transition-colors flex-shrink-0"
                            >
                                Sign Out
                            </button>
                        </div>

                        {/* Delete Account */}
                        <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                    <WarningIcon className="w-4 h-4 text-red-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-red-400">Delete Account</p>
                                    <p className="text-xs text-app-text-muted">Permanently delete your account and all data</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDeleteModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirm Delete Data Modal */}
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

            {/* Delete Account Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setDeleteConfirmText('');
                }}
                title="Delete Account"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                        <WarningIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-red-400 font-medium">This action cannot be undone!</h4>
                            <p className="text-sm text-app-text-secondary mt-1">
                                Deleting your account will permanently remove:
                            </p>
                            <ul className="text-sm text-app-text-secondary mt-2 space-y-1 list-disc list-inside">
                                <li>All your saved sites and bookmarks</li>
                                <li>All categories and tags</li>
                                <li>Your profile and settings</li>
                                <li>All account data</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            Type <span className="text-red-400 font-mono">DELETE</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="w-full px-4 py-2 bg-app-bg-tertiary border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setDeleteConfirmText('');
                            }}
                            className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                            className="flex-1 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-400 border border-red-500/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Account Success Modal */}
            <Modal
                isOpen={deleteSuccessModal}
                onClose={() => { }}
                title="Account Deleted"
                showCloseButton={false}
            >
                <div className="text-center py-4">
                    <div className="text-6xl mb-4">✅</div>
                    <p className="text-app-text-primary text-lg mb-2">
                        Your account has been deleted successfully
                    </p>
                    <p className="text-app-text-secondary text-sm">
                        Redirecting to login...
                    </p>
                </div>
            </Modal>

            {/* Delete Account Error Modal */}
            <Modal
                isOpen={deleteErrorModal.isOpen}
                onClose={() => setDeleteErrorModal({ isOpen: false, message: '' })}
                title="Error"
            >
                <div className="text-center py-4">
                    <div className="text-6xl mb-4">❌</div>
                    <p className="text-app-text-primary mb-2">
                        {deleteErrorModal.message}
                    </p>
                    <button
                        onClick={() => setDeleteErrorModal({ isOpen: false, message: '' })}
                        className="mt-4 px-6 py-2 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover transition-colors"
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </>
    );
}
