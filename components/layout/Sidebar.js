import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { CollectionIcon, CloseIcon, GlobeIcon, FolderIcon, TagIcon, StarIcon, SettingsIcon, PinSimpleIcon, UploadIcon, ChevronDownIcon, PlusIcon, BookmarkIcon, TextLinesIcon, DocumentIcon, FilterIcon, ListBulletIcon, CheckCircleIcon, BanIcon, EditIcon, TrashIcon, DesktopIcon, DeviceMobileIcon } from '../ui/Icons';
import GroupModal from './GroupModal';
import { ConfirmModal } from '../ui/Modal';
import { SUPER_CATEGORIES, matchSuperCategory } from '../../lib/sharedGroups';

const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

function NoteGroupsSection({ noteGroups, addNoteGroup, updateNoteGroup, onDeleteGroup }) {
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#6366f1');
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [editName, setEditName] = useState('');
    const [creating, setCreating] = useState(false);
    const [expandedGroupId, setExpandedGroupId] = useState(null);

    const handleCreate = async () => {
        if (!newGroupName.trim() || creating) return;
        setCreating(true);
        try {
            await addNoteGroup({ name: newGroupName.trim(), color: newGroupColor });
            setNewGroupName('');
            setShowNewGroup(false);
        } catch { }
        setCreating(false);
    };

    const handleRename = async (id) => {
        if (!editName.trim()) { setEditingGroupId(null); return; }
        try { await updateNoteGroup(id, { name: editName.trim() }); } catch { }
        setEditingGroupId(null);
    };

    const handleGroupTap = (g) => {
        // On mobile, first tap shows actions, second tap or desktop click edits
        if (expandedGroupId === g.id) {
            setExpandedGroupId(null);
        } else {
            setExpandedGroupId(g.id);
        }
    };

    return (
        <div className="p-3 sm:p-4 border-t border-app-border">
            <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderIcon className="w-3.5 h-3.5" />
                My Note Groups
            </h3>

            <div className="space-y-0.5 sm:space-y-1 max-h-48 sm:max-h-64 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                {noteGroups.map(g => (
                    <div key={g.id}>
                        <div
                            className="flex items-center gap-2 group px-2 py-2 sm:py-1.5 rounded-lg hover:bg-app-bg-light active:bg-app-bg-light transition-colors cursor-pointer"
                            onClick={() => handleGroupTap(g)}
                        >
                            <span className="w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || '#6366f1' }} />
                            {editingGroupId === g.id ? (
                                <input
                                    className="flex-1 text-sm sm:text-xs bg-app-bg-light border border-app-accent/50 rounded px-2 py-1 sm:px-1.5 sm:py-0.5 text-app-text-primary focus:outline-none"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(g.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                                    onBlur={() => handleRename(g.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            ) : (
                                <span className="flex-1 text-sm sm:text-xs text-app-text-secondary truncate">{g.name}</span>
                            )}
                            <span className="text-[11px] sm:text-[10px] text-app-text-muted">{g.note_count || 0}</span>
                            {/* Desktop: hover actions */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingGroupId(g.id); setEditName(g.name); setExpandedGroupId(null); }}
                                className="hidden sm:block p-0.5 text-app-text-muted hover:text-app-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Rename"
                            >
                                <EditIcon className="w-3 h-3" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteGroup(g); setExpandedGroupId(null); }}
                                className="hidden sm:block p-0.5 text-app-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                            {/* Mobile: chevron indicator */}
                            <ChevronDownIcon className={`w-3.5 h-3.5 sm:hidden text-app-text-muted transition-transform ${expandedGroupId === g.id ? 'rotate-180' : ''}`} />
                        </div>
                        {/* Mobile: expanded action bar */}
                        {expandedGroupId === g.id && (
                            <div className="flex items-center gap-2 px-2 py-1.5 ml-5 sm:hidden">
                                <button
                                    onClick={() => { setEditingGroupId(g.id); setEditName(g.name); setExpandedGroupId(null); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-app-accent bg-app-accent/10 border border-app-accent/20 rounded-md active:bg-app-accent/20"
                                >
                                    <EditIcon className="w-3 h-3" />
                                    Rename
                                </button>
                                <button
                                    onClick={() => { onDeleteGroup(g); setExpandedGroupId(null); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md active:bg-red-500/20"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {noteGroups.length === 0 && !showNewGroup && (
                    <p className="text-sm sm:text-xs text-app-text-muted px-2 py-1">No groups yet</p>
                )}
            </div>

            {showNewGroup ? (
                <div className="mt-2 p-2.5 sm:p-2 bg-app-bg-card border border-app-border rounded-lg space-y-2.5 sm:space-y-2">
                    <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group name..."
                        className="w-full px-3 py-2 sm:px-2 sm:py-1.5 text-sm sm:text-xs bg-app-bg-light border border-app-border rounded text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewGroup(false); }}
                        autoFocus
                    />
                    <div className="flex items-center gap-1.5 sm:gap-1">
                        {GROUP_COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setNewGroupColor(c)}
                                className={`w-6 h-6 sm:w-4 sm:h-4 rounded-full border-2 transition-transform ${newGroupColor === c ? 'border-white scale-110 sm:scale-125' : 'border-transparent'}`}
                                style={{ backgroundColor: c }} />
                        ))}
                    </div>
                    <div className="flex gap-2 sm:gap-1.5">
                        <button onClick={handleCreate} disabled={!newGroupName.trim() || creating}
                            className="flex-1 px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs font-medium bg-app-accent/20 text-app-accent border border-app-accent/30 rounded hover:bg-app-accent/30 disabled:opacity-50 transition-colors">
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                            className="px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs text-app-text-secondary hover:text-app-text-primary transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowNewGroup(true)}
                    className="w-full mt-2 px-3 py-2.5 sm:py-2 rounded-lg text-sm sm:text-xs font-medium transition-colors flex items-center justify-center gap-1.5 bg-app-accent/10 text-app-accent border border-app-accent/30 hover:bg-app-accent/20 active:bg-app-accent/20"
                >
                    <PlusIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    New Group
                </button>
            )}

        </div>
    );
}

export default function Sidebar({
    isOpen = false,
    onClose,
    onGroupFilter
}) {
    const { supabase: supabaseClient } = useAuth();
    const {
        stats,
        categories,
        tags,
        selectedCategory,
        setSelectedCategory,
        selectedTag,
        setSelectedTag,
        selectedImportSource,
        setSelectedImportSource,
        selectedPricing,
        setSelectedPricing,
        activeTab,
        setActiveTab,
        sites,
        selectedSites,
        setSelectedSites,
        totalSitesCount,
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
        crossFilterCounts,
        crossFilterReady,
        usageFilterCategories,
        setUsageFilterCategories,
        usageFilterTags,
        setUsageFilterTags,
        neededFilterSites,
        setNeededFilterSites,
        neededFilterCategories,
        setNeededFilterCategories,
        neededFilterTags,
        setNeededFilterTags,
        fetchAllSites,
        fetchSitesPage,
        selectedGroup,
        setSelectedGroup,
        excludeMode,
        setExcludeMode,
        excludedCategoryIds,
        setExcludedCategoryIds,
        excludedTagIds,
        setExcludedTagIds,
        excludedImportSources,
        setExcludedImportSources,
        excludedPricingValues,
        setExcludedPricingValues,
        excludedNeededValues,
        setExcludedNeededValues,
        excludedUsedOnValues,
        setExcludedUsedOnValues,
        selectedUsedOn,
        setSelectedUsedOn,
        noteGroups,
        addNoteGroup,
        updateNoteGroup,
        deleteNoteGroup,
    } = useDashboard();

    // Ensure all excluded sets are Set instances
    const catSet = useMemo(() => excludedCategoryIds instanceof Set ? excludedCategoryIds : new Set(excludedCategoryIds || []), [excludedCategoryIds]);
    const tagSet = useMemo(() => excludedTagIds instanceof Set ? excludedTagIds : new Set(excludedTagIds || []), [excludedTagIds]);
    const srcSet = useMemo(() => excludedImportSources instanceof Set ? excludedImportSources : new Set(excludedImportSources || []), [excludedImportSources]);
    const prcSet = useMemo(() => excludedPricingValues instanceof Set ? excludedPricingValues : new Set(excludedPricingValues || []), [excludedPricingValues]);
    const nddSet = useMemo(() => excludedNeededValues instanceof Set ? excludedNeededValues : new Set(excludedNeededValues || []), [excludedNeededValues]);
    const uoSet = useMemo(() => excludedUsedOnValues instanceof Set ? excludedUsedOnValues : new Set(excludedUsedOnValues || []), [excludedUsedOnValues]);

    const [categoriesSearchQuery, setCategoriesSearchQuery] = useState('');
    const [tagsSearchQuery, setTagsSearchQuery] = useState('');
    const [isImportSourceOpen, setIsImportSourceOpen] = useState(false);

    // Custom groups (persisted in Supabase user_metadata + localStorage fallback)
    // Initialize from localStorage synchronously to avoid flash of default groups
    const [customGroups, setCustomGroups] = useState(() => {
        try { const s = localStorage.getItem('siteorg_custom_groups'); return s ? JSON.parse(s) : []; } catch { return []; }
    });
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [noteGroupToDelete, setNoteGroupToDelete] = useState(null);
    const [deletingNoteGroup, setDeletingNoteGroup] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    // Hidden auto-matched groups (persisted in Supabase user_metadata + localStorage fallback)
    const [hiddenAutoGroups, setHiddenAutoGroups] = useState(() => {
        try { const s = localStorage.getItem('siteorg_hidden_auto_groups'); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
    });
    const groupsLoaded = useRef(false);

    // Load from Supabase user_metadata (overrides localStorage if present)
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                const meta = user?.user_metadata;
                if (meta) {
                    if (Array.isArray(meta.custom_groups) && !cancelled) {
                        setCustomGroups(meta.custom_groups);
                    }
                    if (Array.isArray(meta.hidden_auto_groups) && !cancelled) {
                        setHiddenAutoGroups(new Set(meta.hidden_auto_groups));
                    }
                }
            } catch { /* ignore */ }
            if (!cancelled) groupsLoaded.current = true;
        }
        load();
        return () => { cancelled = true; };
    }, [supabaseClient]);

    // Save groups to Supabase user_metadata + localStorage whenever they change (skip initial load)
    useEffect(() => {
        if (!groupsLoaded.current) return;
        const groups = customGroups;
        const hidden = [...hiddenAutoGroups];
        // localStorage (instant)
        try { localStorage.setItem('siteorg_custom_groups', JSON.stringify(groups)); } catch { /* ignore */ }
        try { localStorage.setItem('siteorg_hidden_auto_groups', JSON.stringify(hidden)); } catch { /* ignore */ }
        // Supabase user_metadata (async, fire-and-forget)
        supabaseClient.auth.updateUser({ data: { custom_groups: groups, hidden_auto_groups: hidden } }).catch(() => { /* ignore */ });
    }, [customGroups, hiddenAutoGroups, supabaseClient]);

    const handleSaveGroup = useCallback((group) => {
        setCustomGroups(prev => {
            const existing = prev.findIndex(g => g.key === group.key);
            if (existing >= 0) {
                const next = [...prev];
                next[existing] = group;
                return next;
            }
            return [...prev, group];
        });
    }, []);

    const handleDeleteGroup = useCallback((key) => {
        // If it's a custom group, remove from customGroups
        setCustomGroups(prev => prev.filter(g => g.key !== key));
        // If it's an auto-matched group, add to hidden set
        if (SUPER_CATEGORIES.some(sc => sc.key === key)) {
            setHiddenAutoGroups(prev => new Set([...prev, key]));
        }
        if (selectedGroup === key) {
            setSelectedGroup(null);
            onGroupFilter?.(null);
        }
    }, [selectedGroup, setSelectedGroup, onGroupFilter]);

    // Map categories to super-categories and compute group counts
    // Custom groups take priority: if a category is in a custom group, it belongs there
    // Hidden auto groups are excluded — their categories fall to "Other"
    const categoryGroupMap = useMemo(() => {
        const map = {};
        const customKeys = new Set(customGroups.map(g => g.key));
        (categories || []).forEach(cat => {
            const groups = [];
            // Collect ALL custom groups that contain this category
            customGroups.forEach(g => {
                if ((g.categoryIds || []).includes(cat.id)) groups.push(g.key);
            });
            // If no custom group matched, try auto-match
            if (groups.length === 0) {
                const autoKey = matchSuperCategory(cat.name);
                if (autoKey && !hiddenAutoGroups.has(autoKey) && !customKeys.has(autoKey)) {
                    groups.push(autoKey);
                }
            }
            map[cat.id] = groups;
        });
        return map;
    }, [categories, customGroups, hiddenAutoGroups]);

    // Build object for editing an auto-matched group (pre-fill with matched categories)
    const buildAutoGroupEdit = useCallback((sc) => {
        const matchedCatIds = (categories || []).filter(cat => (categoryGroupMap[cat.id] || []).includes(sc.key)).map(cat => cat.id);
        return { key: sc.key, label: sc.label, icon: sc.icon, color: sc.color, categoryIds: matchedCatIds, isCustom: true };
    }, [categories, categoryGroupMap]);

    const superCategoryCounts = useMemo(() => {
        const counts = {};
        SUPER_CATEGORIES.forEach(sc => { counts[sc.key] = 0; });
        customGroups.forEach(cg => { counts[cg.key] = 0; });
        counts._other = 0;
        (categories || []).forEach(cat => {
            const groups = categoryGroupMap[cat.id] || [];
            if (groups.length === 0) { counts._other += 1; }
            else { groups.forEach(g => { if (counts[g] !== undefined) counts[g] += 1; else counts[g] = 1; }); }
        });
        return counts;
    }, [categories, categoryGroupMap, customGroups]);

    // Compute category IDs for currently selected group and call onGroupFilter
    const handleGroupClick = useCallback((groupKey) => {
        const nextKey = selectedGroup === groupKey ? null : groupKey;
        setSelectedGroup(nextKey);
        if (!nextKey) {
            onGroupFilter?.(null);
            // Go back to paginated mode
            fetchSitesPage(1);
            return;
        }
        // Collect all category IDs belonging to this group
        let ids;
        if (nextKey === '_other') {
            ids = (categories || []).filter(cat => !(categoryGroupMap[cat.id] || []).length).map(cat => cat.id);
        } else {
            ids = (categories || []).filter(cat => (categoryGroupMap[cat.id] || []).includes(nextKey)).map(cat => cat.id);
        }
        onGroupFilter?.(ids.length > 0 ? new Set(ids) : null);
        // Fetch all sites so both Sidebar count and SitesList have the full dataset
        if (ids.length > 0) fetchAllSites();
    }, [selectedGroup, setSelectedGroup, categories, categoryGroupMap, onGroupFilter, fetchAllSites, fetchSitesPage]);

    // Visible auto groups = not hidden, not overridden by a custom group with the same key
    const visibleAutoGroups = useMemo(() => {
        const customKeys = new Set(customGroups.map(g => g.key));
        return SUPER_CATEGORIES.filter(sc => !hiddenAutoGroups.has(sc.key) && !customKeys.has(sc.key));
    }, [customGroups, hiddenAutoGroups]);

    // Merged group list: auto-matched (visible) + custom, unified for rendering
    const allGroups = useMemo(() => {
        const autoItems = visibleAutoGroups.map(sc => ({ ...sc, isCustom: false }));
        const customItems = customGroups.map(cg => ({ ...cg, isCustom: true }));
        return [...autoItems, ...customItems];
    }, [visibleAutoGroups, customGroups]);

    // Compute the set of category IDs for the currently selected group (used for site filtering & count)
    const groupCatIds = useMemo(() => {
        if (!selectedGroup) return null;
        let ids;
        if (selectedGroup === '_other') {
            ids = (categories || []).filter(cat => !(categoryGroupMap[cat.id] || []).length).map(cat => cat.id);
        } else {
            ids = (categories || []).filter(cat => (categoryGroupMap[cat.id] || []).includes(selectedGroup)).map(cat => cat.id);
        }
        return ids.length > 0 ? new Set(ids) : null;
    }, [selectedGroup, categories, categoryGroupMap]);

    // Sync group filter to parent when selectedGroup changes (including URL-restored value on mount)
    const groupInitRef = useRef(false);
    useEffect(() => {
        if (!categories.length) return;
        if (!groupInitRef.current && !selectedGroup) {
            groupInitRef.current = true;
            return;
        }
        groupInitRef.current = true;
        onGroupFilter?.(groupCatIds);
        if (groupCatIds) fetchAllSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup, groupCatIds]);

    // Counts from API (loaded with categories/tags)
    const favoriteCount = stats.favorites || 0;
    const uncategorizedCount = stats.uncategorized || 0;
    const untaggedCount = stats.untagged || 0;

    // Whether any site filter is active (including exclusions)
    const hasExclusions = catSet.size > 0 || tagSet.size > 0 || srcSet.size > 0 || prcSet.size > 0 || nddSet.size > 0 || uoSet.size > 0;
    const hasGroupFilter = groupCatIds instanceof Set && groupCatIds.size > 0;
    const totalExcluded = catSet.size + tagSet.size + srcSet.size + prcSet.size + nddSet.size + uoSet.size;
    const hasServerFilter = selectedCategory || selectedTag || selectedImportSource || selectedPricing || selectedUsedOn || (neededFilterSites && neededFilterSites !== 'all');
    // Compute visible sites after exclusions and group filter (all sites loaded via fetchAllSites when active)
    const visibleSites = useMemo(() => {
        if (!hasExclusions && !hasGroupFilter) return sites;
        return sites.filter(site => {
            // Group filter: site must have at least one category belonging to the group
            if (hasGroupFilter) {
                const catIds = (site.categories_array || []).map(c => c?.id).filter(Boolean);
                if (!catIds.some(id => groupCatIds.has(id))) return false;
            }
            if (catSet.size > 0) {
                if (catSet.has('all')) return false;
                const catIds = (site.categories_array || []).map(c => c?.id).filter(Boolean);
                if (catSet.has('uncategorized') && catIds.length === 0) return false;
                if (catIds.some(id => catSet.has(id))) return false;
            }
            if (tagSet.size > 0) {
                if (tagSet.has('all')) return false;
                const tIds = (site.tags_array || []).map(t => t?.id).filter(Boolean);
                if (tagSet.has('untagged') && tIds.length === 0) return false;
                if (tIds.some(id => tagSet.has(id))) return false;
            }
            if (srcSet.size > 0) {
                if (srcSet.has('all')) return false;
                const src = site.import_source || 'manual';
                if (srcSet.has(src)) return false;
            }
            if (prcSet.size > 0) {
                const pr = site.pricing || '';
                if (prcSet.has(pr)) return false;
            }
            if (nddSet.size > 0) {
                const needed = site.is_needed ? 'needed' : 'not_needed';
                if (nddSet.has(needed)) return false;
            }
            if (uoSet.size > 0) {
                const uo = site.used_on || 'unset';
                if (uoSet.has(uo)) return false;
            }
            return true;
        });
    }, [sites, catSet, tagSet, srcSet, prcSet, nddSet, uoSet, hasExclusions, hasGroupFilter, groupCatIds]);

    // Per-filter counts from visible sites (after exclusions + group filter)
    const visibleCounts = useMemo(() => {
        if (!hasExclusions && !hasGroupFilter) return null;
        const cats = {}, tgs = {};
        const srcs = { manual: 0, bookmarks: 0, notion: 0, file: 0 };
        const prc = { fully_free: 0, freemium: 0, free_trial: 0, paid: 0 };
        let uncategorized = 0, untagged = 0, needed = 0, notNeeded = 0;
        const uo = { desktop: 0, mobile: 0, both: 0, web: 0 };
        visibleSites.forEach(site => {
            const catIds = (site.categories_array || []).map(c => c?.id).filter(Boolean);
            if (catIds.length === 0) uncategorized++;
            catIds.forEach(id => { cats[id] = (cats[id] || 0) + 1; });
            const tagIds = (site.tags_array || []).map(t => t?.id).filter(Boolean);
            if (tagIds.length === 0) untagged++;
            tagIds.forEach(id => { tgs[id] = (tgs[id] || 0) + 1; });
            const src = site.import_source || 'manual';
            if (srcs[src] !== undefined) srcs[src]++;
            const pr = site.pricing || '';
            if (Object.prototype.hasOwnProperty.call(prc, pr)) prc[pr]++;
            if (site.is_needed) needed++; else notNeeded++;
            if (site.used_on && uo[site.used_on] !== undefined) uo[site.used_on]++;
        });
        return { categories: cats, tags: tgs, importSources: srcs, pricing: prc, usedOn: uo, uncategorized, untagged, needed, notNeeded, total: visibleSites.length };
    }, [visibleSites, hasExclusions, hasGroupFilter]);

    // Sites tab count: show "visible / total" when any filter is active
    const sitesTabCount = (hasExclusions || hasGroupFilter)
        ? `${visibleSites.length} / ${stats.sites}`
        : hasServerFilter
            ? `${totalSitesCount} / ${stats.sites}`
            : stats.sites;

    // Logo always goes to Sites page
    const buildDashboardUrl = () => {
        return '/dashboard/sites';
    };

    // Import source counts from DB (synced across devices)
    const importSourceCounts = useMemo(() => ({
        manual: stats.importSources?.manual || 0,
        bookmarks: stats.importSources?.bookmarks || 0,
        notion: stats.importSources?.notion || 0,
        file: stats.importSources?.file || 0
    }), [stats.importSources]);

    // Cross-filter count helpers: show "crossCount / ownCount" for ALL items when another dimension is active
    const hasOtherCategoryFilter = selectedTag || selectedImportSource || selectedPricing || (neededFilterSites && neededFilterSites !== 'all');
    const hasOtherTagFilter = selectedCategory || selectedImportSource || selectedPricing || (neededFilterSites && neededFilterSites !== 'all');

    const getCategoryCount = (catId, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = catId === 'uncategorized' ? visibleCounts.uncategorized : (visibleCounts.categories[catId] || 0);
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherCategoryFilter) return ownCount;
        if (!crossFilterReady) return ownCount;
        const crossCount = crossFilterCounts.categories[catId] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const getTagCount = (tagId, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = tagId === 'untagged' ? visibleCounts.untagged : (visibleCounts.tags[tagId] || 0);
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherTagFilter) return ownCount;
        if (!crossFilterReady) return ownCount;
        const crossCount = crossFilterCounts.tags[tagId] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const hasOtherImportSourceFilter = selectedCategory || selectedTag || selectedPricing || (neededFilterSites && neededFilterSites !== 'all');

    const getImportSourceCount = (sourceKey, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = visibleCounts.importSources[sourceKey] || 0;
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherImportSourceFilter) return ownCount;
        if (!crossFilterReady) return ownCount;
        const crossCount = crossFilterCounts.importSources?.[sourceKey] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const hasOtherPricingFilter = selectedCategory || selectedTag || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all');

    // Pricing counts from stats
    const pricingCounts = useMemo(() => ({
        fully_free: stats.pricingCounts?.fully_free || 0,
        freemium: stats.pricingCounts?.freemium || 0,
        free_trial: stats.pricingCounts?.free_trial || 0,
        paid: stats.pricingCounts?.paid || 0
    }), [stats.pricingCounts]);

    const getPricingCount = (pricingKey, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = visibleCounts.pricing?.[pricingKey] || 0;
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherPricingFilter) return ownCount;
        if (!crossFilterReady) return ownCount;
        const crossCount = crossFilterCounts.pricing?.[pricingKey] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    // Needed counts from stats
    const neededCounts = useMemo(() => ({
        needed: stats.neededCounts?.needed || 0,
        not_needed: stats.neededCounts?.not_needed || 0
    }), [stats.neededCounts]);

    const hasOtherNeededFilter = selectedCategory || selectedTag || selectedImportSource || selectedPricing;

    const getNeededCount = (key, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = key === 'all' ? visibleCounts.total : key === 'needed' ? visibleCounts.needed : visibleCounts.notNeeded;
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherNeededFilter) return ownCount;
        if (!crossFilterReady) return ownCount;
        const crossCount = crossFilterCounts.needed?.[key] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const PRICING_OPTIONS = [
        { value: 'fully_free', label: 'Fully Free', icon: '✓', color: '#22c55e' },
        { value: 'freemium', label: 'Freemium', icon: '◐', color: '#3b82f6' },
        { value: 'free_trial', label: 'Free Trial', icon: '⏱', color: '#f59e0b' },
        { value: 'paid', label: 'Paid', icon: '$', color: '#ef4444' }
    ];

    // Used On counts
    const usedOnCounts = useMemo(() => ({
        desktop: stats.usedOnCounts?.desktop || 0,
        mobile: stats.usedOnCounts?.mobile || 0,
        both: stats.usedOnCounts?.both || 0,
        web: stats.usedOnCounts?.web || 0,
    }), [stats.usedOnCounts]);

    const USED_ON_OPTIONS = [
        { value: 'desktop', label: 'Desktop', Icon: DesktopIcon, color: '#0ea5e9' },
        { value: 'mobile', label: 'Mobile', Icon: DeviceMobileIcon, color: '#8b5cf6' },
        { value: 'both', label: 'Both', Icon: DesktopIcon, color: '#14b8a6' },
        { value: 'web', label: 'Web', Icon: GlobeIcon, color: '#f59e0b' },
    ];

    const getUsedOnCount = (key, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = visibleCounts.usedOn?.[key] || 0;
            return `${vc} / ${ownCount}`;
        }
        return ownCount;
    };

    return (
        <>
            {/* Mobile Overlay Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                data-tour="mobile-sidebar"
                className={`
          w-full xs:w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full
          fixed inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                {/* Logo */}
                <div className="p-3 sm:p-4 border-b border-app-border flex items-center justify-between">
                    <Link href={buildDashboardUrl()} className="text-lg sm:text-xl font-bold text-app-text-primary flex items-center gap-2 sm:gap-3 hover:text-app-accent transition-colors">
                        <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-app-accent to-[#4A9FE8] flex items-center justify-center shadow-lg shadow-app-accent/20">
                            <CollectionIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </span>
                        Site Organizer
                    </Link>
                    {/* Mobile Close Button */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light transition-colors"
                        aria-label="Close sidebar"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="p-1.5 sm:p-2 border-b border-app-border">
                    <nav className="space-y-0.5 sm:space-y-1">
                        {[
                            { id: 'sites', label: 'Sites', icon: 'sites', count: sitesTabCount },
                            { id: 'categories', label: 'Categories', icon: 'categories', count: stats.categories },
                            { id: 'tags', label: 'Tags', icon: 'tags', count: stats.tags },
                            { id: 'favorites', label: 'Favorites', icon: 'favorites', count: favoriteCount },
                            { id: 'notes', label: 'Notes', icon: 'notes', count: stats.notes || 0 },
                            { id: 'settings', label: 'Settings', icon: 'settings', count: null }
                        ].map(tab => {
                            const iconMap = {
                                sites: (
                                    <GlobeIcon className="w-4 h-4" />
                                ),
                                categories: (
                                    <FolderIcon className="w-4 h-4" />
                                ),
                                tags: (
                                    <TagIcon className="w-4 h-4" />
                                ),
                                favorites: (
                                    <StarIcon className="w-4 h-4" />
                                ),
                                notes: (
                                    <DocumentIcon className="w-4 h-4" />
                                ),
                                settings: (
                                    <SettingsIcon className="w-4 h-4" />
                                )
                            };

                            return (
                                <button
                                    key={tab.id}
                                    data-tour={`${tab.id}-tab`}
                                    onClick={() => {
                                        // Filter selectedSites when switching to favorites tab
                                        if (tab.id === 'favorites' && selectedSites.size > 0) {
                                            const favoriteSiteIds = new Set(
                                                Array.from(selectedSites).filter(siteId => {
                                                    const site = sites.find(s => s.id === siteId);
                                                    return site && site.is_favorite;
                                                })
                                            );
                                            setSelectedSites(favoriteSiteIds);
                                        }

                                        // Just set tab — URL sync effect in DashboardContext handles the URL
                                        setActiveTab(tab.id);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border
                ${activeTab === tab.id
                                            ? 'bg-app-accent/20 text-app-accent border-app-accent/30'
                                            : 'border-transparent text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span>{iconMap[tab.icon]}</span>
                                        {tab.label}
                                    </span>
                                    {tab.count !== null && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full 
                                            ${activeTab === tab.id ? 'bg-app-accent text-app-bg-primary' : 'bg-app-bg-light text-app-text-secondary'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Sort Section - Hide when on settings tab */}
                {activeTab !== 'settings' && activeTab !== 'notes' && (
                    <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-700" data-tour="sorting">
                        {/* Sort Controls - improved UI */}
                        <div className="space-y-2 sm:space-y-3">
                            {/* Sort By Options - Different per tab */}
                            {(activeTab === 'sites' || activeTab === 'favorites') && (
                                <div>
                                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-400 mb-1.5 sm:mb-2">Sort by</label>
                                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                        {[
                                            { label: 'Created', value: 'created_at' },
                                            { label: 'Updated', value: 'updated_at' },
                                            { label: 'Name', value: 'name' },
                                            { label: 'Pricing', value: 'pricing' }
                                        ].map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSortBy(option.value)}
                                                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border"
                                                style={{
                                                    backgroundColor: sortBy === option.value ? '#2A5A8A' : '#1A2E4A',
                                                    color: sortBy === option.value ? '#8DD0FF' : '#4A7CA8',
                                                    borderColor: sortBy === option.value ? '#3A6A9A' : '#243654',
                                                    fontWeight: sortBy === option.value ? '600' : '500'
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sort By for Categories/Tags */}
                            {(activeTab === 'categories' || activeTab === 'tags') && (() => {
                                const current = activeTab === 'categories' ? sortByCategories : sortByTags;
                                const setter = activeTab === 'categories' ? setSortByCategories : setSortByTags;
                                return (
                                    <div className="mb-4">
                                        <label className="block text-[10px] sm:text-xs font-semibold text-gray-400 mb-1.5 sm:mb-2">Sort By</label>
                                        <div className="flex gap-1.5 sm:gap-2">
                                            {[{ label: 'Name', value: 'name' }, { label: 'Created', value: 'created_at' }].map(option => (
                                                <button key={option.value} onClick={() => setter(option.value)}
                                                    className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border"
                                                    style={{
                                                        backgroundColor: current === option.value ? '#2A5A8A' : '#1A2E4A',
                                                        color: current === option.value ? '#8DD0FF' : '#4A7CA8',
                                                        borderColor: current === option.value ? '#3A6A9A' : '#243654',
                                                        fontWeight: current === option.value ? '600' : '500'
                                                    }}>{option.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Sort Order Toggle - Different per tab */}
                            <div>
                                <label className="block text-[10px] sm:text-xs font-semibold text-gray-400 mb-1.5 sm:mb-2">
                                    Order
                                </label>
                                <div className="flex gap-1.5 sm:gap-2">
                                    {[
                                        { label: '↓ Desc', value: 'desc' },
                                        { label: '↑ Asc', value: 'asc' }
                                    ].map(option => {
                                        // Determine current sort order based on active tab
                                        const currentSortOrder = activeTab === 'categories'
                                            ? sortOrderCategories
                                            : activeTab === 'tags'
                                                ? sortOrderTags
                                                : sortOrder;

                                        const handleClick = () => {
                                            if (activeTab === 'categories') {
                                                setSortOrderCategories(option.value);
                                            } else if (activeTab === 'tags') {
                                                setSortOrderTags(option.value);
                                            } else {
                                                setSortOrder(option.value);
                                            }
                                        };

                                        return (
                                            <button
                                                key={option.value}
                                                onClick={handleClick}
                                                className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border"
                                                style={{
                                                    backgroundColor: currentSortOrder === option.value ? '#2A5A8A' : '#1A2E4A',
                                                    color: currentSortOrder === option.value ? '#8DD0FF' : '#4A7CA8',
                                                    borderColor: currentSortOrder === option.value ? '#3A6A9A' : '#243654',
                                                    fontWeight: currentSortOrder === option.value ? '600' : '500'
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Note about pinned sites - Only show for sites/favorites */}
                        {(activeTab === 'sites' || activeTab === 'favorites') && (
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3">
                                <PinSimpleIcon className="w-4 h-4 inline-block mr-1" />
                                Pinned sites always appear first
                            </p>
                        )}
                    </div>
                )}

                {/* Categories Filter */}
                {(activeTab === 'sites' || activeTab === 'favorites') && (
                    <div className="p-3 sm:p-4 flex-1 overflow-y-auto  sm:max-h-none" data-tour="filters">
                        {/* Reset All Filters Button */}
                        {(selectedCategory || selectedTag || selectedImportSource || selectedPricing || selectedUsedOn || selectedGroup || (neededFilterSites && neededFilterSites !== 'all') || hasExclusions) && (
                            <button
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setSelectedTag(null);
                                    setSelectedImportSource(null);
                                    setSelectedPricing(null);
                                    setSelectedUsedOn(null);
                                    setNeededFilterSites('all');
                                    setExcludedCategoryIds(new Set());
                                    setExcludedTagIds(new Set());
                                    setExcludedImportSources(new Set());
                                    setExcludedPricingValues(new Set());
                                    setExcludedNeededValues(new Set());
                                    setExcludedUsedOnValues(new Set());
                                    setExcludeMode(false);
                                    setSelectedGroup(null);
                                    onGroupFilter?.(null);
                                }}
                                className="w-full mb-4 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                            >
                                <CloseIcon className="w-4 h-4" />
                                Reset All Filters
                            </button>
                        )}

                        {/* Single Exclude Mode Toggle */}
                        <div className="mb-4">
                            <button
                                type="button"
                                className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border ${excludeMode
                                    ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                                    : 'bg-app-bg-light border-app-border text-app-text-secondary hover:bg-app-bg-lighter hover:text-app-text-primary'
                                    }`}
                                onClick={() => {
                                    if (excludeMode) {
                                        setExcludedCategoryIds(new Set());
                                        setExcludedTagIds(new Set());
                                        setExcludedImportSources(new Set());
                                        setExcludedPricingValues(new Set());
                                        setExcludedNeededValues(new Set());
                                    }
                                    setExcludeMode(m => !m);
                                }}
                                title={excludeMode ? 'Exit Exclude Mode — click items to hide them from the list' : 'Enable Exclude Mode — click items to hide them from the list'}
                            >
                                <BanIcon className="w-3.5 h-3.5" />
                                {excludeMode
                                    ? `Exclude Mode ON${totalExcluded > 0 ? ` (${totalExcluded} hidden)` : ''}`
                                    : 'Exclude Mode'
                                }
                            </button>
                        </div>

                        {/* Pricing Filter */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">💰</span>
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Pricing</span>
                            {(selectedPricing || prcSet.size > 0) && (
                                <button onClick={() => { setSelectedPricing(null); setExcludedPricingValues(new Set()); }} className="ml-auto text-red-400 hover:text-red-300" title="Reset">
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-5">
                            {PRICING_OPTIONS.map(opt => {
                                const isExcluded = prcSet.has(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => excludeMode
                                            ? setExcludedPricingValues(prev => {
                                                const next = new Set(prev);
                                                if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
                                                return next;
                                            })
                                            : setSelectedPricing(selectedPricing === opt.value ? null : opt.value)
                                        }
                                        className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all flex flex-col items-center gap-0.5 border ${isExcluded ? 'opacity-40 line-through' : ''} ${selectedPricing === opt.value
                                            ? 'shadow-sm'
                                            : 'hover:shadow-md'
                                            }`}
                                        style={{
                                            backgroundColor: isExcluded ? 'rgba(239,68,68,0.1)' : selectedPricing === opt.value ? `${opt.color}20` : '#1A2E4A',
                                            color: isExcluded ? '#ef4444' : selectedPricing === opt.value ? opt.color : '#8BA4C4',
                                            borderColor: isExcluded ? 'rgba(239,68,68,0.3)' : selectedPricing === opt.value ? `${opt.color}50` : '#243654'
                                        }}
                                    >
                                        <span className="text-sm leading-none">{isExcluded ? '✖' : opt.icon}</span>
                                        <span className="truncate w-full text-center leading-tight">{opt.label}</span>
                                        <span className={`text-xs font-bold leading-none ${selectedPricing === opt.value ? '' : 'text-app-text-muted'}`}>
                                            {getPricingCount(opt.value, pricingCounts[opt.value])}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Super-Categories (Groups) */}
                        <div className="flex items-center gap-2 mb-2">
                            <CollectionIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Group</span>
                            <button
                                onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}
                                className="ml-auto text-app-text-tertiary hover:text-app-accent transition-colors"
                                title="Add custom group"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                            </button>
                            {selectedGroup && (
                                <button onClick={() => { setSelectedGroup(null); onGroupFilter?.(null); }} className="text-red-400 hover:text-red-300" title="Show all categories">
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* All groups (auto-matched + custom) in a single grid */}
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-1 mb-5">
                            {allGroups.map(grp => {
                                const count = superCategoryCounts[grp.key] || 0;
                                const isActive = selectedGroup === grp.key;
                                const editObj = grp.isCustom ? grp : buildAutoGroupEdit(grp);
                                return (
                                    <div
                                        key={grp.key}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleGroupClick(grp.key)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGroupClick(grp.key); } }}
                                        onContextMenu={(e) => { e.preventDefault(); setEditingGroup(editObj); setGroupModalOpen(true); }}
                                        className={`px-1 py-2.5 sm:px-0.5 sm:py-1.5 rounded-md text-[11px] sm:text-[10px] font-medium transition-all flex flex-col items-center gap-0.5 border relative group/grp cursor-pointer active:scale-95 ${isActive ? 'shadow-sm' : 'hover:shadow-md'}`}
                                        style={{
                                            backgroundColor: isActive ? `${grp.color}20` : '#1A2E4A',
                                            color: isActive ? grp.color : '#8BA4C4',
                                            borderColor: isActive ? `${grp.color}50` : '#243654'
                                        }}
                                        title={`${grp.label} (${count}) — right-click to edit`}
                                    >
                                        <span className="text-sm leading-none">{grp.icon}</span>
                                        <span className="truncate w-full text-center leading-tight text-[9px]">{grp.label}</span>
                                        <span className="text-[9px] opacity-60 leading-none">{count}</span>
                                        <span className={`absolute -top-1.5 -right-1.5 sm:-top-1 sm:-right-1 gap-0.5 ${isActive ? 'flex' : 'hidden group-hover/grp:flex'}`}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingGroup(editObj); setGroupModalOpen(true); }}
                                                className="w-5 h-5 sm:w-3.5 sm:h-3.5 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-[10px] sm:text-[8px] text-gray-300 hover:bg-app-accent hover:text-white active:bg-app-accent active:text-white"
                                                title="Edit"
                                            >✎</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(grp.key); }}
                                                className="w-5 h-5 sm:w-3.5 sm:h-3.5 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-[10px] sm:text-[8px] text-gray-300 hover:bg-red-500 hover:text-white active:bg-red-500 active:text-white"
                                                title="Delete"
                                            >✕</button>
                                        </span>
                                    </div>
                                );
                            })}
                            {/* Other group for unmatched categories */}
                            {(() => {
                                const count = superCategoryCounts._other || 0;
                                const isActive = selectedGroup === '_other';
                                return count > 0 ? (
                                    <button
                                        onClick={() => handleGroupClick('_other')}
                                        className={`px-0.5 py-1.5 rounded-md text-[10px] font-medium transition-all flex flex-col items-center gap-0.5 border ${isActive ? 'shadow-sm' : 'hover:shadow-md'}`}
                                        style={{
                                            backgroundColor: isActive ? '#9ca3af20' : '#1A2E4A',
                                            color: isActive ? '#9ca3af' : '#8BA4C4',
                                            borderColor: isActive ? '#9ca3af50' : '#243654'
                                        }}
                                        title={`Other (${count})`}
                                    >
                                        <span className="text-sm leading-none">📁</span>
                                        <span className="truncate w-full text-center leading-tight text-[9px]">Other</span>
                                        <span className="text-[9px] opacity-60 leading-none">{count}</span>
                                    </button>
                                ) : null;
                            })()}
                        </div>

                        {/* Categories */}
                        <div className="flex items-center gap-2 mb-3">
                            <FolderIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">
                                {selectedGroup
                                    ? `${(SUPER_CATEGORIES.find(s => s.key === selectedGroup)?.label || customGroups.find(g => g.key === selectedGroup)?.label || 'Other')} Categories`
                                    : 'Filter by Category'
                                }
                            </span>
                        </div>
                        <div className="mb-3 relative">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={categoriesSearchQuery}
                                onChange={(e) => setCategoriesSearchQuery(e.target.value)}
                                className="w-full px-2 py-1.5 bg-app-bg-light border border-app-border rounded text-xs text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-1 focus:ring-app-accent"
                            />
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                            <button
                                onClick={() => excludeMode
                                    ? setExcludedCategoryIds(prev => {
                                        const next = prev instanceof Set ? new Set(prev) : new Set(prev || []);
                                        if (next.has('all')) next.delete('all'); else next.add('all');
                                        return next;
                                    })
                                    : setSelectedCategory(null)
                                }
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-medium
                                    ${catSet.has('all') && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : !selectedCategory
                                        ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light/50 hover:text-app-text-primary border border-transparent'
                                    }`}
                                aria-pressed={catSet.has('all') && excludeMode}
                                title={excludeMode ? (catSet.has('all') ? 'Click to include' : 'Click to exclude') : undefined}
                            >
                                All Categories {excludeMode && catSet.has('all') && <span className="ml-2 text-xs">✖</span>}
                            </button>
                            <button
                                onClick={() => excludeMode
                                    ? setExcludedCategoryIds(prev => {
                                        const next = prev instanceof Set ? new Set(prev) : new Set(prev || []);
                                        if (next.has('uncategorized')) next.delete('uncategorized'); else next.add('uncategorized');
                                        return next;
                                    })
                                    : setSelectedCategory('uncategorized')
                                }
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                                    ${catSet.has('uncategorized') && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : selectedCategory === 'uncategorized'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                                        : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                    }`}
                                aria-pressed={catSet.has('uncategorized') && excludeMode}
                                title={excludeMode ? (catSet.has('uncategorized') ? 'Click to include' : 'Click to exclude') : undefined}
                            >
                                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0 bg-gray-500" />
                                <span className="truncate flex-1">Uncategorized</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedCategory === 'uncategorized'
                                    ? 'bg-amber-500/30 text-amber-400'
                                    : 'bg-app-bg-light text-app-text-muted group-hover:bg-amber-500/20 group-hover:text-amber-400'
                                    }`}>
                                    {getCategoryCount('uncategorized', uncategorizedCount)}
                                </span>
                                {excludeMode && catSet.has('uncategorized') && <span className="ml-2 text-xs">✖</span>}
                            </button>
                            {categories
                                .filter(cat => {
                                    if (!cat?.name?.toLowerCase().includes(categoriesSearchQuery.toLowerCase())) return false;
                                    if (!selectedGroup) return true;
                                    const groups = categoryGroupMap[cat.id] || [];
                                    if (selectedGroup === '_other') return groups.length === 0;
                                    return groups.includes(selectedGroup);
                                })
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(cat => {
                                    // Use site_count from API
                                    const siteCount = cat.site_count || 0;
                                    const isExcluded = catSet.has(cat.id);
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => excludeMode
                                                ? setExcludedCategoryIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                                                    return next;
                                                })
                                                : setSelectedCategory(cat.id)
                                            }
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                                                ${isExcluded && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : selectedCategory === cat.id
                                                    ? 'bg-app-accent/20 text-app-accent border border-app-accent/30 shadow-sm backdrop-blur-sm'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                                }`}
                                            aria-pressed={isExcluded}
                                            title={excludeMode ? (isExcluded ? 'Click to include' : 'Click to exclude') : undefined}
                                        >
                                            <span
                                                className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0"
                                                style={{ backgroundColor: cat.color || '#6b7280' }}
                                            />
                                            <span className="truncate flex-1">{cat.name}</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedCategory === cat.id
                                                ? 'bg-app-accent/30 text-app-accent'
                                                : 'bg-app-bg-light text-app-text-muted group-hover:bg-app-accent/20 group-hover:text-app-accent'
                                                }`}>
                                                {getCategoryCount(cat.id, siteCount)}
                                            </span>
                                            {excludeMode && isExcluded && (
                                                <span className="ml-2 text-xs">✖</span>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Tags Filter */}
                        <div className="flex items-center gap-2 mb-3 mt-6">
                            <TagIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Filter by Tag</span>
                        </div>
                        <div className="mb-3 relative">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={tagsSearchQuery}
                                onChange={(e) => setTagsSearchQuery(e.target.value)}
                                className="w-full px-2 py-1.5 bg-app-bg-light border border-app-border rounded text-xs text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-1 focus:ring-app-accent"
                            />
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                            <button
                                onClick={() => excludeMode
                                    ? setExcludedTagIds(prev => {
                                        const next = prev instanceof Set ? new Set(prev) : new Set(prev || []);
                                        if (next.has('all')) next.delete('all'); else next.add('all');
                                        return next;
                                    })
                                    : setSelectedTag(null)
                                }
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-medium
                                    ${tagSet.has('all') && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : !selectedTag
                                        ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light/50 hover:text-app-text-primary border border-transparent'
                                    }`}
                                aria-pressed={tagSet.has('all') && excludeMode}
                                title={excludeMode ? (tagSet.has('all') ? 'Click to include' : 'Click to exclude') : undefined}
                            >
                                All Tags {excludeMode && tagSet.has('all') && <span className="ml-2 text-xs">✖</span>}
                            </button>
                            <button
                                onClick={() => excludeMode
                                    ? setExcludedTagIds(prev => {
                                        const next = prev instanceof Set ? new Set(prev) : new Set(prev || []);
                                        if (next.has('untagged')) next.delete('untagged'); else next.add('untagged');
                                        return next;
                                    })
                                    : setSelectedTag('untagged')
                                }
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                                    ${tagSet.has('untagged') && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : selectedTag === 'untagged'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                                        : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                    }`}
                                aria-pressed={tagSet.has('untagged') && excludeMode}
                                title={excludeMode ? (tagSet.has('untagged') ? 'Click to include' : 'Click to exclude') : undefined}
                            >
                                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0 bg-gray-500" />
                                <span className="truncate flex-1">Untagged</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedTag === 'untagged'
                                    ? 'bg-amber-500/30 text-amber-400'
                                    : 'bg-app-bg-light text-app-text-muted group-hover:bg-amber-500/20 group-hover:text-amber-400'
                                    }`}>
                                    {getTagCount('untagged', untaggedCount)}
                                </span>
                                {excludeMode && tagSet.has('untagged') && <span className="ml-2 text-xs">✖</span>}
                            </button>
                            {tags
                                .filter(tag => tag?.name?.toLowerCase().includes(tagsSearchQuery.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(tag => {
                                    // Use site_count from API
                                    const siteCount = tag.site_count || 0;
                                    const isExcluded = tagSet.has(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => excludeMode
                                                ? setExcludedTagIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id);
                                                    return next;
                                                })
                                                : setSelectedTag(selectedTag === tag.id ? null : tag.id)
                                            }
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                                                ${isExcluded && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : selectedTag === tag.id
                                                    ? 'bg-app-accent/20 text-app-accent border border-app-accent/30 shadow-sm backdrop-blur-sm'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                                }`}
                                            aria-pressed={isExcluded}
                                            title={excludeMode ? (isExcluded ? 'Click to include' : 'Click to exclude') : undefined}
                                        >
                                            <span
                                                className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0 transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: tag.color || '#5B8DEE' }}
                                            />
                                            <span className="truncate flex-1">{tag.name}</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedTag === tag.id
                                                ? 'bg-app-accent/30 text-app-accent'
                                                : 'bg-app-bg-light text-app-text-muted group-hover:bg-app-accent/20 group-hover:text-app-accent'
                                                }`}>
                                                {getTagCount(tag.id, siteCount)}
                                            </span>
                                            {excludeMode && isExcluded && (
                                                <span className="ml-2 text-xs">✖</span>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Needed Filter */}
                        <div className="mt-6">
                            <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FilterIcon className="w-3.5 h-3.5" />
                                Needed Filter
                                {(nddSet.size > 0 || neededFilterSites !== 'all') && (
                                    <button onClick={() => { setNeededFilterSites('all'); setExcludedNeededValues(new Set()); }} className="ml-auto text-red-400 hover:text-red-300" title="Reset">
                                        <CloseIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </h3>
                            <div className="space-y-1">
                                {[
                                    { key: 'all', label: 'All Sites', icon: ListBulletIcon },
                                    { key: 'needed', label: 'Needed', icon: CheckCircleIcon },
                                    { key: 'not_needed', label: 'Not needed', icon: BanIcon }
                                ].map(item => {
                                    const Icon = item.icon;
                                    const isExcluded = item.key !== 'all' && nddSet.has(item.key);
                                    const ownCount = item.key === 'all' ? stats.sites : neededCounts[item.key] || 0;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => {
                                                if (excludeMode && item.key !== 'all') {
                                                    setExcludedNeededValues(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(item.key)) next.delete(item.key); else next.add(item.key);
                                                        return next;
                                                    });
                                                } else {
                                                    setNeededFilterSites(item.key);
                                                }
                                            }}
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${isExcluded ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30' : neededFilterSites === item.key
                                                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                                : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-3.5 h-3.5" />
                                                {item.label}
                                                {isExcluded && <span className="text-xs">✖</span>}
                                            </span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${neededFilterSites === item.key
                                                ? 'bg-app-accent/30 text-app-accent'
                                                : 'bg-app-bg-light text-app-text-muted'
                                                }`}>
                                                {getNeededCount(item.key, ownCount)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {neededFilterSites !== 'all' && (
                                <button onClick={() => setNeededFilterSites('all')}
                                    className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                                    <CloseIcon className="w-3 h-3" />
                                    Reset Filter
                                </button>
                            )}
                        </div>

                        {/* Import Source Filter */}
                        <div className="flex items-center gap-2 mb-3 mt-6">
                            <UploadIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Import Source</span>
                            <button
                                onClick={() => setIsImportSourceOpen(!isImportSourceOpen)}
                                className="ml-auto text-xs text-app-text-secondary hover:text-app-text-primary"
                                title={isImportSourceOpen ? 'Hide sources' : 'Show sources'}
                            >
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isImportSourceOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        {isImportSourceOpen && (<>
                            <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                                {['manual', 'bookmarks', 'notion', 'file'].map(source => {
                                    const isExcluded = srcSet.has(source);
                                    const labelMap = { manual: 'Manual', bookmarks: 'Bookmarks', notion: 'Notion', file: 'File' };
                                    const iconMap = { manual: PlusIcon, bookmarks: BookmarkIcon, notion: TextLinesIcon, file: DocumentIcon };
                                    const Icon = iconMap[source];
                                    return (
                                        <button
                                            key={source}
                                            onClick={() => excludeMode
                                                ? setExcludedImportSources(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(source)) next.delete(source); else next.add(source);
                                                    return next;
                                                })
                                                : setSelectedImportSource(selectedImportSource === source ? null : source)
                                            }
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between
                                                ${isExcluded && excludeMode ? 'opacity-40 line-through bg-red-500/10 border border-red-500/30 text-red-400' : selectedImportSource === source
                                                    ? 'bg-app-accent/20 text-app-accent border border-app-accent/30 shadow-sm backdrop-blur-sm'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                                }`}
                                            aria-pressed={isExcluded}
                                            title={excludeMode ? (isExcluded ? 'Click to include' : 'Click to exclude') : undefined}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{labelMap[source]}</span>
                                            </span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedImportSource === source
                                                ? 'bg-app-accent/30 text-app-accent'
                                                : 'bg-app-bg-light text-app-text-muted'
                                                }`}>
                                                {getImportSourceCount(source, importSourceCounts[source])}
                                            </span>
                                            {excludeMode && isExcluded && (
                                                <span className="ml-2 text-xs">✖</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>)}

                        {/* Used On Filter */}
                        <div className="flex items-center gap-2 mb-2 mt-6">
                            <DesktopIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Used On</span>
                            {(selectedUsedOn || uoSet.size > 0) && (
                                <button onClick={() => { setSelectedUsedOn(null); setExcludedUsedOnValues(new Set()); }} className="ml-auto text-red-400 hover:text-red-300" title="Reset">
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-5">
                            {USED_ON_OPTIONS.map(opt => {
                                const isExcluded = uoSet.has(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => excludeMode
                                            ? setExcludedUsedOnValues(prev => {
                                                const next = new Set(prev);
                                                if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
                                                return next;
                                            })
                                            : setSelectedUsedOn(selectedUsedOn === opt.value ? null : opt.value)
                                        }
                                        className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all flex flex-col items-center gap-0.5 border ${isExcluded ? 'opacity-40 line-through' : ''} ${selectedUsedOn === opt.value
                                            ? 'shadow-sm'
                                            : ''
                                            }`}
                                        style={{
                                            backgroundColor: isExcluded ? 'rgba(239,68,68,0.1)' : selectedUsedOn === opt.value ? `${opt.color}20` : '#1A2E4A',
                                            color: isExcluded ? '#ef4444' : selectedUsedOn === opt.value ? opt.color : '#8BA4C4',
                                            borderColor: isExcluded ? 'rgba(239,68,68,0.3)' : selectedUsedOn === opt.value ? `${opt.color}50` : '#243654'
                                        }}
                                    >
                                        <span className="text-sm leading-none">{isExcluded ? '✖' : <opt.Icon className="w-3.5 h-3.5" />}</span>
                                        <span className="truncate w-full text-center leading-tight">{opt.label}</span>
                                        <span className={`text-xs font-bold leading-none ${selectedUsedOn === opt.value ? '' : 'text-app-text-muted'}`}>
                                            {getUsedOnCount(opt.value, usedOnCounts[opt.value])}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Usage Filter for Categories/Tags tab */}
                {(activeTab === 'categories' || activeTab === 'tags') && (() => {
                    const isCat = activeTab === 'categories';
                    const usageFilter = isCat ? usageFilterCategories : usageFilterTags;
                    const setUsageFilter = isCat ? setUsageFilterCategories : setUsageFilterTags;
                    const neededFilter = isCat ? neededFilterCategories : neededFilterTags;
                    const setNeededFilter = isCat ? setNeededFilterCategories : setNeededFilterTags;
                    const USAGE_ICONS = { all: ListBulletIcon, used: CheckCircleIcon, unused: BanIcon };
                    const items = [
                        { key: 'all', label: isCat ? 'All Categories' : 'All Tags' },
                        { key: 'used', label: 'Used in Sites' },
                        { key: 'unused', label: 'Not Used' }
                    ];
                    return (
                        <div className="p-3 sm:p-4">
                            <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FilterIcon className="w-3.5 h-3.5" />
                                Usage Filter
                            </h3>
                            <div className="space-y-1">
                                {items.map(f => {
                                    const Icon = USAGE_ICONS[f.key];
                                    return (
                                        <button key={f.key} onClick={() => setUsageFilter(f.key)}
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${usageFilter === f.key
                                                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                                : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                                }`}>
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-3.5 h-3.5" />
                                                {f.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {usageFilter !== 'all' && (
                                <button onClick={() => setUsageFilter('all')}
                                    className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                                    <CloseIcon className="w-3 h-3" />
                                    Reset Filter
                                </button>
                            )}

                            <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                                <FilterIcon className="w-3.5 h-3.5" />
                                Needed Filter
                            </h3>
                            <div className="space-y-1">
                                {[
                                    { key: 'all', label: isCat ? 'All Categories' : 'All Tags', icon: ListBulletIcon },
                                    { key: 'needed', label: 'Needed', icon: CheckCircleIcon },
                                    { key: 'not_needed', label: 'Not needed', icon: BanIcon }
                                ].map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => setNeededFilter(item.key)}
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${neededFilter === item.key
                                                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                                : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-3.5 h-3.5" />
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {neededFilter !== 'all' && (
                                <button onClick={() => setNeededFilter('all')}
                                    className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                                    <CloseIcon className="w-3 h-3" />
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    );
                })()}

                {/* Note Groups Section — only on Notes tab */}
                {activeTab === 'notes' && (
                    <NoteGroupsSection
                        noteGroups={noteGroups}
                        addNoteGroup={addNoteGroup}
                        updateNoteGroup={updateNoteGroup}
                        onDeleteGroup={setNoteGroupToDelete}
                    />
                )}
            </aside>

            <GroupModal
                key={groupModalOpen ? (editingGroup?.key || 'new') : 'closed'}
                isOpen={groupModalOpen}
                onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }}
                categories={categories}
                editGroup={editingGroup}
                onSave={(group) => {
                    handleSaveGroup(group);
                    setGroupModalOpen(false);
                    setEditingGroup(null);
                }}
            />

            <ConfirmModal
                isOpen={!!noteGroupToDelete}
                onClose={() => setNoteGroupToDelete(null)}
                onConfirm={async () => {
                    if ((noteGroupToDelete?.note_count || 0) > 0) {
                        setNoteGroupToDelete(null);
                        return;
                    }
                    setDeletingNoteGroup(true);
                    try { await deleteNoteGroup(noteGroupToDelete.id); } catch { }
                    setDeletingNoteGroup(false);
                    setNoteGroupToDelete(null);
                }}
                title="Delete Group"
                message={
                    (noteGroupToDelete?.note_count || 0) > 0
                        ? `Cannot delete "${noteGroupToDelete?.name}" because it has ${noteGroupToDelete?.note_count} note${noteGroupToDelete?.note_count !== 1 ? 's' : ''}. Move or remove all notes from this group first.`
                        : `Are you sure you want to delete "${noteGroupToDelete?.name}"? This action cannot be undone.`
                }
                confirmText={(noteGroupToDelete?.note_count || 0) > 0 ? 'OK' : 'Delete'}
                cancelText={(noteGroupToDelete?.note_count || 0) > 0 ? null : 'Cancel'}
                variant="danger"
                loading={deletingNoteGroup}
            />
        </>
    );
}
