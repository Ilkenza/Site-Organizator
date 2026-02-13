import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { fetchAPI } from '../../lib/supabase';
import { TIER_COLORS, TIER_FREE } from '../../lib/tierConfig';
import Button from '../ui/Button';
import {
    MenuIcon, SearchIcon, RefreshIcon, CloseIcon, ClipboardCheckIcon,
    TrashIcon, DotsVerticalIcon, CheckmarkIcon, PlusIcon, SettingsIcon,
    ShieldCheckIcon, LogoutIcon, WarningIcon, FolderIcon, TagIcon
} from '../ui/Icons';
import { ConfirmModal } from '../ui/Modal';
import UndoToast from '../ui/UndoToast';
import ServerStatus from '../ui/ServerStatus';

// Strip joined/computed fields from site rows for restore
const SITE_STRIP_KEYS = ['categories_array', 'tags_array', 'site_categories', 'site_tags'];
const stripSite = (site) => {
    const row = {};
    for (const [k, v] of Object.entries(site)) {
        if (!SITE_STRIP_KEYS.includes(k)) row[k] = v;
    }
    return row;
};
const stripItem = ({ site_count: _sc, ...rest }) => rest;

/**
 * Build a restore payload from selected items so undo can re-insert them.
 * For sites: saves raw rows + junction rows (site_categories, site_tags).
 * For categories/tags: saves items + any junction rows from the current page's sites.
 */
function buildRestorePayload(type, selectedIds, sitesData, categoriesData, tagsData) {
    const payload = { sites: [], categories: [], tags: [], site_categories: [], site_tags: [] };

    if (type === 'sites') {
        const deleted = sitesData.filter(s => selectedIds.has(s.id));
        payload.sites = deleted.map(stripSite);
        deleted.forEach(s => {
            (s.categories_array || []).forEach(c => {
                if (c?.id) payload.site_categories.push({ site_id: s.id, category_id: c.id });
            });
            (s.tags_array || []).forEach(t => {
                if (t?.id) payload.site_tags.push({ site_id: s.id, tag_id: t.id });
            });
        });
    } else if (type === 'categories') {
        payload.categories = categoriesData.filter(c => selectedIds.has(c.id)).map(stripItem);
        sitesData.forEach(s => {
            (s.categories_array || []).forEach(c => {
                if (c?.id && selectedIds.has(c.id)) {
                    payload.site_categories.push({ site_id: s.id, category_id: c.id });
                }
            });
        });
    } else if (type === 'tags') {
        payload.tags = tagsData.filter(t => selectedIds.has(t.id)).map(stripItem);
        sitesData.forEach(s => {
            (s.tags_array || []).forEach(t => {
                if (t?.id && selectedIds.has(t.id)) {
                    payload.site_tags.push({ site_id: s.id, tag_id: t.id });
                }
            });
        });
    }

    return payload;
}

