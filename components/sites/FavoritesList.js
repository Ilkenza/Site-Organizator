import { useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import SiteCard from './SiteCard';
import Pagination from '../ui/Pagination';
import { StarIcon, SearchIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';

export default function FavoritesList({ onEdit, onDelete }) {
    const {
        filteredSites,
        loading,
        currentPage,
        totalPages,
        totalSitesCount,
        fetchSitesPage,
        SITES_PAGE_SIZE
    } = useDashboard();

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

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-app-bg-light/50 rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-gray-700 rounded w-full mb-2" />
                        <div className="h-4 bg-gray-700 rounded w-2/3" />
                    </div>
                ))}
            </div>
        );
    }

    if (filteredSites.length === 0 && totalSitesCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-app-bg-light flex items-center justify-center mb-3 sm:mb-4">
                    <StarIcon className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No favorite sites yet</h3>
                <p className="text-sm sm:text-base text-app-text-secondary text-center max-w-md">
                    Click the star icon on any site to add it to your favorites. Your favorite sites will appear here.
                </p>
            </div>
        );
    }

    if (filteredSites.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-app-bg-light flex items-center justify-center mb-3 sm:mb-4">
                    <SearchIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">No favorite sites found</h3>
                <p className="text-sm sm:text-base text-app-text-secondary text-center max-w-md">
                    Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Results count */}
            {totalSitesCount > 0 && (
                <div className="px-3 sm:px-6 pt-3 sm:pt-4 text-sm text-app-text-secondary">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalSitesCount)} of {totalSitesCount} favorite sites
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
                {filteredSites.map((site, index) => (
                    <SiteCard
                        key={site.id || `site-${index}`}
                        site={site}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onVisit={handleVisitSite}
                    />
                ))}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
        </div>
    );
}
