import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { ConfirmModal } from '../ui/Modal';

export default function Header({ onAddClick, onMenuClick }) {
    const { user, signOut } = useAuth();
    const {
        activeTab,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        sortByCategories,
        setSortByCategories,
        sortOrderCategories,
        setSortOrderCategories,
        sortByTags,
        setSortByTags,
        sortOrderTags,
        setSortOrderTags,
        sites,
        filteredSites,
        categories,
        tags,
        fetchData,
        setActiveTab,
        multiSelectMode,
        setMultiSelectMode,
        selectedSites,
        setSelectedSites,
        selectedCategories,
        setSelectedCategories,
        selectedTags,
        setSelectedTags,
        deleteSite,
        deleteCategory,
        deleteTag,
        showToast,
    } = useDashboard();

    // User menu state and ref
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    // Bulk delete modal state
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [usageWarning, setUsageWarning] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';

            // Ctrl+A or Cmd+A - Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInput && multiSelectMode) {
                e.preventDefault();
                const allIds = (activeTab === 'sites' || activeTab === 'favorites' ? filteredSites : activeTab === 'categories' ? categories : tags).map(item => item.id);
                if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set(allIds));
                else if (activeTab === 'categories') setSelectedCategories(new Set(allIds));
                else if (activeTab === 'tags') setSelectedTags(new Set(allIds));
            }

            // Ctrl+D or Cmd+D - Deselect All
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInput && multiSelectMode) {
                e.preventDefault();
                if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                else if (activeTab === 'categories') setSelectedCategories(new Set());
                else if (activeTab === 'tags') setSelectedTags(new Set());
            }

            // M - Toggle multi-select mode (if on with selection, deselect and exit)
            if ((e.key === 'm' || e.key === 'M') && !isInput && activeTab !== 'settings') {
                e.preventDefault();
                if (multiSelectMode) {
                    // Exit multi-select mode and clear any selection
                    setMultiSelectMode(false);
                    if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                    else if (activeTab === 'categories') setSelectedCategories(new Set());
                    else if (activeTab === 'tags') setSelectedTags(new Set());
                } else {
                    // Enter multi-select mode
                    setMultiSelectMode(true);
                }
            }

            // ESC - Exit multi-select mode
            if (e.key === 'Escape' && multiSelectMode) {
                setMultiSelectMode(false);
                if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                else if (activeTab === 'categories') setSelectedCategories(new Set());
                else if (activeTab === 'tags') setSelectedTags(new Set());
            }

            // Delete or Backspace - Delete selected items
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && multiSelectMode) {
                const getSelectedCount = () => {
                    switch (activeTab) {
                        case 'sites': return selectedSites.size;
                        case 'favorites': return selectedSites.size;
                        case 'categories': return selectedCategories.size;
                        case 'tags': return selectedTags.size;
                        default: return 0;
                    }
                };
                if (getSelectedCount() > 0) {
                    e.preventDefault();
                    // Trigger delete via custom event (handleBulkDelete is defined later)
                    window.dispatchEvent(new CustomEvent('bulkDeleteTriggered'));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [multiSelectMode, activeTab, setMultiSelectMode, setSelectedSites, setSelectedCategories, setSelectedTags, filteredSites, categories, tags]);

    const getHeaderTitle = () => {
        switch (activeTab) {
            case 'sites': return 'Sites';
            case 'favorites': return 'Favorited Sites';
            case 'categories': return 'Categories';
            case 'tags': return 'Tags';
            case 'settings': return 'Settings';
            default: return activeTab;
        }
    };

    const getAddButtonText = () => {
        switch (activeTab) {
            case 'sites': return 'Add Site';
            case 'favorites': return 'Add Site';
            case 'categories': return 'Add Category';
            case 'tags': return 'Add Tag';
            default: return 'Add';
        }
    };

    // Get selected count for bulk operations
    const getSelectedIds = () => {
        switch (activeTab) {
            case 'sites': return selectedSites;
            case 'favorites': return selectedSites;
            case 'categories': return selectedCategories;
            case 'tags': return selectedTags;
            default: return new Set();
        }
    };

    const handleBulkDelete = () => {
        const selectedIds = getSelectedIds();
        if (selectedIds.size === 0) {
            showToast('No items selected', 'warning');
            return;
        }

        // Check if any selected category/tag is in use by sites
        if (activeTab === 'categories') {
            const inUseItems = [];
            for (const catId of selectedIds) {
                const sitesUsingCat = sites.filter(site =>
                    site.categories_array?.some(c => c?.id === catId)
                );
                if (sitesUsingCat.length > 0) {
                    const cat = categories.find(c => c.id === catId);
                    inUseItems.push({ name: cat?.name, count: sitesUsingCat.length, sites: sitesUsingCat });
                }
            }
            if (inUseItems.length > 0) {
                setUsageWarning({ type: 'categories', items: inUseItems });
                return;
            }
        }

        if (activeTab === 'tags') {
            const inUseItems = [];
            for (const tagId of selectedIds) {
                const sitesUsingTag = sites.filter(site =>
                    site.tags_array?.some(t => t?.id === tagId)
                );
                if (sitesUsingTag.length > 0) {
                    const tag = tags.find(t => t.id === tagId);
                    inUseItems.push({ name: tag?.name, count: sitesUsingTag.length, sites: sitesUsingTag });
                }
            }
            if (inUseItems.length > 0) {
                setUsageWarning({ type: 'tags', items: inUseItems });
                return;
            }
        }

        setBulkDeleteModalOpen(true);
    };

    const confirmBulkDelete = async () => {
        const selectedIds = getSelectedIds();
        const itemName = activeTab.slice(0, -1); // Remove 's' from end

        setBulkDeleting(true);
        try {
            const deleteFunc = activeTab === 'sites' ? deleteSite : activeTab === 'categories' ? deleteCategory : deleteTag;
            let successCount = 0;

            for (const id of selectedIds) {
                try {
                    await deleteFunc(id);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to delete ${itemName}:`, err);
                }
            }

            if (successCount === selectedIds.size) {
                showToast(`✓ Deleted ${successCount} ${itemName}(s) successfully`, 'success');
            } else {
                showToast(`⚠ Deleted ${successCount}/${selectedIds.size} ${itemName}(s)`, 'warning');
            }

            // Clear selection
            if (activeTab === 'sites') setSelectedSites(new Set());
            else if (activeTab === 'categories') setSelectedCategories(new Set());
            else if (activeTab === 'tags') setSelectedTags(new Set());

            setBulkDeleteModalOpen(false);
        } catch (err) {
            showToast(`✗ Failed to delete items: ${err.message}`, 'error');
        } finally {
            setBulkDeleting(false);
        }
    };

    // Listen for bulk delete keyboard shortcut event
    useEffect(() => {
        const handleBulkDeleteEvent = () => {
            handleBulkDelete();
        };
        window.addEventListener('bulkDeleteTriggered', handleBulkDeleteEvent);
        return () => window.removeEventListener('bulkDeleteTriggered', handleBulkDeleteEvent);
    }, [activeTab, selectedSites, selectedCategories, selectedTags, showToast]);

    return (
        <>
            <header className="bg-app-bg-secondary border-b border-app-border px-3 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                    {/* Mobile menu button */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light rounded-lg transition-colors flex-shrink-0"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Title - hidden on mobile */}
                    <div className="hidden md:block flex-shrink-0">
                        <h2 className="text-xl font-semibold text-app-text-primary">
                            {getHeaderTitle()}
                        </h2>
                    </div>

                    {/* Search - hidden on settings tab */}
                    {activeTab !== 'settings' && (
                        <div className="flex-1 min-w-0 max-w-xs sm:max-w-md">
                            <div className="relative">
                                {/* SVG search icon */}
                                <svg
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-text-tertiary"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    placeholder={
                                        activeTab === 'sites'
                                            ? 'Search sites...'
                                            : activeTab === 'categories'
                                                ? 'Search categories...'
                                                : activeTab === 'tags'
                                                    ? 'Search tags...'
                                                    : 'Search...'
                                    }
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary text-sm placeholder-app-text-tertiary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-tertiary hover:text-app-text-primary transition-colors"
                                        title="Clear search"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {/* Refresh button */}
                        {activeTab !== 'settings' && (
                            <button
                                onClick={async () => {
                                    setRefreshing(true);
                                    try {
                                        await fetchData();
                                    } finally {
                                        setRefreshing(false);
                                    }
                                }}
                                disabled={refreshing}
                                className="p-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light border border-transparent disabled:opacity-50"
                                title="Refresh data"
                            >
                                <svg
                                    className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </button>
                        )}

                        {/* Multi-Select Toggle - hidden on settings tab */}
                        {activeTab !== 'settings' && (() => {
                            const getSelectedCount = () => {
                                switch (activeTab) {
                                    case 'sites': return selectedSites.size;
                                    case 'favorites': return selectedSites.size;
                                    case 'categories': return selectedCategories.size;
                                    case 'tags': return selectedTags.size;
                                    default: return 0;
                                }
                            };
                            const selectedCount = getSelectedCount();
                            const hasSelection = multiSelectMode && selectedCount > 0;

                            return (
                                <button
                                    onClick={() => {
                                        if (hasSelection) {
                                            // If items are selected, deselect all
                                            if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                                            else if (activeTab === 'categories') setSelectedCategories(new Set());
                                            else if (activeTab === 'tags') setSelectedTags(new Set());
                                        } else {
                                            // Toggle multi-select mode
                                            setMultiSelectMode(!multiSelectMode);
                                            if (multiSelectMode) {
                                                if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                                                else if (activeTab === 'categories') setSelectedCategories(new Set());
                                                else if (activeTab === 'tags') setSelectedTags(new Set());
                                            }
                                        }
                                    }}
                                    className={`p-2 rounded-lg transition-colors text-sm font-medium ${hasSelection
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                        : multiSelectMode
                                            ? 'bg-app-accent/20 text-app-accent border border-app-accent/50'
                                            : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                    title={hasSelection ? 'Deselect all' : 'Toggle multi-select mode (M)'}
                                >
                                    {hasSelection ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })()}

                        {/* Select All button - shown when multi-select is active and nothing selected */}
                        {activeTab !== 'settings' && multiSelectMode && (() => {
                            const getSelectedCount = () => {
                                switch (activeTab) {
                                    case 'sites': return selectedSites.size;
                                    case 'favorites': return selectedSites.size;
                                    case 'categories': return selectedCategories.size;
                                    case 'tags': return selectedTags.size;
                                    default: return 0;
                                }
                            };
                            if (getSelectedCount() > 0) return null;

                            return (
                                <button
                                    onClick={() => {
                                        const allIds = (activeTab === 'sites' || activeTab === 'favorites' ? filteredSites : activeTab === 'categories' ? categories : tags).map(item => item.id);
                                        if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set(allIds));
                                        else if (activeTab === 'categories') setSelectedCategories(new Set(allIds));
                                        else if (activeTab === 'tags') setSelectedTags(new Set(allIds));
                                    }}
                                    className="p-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light border border-transparent"
                                    title="Select all (Ctrl+A)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                            );
                        })()}

                        {/* Delete Selected button - shown when items are selected */}
                        {activeTab !== 'settings' && multiSelectMode && (() => {
                            const getSelectedCount = () => {
                                switch (activeTab) {
                                    case 'sites': return selectedSites.size;
                                    case 'favorites': return selectedSites.size;
                                    case 'categories': return selectedCategories.size;
                                    case 'tags': return selectedTags.size;
                                    default: return 0;
                                }
                            };
                            const selectedCount = getSelectedCount();

                            if (selectedCount === 0) return null;

                            return (
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium"
                                    title={`Delete ${selectedCount} selected item(s)`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>{selectedCount}</span>
                                </button>
                            );
                        })()}

                        {/* Add button - hidden on settings tab */}
                        {activeTab !== 'settings' && (
                            <Button onClick={onAddClick} variant="primary" size="sm" className="whitespace-nowrap">
                                <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">{getAddButtonText()}</span>
                            </Button>
                        )}

                        {/* User menu */}
                        {user && (
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                                        {user?.avatarUrl ? (
                                            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            user.email?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                </button>

                                {/* Dropdown */}
                                {userMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 sm:w-56 bg-app-bg-light border border-app-border rounded-xl shadow-xl z-50 overflow-hidden">
                                        {/* User info with settings gear */}
                                        <div className="p-3 border-b border-app-border flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-app-text-primary truncate font-semibold">{user?.displayName || 'User'}</p>
                                                <p className="text-xs text-app-text-tertiary truncate">{user?.email}</p>
                                            </div>
                                            <button
                                                onClick={() => { setActiveTab('settings'); setUserMenuOpen(false); }}
                                                className="p-2 text-app-text-tertiary hover:text-app-accent hover:bg-app-bg-secondary rounded-lg transition-colors"
                                                title="Settings"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                        {/* Sign Out */}
                                        <div className="p-2">
                                            <button
                                                onClick={() => { signOut(); setUserMenuOpen(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </header>

            {/* Bulk Delete Confirmation Modal */}
            {/* Usage Warning Modal */}
            {usageWarning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-app-bg-secondary border border-app-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-6 py-4 border-b border-app-border">
                            <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                                <span className="text-amber-400">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </span>
                                Cannot Delete {usageWarning.type === 'categories' ? 'Categories' : 'Tags'}
                            </h2>
                        </div>
                        <div className="p-6">
                            <p className="text-app-text-secondary mb-4">
                                The following {usageWarning.type} are still in use and cannot be deleted:
                            </p>
                            <div className="bg-app-bg-light border border-app-border rounded-lg p-3 mb-4 max-h-48 overflow-y-auto space-y-3">
                                {usageWarning.items.map((item, idx) => (
                                    <div key={idx} className="border-b border-app-border/50 pb-2 last:border-0 last:pb-0">
                                        <div className="font-medium text-app-text-primary flex items-center gap-2">
                                            <span className={usageWarning.type === 'categories' ? 'text-blue-400' : 'text-purple-400'}>
                                                {usageWarning.type === 'categories' ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                )}
                                            </span>
                                            {item.name}
                                            <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded-full">
                                                {item.count} site{item.count !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="ml-6 mt-1 text-sm text-app-text-tertiary">
                                            {item.sites.slice(0, 3).map(site => (
                                                <div key={site.id}>• {site.name}</div>
                                            ))}
                                            {item.sites.length > 3 && (
                                                <div className="text-app-text-muted">...and {item.sites.length - 3} more</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-app-text-tertiary mb-6">
                                Remove these {usageWarning.type} from all sites first, then try deleting again.
                            </p>
                            <button
                                onClick={() => setUsageWarning(null)}
                                className="w-full px-4 py-2.5 bg-app-bg-light hover:bg-app-bg-lighter text-app-text-primary font-medium rounded-lg border border-app-border transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={bulkDeleteModalOpen}
                onClose={() => setBulkDeleteModalOpen(false)}
                onConfirm={confirmBulkDelete}
                title="Delete Selected Items"
                message={`Are you sure you want to delete ${getSelectedIds().size} ${activeTab.slice(0, -1)}(s)? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                loading={bulkDeleting}
            />
        </>
    );
}