export default function Header({ onAddClick, onMenuClick }) {
    const { user: authUser, signOut } = useAuth();

    // Fallback: if authUser is null, try to get user from localStorage AND fetch profile data
    const [localUser, setLocalUser] = useState(null);
    useEffect(() => {
        if (!authUser && typeof window !== 'undefined') {
            const fetchLocalUserWithProfile = async () => {
                try {
                    const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                    const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                    const storedTokens = localStorage.getItem(storageKey);
                    if (storedTokens) {
                        const tokens = JSON.parse(storedTokens);
                        if (tokens?.user) {
                            // Immediately set basic user
                            setLocalUser(tokens.user);

                            // Fetch profile data via our API (more reliable than SDK)
                            try {
                                const response = await fetch('/api/profile', {
                                    method: 'GET',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${tokens.access_token}`
                                    }
                                });

                                const result = await response.json();

                                if (result?.success && result?.data) {
                                    const profile = result.data;
                                    setLocalUser({
                                        ...tokens.user,
                                        avatarUrl: profile.avatar_url || null,
                                        displayName: profile.name || null
                                    });
                                } else {
                                    console.warn('[Header] Profile API returned no data:', result?.error);
                                }
                            } catch (err) {
                                console.warn('[Header] Failed to fetch profile via API:', err);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Header] Error in fallback user fetch:', e);
                }
            };
            fetchLocalUserWithProfile();
        } else if (authUser) {
            setLocalUser(null); // Clear fallback when real user is available
        }
    }, [authUser]);

    // Use authUser if available, otherwise fallback to localUser
    const user = authUser || localUser;
    const router = useRouter();

    // Check if current user is an admin
    const isAdmin = useMemo(() => {
        if (!user?.email) return false;
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        return adminEmails.includes(user.email.toLowerCase());
    }, [user?.email]);

    const {
        activeTab,
        searchInput,
        handleSearchInput,
        clearSearch,
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
        showToast,
        isOnline,
        pendingChanges,
        syncing,
        syncOfflineChanges,
    } = useDashboard();

    // User menu state and ref
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    // Mobile search state
    // More options menu for mobile
    const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
    const moreOptionsRef = useRef(null);
    // Search input ref for keyboard shortcut (Ctrl/Cmd+K)
    const searchInputRef = useRef(null);

    // Bulk delete modal state
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    const [pendingBulkDelete, setPendingBulkDelete] = useState(null);
    const didBulkUndoRef = useRef(false);
    const [usageWarning, setUsageWarning] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Computed selected count for bulk operations
    const selectedCount = useMemo(() => {
        switch (activeTab) {
            case 'sites': return selectedSites.size;
            case 'favorites': {
                let count = 0;
                for (const siteId of selectedSites) {
                    const site = sites.find(s => s.id === siteId);
                    if (site && site.is_favorite) count++;
                }
                return count;
            }
            case 'categories': return selectedCategories.size;
            case 'tags': return selectedTags.size;
            default: return 0;
        }
    }, [activeTab, selectedSites, selectedCategories, selectedTags, sites]);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
            if (moreOptionsRef.current && !moreOptionsRef.current.contains(event.target)) {
                setMoreOptionsOpen(false);
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
                if (activeTab === 'sites' || activeTab === 'favorites') {
                    setSelectedSites(new Set(allIds));
                }
                else if (activeTab === 'categories') {
                    setSelectedCategories(new Set(allIds));
                }
                else if (activeTab === 'tags') {
                    setSelectedTags(new Set(allIds));
                }
            }

            // Ctrl+D or Cmd+D - Deselect All
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInput && multiSelectMode) {
                e.preventDefault();
                if (activeTab === 'sites' || activeTab === 'favorites') {
                    setSelectedSites(new Set());
                } else if (activeTab === 'categories') {
                    setSelectedCategories(new Set());
                } else if (activeTab === 'tags') {
                    setSelectedTags(new Set());
                }
            }

            // M - Toggle multi-select mode (if on with selection, deselect and exit)
            if ((e.key === 'm' || e.key === 'M') && !isInput && activeTab !== 'settings') {
                e.preventDefault();
                if (multiSelectMode) {
                    // Exit multi-select mode and clear any selection
                    setMultiSelectMode(false);
                    if (activeTab === 'sites' || activeTab === 'favorites') {
                        setSelectedSites(new Set());
                    } else if (activeTab === 'categories') {
                        setSelectedCategories(new Set());
                    } else if (activeTab === 'tags') {
                        setSelectedTags(new Set());
                    }
                } else {
                    // Enter multi-select mode
                    setMultiSelectMode(true);
                }
            }

            // ESC - Exit multi-select mode (search input has its own onKeyDown handler)
            if (e.key === 'Escape') {
                // Skip if search input is focused (handled by input's onKeyDown)
                if (searchInputRef?.current && document.activeElement === searchInputRef.current) {
                    return;
                }
                // Otherwise, exit multi-select mode
                if (multiSelectMode) {
                    setMultiSelectMode(false);
                    if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                    else if (activeTab === 'categories') setSelectedCategories(new Set());
                    else if (activeTab === 'tags') setSelectedTags(new Set());
                }
            }

            // Ctrl/Cmd+N - Open Add Site modal
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !isInput) {
                e.preventDefault();
                if (typeof onAddClick === 'function') onAddClick();
            }

            // Ctrl/Cmd+K - Focus search input (with fallback)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                // Preferred: use the ref
                if (searchInputRef?.current) {
                    try { searchInputRef.current.focus(); searchInputRef.current.select && searchInputRef.current.select(); return; } catch (err) { /* ignore */ }
                }
                // Fallback: try to query a visible search input in the header
                try {
                    const header = document.querySelector('header');
                    const fallback = header?.querySelector('input[type="text"]');
                    if (fallback) { fallback.focus(); fallback.select && fallback.select(); }
                } catch (err) { /* ignore */ }
            }

            // Delete or Backspace - Delete selected items
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && multiSelectMode) {
                if (selectedCount > 0) {
                    e.preventDefault();
                    // Trigger delete via custom event (handleBulkDelete is defined later)
                    window.dispatchEvent(new CustomEvent('bulkDeleteTriggered'));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [multiSelectMode, activeTab, setMultiSelectMode, setSelectedSites, setSelectedCategories, setSelectedTags, filteredSites, categories, tags, onAddClick, selectedCount]);

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

    const handleBulkDelete = useCallback(() => {
        // Inline getSelectedIds logic to avoid dependency issues
        const selectedIds = (() => {
            switch (activeTab) {
                case 'sites': return selectedSites;
                case 'favorites': return selectedSites;
                case 'categories': return selectedCategories;
                case 'tags': return selectedTags;
                default: return new Set();
            }
        })();

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
    }, [activeTab, selectedSites, selectedCategories, selectedTags, sites, categories, tags, showToast]);

    const confirmBulkDelete = async () => {
        const selectedIds = getSelectedIds();
        const idsArray = Array.from(selectedIds);
        const total = idsArray.length;
        const itemType = (activeTab === 'favorites' ? 'sites' : activeTab);
        didBulkUndoRef.current = false;

        // Build restore payload BEFORE deleting (for undo)
        const restorePayload = buildRestorePayload(itemType, selectedIds, sites, categories, tags);

        // Close modal, clear selection, exit multi-select immediately
        setBulkDeleteModalOpen(false);
        if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
        else if (activeTab === 'categories') setSelectedCategories(new Set());
        else if (activeTab === 'tags') setSelectedTags(new Set());
        setMultiSelectMode(false);

        // Delete from DB in one fast call
        try {
            const res = await fetchAPI('/bulk-delete', {
                method: 'POST',
                body: JSON.stringify({ type: itemType, ids: idsArray }),
            });
            if (!res?.success) throw new Error(res?.error || 'Bulk delete failed');
        } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
            return;
        }

        // Refresh from server — remaining items fill in with correct pagination
        await fetchData();

        // Show undo toast (data is already deleted, undo will restore)
        setPendingBulkDelete({ type: itemType, restorePayload, total });
    };

    const handleBulkUndo = async () => {
        didBulkUndoRef.current = true;
        const pending = pendingBulkDelete;
        setPendingBulkDelete(null);
        if (!pending?.restorePayload) return;

        try {
            const res = await fetchAPI('/restore', {
                method: 'POST',
                body: JSON.stringify(pending.restorePayload),
            });
            if (!res?.success) throw new Error(res?.error || 'Restore failed');
            await fetchData();
            showToast('Restored successfully', 'success');
        } catch (err) {
            showToast(`Undo failed: ${err.message}`, 'error');
        }
    };

    const handleBulkToastClose = () => {
        if (didBulkUndoRef.current) {
            didBulkUndoRef.current = false;
        }
        // Already deleted from DB — nothing more to do
        setPendingBulkDelete(null);
    };

    const cancelBulkDelete = () => {
        setBulkDeleteModalOpen(false);
    };

    // Listen for bulk delete keyboard shortcut event
    useEffect(() => {
        const handleBulkDeleteEvent = () => {
            handleBulkDelete();
        };
        window.addEventListener('bulkDeleteTriggered', handleBulkDeleteEvent);
        return () => window.removeEventListener('bulkDeleteTriggered', handleBulkDeleteEvent);
    }, [handleBulkDelete]);

    return (
        <>
            <header className="bg-app-bg-secondary border-b border-app-border">
                {/* Main Header Row */}
                <div className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                        {/* Mobile menu button */}
                        <button
                            onClick={onMenuClick}
                            data-tour="mobile-menu"
                            className="lg:hidden p-2 text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light rounded-lg transition-colors flex-shrink-0"
                            aria-label="Toggle menu"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>

                        {/* Title */}
                        <div className="flex-shrink-0">
                            <h2 className="text-base sm:text-xl font-semibold text-app-text-primary">
                                {getHeaderTitle()}
                            </h2>
                        </div>

                        {/* Offline / Sync Status */}
                        {!isOnline && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Offline
                            </span>
                        )}
                        {isOnline && pendingChanges > 0 && (
                            <button
                                onClick={syncOfflineChanges}
                                disabled={syncing}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                            >
                                {syncing && <RefreshIcon className="w-3 h-3 animate-spin" />}
                                {syncing ? 'Syncing...' : `${pendingChanges} pending`}
                            </button>
                        )}

                        {/* Desktop Search - hidden on mobile and settings tab */}
                        {activeTab !== 'settings' && (
                            <div className="flex-1 min-w-0 max-w-xs sm:max-w-md hidden md:block" data-tour="search-bar">
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-text-tertiary" />
                                    <input
                                        ref={searchInputRef}
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
                                        value={searchInput}
                                        onChange={(e) => handleSearchInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                clearSearch();
                                                e.target.blur();
                                            }
                                        }}
                                        className="w-full pl-10 pr-4 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary text-sm placeholder-app-text-tertiary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    {searchInput && (
                                        <button
                                            onClick={() => clearSearch()}
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
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                            {/* Refresh button - hidden on mobile when multi-select active */}
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
                                    className="p-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light disabled:opacity-50 hidden sm:block"
                                    title="Refresh data"
                                    aria-label="Refresh"
                                >
                                    <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>
                            )}

                            {/* Multi-Select Toggle - simplified for mobile */}
                            {activeTab !== 'settings' && (() => {
                                const hasSelection = multiSelectMode && selectedCount > 0;

                                return (
                                    <button
                                        data-tour="select-mode"
                                        onClick={() => {
                                            if (hasSelection) {
                                                if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set());
                                                else if (activeTab === 'categories') setSelectedCategories(new Set());
                                                else if (activeTab === 'tags') setSelectedTags(new Set());
                                            } else {
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
                                        aria-label={hasSelection ? 'Deselect all' : 'Toggle multi-select'}
                                    >
                                        {hasSelection ? (
                                            <CloseIcon className="w-4 h-4" />
                                        ) : (
                                            <ClipboardCheckIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Delete Selected - shown when items selected */}
                            {activeTab !== 'settings' && multiSelectMode && (() => {
                                const selectedCount = (() => {
                                    switch (activeTab) {
                                        case 'sites': return selectedSites.size;
                                        case 'favorites': return selectedSites.size;
                                        case 'categories': return selectedCategories.size;
                                        case 'tags': return selectedTags.size;
                                        default: return 0;
                                    }
                                })();

                                if (selectedCount === 0) return null;

                                return (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 px-2 sm:px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium"
                                        title={`Delete ${selectedCount} selected item(s)`}
                                        aria-label={`Delete ${selectedCount} items`}
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span>{selectedCount}</span>
                                    </button>
                                );
                            })()}

                            {/* More Options Menu - mobile only */}
                            {activeTab !== 'settings' && multiSelectMode && (() => {
                                const selectedCount = (() => {
                                    switch (activeTab) {
                                        case 'sites': return selectedSites.size;
                                        case 'favorites': {
                                            let count = 0;
                                            for (const siteId of selectedSites) {
                                                const site = sites.find(s => s.id === siteId);
                                                if (site && site.is_favorite) count++;
                                            }
                                            return count;
                                        }
                                        case 'categories': return selectedCategories.size;
                                        case 'tags': return selectedTags.size;
                                        default: return 0;
                                    }
                                })();

                                if (selectedCount > 0) return null;

                                return (
                                    <div className="relative sm:hidden" ref={moreOptionsRef}>
                                        <button
                                            onClick={() => setMoreOptionsOpen(!moreOptionsOpen)}
                                            className="p-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light"
                                            title="More options"
                                            aria-label="More options"
                                        >
                                            <DotsVerticalIcon className="w-5 h-5" />
                                        </button>
                                        {moreOptionsOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-app-bg-light border border-app-border rounded-xl shadow-xl z-50 overflow-hidden">
                                                <div className="p-2 space-y-1">
                                                    <button
                                                        onClick={async () => {
                                                            setMoreOptionsOpen(false);
                                                            setRefreshing(true);
                                                            try {
                                                                await fetchData();
                                                            } finally {
                                                                setRefreshing(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-secondary rounded-lg transition-colors"
                                                    >
                                                        <RefreshIcon className="w-4 h-4" />
                                                        Refresh
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setMoreOptionsOpen(false);
                                                            const allIds = (activeTab === 'sites' || activeTab === 'favorites' ? filteredSites : activeTab === 'categories' ? categories : tags).map(item => item.id);
                                                            if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set(allIds));
                                                            else if (activeTab === 'categories') setSelectedCategories(new Set(allIds));
                                                            else if (activeTab === 'tags') setSelectedTags(new Set(allIds));
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-secondary rounded-lg transition-colors"
                                                    >
                                                        <CheckmarkIcon className="w-4 h-4" />
                                                        Select All
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Select All - desktop only */}
                            {activeTab !== 'settings' && multiSelectMode && (() => {
                                const selectedCount = (() => {
                                    switch (activeTab) {
                                        case 'sites': return selectedSites.size;
                                        case 'favorites': {
                                            let count = 0;
                                            for (const siteId of selectedSites) {
                                                const site = sites.find(s => s.id === siteId);
                                                if (site && site.is_favorite) count++;
                                            }
                                            return count;
                                        }
                                        case 'categories': return selectedCategories.size;
                                        case 'tags': return selectedTags.size;
                                        default: return 0;
                                    }
                                })();
                                if (selectedCount > 0) return null;

                                return (
                                    <button
                                        onClick={() => {
                                            const allIds = (activeTab === 'sites' || activeTab === 'favorites' ? filteredSites : activeTab === 'categories' ? categories : tags).map(item => item.id);
                                            if (activeTab === 'sites' || activeTab === 'favorites') setSelectedSites(new Set(allIds));
                                            else if (activeTab === 'categories') setSelectedCategories(new Set(allIds));
                                            else if (activeTab === 'tags') setSelectedTags(new Set(allIds));
                                        }}
                                        className="hidden sm:block p-2 rounded-lg transition-colors text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light"
                                        title="Select all (Ctrl+A)"
                                        aria-label="Select all"
                                    >
                                        <CheckmarkIcon className="w-4 h-4" />
                                    </button>
                                );
                            })()}

                            {/* Add button - desktop only */}
                            {activeTab !== 'settings' && (
                                <Button onClick={onAddClick} variant="primary" size="sm" className="whitespace-nowrap hidden sm:inline-flex" data-tour="add-button">
                                    <PlusIcon className="w-4 h-4 sm:mr-1.5" />
                                    <span className="hidden md:inline">{getAddButtonText()}</span>
                                </Button>
                            )}

                            {/* Server Status */}
                            <ServerStatus />

                            {/* User menu */}
                            {user && (
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-gray-800 transition-colors"
                                        aria-label="User menu"
                                    >
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs sm:text-sm font-medium overflow-hidden">
                                            {user?.avatarUrl ? (
                                                <Image src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" width={32} height={32} />
                                            ) : (
                                                user.email?.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                    </button>

                                    {/* Dropdown */}
                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-48 sm:w-56 bg-app-bg-light border border-app-border rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div className="p-3 border-b border-app-border flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm text-app-text-primary truncate font-semibold">{user?.displayName || 'User'}</p>
                                                        {(() => {
                                                            const t = user?.tier || TIER_FREE;
                                                            const tc = TIER_COLORS[t] || TIER_COLORS[TIER_FREE];
                                                            return (
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${tc.bg} ${tc.text}`}>
                                                                    {tc.badge}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <p className="text-xs text-app-text-tertiary truncate">{user?.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => { setActiveTab('settings'); setUserMenuOpen(false); }}
                                                    className="p-2 text-app-text-tertiary hover:text-app-accent hover:bg-app-bg-secondary rounded-lg transition-colors"
                                                    title="Settings"
                                                    aria-label="Settings"
                                                >
                                                    <SettingsIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="p-2">
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => { router.push('/admin'); setUserMenuOpen(false); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-app-text-secondary hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors mb-1"
                                                    >
                                                        <ShieldCheckIcon className="w-4 h-4" />
                                                        Admin Dashboard
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { signOut(); setUserMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <LogoutIcon className="w-4 h-4" />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                                    <WarningIcon className="w-6 h-6" />
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
                                                    <FolderIcon className="w-4 h-4" />
                                                ) : (
                                                    <TagIcon className="w-4 h-4" />
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
                onClose={cancelBulkDelete}
                onConfirm={confirmBulkDelete}
                title="Delete Selected Items"
                message={`Are you sure you want to delete ${getSelectedIds().size} ${activeTab.slice(0, -1)}(s)? You will have a brief window to undo.`}
                confirmText="Delete"
            />

            {/* Bulk delete undo toast */}
            {pendingBulkDelete && (
                <UndoToast
                    message={`Deleted ${pendingBulkDelete.total} ${pendingBulkDelete.type.slice(0, -1)}(s)`}
                    onUndo={handleBulkUndo}
                    onClose={handleBulkToastClose}
                    duration={8000}
                />
            )}
        </>
    );
}
