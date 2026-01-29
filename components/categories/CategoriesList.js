import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import Pagination from '../ui/Pagination';

const ITEMS_PER_PAGE = 100;

export default function CategoriesList({ onEdit }) {
    const router = useRouter();
    const {
        categories,
        sites,
        deleteCategory,
        loading,
        sortByCategories,
        setSortByCategories,
        sortOrderCategories,
        setSortOrderCategories,
        searchQuery,
        multiSelectMode,
        selectedCategories,
        setSelectedCategories,
    } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);

    // Get current page from URL or default to 1
    const currentPage = parseInt(router.query.page) || 1;

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return categories;
        return categories.filter(cat =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [categories, searchQuery]);

    // Calculate pagination
    const totalItems = filteredCategories.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

    // Reset to page 1 when search filter changes
    useEffect(() => {
        if (currentPage > 1 && searchQuery) {
            router.push({
                pathname: router.pathname,
                query: { ...router.query, page: 1 }
            }, undefined, { shallow: true });
        }
    }, [searchQuery]);

    // Handle page change
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            router.push({
                pathname: router.pathname,
                query: { ...router.query, page: newPage }
            }, undefined, { shallow: true });
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
                <div className="mb-6">
                    <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                        <div className="h-10 bg-app-bg-light/30 rounded-lg animate-pulse flex-1 min-w-[200px]" />
                        <div className="h-10 bg-app-bg-light/30 rounded-lg animate-pulse w-20" />
                    </div>
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-app-bg-light/20 border border-app-border rounded-lg p-4 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 bg-app-bg-light rounded-full" />
                                <div className="h-5 bg-app-bg-light rounded w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (filteredCategories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-app-bg-light flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No categories yet</h3>
                <p className="text-app-text-secondary text-center">Create your first category to organize your sites.</p>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6">

            {/* Results count */}
            {totalItems > 0 && (
                <div className="mb-4 text-sm text-gray-400">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} categories
                </div>
            )}

            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {paginatedCategories.map(category => (
                    <div
                        key={category.id}
                        className={`bg-app-bg-light border rounded-lg p-4 transition-colors ${selectedCategories.has(category.id)
                            ? 'border-[#A0D8FF] bg-[#A0D8FF]/10 hover:border-[#A0D8FF]'
                            : 'border-app-border hover:border-app-accent/50'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {multiSelectMode && (
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.has(category.id)}
                                        onChange={(e) => handleSelectCategory(e, category.id)}
                                        className="w-4 h-4 rounded-full border-2 border-app-accent/50 bg-app-bg-card cursor-pointer accent-app-accent flex-shrink-0"
                                        title="Select category for bulk actions"
                                    />
                                )}
                                <div
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.color || '#6CBBFB' }}
                                    title={category.color}
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-app-text-primary truncate">{category.name}</h3>
                                    <p className="text-xs text-app-text-secondary">
                                        {category.created_at ? new Date(category.created_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => onEdit(category)}
                                    disabled={deletingId === category.id}
                                    className="p-1.5 text-app-text-secondary hover:text-app-accent hover:bg-app-bg-hover rounded-lg transition-colors disabled:opacity-50"
                                    title="Edit"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(category)}
                                    disabled={deletingId === category.id}
                                    className="p-1.5 text-app-text-secondary hover:text-btn-danger hover:bg-app-bg-light rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete"
                                >
                                    {deletingId === category.id ? (
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
                ))}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
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
                                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Cannot Delete Category
                            </h2>
                            <p className="text-app-text-secondary mb-4">
                                The category <strong>"{usageWarning.name}"</strong> is used on <strong>{usageWarning.count}</strong> site{usageWarning.count !== 1 ? 's' : ''}:
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

