import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDashboard } from '../../context/DashboardContext';
import { CollectionIcon, CloseIcon, GlobeIcon, FolderIcon, TagIcon, StarIcon, SettingsIcon, PinSimpleIcon, UploadIcon, ChevronDownIcon, PlusIcon, BookmarkIcon, TextLinesIcon, DocumentIcon, FilterIcon, ListBulletIcon, CheckCircleIcon, BanIcon } from '../ui/Icons';

export default function Sidebar({
    isOpen = false,
    onClose,
    excludedCategoryIds,
    setExcludedCategoryIds,
    excludedTagIds,
    setExcludedTagIds,
    excludedImportSources,
    setExcludedImportSources
}) {
    // Ensure all excluded sets are Set instances (memoized to avoid re-creating on every render)
    const catSet = useMemo(() => excludedCategoryIds instanceof Set ? excludedCategoryIds : new Set(excludedCategoryIds || []), [excludedCategoryIds]);
    const tagSet = useMemo(() => excludedTagIds instanceof Set ? excludedTagIds : new Set(excludedTagIds || []), [excludedTagIds]);
    const srcSet = useMemo(() => excludedImportSources instanceof Set ? excludedImportSources : new Set(excludedImportSources || []), [excludedImportSources]);
    const router = useRouter();
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
        usageFilterCategories,
        setUsageFilterCategories,
        usageFilterTags,
        setUsageFilterTags,
        neededFilterSites,
        setNeededFilterSites,
        neededFilterCategories,
        setNeededFilterCategories,
        neededFilterTags,
        setNeededFilterTags
    } = useDashboard();

    const [categoriesSearchQuery, setCategoriesSearchQuery] = useState('');
    const [tagsSearchQuery, setTagsSearchQuery] = useState('');
    const [isImportSourceOpen, setIsImportSourceOpen] = useState(false);
    // Exclude mode (local only) — single toggle for all filter types
    const [excludeMode, setExcludeMode] = useState(false);

    // Counts from API (loaded with categories/tags)
    const favoriteCount = stats.favorites || 0;
    const uncategorizedCount = stats.uncategorized || 0;
    const untaggedCount = stats.untagged || 0;

    // Whether any site filter is active (including exclusions)
    const hasExclusions = catSet.size > 0 || tagSet.size > 0 || srcSet.size > 0;
    const totalExcluded = catSet.size + tagSet.size + srcSet.size;
    const hasServerFilter = selectedCategory || selectedTag || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all');
    // Compute visible sites after exclusions (all sites loaded via fetchAllSites when exclusions active)
    const visibleSites = useMemo(() => {
        if (!hasExclusions) return sites;
        return sites.filter(site => {
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
            return true;
        });
    }, [sites, catSet, tagSet, srcSet, hasExclusions]);

    // Per-filter counts from visible sites (after exclusions)
    const visibleCounts = useMemo(() => {
        if (!hasExclusions) return null;
        const cats = {}, tgs = {};
        const srcs = { manual: 0, bookmarks: 0, notion: 0, file: 0 };
        let uncategorized = 0, untagged = 0, needed = 0, notNeeded = 0;
        visibleSites.forEach(site => {
            const catIds = (site.categories_array || []).map(c => c?.id).filter(Boolean);
            if (catIds.length === 0) uncategorized++;
            catIds.forEach(id => { cats[id] = (cats[id] || 0) + 1; });
            const tagIds = (site.tags_array || []).map(t => t?.id).filter(Boolean);
            if (tagIds.length === 0) untagged++;
            tagIds.forEach(id => { tgs[id] = (tgs[id] || 0) + 1; });
            const src = site.import_source || 'manual';
            if (srcs[src] !== undefined) srcs[src]++;
            if (site.is_needed) needed++; else notNeeded++;
        });
        return { categories: cats, tags: tgs, importSources: srcs, uncategorized, untagged, needed, notNeeded, total: visibleSites.length };
    }, [visibleSites, hasExclusions]);

    // Sites tab count: show "visible / total" when any filter is active
    const sitesTabCount = hasExclusions
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
    const hasOtherCategoryFilter = selectedTag || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all');
    const hasOtherTagFilter = selectedCategory || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all');

    const getCategoryCount = (catId, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = catId === 'uncategorized' ? visibleCounts.uncategorized : (visibleCounts.categories[catId] || 0);
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherCategoryFilter) return ownCount;
        const crossCount = crossFilterCounts.categories[catId] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const getTagCount = (tagId, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = tagId === 'untagged' ? visibleCounts.untagged : (visibleCounts.tags[tagId] || 0);
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherTagFilter) return ownCount;
        const crossCount = crossFilterCounts.tags[tagId] ?? 0;
        return `${crossCount} / ${ownCount}`;
    };

    const hasOtherImportSourceFilter = selectedCategory || selectedTag || (neededFilterSites && neededFilterSites !== 'all');

    const getImportSourceCount = (sourceKey, ownCount) => {
        if (hasExclusions && visibleCounts) {
            const vc = visibleCounts.importSources[sourceKey] || 0;
            return `${vc} / ${ownCount}`;
        }
        if (!hasOtherImportSourceFilter) return ownCount;
        const crossCount = crossFilterCounts.importSources?.[sourceKey] ?? 0;
        return `${crossCount} / ${ownCount}`;
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
                                settings: (
                                    <SettingsIcon className="w-4 h-4" />
                                )
                            };

                            return (
                                <button
                                    key={tab.id}
                                    data-tour={`${tab.id}-tab`}
                                    onClick={() => {
                                        // Build URL based on tab
                                        const url = tab.id === 'settings' || tab.id === 'favorites'
                                            ? `/dashboard/${tab.id}`
                                            : `/dashboard/${tab.id}?page=1`;

                                        router.push(url, undefined, { shallow: true });

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

                                        setActiveTab(tab.id);
                                        setSelectedCategory(null);
                                        setSelectedTag(null);
                                        setNeededFilterSites('all');
                                        setSelectedImportSource(null);
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
                {activeTab !== 'settings' && (
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
                        {(selectedCategory || selectedTag || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all') || hasExclusions) && (
                            <button
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setSelectedTag(null);
                                    setSelectedImportSource(null);
                                    setNeededFilterSites('all');
                                    setExcludedCategoryIds(new Set());
                                    setExcludedTagIds(new Set());
                                    setExcludedImportSources(new Set());
                                    setExcludeMode(false);
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

                        {/* Categories */}
                        <div className="flex items-center gap-2 mb-3">
                            <FolderIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Filter by Category</span>
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
                                .filter(cat => cat?.name?.toLowerCase().includes(categoriesSearchQuery.toLowerCase()))
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
                            </h3>
                            <div className="space-y-1">
                                {[
                                    { key: 'all', label: 'All Sites', icon: ListBulletIcon },
                                    { key: 'needed', label: 'Needed', icon: CheckCircleIcon },
                                    { key: 'not_needed', label: 'Not needed', icon: BanIcon }
                                ].map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => setNeededFilterSites(item.key)}
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${neededFilterSites === item.key
                                                ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                                : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-3.5 h-3.5" />
                                                {item.label}
                                            </span>
                                            {hasExclusions && visibleCounts && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${neededFilterSites === item.key
                                                    ? 'bg-app-accent/30 text-app-accent'
                                                    : 'bg-app-bg-light text-app-text-muted'
                                                    }`}>
                                                    {item.key === 'all' ? visibleCounts.total : item.key === 'needed' ? visibleCounts.needed : visibleCounts.notNeeded}
                                                </span>
                                            )}
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
            </aside>
        </>
    );
}
