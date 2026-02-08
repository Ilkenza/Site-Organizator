import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDashboard } from '../../context/DashboardContext';

export default function Sidebar({ isOpen = false, onClose }) {
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
        setSortOrderTags
    } = useDashboard();

    const [categoriesSearchQuery, setCategoriesSearchQuery] = useState('');
    const [tagsSearchQuery, setTagsSearchQuery] = useState('');
    const [isImportSourceOpen, setIsImportSourceOpen] = useState(false);

    // Counts from API (loaded with categories/tags)
    const favoriteCount = stats.favorites || 0;
    const uncategorizedCount = stats.uncategorized || 0;
    const untaggedCount = stats.untagged || 0;

    // Whether any site filter is active
    const hasActiveFilter = selectedCategory || selectedTag || selectedImportSource;

    // Sites tab count: show "filtered / total" when a filter is active
    const sitesTabCount = hasActiveFilter
        ? `${totalSitesCount} / ${stats.sites}`
        : stats.sites;

    // Logo always goes to Sites page
    const buildDashboardUrl = () => {
        return '/dashboard/sites';
    };

    // Import source counts — computed from ALL localStorage entries (not just current page)
    const importSourceCounts = useMemo(() => {
        const counts = { bookmarks: 0, notion: 0, file: 0, manual: 0 };
        try {
            const importSources = JSON.parse(localStorage.getItem('import_sources') || '{}');
            Object.values(importSources).forEach(source => {
                if (source && Object.prototype.hasOwnProperty.call(counts, source)) {
                    counts[source]++;
                }
            });
            // Manual = total sites minus all sites with a recorded import source
            const totalImported = counts.bookmarks + counts.notion + counts.file;
            counts.manual = Math.max(0, (stats.sites || 0) - totalImported);
        } catch (e) {
            console.warn('Failed to parse import sources:', e);
        }
        return counts;
    }, [stats.sites]);

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
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </span>
                        Site Organizer
                    </Link>
                    {/* Mobile Close Button */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light transition-colors"
                        aria-label="Close sidebar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                ),
                                categories: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                ),
                                tags: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                ),
                                favorites: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                ),
                                settings: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
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

                            {/* Sort By for Categories */}
                            {activeTab === 'categories' && (
                                <div className="mb-4">
                                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-400 mb-1.5 sm:mb-2">
                                        Sort By
                                    </label>
                                    <div className="flex gap-1.5 sm:gap-2">
                                        {[
                                            { label: 'Name', value: 'name' },
                                            { label: 'Created', value: 'created_at' }
                                        ].map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSortByCategories(option.value)}
                                                className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border"
                                                style={{
                                                    backgroundColor: sortByCategories === option.value ? '#2A5A8A' : '#1A2E4A',
                                                    color: sortByCategories === option.value ? '#8DD0FF' : '#4A7CA8',
                                                    borderColor: sortByCategories === option.value ? '#3A6A9A' : '#243654',
                                                    fontWeight: sortByCategories === option.value ? '600' : '500'
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sort By for Tags */}
                            {activeTab === 'tags' && (
                                <div className="mb-4">
                                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-400 mb-1.5 sm:mb-2">
                                        Sort By
                                    </label>
                                    <div className="flex gap-1.5 sm:gap-2">
                                        {[
                                            { label: 'Name', value: 'name' },
                                            { label: 'Created', value: 'created_at' }
                                        ].map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSortByTags(option.value)}
                                                className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border"
                                                style={{
                                                    backgroundColor: sortByTags === option.value ? '#2A5A8A' : '#1A2E4A',
                                                    color: sortByTags === option.value ? '#8DD0FF' : '#4A7CA8',
                                                    borderColor: sortByTags === option.value ? '#3A6A9A' : '#243654',
                                                    fontWeight: sortByTags === option.value ? '600' : '500'
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
                                </svg>
                                Pinned sites always appear first
                            </p>
                        )}
                    </div>
                )}

                {/* Categories Filter */}
                {(activeTab === 'sites' || activeTab === 'favorites') && (
                    <div className="p-3 sm:p-4 flex-1 overflow-y-auto  sm:max-h-none" data-tour="filters">
                        {/* Reset All Filters Button */}
                        {(selectedCategory || selectedTag || selectedImportSource) && (
                            <button
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setSelectedTag(null);
                                    setSelectedImportSource(null);
                                }}
                                className="w-full mb-4 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reset All Filters
                            </button>
                        )}

                        {/* Categories */}
                        <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Filter by Category
                        </h3>
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
                                onClick={() => setSelectedCategory(null)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-medium
                ${!selectedCategory
                                        ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light/50 hover:text-app-text-primary border border-transparent'
                                    }`}
                            >
                                All Categories
                            </button>
                            <button
                                onClick={() => setSelectedCategory('uncategorized')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                      ${selectedCategory === 'uncategorized'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                                        : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                    }`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0 bg-gray-500" />
                                <span className="truncate flex-1">Uncategorized</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedCategory === 'uncategorized'
                                    ? 'bg-amber-500/30 text-amber-400'
                                    : 'bg-app-bg-light text-app-text-muted group-hover:bg-amber-500/20 group-hover:text-amber-400'
                                    }`}>
                                    {uncategorizedCount}
                                </span>
                            </button>
                            {categories
                                .filter(cat => cat?.name?.toLowerCase().includes(categoriesSearchQuery.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(cat => {
                                    // Use site_count from API
                                    const siteCount = cat.site_count || 0;

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                      ${selectedCategory === cat.id
                                                    ? 'bg-app-accent/20 text-app-accent border border-app-accent/30 shadow-sm backdrop-blur-sm'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                                }`}
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
                                                {siteCount}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Tags Filter */}
                        <h3 className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Filter by Tag
                        </h3>
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
                                onClick={() => setSelectedTag(null)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-medium
                      ${!selectedTag
                                        ? 'bg-app-accent/20 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light/50 hover:text-app-text-primary border border-transparent'
                                    }`}
                            >
                                All Tags
                            </button>
                            <button
                                onClick={() => setSelectedTag('untagged')}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                      ${selectedTag === 'untagged'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                                        : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                    }`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0 bg-gray-500" />
                                <span className="truncate flex-1">Untagged</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedTag === 'untagged'
                                    ? 'bg-amber-500/30 text-amber-400'
                                    : 'bg-app-bg-light text-app-text-muted group-hover:bg-amber-500/20 group-hover:text-amber-400'
                                    }`}>
                                    {untaggedCount}
                                </span>
                            </button>
                            {tags
                                .filter(tag => tag?.name?.toLowerCase().includes(tagsSearchQuery.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(tag => {
                                    // Use site_count from API
                                    const siteCount = tag.site_count || 0;

                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group hover:scale-[1.01]
                      ${selectedTag === tag.id
                                                    ? 'bg-app-accent/20 text-app-accent border border-app-accent/30 shadow-sm backdrop-blur-sm'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary border border-transparent hover:shadow-md'
                                                }`}
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
                                                {siteCount}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Import Source Filter */}
                        <button
                            onClick={() => setIsImportSourceOpen(!isImportSourceOpen)}
                            className="w-full text-xs font-semibold text-app-text-tertiary uppercase tracking-wider mb-3 mt-6 flex items-center justify-between gap-2 hover:text-app-text-secondary transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Import Source
                            </span>
                            <svg
                                className={`w-4 h-4 transition-transform ${isImportSourceOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {isImportSourceOpen && (<>
                            <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                                <button
                                    onClick={() => setSelectedImportSource(null)}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${!selectedImportSource
                                        ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span>All Sources</span>
                                </button>
                                <button
                                    onClick={() => setSelectedImportSource('manual')}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${selectedImportSource === 'manual'
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span>Manual</span>
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedImportSource === 'manual'
                                        ? 'bg-green-500/30 text-green-400'
                                        : 'bg-app-bg-light text-app-text-muted'
                                        }`}>
                                        {importSourceCounts.manual}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setSelectedImportSource('bookmarks')}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${selectedImportSource === 'bookmarks'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                        </svg>
                                        <span>Bookmarks</span>
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedImportSource === 'bookmarks'
                                        ? 'bg-amber-500/30 text-amber-400'
                                        : 'bg-app-bg-light text-app-text-muted'
                                        }`}>
                                        {importSourceCounts.bookmarks}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setSelectedImportSource('notion')}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${selectedImportSource === 'notion'
                                        ? 'bg-app-accent/10 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
                                        </svg>
                                        <span>Notion</span>
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedImportSource === 'notion'
                                        ? 'bg-app-accent/30 text-app-accent'
                                        : 'bg-app-bg-light text-app-text-muted'
                                        }`}>
                                        {importSourceCounts.notion}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setSelectedImportSource('file')}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${selectedImportSource === 'file'
                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <span>File</span>
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedImportSource === 'file'
                                        ? 'bg-purple-500/30 text-purple-400'
                                        : 'bg-app-bg-light text-app-text-muted'
                                        }`}>
                                        {importSourceCounts.file}
                                    </span>
                                </button>
                            </div>
                            {/* Clear import source data if corrupted */}
                            {(importSourceCounts.bookmarks > 0 || importSourceCounts.notion > 0 || importSourceCounts.file > 0) && (
                                <button
                                    onClick={() => {
                                        if (confirm('This will mark all sites as manually added. Are you sure?')) {
                                            localStorage.removeItem('import_sources');
                                            setSelectedImportSource(null);
                                            window.location.reload();
                                        }
                                    }}
                                    className="w-full mt-2 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Reset import source data
                                </button>
                            )}
                        </>
                        )}
                    </div>
                )}
            </aside>
        </>
    );
}
