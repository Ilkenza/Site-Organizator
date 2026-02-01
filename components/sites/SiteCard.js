import { useState } from 'react';
import Badge from '../ui/Badge';
import InlineEditableName from '../categories/InlineEditableName';
import { useDashboard } from '../../context/DashboardContext';

export default function SiteCard({ site, onEdit, onDelete, onVisit }) {
    const [imageError, setImageError] = useState(false);
    const [favoriteAnimating, setFavoriteAnimating] = useState(false);
    const [pinAnimating, setPinAnimating] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllTags, setShowAllTags] = useState(false);
    const { selectedSites, setSelectedSites, multiSelectMode, toggleFavorite, togglePinned, activeTab, updateSite } = useDashboard();

    // Support multiple possible field names from API
    const categories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
    const tags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('sr-RS', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getFaviconUrl = (url) => {
        try {
            const urlObj = new URL(url);
            // Skip localhost and invalid domains
            if (urlObj.hostname === 'localhost' || !urlObj.hostname.includes('.')) {
                return null;
            }
            return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
        } catch {
            return null;
        }
    };

    const handleVisit = () => {
        window.open(site.url, '_blank');
        onVisit?.(site.id);
    };

    const handleSelectSite = (e) => {
        e.stopPropagation();
        const newSelected = new Set(selectedSites);
        if (newSelected.has(site.id)) {
            newSelected.delete(site.id);
        } else {
            newSelected.add(site.id);
        }
        setSelectedSites(newSelected);
    };

    return (
        <div className={`group bg-app-bg-light/50 border-2 rounded-xl p-3 sm:p-4 transition-all duration-200 hover:shadow-lg hover:shadow-app-accent/5 ${selectedSites.has(site.id)
            ? activeTab === 'favorites'
                ? 'border-[#D4B86A] bg-[#D4B86A]/10'
                : 'border-[#A0D8FF] bg-[#A0D8FF]/10'
            : site.is_pinned
                ? 'border-[#6CBBFB] bg-[#6CBBFB]/5 hover:border-[#6CBBFB] hover:bg-[#6CBBFB]/10'
                : 'border-app-border hover:border-app-accent/30 hover:bg-app-bg-light'
            }`}>
            {/* Header: Checkbox, Icon, Name, Actions */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                {/* Checkbox - visible only in multi-select mode */}
                {multiSelectMode && (
                    <div className="relative flex-shrink-0">
                        <input
                            type="checkbox"
                            checked={selectedSites.has(site.id)}
                            onChange={handleSelectSite}
                            className="peer w-5 h-5 rounded border-2 border-app-border bg-app-bg-secondary cursor-pointer appearance-none checked:bg-app-accent checked:border-app-accent hover:border-app-accent/70 transition-all duration-200 mt-0.5"
                            title="Select site for bulk actions"
                        />
                        <svg className="absolute top-1 left-0.5 w-4 h-4 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}

                {/* Favicon - larger and centered on mobile */}
                <div className="flex-shrink-0 w-14 h-14 sm:w-10 sm:h-10 rounded-xl sm:rounded-lg bg-app-bg-card flex items-center justify-center overflow-hidden transition-colors duration-200 group-hover:bg-app-accent/10">
                    {site.url && !imageError ? (
                        <img
                            src={getFaviconUrl(site.url)}
                            alt=""
                            className="w-8 h-8 sm:w-6 sm:h-6 transition-transform"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <svg className="w-5 h-5 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    )}
                </div>

                {/* Title and URL - centered on mobile, left-aligned on desktop */}
                <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                    {editingName ? (
                        <InlineEditableName
                            value={site.name || 'Untitled'}
                            onSave={async (newName) => {
                                await updateSite(site.id, { name: newName });
                                setEditingName(false);
                            }}
                            onCancel={() => setEditingName(false)}
                            className="text-sm sm:text-base"
                        />
                    ) : (
                        <h3
                            className="font-semibold text-sm sm:text-base text-app-text-primary truncate group-hover:text-app-accent transition-colors cursor-text border border-transparent px-1 py-0"
                            onDoubleClick={() => setEditingName(true)}
                            title="Double-click to edit"
                        >
                            {site.name || 'Untitled'}
                        </h3>
                    )}
                    <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm text-app-text-secondary hover:text-app-accent truncate block"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {site.url}
                    </a>
                </div>

                {/* Favorite and Pin Icons - Side by Side */}
                {activeTab !== 'settings' && (
                    <div className="flex items-center gap-1 flex-shrink-0 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        {/* Favorite Star */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setFavoriteAnimating(true);
                                setTimeout(() => setFavoriteAnimating(false), 600);
                                toggleFavorite(site.id);
                            }}
                            className={`p-1 sm:p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${favoriteAnimating ? '-translate-y-px' : ''} ${site.is_favorite
                                ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10'
                                : 'text-app-text-secondary hover:text-yellow-400 hover:bg-yellow-400/10'
                                }`}
                            title={site.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <div className="relative">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill={site.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                                    <polygon points="12 2 15.09 10.26 23 10.26 17 16 19.09 24 12 18.9 4.91 24 7 16 1 10.26 8.91 10.26 12 2" />
                                </svg>
                                {favoriteAnimating && site.is_favorite && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                                            <polygon points="12 2 15.09 10.26 23 10.26 17 16 19.09 24 12 18.9 4.91 24 7 16 1 10.26 8.91 10.26 12 2" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </button>

                        {/* Pin Icon - Push Pin */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPinAnimating(true);
                                setTimeout(() => {
                                    setPinAnimating(false);
                                    togglePinned(site.id);
                                }, 500);
                            }}
                            className={`p-1 sm:p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 ${pinAnimating ? '-translate-y-px' : ''} ${site.is_pinned
                                ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-400/10'
                                : 'text-app-text-secondary hover:text-purple-400 hover:bg-purple-400/10'
                                }`}
                            title={site.is_pinned ? 'Unpin site' : 'Pin site'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                                <path d="m640-480 80 80v80H520v240l-40 40-40-40v-240H240v-80l80-80v-280h-40v-80h400v80h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Actions - visible on mobile, hover on tablet+ */}
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                        onClick={handleVisit}
                        className="p-1.5 text-app-text-secondary hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
                        title="Visit site"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onEdit(site)}
                        className="p-1.5 text-app-text-secondary hover:text-app-accent hover:bg-app-accent/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-app-accent"
                        title="Edit"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(site)}
                        className="p-1.5 text-app-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                        title="Delete"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Description */}
            {site.description && (
                <p className="text-xs sm:text-sm text-app-text-secondary line-clamp-2 mb-2 sm:mb-3">
                    {site.description}
                </p>
            )}

            {/* Categories and Tags */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                {(showAllCategories ? categories : categories.slice(0, 6)).map((cat, index) => (
                    <Badge key={`cat-${cat.id || index}`} color={cat.color || 'blue'} size="xs" variant="category">
                        {cat.name}
                    </Badge>
                ))}
                {categories.length > 6 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAllCategories(!showAllCategories);
                        }}
                        className="px-2 py-0.5 text-[10px] sm:text-xs font-medium text-app-accent hover:text-app-accent/80 bg-app-accent/10 hover:bg-app-accent/20 rounded-full transition-colors"
                    >
                        {showAllCategories ? '−' : `+${categories.length - 6}`}
                    </button>
                )}
                {categories.length > 0 && tags.length > 0 && (
                    <span className="text-app-text-muted/40 px-1 self-center">|</span>
                )}
                {(showAllTags ? tags : tags.slice(0, 6)).map((tag, index) => (
                    <Badge key={`tag-${tag.id || index}`} color={tag.color || '#5B8DEE'} size="xs" variant="tag">
                        {tag.name}
                    </Badge>
                ))}
                {tags.length > 6 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAllTags(!showAllTags);
                        }}
                        className="px-2 py-0.5 text-[10px] sm:text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-full transition-colors"
                    >
                        {showAllTags ? '−' : `+${tags.length - 6}`}
                    </button>
                )}
            </div>

            {/* Footer: Pricing and Date */}
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-app-text-secondary pt-2 sm:pt-3 border-t border-app-border/50">
                {/* Pricing */}
                <span className={`px-2 py-0.5 rounded-full font-medium ${site.pricing === 'fully_free' ? 'bg-green-950 text-emerald-300' :
                    site.pricing === 'freemium' ? 'bg-amber-900 text-amber-300' :
                        site.pricing === 'free_trial' ? 'bg-blue-950 text-blue-300' :
                            site.pricing === 'paid' ? 'bg-red-950 text-red-200' :
                                'bg-gray-700 text-gray-400'
                    }`}>
                    {site.pricing === 'fully_free' ? '✓ Free' :
                        site.pricing === 'freemium' ? '◐ Freemium' :
                            site.pricing === 'free_trial' ? '⏱ Free Trial' :
                                site.pricing === 'paid' ? '$ Paid' :
                                    'Unknown'}
                </span>

                {/* Date */}
                <span>{formatDate(site.created_at)}</span>
            </div>
        </div>
    );
}
