import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchAPI } from '../lib/supabase';
import { useAuth, supabase } from './AuthContext';

const DashboardContext = createContext(null);

// Constants
const AUTH_CLEAR_DELAY = 500;
const TOAST_DURATION = 3000;
const SITES_LIMIT = 500;

// Helper to check if valid tokens exist in localStorage
function hasValidTokensInStorage() {
    if (typeof window === 'undefined') return false;
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.access_token && parsed?.expires_at) {
                        const expiresAt = parsed.expires_at * 1000;
                        if (Date.now() < expiresAt) return true;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[DashboardContext] Error checking localStorage tokens:', e);
    }
    return false;
}

// Helper for generic sorting
function sortItems(items, sortBy, sortOrder, isPinnedPrimary = false) {
    return items.slice().sort((a, b) => {
        // Pinned items first (only for sites)
        if (isPinnedPrimary) {
            const aIsPinned = a.is_pinned ? 1 : 0;
            const bIsPinned = b.is_pinned ? 1 : 0;
            if (aIsPinned !== bIsPinned) return bIsPinned - aIsPinned;
        }

        let aVal = a[sortBy];
        let bVal = b[sortBy];

        if (sortBy === 'created_at' || sortBy === 'updated_at') {
            aVal = new Date(aVal || 0).getTime();
            bVal = new Date(bVal || 0).getTime();
        } else if (sortBy === 'pricing') {
            const pricingOrder = { fully_free: 0, freemium: 1, free_trial: 2, paid: 3 };
            aVal = pricingOrder[aVal] ?? 4;
            bVal = pricingOrder[bVal] ?? 4;
        } else {
            aVal = (aVal || '').toString().toLowerCase();
            bVal = (bVal || '').toString().toLowerCase();
        }

        return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
}

// Helper to handle warnings from API responses
function handleResponseWarnings(response, siteId, siteData, setFailedRelationUpdates, showToast, fetchData) {
    if (response?.warnings && response.warnings.length) {
        console.warn('API response warnings:', response.warnings);

        const relationRelated = response.warnings.some(w =>
            w.stage && (w.stage.includes('site_categories') ||
                w.stage.includes('site_tags') ||
                w.stage === 'service_role_key_missing')
        );

        if (relationRelated) {
            setFailedRelationUpdates(prev => ({
                ...prev,
                [siteId]: {
                    categoryIds: siteData.category_ids || siteData.categoryIds || [],
                    tagIds: siteData.tag_ids || siteData.tagIds || [],
                    warnings: response.warnings
                }
            }));
        }

        showToast('Operation completed but some relation updates failed (refreshing...)', 'warning');
        fetchData().catch(e => console.warn('fetchData after warnings failed', e));
        return true;
    }
    return false;
}

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

    // Refs to prevent premature data clearing during auth transitions
    const hadUserRef = useRef(false);
    const clearDataTimeoutRef = useRef(null);

    // Show toast notification
    const showToast = useCallback((message, type = 'info', duration = TOAST_DURATION) => {
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
                fetchAPI(`/sites?limit=${SITES_LIMIT}`),
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
    useEffect(() => {
        if (clearDataTimeoutRef.current) {
            clearTimeout(clearDataTimeoutRef.current);
            clearDataTimeoutRef.current = null;
        }

        if (user) {
            hadUserRef.current = true;
            fetchData();
        } else if (!hasValidTokensInStorage()) {
            const clearData = () => {
                setSites([]);
                setCategories([]);
                setTags([]);
                setStats({ sites: 0, categories: 0, tags: 0 });
                hadUserRef.current = false;
            };

            // If we had a user recently, wait before clearing (gives time for auth to recover)
            if (hadUserRef.current) {
                clearDataTimeoutRef.current = setTimeout(clearData, AUTH_CLEAR_DELAY);
            } else {
                clearData();
            }
        }

        return () => {
            if (clearDataTimeoutRef.current) {
                clearTimeout(clearDataTimeoutRef.current);
            }
        };
    }, [user, fetchData]);

    // Real-time subscription for automatic data refresh
    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);

    useEffect(() => {
        if (!supabase || !user) return;

        const handleChange = () => fetchDataRef.current();

        const channel = supabase
            .channel('dashboard-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, handleChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, handleChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, handleChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'site_categories' }, handleChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'site_tags' }, handleChange)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

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

            if (!handleResponseWarnings(response, newSite.id, siteData, setFailedRelationUpdates, showToast, fetchData)) {
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

            setSites(prev => prev.map(s => s.id === id ? updated : s));

            const hadWarnings = handleResponseWarnings(response, id, siteData, setFailedRelationUpdates, showToast, fetchData);

            if (!hadWarnings) {
                // Clear any previous failed relation updates if no new warnings
                setFailedRelationUpdates(prev => {
                    const next = { ...prev };
                    delete next[id];
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
            const _response = await fetchAPI(`/sites/${id}`, { method: 'DELETE' });
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
    const filteredSites = sortItems(
        sites.filter(site => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = site.name?.toLowerCase().includes(query);
                const matchesUrl = site.url?.toLowerCase().includes(query);
                const matchesDescription = site.description?.toLowerCase().includes(query);
                if (!matchesName && !matchesUrl && !matchesDescription) return false;
            }
            if (selectedCategory) {
                const siteCategories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
                if (!siteCategories.some(c => c?.id === selectedCategory)) return false;
            }
            if (selectedTag) {
                const siteTags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];
                if (!siteTags.some(t => t?.id === selectedTag)) return false;
            }
            return true;
        }),
        sortBy,
        sortOrder,
        true // isPinnedPrimary
    );

    // Sorted and filtered categories
    const filteredCategories = sortItems(categories, sortByCategories, sortOrderCategories);

    // Sorted and filtered tags
    const filteredTags = sortItems(tags, sortByTags, sortOrderTags);
    const value = {
        // Data
        sites,
        setSites,
        categories: filteredCategories,
        setCategories,
        tags: filteredTags,
        setTags,
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
        toggleFavorite,
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
        retrySiteRelations
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
