import { useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import InlineEditableName from '../categories/InlineEditableName';

export default function TagsList({ onEdit }) {
    const { tags, sites, deleteTag, updateTag, loading, searchQuery, multiSelectMode, selectedTags, setSelectedTags } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);
    const [checkAnimations, setCheckAnimations] = useState(new Set());
    const [editingId, setEditingId] = useState(null);

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
            // Trigger check animation
            setCheckAnimations(prev => new Set(prev).add(tagId));
            setTimeout(() => {
                setCheckAnimations(prev => {
                    const next = new Set(prev);
                    next.delete(tagId);
                    return next;
                });
            }, 300);
        }
        setSelectedTags(newSelected);
    };

    const handleInlineSave = async (tagId, newName) => {
        try {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return;

            await updateTag(tagId, { name: newName });
            setEditingId(null);
        } catch (err) {
            alert('Failed to update tag: ' + err.message);
            setEditingId(null);
        }
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="bg-app-bg-light border border-app-border rounded-xl p-4 animate-pulse"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-4 h-4 bg-app-bg-card rounded-full" />
                                <div className="flex-1">
                                    <div className="h-4 bg-app-bg-card rounded w-24 mb-2" />
                                    <div className="h-3 bg-app-bg-card rounded w-16" />
                                </div>
                            </div>
                            <div className="h-3 bg-app-bg-card rounded w-20" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (tags.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-4 animate-bounce-slow">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No tags yet</h3>
                <p className="text-app-text-secondary text-center max-w-md mb-6">
                    Create tags to add additional labels and make your sites easier to find.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="text-xs text-app-text-muted bg-app-bg-light px-4 py-2 rounded-lg border border-app-border">
                        💡 Tip: Use tags like #tutorial, #work or #inspiration
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6">
            {/* Empty Search Result */}
            {filteredTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 animate-fadeIn">
                    <div className="w-14 h-14 rounded-xl bg-app-bg-light border-2 border-dashed border-app-border flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-1">No results found</h3>
                    <p className="text-app-text-secondary text-center max-w-md mb-3">
                        No tags match your search <span className="font-semibold text-app-accent">"{searchQuery}"</span>
                    </p>
                    <p className="text-xs text-app-text-muted">
                        Try a different search term
                    </p>
                </div>
            ) : (
                /* Tags Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredTags.map((tag, index) => {
                        // Count sites using this tag
                        const siteCount = sites.filter(site =>
                            site.tags_array?.some(t => t?.id === tag.id)
                        ).length;

                        return (
                            <div
                                key={tag.id}
                                className={`group relative bg-app-bg-light border rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-app-accent/10 animate-fadeIn ${selectedTags.has(tag.id)
                                    ? 'border-[#A0D8FF] bg-[#A0D8FF]/10 hover:border-[#A0D8FF]'
                                    : 'border-app-border hover:border-app-accent/50'
                                    }`}
                            >
                                {/* Tag Content */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {multiSelectMode && (
                                            <div className="relative flex-shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTags.has(tag.id)}
                                                    onChange={(e) => handleSelectTag(e, tag.id)}
                                                    className="peer w-5 h-5 rounded border-2 border-app-border bg-app-bg-secondary cursor-pointer appearance-none checked:bg-app-accent checked:border-app-accent hover:border-app-accent/70 transition-all duration-200 flex-shrink-0"
                                                    title="Select tag for bulk actions"
                                                    aria-label={`Select ${tag.name}`}
                                                />
                                                <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                        <div
                                            className="w-4 h-4 rounded-full flex-shrink-0 transition-transform group-hover:scale-110 group-hover:shadow-md"
                                            style={{ backgroundColor: tag.color || '#5B8DEE', boxShadow: `0 0 8px ${tag.color || '#5B8DEE'}40` }}
                                            title={tag.color}
                                        />
                                        <div className="min-w-0 flex-1">
                                            {editingId === tag.id ? (
                                                <InlineEditableName
                                                    value={tag.name}
                                                    onSave={(newName) => handleInlineSave(tag.id, newName)}
                                                    onCancel={() => setEditingId(null)}
                                                    className=""
                                                />
                                            ) : (
                                                <h3
                                                    className="font-semibold text-app-text-primary truncate cursor-text hover:text-app-accent transition-colors border border-transparent px-1 py-0 leading-tight"
                                                    onDoubleClick={() => setEditingId(tag.id)}
                                                    title="Double-click to edit name"
                                                >
                                                    {tag.name}
                                                </h3>
                                            )}
                                            <p className="text-xs text-app-text-secondary">
                                                {tag.created_at ? new Date(tag.created_at).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                        {/* Actions - visible on mobile, hover on tablet+ */}
                                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button
                                                onClick={() => onEdit(tag)}
                                                className="p-1.5 text-app-text-secondary hover:text-app-accent hover:bg-app-accent/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                                title="Edit tag"
                                                aria-label="Edit tag"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(tag)}
                                                disabled={deletingId === tag.id}
                                                className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                                title="Delete tag"
                                                aria-label="Delete tag"
                                            >
                                                {deletingId === tag.id ? (
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Site count */}
                                <div className="flex items-center gap-1 text-xs text-app-text-muted">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <span>{siteCount} {siteCount === 1 ? 'site' : 'sites'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div >
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
            {
                usageWarning?.type === 'tag' && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                        <div className="bg-app-bg-primary rounded-lg shadow-2xl max-w-md w-full mx-4 animate-slideUp border border-app-border">
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
                )
            }    </div >
    );
}
