import { useState, useEffect, useRef, useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import SiteCard from './SiteCard';
import CategoryColorIndicator from '../layout/CategoryColorIndicator';
import Pagination from '../ui/Pagination';
import { SearchIcon, GlobeIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';

const RENDER_DELAY_MS = 500;

export default function SitesList({ onEdit, onDelete }) {
    const {
        filteredSites, loading, searchQuery, selectedCategory, selectedTag, categories,
        currentPage, totalPages, totalSitesCount, fetchSitesPage, SITES_PAGE_SIZE
    } = useDashboard();

    // Delayed render: show skeleton briefly after sites data arrives
    const [showSites, setShowSites] = useState(false);
    const delayTimer = useRef(null);
    const prevPageRef = useRef(currentPage);

    useEffect(() => {
        // When data changes (page change, filter change), delay rendering
        if (!loading && filteredSites.length > 0) {
            // If it's the first load (already waited for loading), show immediately
            if (prevPageRef.current === currentPage && showSites) return;
            prevPageRef.current = currentPage;

            setShowSites(false);
            delayTimer.current = setTimeout(() => setShowSites(true), RENDER_DELAY_MS);
        } else if (!loading && filteredSites.length === 0) {
            setShowSites(true);
        }
        return () => { if (delayTimer.current) clearTimeout(delayTimer.current); };
    }, [loading, filteredSites, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Calculate display indices
    const startIndex = (currentPage - 1) * SITES_PAGE_SIZE;
    const endIndex = startIndex + filteredSites.length;

    // Track site click for Rediscover (fire & forget)
    const handleVisitSite = useCallback((siteId) => {
        fetchAPI('/rediscover', { method: 'POST', body: JSON.stringify({ siteId }) }).catch(() => { });
    }, []);

    // Handle page change — fetch new page from server
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchSitesPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (loading || (!showSites && filteredSites.length > 0)) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-app-bg-light/50 border border-app-border rounded-xl p-4 animate-pulse">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 bg-app-bg-secondary rounded-lg" />
                            <div className="flex-1">
                                <div className="h-5 bg-app-bg-secondary rounded w-3/4 mb-2" />
                                <div className="h-4 bg-app-bg-secondary rounded w-1/2" />
                            </div>
                        </div>
                        <div className="h-4 bg-app-bg-secondary rounded w-full mb-2" />
                        <div className="h-4 bg-app-bg-secondary rounded w-2/3" />
                    </div>
                ))}
            </div>
        );
    }

    if (filteredSites.length === 0) {
        const hasFilters = searchQuery || selectedCategory || selectedTag;

        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-app-bg-light flex items-center justify-center mb-4">
                    {hasFilters ? (
                        <SearchIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" strokeWidth={1.5} />
                    ) : (
                        <GlobeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" strokeWidth={1.5} />
                    )}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">
                    {hasFilters ? 'No sites found' : 'No sites yet'}
                </h3>
                <p className="text-app-text-secondary text-center max-w-md">
                    {hasFilters
                        ? 'Try adjusting your search or filters to find what you\'re looking for.'
                        : 'Add your first site to start organizing your bookmarks and favorite websites.'}
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Results count */}
            {totalSitesCount > 0 && (
                <div className="px-3 sm:px-6 pt-3 sm:pt-4 flex items-center gap-3 text-sm text-app-text-secondary">
                    <span>Showing {startIndex + 1}-{Math.min(endIndex, totalSitesCount)} of {totalSitesCount} sites</span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
                {filteredSites.map((site, index) => (
                    <div key={site.id || `site-${index}`} data-tour={index === 0 ? 'site-card' : undefined}>
                        <SiteCard
                            site={site}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onVisit={handleVisitSite}
                        />
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            {selectedCategory && <CategoryColorIndicator category={categories.find(c => c.id === selectedCategory)} />}
        </div>
    );
}
