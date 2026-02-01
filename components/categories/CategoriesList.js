import { useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { ConfirmModal } from '../ui/Modal';
import InlineEditableName from './InlineEditableName';

export default function CategoriesList({ onEdit }) {
    const {
        categories,
        sites,
        deleteCategory,
        updateCategory,
        loading,
        sortByCategories: _sortByCategories,
        setSortByCategories: _setSortByCategories,
        sortOrderCategories: _sortOrderCategories,
        setSortOrderCategories: _setSortOrderCategories,
        searchQuery,
        multiSelectMode,
        selectedCategories,
        setSelectedCategories,
    } = useDashboard();
    const [deletingId, setDeletingId] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [usageWarning, setUsageWarning] = useState(null);
    const [_checkAnimations, setCheckAnimations] = useState(new Set());
    const [editingId, setEditingId] = useState(null);

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return categories;
        return categories.filter(cat =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [categories, searchQuery]);

    const handleSelectCategory = (e, categoryId) => {
        e.stopPropagation();
        const newSelected = new Set(selectedCategories);
        if (newSelected.has(categoryId)) {
            newSelected.delete(categoryId);
        } else {
            newSelected.add(categoryId);
            setCheckAnimations(prev => new Set(prev).add(categoryId));
            setTimeout(() => {
                setCheckAnimations(prev => {
                    const next = new Set(prev);
                    next.delete(categoryId);
                    return next;
                });
            }, 300);
        }
        setSelectedCategories(newSelected);
    };

    const handleInlineSave = async (categoryId, newName) => {
        try {
            const category = categories.find(c => c.id === categoryId);
            if (!category) return;

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
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
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

            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredCategories.map((category, _index) => {
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
                                                className=""
                                            />
                                        ) : (
                                            <h3
                                                className="font-semibold text-app-text-primary truncate cursor-text hover:text-app-accent transition-colors border border-transparent px-1 py-0 leading-tight active:bg-app-accent/10 sm:active:bg-transparent"
                                                onDoubleClick={() => setEditingId(category.id)}
                                                onClick={(_e) => {
                                                    // Single click on mobile to edit (if not in multi-select)
                                                    if (!multiSelectMode && window.innerWidth < 640) {
                                                        setEditingId(category.id);
                                                    }
                                                }}
                                                title={window.innerWidth < 640 ? "Tap to edit name" : "Double-click to edit name"}
                                            >
                                                {category.name}
                                            </h3>
                                        )}
                                        <p className="text-xs text-app-text-secondary">
                                            {category.created_at ? new Date(category.created_at).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => onEdit(category)}
                                        disabled={deletingId === category.id}
                                        className="p-1.5 text-app-text-secondary hover:text-app-accent hover:bg-app-accent/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                        title="Edit category"
                                        aria-label="Edit category"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(category)}
                                        disabled={deletingId === category.id}
                                        className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-app-bg-light"
                                        title="Delete category"
                                        aria-label="Delete category"
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
            </div>

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

