import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchAPI } from '../lib/supabase';
import { useAuth, supabase } from './AuthContext';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
    const { user } = useAuth();
    const [sites, setSites] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [stats, setStats] = useState({ sites: 0, categories: 0, tags: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [failedRelationUpdates, setFailedRelationUpdates] = useState({}); // { [siteId]: { categoryIds, tagIds, warnings } }

    // Toast notification
    const [toast, setToast] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [sortByCategories, setSortByCategories] = useState('name');
    const [sortOrderCategories, setSortOrderCategories] = useState('asc');
    const [sortByTags, setSortByTags] = useState('name');
    const [sortOrderTags, setSortOrderTags] = useState('asc');
    const [activeTab, setActiveTab] = useState('sites');

    // Multi-select state
    const [selectedSites, setSelectedSites] = useState(new Set());
    const [selectedCategories, setSelectedCategories] = useState(new Set());
    const [selectedTags, setSelectedTags] = useState(new Set());
    const [multiSelectMode, setMultiSelectMode] = useState(false);

    // Favorites and Pinned state
    const [favoriteSites, setFavoriteSites] = useState(new Set());
    const [pinnedSites, setPinnedSites] = useState(new Set());

    // Refs to prevent premature data clearing during auth transitions
    const hadUserRef = useRef(false);
    const clearDataTimeoutRef = useRef(null);

    // Show toast notification
    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        setToast({ message, type, id: Date.now() });
        setTimeout(() => setToast(null), duration);
    }, []);

    // Toggle favorite site - updates sites table
    const toggleFavorite = useCallback(async (siteId) => {
        try {
            const site = sites.find(s => s.id === siteId);
            if (!site) return;

            // Update local sites state
            setSites(prev => prev.map(s =>
                s.id === siteId ? { ...s, is_favorite: !s.is_favorite } : s
            ));

            // Save to Supabase
            await fetchAPI('/favorites', {
                method: 'POST',
                body: JSON.stringify({ site_id: siteId })
            });

            if (!site.is_favorite) {
                showToast('✓ Added to favorites', 'success');
            } else {
                showToast('Removed from favorites', 'info');
            }
        } catch (err) {
            // Revert on error
            setSites(prev => prev.map(s =>
                s.id === siteId ? { ...s, is_favorite: !s.is_favorite } : s
            ));
            showToast(`Failed to update favorite: ${err.message}`, 'error');
        }
    }, [sites, showToast]);

    // Toggle pinned site - updates sites table
    const togglePinned = useCallback(async (siteId) => {
        try {
            const site = sites.find(s => s.id === siteId);
            if (!site) return;

            // Update local sites state
            setSites(prev => prev.map(s =>
                s.id === siteId ? { ...s, is_pinned: !s.is_pinned } : s
            ));

            // Save to Supabase
            await fetchAPI('/pinned', {
                method: 'POST',
                body: JSON.stringify({ site_id: siteId })
            });

            if (!site.is_pinned) {
                showToast('✓ Site pinned', 'success');
            } else {
                showToast('Unpinned', 'info');
            }
        } catch (err) {
            // Revert on error
            setSites(prev => prev.map(s =>
                s.id === siteId ? { ...s, is_pinned: !s.is_pinned } : s
            ));
            showToast(`Failed to update pin: ${err.message}`, 'error');
        }
    }, [sites, showToast]);

    // Fetch all data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [sitesRes, categoriesRes, tagsRes] = await Promise.all([
                fetchAPI('/sites?limit=500'),
                fetchAPI('/categories'),
                fetchAPI('/tags')
            ]);

            // Handle both direct array and { data: [...] } response formats
            const sitesData = Array.isArray(sitesRes) ? sitesRes : (sitesRes?.data || []);
            const categoriesData = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.data || []);
            const tagsData = Array.isArray(tagsRes) ? tagsRes : (tagsRes?.data || []);

            setSites(sitesData);
            setCategories(categoriesData);
            setTags(tagsData);
            setStats({
                sites: sitesData.length,
                categories: categoriesData.length,
                tags: tagsData.length
            });
        } catch (err) {
            setError(err.message);
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch data when user changes
    // PROTECTION: Don't clear data just because user became null temporarily
    // Check localStorage for valid tokens before clearing, and use debounce
    useEffect(() => {
        // Clear any pending clear timeout
        if (clearDataTimeoutRef.current) {
            clearTimeout(clearDataTimeoutRef.current);
            clearDataTimeoutRef.current = null;
        }

        if (user) {
            hadUserRef.current = true;
            fetchData();
        } else {
            // Before clearing data, check if tokens still exist in localStorage
            // This prevents data loss during temporary auth state transitions
            const hasValidTokens = (() => {
                if (typeof window === 'undefined') return false;
                try {
                    // Check for Supabase auth tokens in localStorage
                    const keys = Object.keys(localStorage);
                    for (const key of keys) {
                        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                            const stored = localStorage.getItem(key);
                            if (stored) {
                                const parsed = JSON.parse(stored);
                                // Check if tokens exist and aren't expired
                                if (parsed?.access_token && parsed?.expires_at) {
                                    const expiresAt = parsed.expires_at * 1000; // Convert to ms
                                    if (Date.now() < expiresAt) {
                                        console.log('[DashboardContext] User is null but valid tokens found - NOT clearing data');
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[DashboardContext] Error checking localStorage tokens:', e);
                }
                return false;
            })();

            // Only clear data if there are no valid tokens
            // Use debounce if we recently had a user (auth transition in progress)
            if (!hasValidTokens) {
                const clearData = () => {
                    console.log('[DashboardContext] No valid tokens found - clearing data');
                    setSites([]);
                    setCategories([]);
                    setTags([]);
                    setStats({ sites: 0, categories: 0, tags: 0 });
                    hadUserRef.current = false;
                };

                // If we had a user recently, wait 500ms before clearing (gives time for auth to recover)
                if (hadUserRef.current) {
                    console.log('[DashboardContext] User became null but had user recently - waiting 500ms before clearing');
                    clearDataTimeoutRef.current = setTimeout(clearData, 500);
                } else {
                    clearData();
                }
            }
        }

        return () => {
            if (clearDataTimeoutRef.current) {
                clearTimeout(clearDataTimeoutRef.current);
            }
        };
    }, [user, fetchData]);

    // Real-time subscription for automatic data refresh
    useEffect(() => {
        if (!supabase || !user) return;

        // Subscribe to changes on sites, categories, and tags tables
        const channel = supabase
            .channel('dashboard-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, () => {
                console.log('Sites table changed, refreshing data...');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                console.log('Categories table changed, refreshing data...');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => {
                console.log('Tags table changed, refreshing data...');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'site_categories' }, () => {
                console.log('Site-categories relation changed, refreshing data...');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'site_tags' }, () => {
                console.log('Site-tags relation changed, refreshing data...');
                fetchData();
            })
            .subscribe((status) => {
                console.log('Realtime subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchData]);

    // Site operations
    const addSite = useCallback(async (siteData) => {
        if (!user) throw new Error('Must be logged in to add a site');
        try {
            const response = await fetchAPI('/sites', {
                method: 'POST',
                body: JSON.stringify({ ...siteData, user_id: user.id })
            });
            const newSite = response?.data || response;
            setSites(prev => [newSite, ...prev]);
            setStats(prev => ({ ...prev, sites: prev.sites + 1 }));
            if (response?.warnings && response.warnings.length) {
                console.warn('Site created with warnings:', response.warnings);

                // Record failed relation updates so user can retry attaching them later
                setFailedRelationUpdates(prev => ({
                    ...prev,
                    [newSite.id]: {
                        categoryIds: siteData.category_ids || siteData.categoryIds || [],
                        tagIds: siteData.tag_ids || siteData.tagIds || [],
                        warnings: response.warnings
                    }
                }));

                showToast(`Site created but some relations failed (refreshing...)`, 'warning');
                // Refresh authoritative data from server to reflect actual state
                try { await fetchData(); } catch (e) { console.warn('fetchData after addSite warnings failed', e); }
            } else {
                showToast(`✓ Site "${newSite.name}" created successfully`, 'success');
            }
            return newSite;
        } catch (err) {
            showToast(`✗ Failed to add site: ${err.message}`, 'error');
            throw err;
        }
    }, [user, showToast, fetchData]);

    const updateSite = useCallback(async (id, siteData) => {
        try {
            const response = await fetchAPI(`/sites/${id}`, {
                method: 'PUT',
                body: JSON.stringify(siteData)
            });
            const updated = response?.data || response;

            // Zamijeni kompletan site sa updated verzijom (sa svim kategorijama/tagovima)
            // Update local cache with server value, and then ensure authoritative data is fetched (fixes relation persistence mismatches)
            setSites(prev => prev.map(s => s.id === id ? updated : s));
            try {
                if (response?.warnings && response.warnings.length) {
                    console.warn('[DashboardContext] updateSite warnings:', response.warnings);

                    // If relation inserts/updates failed, capture details so user can retry
                    const relationRelated = response.warnings.some(w => w.stage && (w.stage.includes('site_categories') || w.stage.includes('site_tags') || w.stage === 'service_role_key_missing'));
                    if (relationRelated) {
                        setFailedRelationUpdates(prev => ({
                            ...prev,
                            [id]: {
                                categoryIds: siteData.category_ids || siteData.categoryIds || [],
                                tagIds: siteData.tag_ids || siteData.tagIds || [],
                                warnings: response.warnings
                            }
                        }));
                    }

                    showToast && showToast('Site updated, but related updates failed. You can retry relation updates from the site editor after configuring SUPABASE_SERVICE_ROLE_KEY.', 'warning');
                }
                await fetchData();
            } catch (e) {
                console.warn('fetchData after updateSite failed', e);
            }
            if (response?.warnings && response.warnings.length) {
                console.warn('Site updated with warnings:', response.warnings);
                showToast('Site updated but some relation updates failed (refreshing...)', 'warning');
                try { await fetchData(); } catch (e) { console.warn('fetchData after updateSite warnings failed', e); }
            } else {
                // Clear any previous failed relation updates if no new warnings
                setFailedRelationUpdates(prev => {
                    const next = { ...prev };
                    delete next[response.data.id];
                    return next;
                });
                showToast(`✓ Site "${updated.name}" updated successfully`, 'success');
            }

            return updated;
        } catch (err) {
            showToast(`✗ Failed to update site: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast, fetchData]);

    const deleteSite = useCallback(async (id) => {
        try {
            console.log('Deleting site with id:', id);
            const response = await fetchAPI(`/sites/${id}`, { method: 'DELETE' });
            console.log('Delete response:', response);
            setSites(prev => prev.filter(s => s.id !== id));
            setStats(prev => ({ ...prev, sites: prev.sites - 1 }));
            showToast('✓ Site deleted successfully', 'success');
        } catch (err) {
            showToast(`✗ Failed to delete site: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    // Retry failed relation updates for a site (requires service role key configured)
    const retrySiteRelations = useCallback(async (id) => {
        try {
            const failed = failedRelationUpdates[id];
            if (!failed) throw new Error('No failed relation update recorded for this site');

            const res = await fetchAPI(`/sites/${id}/relations/retry`, {
                method: 'POST',
                body: JSON.stringify({ category_ids: failed.categoryIds || [], tag_ids: failed.tagIds || [] })
            });

            if (!res || res?.success === false) {
                const err = res?.error || JSON.stringify(res);
                throw new Error(err);
            }

            // Success: clear failure record and refresh data
            setFailedRelationUpdates(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
            await fetchData();
            showToast('✓ Relation updates retried successfully', 'success');
            return res.data || res;
        } catch (err) {
            console.error('retrySiteRelations error:', err);
            showToast(`✗ Failed to retry relations: ${err.message || err}`, 'error');
            throw err;
        }
    }, [failedRelationUpdates, fetchData, showToast]);

    // Category operations
    const addCategory = useCallback(async (categoryData) => {
        try {
            const response = await fetchAPI('/categories', {
                method: 'POST',
                body: JSON.stringify(categoryData)
            });
            const newCategory = response?.data || response;
            setCategories(prev => [...prev, newCategory]);
            setStats(prev => ({ ...prev, categories: prev.categories + 1 }));
            showToast(`✓ Category "${newCategory.name}" created successfully`, 'success');
            return newCategory;
        } catch (err) {
            showToast(`✗ Failed to add category: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    const updateCategory = useCallback(async (id, categoryData) => {
        try {
            const response = await fetchAPI(`/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify(categoryData)
            });
            const updated = response?.data || response;
            setCategories(prev => prev.map(c => c.id === id ? updated : c));
            // Update all sites that use this category
            setSites(prev => prev.map(site => ({
                ...site,
                categories_array: site.categories_array?.map(c => c?.id === id ? updated : c) || []
            })));
            showToast(`✓ Category "${updated.name}" updated successfully`, 'success');
            return updated;
        } catch (err) {
            showToast(`✗ Failed to update category: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    const deleteCategory = useCallback(async (id) => {
        try {
            await fetchAPI(`/categories/${id}`, { method: 'DELETE' });
            setCategories(prev => prev.filter(c => c.id !== id));
            // Remove deleted category from all sites
            setSites(prev => prev.map(site => ({
                ...site,
                categories_array: site.categories_array?.filter(c => c?.id !== id) || []
            })));
            setStats(prev => ({ ...prev, categories: prev.categories - 1 }));
            showToast('✓ Category deleted successfully', 'success');
        } catch (err) {
            showToast(`✗ Failed to delete category: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    // Tag operations
    const addTag = useCallback(async (tagData) => {
        try {
            const response = await fetchAPI('/tags', {
                method: 'POST',
                body: JSON.stringify(tagData)
            });
            const newTag = response?.data || response;
            setTags(prev => [...prev, newTag]);
            setStats(prev => ({ ...prev, tags: prev.tags + 1 }));
            showToast(`✓ Tag "${newTag.name}" created successfully`, 'success');
            return newTag;
        } catch (err) {
            showToast(`✗ Failed to add tag: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    const updateTag = useCallback(async (id, tagData) => {
        try {
            const response = await fetchAPI(`/tags/${id}`, {
                method: 'PUT',
                body: JSON.stringify(tagData)
            });
            const updated = response?.data || response;
            setTags(prev => prev.map(t => t.id === id ? updated : t));
            // Update all sites that use this tag
            setSites(prev => prev.map(site => ({
                ...site,
                tags_array: site.tags_array?.map(t => t?.id === id ? updated : t) || []
            })));
            showToast(`✓ Tag "${updated.name}" updated successfully`, 'success');
            return updated;
        } catch (err) {
            showToast(`✗ Failed to update tag: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    const deleteTag = useCallback(async (id) => {
        try {
            await fetchAPI(`/tags/${id}`, { method: 'DELETE' });
            setTags(prev => prev.filter(t => t.id !== id));
            // Remove deleted tag from all sites
            setSites(prev => prev.map(site => ({
                ...site,
                tags_array: site.tags_array?.filter(t => t?.id !== id) || []
            })));
            setStats(prev => ({ ...prev, tags: prev.tags - 1 }));
            showToast('✓ Tag deleted successfully', 'success');
        } catch (err) {
            showToast(`✗ Failed to delete tag: ${err.message}`, 'error');
            throw err;
        }
    }, [showToast]);

    // Filtered and sorted sites
    const filteredSites = sites
        .filter(site => {
            // Search filter - applies to active tab only for sites
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = site.name?.toLowerCase().includes(query);
                const matchesUrl = site.url?.toLowerCase().includes(query);
                const matchesDescription = site.description?.toLowerCase().includes(query);
                if (!matchesName && !matchesUrl && !matchesDescription) return false;
            }
            // Category filter
            if (selectedCategory) {
                const siteCategories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
                if (!siteCategories.some(c => c?.id === selectedCategory)) return false;
            }
            // Tag filter
            if (selectedTag) {
                const siteTags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];
                if (!siteTags.some(t => t?.id === selectedTag)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            // PINNED SITES FIRST - primary sort key
            const aIsPinned = a.is_pinned ? 1 : 0;
            const bIsPinned = b.is_pinned ? 1 : 0;
            if (aIsPinned !== bIsPinned) {
                return bIsPinned - aIsPinned; // true (1) comes before false (0)
            }

            // Then apply normal sortBy logic
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'created_at' || sortBy === 'updated_at') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            } else if (sortBy === 'pricing') {
                // Sort order: free, freemium, free_trial, paid
                const pricingOrder = { fully_free: 0, freemium: 1, free_trial: 2, paid: 3 };
                aVal = pricingOrder[aVal] ?? 4;
                bVal = pricingOrder[bVal] ?? 4;
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });
    // Sorted and filtered categories
    const filteredCategories = categories
        .slice()
        .sort((a, b) => {
            let aVal = a[sortByCategories];
            let bVal = b[sortByCategories];

            if (sortByCategories === 'created_at' || sortByCategories === 'updated_at') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }

            if (sortOrderCategories === 'asc') {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });

    // Sorted and filtered tags
    const filteredTags = tags
        .slice()
        .sort((a, b) => {
            let aVal = a[sortByTags];
            let bVal = b[sortByTags];

            if (sortByTags === 'created_at' || sortByTags === 'updated_at') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }

            if (sortOrderTags === 'asc') {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });
    const value = {
        // Data
        sites,
        categories: filteredCategories,
        tags: filteredTags,
        stats,
        loading,
        error,
        filteredSites,
        toast,
        showToast,

        // Filters
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        selectedTag,
        setSelectedTag,
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
        activeTab,
        setActiveTab,

        // Multi-select
        selectedSites,
        setSelectedSites,
        selectedCategories,
        setSelectedCategories,
        selectedTags,
        setSelectedTags,
        multiSelectMode,
        setMultiSelectMode,

        // Favorites and Pinned
        favoriteSites,
        toggleFavorite,
        pinnedSites,
        togglePinned,

        // Actions
        fetchData,
        addSite,
        updateSite,
        deleteSite,
        addCategory,
        updateCategory,
        deleteCategory,
        addTag,
        updateTag,
        deleteTag,
        // Failed relation updates map and retry helper
        failedRelationUpdates,
        retrySiteRelations,
        sites
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within DashboardProvider');
    }
    return context;
}
