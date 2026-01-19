import { useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import Input from '../ui/Input';

export default function TagsList({ onEdit }) {
    const { tags, sites, deleteTag, loading, searchQuery, multiSelectMode, selectedTags, setSelectedTags } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);

    // Filter tags based on search query
    const filteredTags = useMemo(() => {
        if (!searchQuery.trim()) return tags;
        return tags.filter(tag =>
            tag.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [tags, searchQuery]);

    const handleSelectTag = (e, tagId) => {
        e.stopPropagation();
        const newSelected = new Set(selectedTags);
        if (newSelected.has(tagId)) {
            newSelected.delete(tagId);
        } else {
            newSelected.add(tagId);
        }
        setSelectedTags(newSelected);
    };

    const handleDeleteClick = (tag) => {
        // Check if tag is used on any site
        const sitesUsingTag = sites.filter(site =>
            site.tags_array?.some(t => t?.id === tag.id)
        );

        if (sitesUsingTag.length > 0) {
            setUsageWarning({
                type: 'tag',
                name: tag.name,
                count: sitesUsingTag.length,
                sites: sitesUsingTag
            });
        } else {
            setTagToDelete(tag);
        }
    };

    const confirmDelete = async () => {
        if (!tagToDelete) return;

        setDeletingId(tagToDelete.id);
        try {
            await deleteTag(tagToDelete.id);
            setTagToDelete(null);
        } catch (err) {
            alert('Failed to delete tag: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="p-3 sm:p-6">
                <div className="mb-6">
                    <div className="h-10 bg-app-bg-light/30 rounded-lg animate-pulse" />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-8 w-24 bg-app-bg-light/20 rounded-full animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (tags.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-app-bg-light flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No tags yet</h3>
                <p className="text-app-text-secondary text-center max-w-md">
                    Create tags to add additional labels and make your sites easier to find.
                </p>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6">

            {/* Empty Search Result */}
            {filteredTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="w-14 h-14 rounded-xl bg-app-bg-light flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-1">No tags found</h3>
                    <p className="text-app-text-secondary text-center max-w-md">
                        No tags match your search. Try adjusting your search term.
                    </p>
                </div>
            ) : (
                /* Tags List */
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    {filteredTags.map(tag => (
                        <div
                            key={tag.id}
                            className={`group flex items-center gap-2 border rounded-full px-4 py-2 transition-colors ${selectedTags.has(tag.id)
                                ? 'bg-[#A0D8FF]/10 border-[#A0D8FF] hover:border-[#A0D8FF]'
                                : 'bg-app-bg-card border-app-border hover:border-app-accent'
                                }`}
                        >
                            {multiSelectMode && (
                                <input
                                    type="checkbox"
                                    checked={selectedTags.has(tag.id)}
                                    onChange={(e) => handleSelectTag(e, tag.id)}
                                    className="w-4 h-4 rounded border-app-border bg-app-bg-card cursor-pointer accent-app-accent"
                                    title="Select tag for bulk actions"
                                />
                            )}
                            <span className="text-app-accent font-medium">#{tag.name}</span>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onEdit(tag)}
                                    className="p-1 text-app-text-secondary hover:text-app-accent rounded transition-colors"
                                    title="Edit"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(tag)}
                                    disabled={deletingId === tag.id}
                                    className="p-1 text-app-text-secondary hover:text-btn-danger rounded transition-colors disabled:opacity-50"
                                    title="Delete"
                                >
                                    {deletingId === tag.id ? (
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!tagToDelete}
                onClose={() => setTagToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Tag"
                message={`Are you sure you want to delete "#${tagToDelete?.name}"? Sites tagged with this will not be deleted.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
            {/* Usage Warning Modal */}
            {usageWarning?.type === 'tag' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-app-bg-primary rounded-lg shadow-lg max-w-md w-full mx-4">
                        <div className="p-6">
                            <h2 className="text-lg font-semibold text-app-text-primary mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Cannot Delete Tag
                            </h2>
                            <p className="text-app-text-secondary mb-4">
                                The tag <strong>"{usageWarning.name}"</strong> is used on <strong>{usageWarning.count}</strong> site{usageWarning.count !== 1 ? 's' : ''}:
                            </p>
                            <div className="bg-app-bg-light rounded p-3 mb-4 max-h-40 overflow-y-auto">
                                {usageWarning.sites?.map(site => (
                                    <div key={site.id} className="text-sm text-app-text-secondary py-1">
                                        • {site.name}
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-app-text-secondary mb-6">
                                Remove this tag from all sites first to delete it.
                            </p>
                            <button
                                onClick={() => setUsageWarning(null)}
                                className="w-full px-4 py-2 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}    </div>
    );
}
