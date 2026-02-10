import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal, { ConfirmModal } from '../ui/Modal';
import Pagination from '../ui/Pagination';
import InlineEditableName from '../categories/InlineEditableName';
import { TagIcon, SearchIcon, FilterIcon, EditIcon, TrashIcon, SpinnerIcon, LinkIcon, WarningIcon } from '../ui/Icons';

const ITEMS_PER_PAGE = 50;

export default function TagsList({ onEdit, onDelete }) {
    const { tags, sites, deleteTag, updateTag, loading, searchQuery, multiSelectMode, selectedTags, setSelectedTags, usageFilterTags } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter tags based on search query + usage filter
    const filteredTags = useMemo(() => {
        let list = tags;
        if (searchQuery.trim()) {
            list = list.filter(tag =>
                tag?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        // Use site_count from the API (counts all sites, not just current page)
        if (usageFilterTags === 'used') {
            list = list.filter(tag => (tag.site_count || 0) > 0);
        } else if (usageFilterTags === 'unused') {
            list = list.filter(tag => (tag.site_count || 0) === 0);
        }
        return list;
    }, [tags, searchQuery, usageFilterTags]);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, usageFilterTags]);

    const totalPages = Math.ceil(filteredTags.length / ITEMS_PER_PAGE);
    const paginatedTags = filteredTags.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
        } else if (onDelete) {
            onDelete(tag);
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
                    <TagIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-accent" strokeWidth={1.5} />
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
                        <SearchIcon className="w-7 h-7 text-app-text-secondary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-1">No results found</h3>
                    <p className="text-app-text-secondary text-center max-w-md mb-3">
                        No tags match your search <span className="font-semibold text-app-accent">&quot;{searchQuery}&quot;</span>
                    </p>
                    <p className="text-xs text-app-text-muted">
                        Try a different search term
                    </p>
                </div>
            ) : (
                <>
                    {/* Item count */}
                    {filteredTags.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-app-text-muted">
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredTags.length)} of {filteredTags.length}
                            </span>
                        </div>
                    )}

                    {/* Empty state for filter */}
                    {filteredTags.length === 0 && usageFilterTags !== 'all' && (
                        <div className="flex flex-col items-center justify-center py-12 px-4 animate-fadeIn">
                            <div className="w-14 h-14 rounded-xl bg-app-bg-light border-2 border-dashed border-app-border flex items-center justify-center mb-3">
                                <FilterIcon className="w-7 h-7 text-app-text-secondary" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-lg font-semibold text-app-text-primary mb-1">No {usageFilterTags} tags</h3>
                            <p className="text-app-text-secondary text-center text-sm">
                                {usageFilterTags === 'used' ? 'None of your tags are assigned to sites yet.' : 'All tags are currently in use.'}
                            </p>
                        </div>
                    )}

                    {/* Tags Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {paginatedTags.map((tag, _index) => {
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
                                                        onMouseDown={(e) => {
                                                            // Blur immediately after click to allow Delete key
                                                            setTimeout(() => e.target.blur(), 0);
                                                        }}
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
                                                    />
                                                ) : (
                                                    <h3
                                                        className="font-semibold text-app-text-primary truncate cursor-pointer hover:text-app-accent transition-colors active:bg-app-accent/10 sm:active:bg-transparent"
                                                        onDoubleClick={() => setEditingId(tag.id)}
                                                        onClick={() => {
                                                            // Mobile: open modal; Desktop: requires double-click for inline edit
                                                            if (!multiSelectMode && window.innerWidth < 640) {
                                                                onEdit(tag);
                                                            }
                                                        }}
                                                        title={window.innerWidth < 640 ? "Tap to edit" : "Double-click for inline edit"}
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
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(tag)}
                                                    disabled={deletingId === tag.id}
                                                    className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                                    title="Delete tag"
                                                    aria-label="Delete tag"
                                                >
                                                    {deletingId === tag.id ? (
                                                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <TrashIcon className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Site count */}
                                    <div className="flex items-center gap-1 text-xs text-app-text-muted">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        <span>{siteCount} {siteCount === 1 ? 'site' : 'sites'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </>
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
            <Modal
                isOpen={usageWarning?.type === 'tag'}
                onClose={() => setUsageWarning(null)}
                title="Cannot Delete Tag"
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <WarningIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-app-text-secondary">
                            The tag <strong>&quot;{usageWarning?.name}&quot;</strong> is used on <strong>{usageWarning?.count}</strong> site{usageWarning?.count !== 1 ? 's' : ''}:
                        </p>
                    </div>
                    <div className="bg-app-bg-light rounded-lg p-3 max-h-40 overflow-y-auto border border-app-border">
                        {usageWarning?.sites?.map(site => (
                            <div key={site.id} className="text-sm text-app-text-secondary py-1">
                                • {site.name}
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-app-text-secondary">
                        Remove this tag from all sites first to delete it.
                    </p>
                    <button
                        onClick={() => setUsageWarning(null)}
                        className="w-full px-4 py-2 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </Modal>
        </div>
    );
}
