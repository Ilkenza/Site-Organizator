import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import Pagination from '../ui/Pagination';
import InlineEditableName from './InlineEditableName';
import { FolderIcon, FilterIcon, EditIcon, TrashIcon, SpinnerIcon, LinkIcon, WarningIcon, CheckCircleFilledIcon, BanIcon } from '../ui/Icons';

const ITEMS_PER_PAGE = 50;

export default function CategoriesList({ onEdit, onDelete }) {
    const {
        categories,
        sites,
        deleteCategory,
        updateCategory,
        loading,
        searchQuery,
        multiSelectMode,
        selectedCategories,
        setSelectedCategories,
        usageFilterCategories,
        neededFilterCategories,
    } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredCategories = useMemo(() => {
        let list = categories;
        if (searchQuery.trim()) {
            list = list.filter(cat =>
                cat?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        // Use site_count from the API (counts all sites, not just current page)
        if (usageFilterCategories === 'used') {
            list = list.filter(cat => (cat.site_count || 0) > 0);
        } else if (usageFilterCategories === 'unused') {
            list = list.filter(cat => (cat.site_count || 0) === 0);
        }
        if (neededFilterCategories === 'needed') {
            list = list.filter(cat => cat.is_needed === true);
        } else if (neededFilterCategories === 'not_needed') {
            list = list.filter(cat => cat.is_needed !== true);
        }
        return list;
    }, [categories, searchQuery, usageFilterCategories, neededFilterCategories]);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, usageFilterCategories, neededFilterCategories]);

    const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
    const paginatedCategories = filteredCategories.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleSelectCategory = (e, categoryId) => {
        e.stopPropagation();
        const newSelected = new Set(selectedCategories);
        if (newSelected.has(categoryId)) {
            newSelected.delete(categoryId);
        } else {
            newSelected.add(categoryId);
        }
        setSelectedCategories(newSelected);
    };

    const handleInlineSave = async (categoryId, newName) => {
        try {
            const category = categories.find(c => c.id === categoryId);
            if (!category) {
                return;
            }

            await updateCategory(categoryId, { name: newName, color: category.color });
            setEditingId(null);
        } catch (err) {
            alert('Failed to update category: ' + err.message);
            setEditingId(null);
        }
    };

    const handleDeleteClick = (category) => {
        // Check if category is used on any site
        const sitesUsingCategory = sites.filter(site =>
            site.categories_array?.some(c => c?.id === category.id)
        );

        if (sitesUsingCategory.length > 0) {
            setUsageWarning({
                type: 'category',
                name: category.name,
                count: sitesUsingCategory.length,
                sites: sitesUsingCategory
            });
        } else if (onDelete) {
            onDelete(category);
        } else {
            setCategoryToDelete(category);
        }
    };

    const confirmDelete = async () => {
        if (!categoryToDelete) return;

        setDeletingId(categoryToDelete.id);
        try {
            await deleteCategory(categoryToDelete.id);
            setCategoryToDelete(null);
        } catch (err) {
            alert('Failed to delete category: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="p-3 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="bg-app-bg-light border border-app-border rounded-lg p-4 animate-pulse"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-4 h-4 bg-app-bg-card rounded-full" />
                                <div className="flex-1">
                                    <div className="h-4 bg-app-bg-card rounded w-32 mb-2" />
                                    <div className="h-3 bg-app-bg-card rounded w-20" />
                                </div>
                            </div>
                            <div className="h-3 bg-app-bg-card rounded w-24" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (filteredCategories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-4 animate-bounce-slow">
                    <FolderIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-accent" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No categories yet</h3>
                <p className="text-app-text-secondary text-center mb-6">Create your first category to organize your sites.</p>
                <div className="text-xs text-app-text-muted bg-app-bg-light px-4 py-2 rounded-lg border border-app-border">
                    💡 Tip: Use categories like Work, Personal, Education
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6">

            {/* Item count */}
            {filteredCategories.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-app-text-muted">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCategories.length)} of {filteredCategories.length}
                    </span>
                </div>
            )}

            {/* Empty state for filter */}
            {filteredCategories.length === 0 && usageFilterCategories !== 'all' && (
                <div className="flex flex-col items-center justify-center py-12 px-4 animate-fadeIn">
                    <div className="w-14 h-14 rounded-xl bg-app-bg-light border-2 border-dashed border-app-border flex items-center justify-center mb-3">
                        <FilterIcon className="w-7 h-7 text-app-text-secondary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-1">No {usageFilterCategories} categories</h3>
                    <p className="text-app-text-secondary text-center text-sm">
                        {usageFilterCategories === 'used' ? 'None of your categories are assigned to sites yet.' : 'All categories are currently in use.'}
                    </p>
                </div>
            )}

            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {paginatedCategories.map((category) => {
                    const siteCount = sites.filter(site =>
                        site.categories_array?.some(c => c?.id === category.id)
                    ).length;

                    return (
                        <div
                            key={category.id}
                            className={`group bg-app-bg-light border rounded-lg p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-app-accent/10 animate-fadeIn ${selectedCategories.has(category.id)
                                ? 'border-[#A0D8FF] bg-[#A0D8FF]/10 hover:border-[#A0D8FF]'
                                : 'border-app-border hover:border-app-accent/50'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {multiSelectMode && (
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedCategories.has(category.id)}
                                                onChange={(e) => handleSelectCategory(e, category.id)}
                                                onMouseDown={(e) => {
                                                    // Blur immediately after click to allow Delete key
                                                    setTimeout(() => e.target.blur(), 0);
                                                }}
                                                className="peer w-5 h-5 rounded border-2 border-app-border bg-app-bg-secondary cursor-pointer appearance-none checked:bg-app-accent checked:border-app-accent hover:border-app-accent/70 transition-all duration-200 flex-shrink-0"
                                                title="Select category for bulk actions"
                                                aria-label={`Select ${category.name}`}
                                            />
                                            <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0 transition-transform group-hover:scale-110 group-hover:shadow-md"
                                        style={{ backgroundColor: category.color || '#6CBBFB', boxShadow: `0 0 8px ${category.color || '#6CBBFB'}40` }}
                                        title={category.color}
                                    />
                                    <div className="min-w-0 flex-1">
                                        {editingId === category.id ? (
                                            <InlineEditableName
                                                value={category.name}
                                                onSave={(newName) => handleInlineSave(category.id, newName)}
                                                onCancel={() => setEditingId(null)}
                                            />
                                        ) : (
                                            <h3
                                                className="font-semibold text-app-text-primary truncate cursor-pointer hover:text-app-accent transition-colors active:bg-app-accent/10 sm:active:bg-transparent"
                                                onDoubleClick={() => setEditingId(category.id)}
                                                onClick={() => {
                                                    // Mobile: open modal; Desktop: requires double-click for inline edit
                                                    if (!multiSelectMode && window.innerWidth < 640) {
                                                        onEdit(category);
                                                    }
                                                }}
                                                title={window.innerWidth < 640 ? "Tap to edit" : "Double-click for inline edit"}
                                            >
                                                {category.name}
                                            </h3>
                                        )}
                                        <p className="text-xs text-app-text-secondary">
                                            {category.created_at ? new Date(category.created_at).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${category.is_needed
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                    : 'bg-app-bg-secondary text-app-text-muted border-app-border'
                                    }`}
                                    title={category.is_needed ? 'Needed' : 'Not needed'}
                                >
                                    {category.is_needed ? (
                                        <CheckCircleFilledIcon className="w-3 h-3" />
                                    ) : (
                                        <BanIcon className="w-3 h-3" />
                                    )}
                                    {category.is_needed ? 'Needed' : 'Not needed'}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => onEdit(category)}
                                        disabled={deletingId === category.id}
                                        className="p-1.5 text-app-text-secondary hover:text-app-accent hover:bg-app-accent/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                        title="Edit category"
                                        aria-label="Edit category"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(category)}
                                        disabled={deletingId === category.id}
                                        className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                        title="Delete category"
                                        aria-label="Delete category"
                                    >
                                        {deletingId === category.id ? (
                                            <SpinnerIcon className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <TrashIcon className="w-4 h-4" />
                                        )}
                                    </button>
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

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Category"
                message={`Are you sure you want to delete "${categoryToDelete?.name}"? Sites in this category will not be deleted.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Usage Warning Modal */}
            {usageWarning?.type === 'category' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-app-bg-primary rounded-lg shadow-lg max-w-md w-full mx-4">
                        <div className="p-6">
                            <h2 className="text-lg font-semibold text-app-text-primary mb-4 flex items-center gap-2">
                                <WarningIcon className="w-5 h-5 text-amber-400" />
                                Cannot Delete Category
                            </h2>
                            <p className="text-app-text-secondary mb-4">
                                The category <strong>&quot;{usageWarning.name}&quot;</strong> is used on <strong>{usageWarning.count}</strong> site{usageWarning.count !== 1 ? 's' : ''}:
                            </p>
                            <div className="bg-app-bg-light rounded p-3 mb-4 max-h-40 overflow-y-auto">
                                {usageWarning.sites?.map(site => (
                                    <div key={site.id} className="text-sm text-app-text-secondary py-1">
                                        • {site.name}
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-app-text-secondary mb-6">
                                Remove this category from all sites first to delete it.
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
            )}
        </div>
    );
}

