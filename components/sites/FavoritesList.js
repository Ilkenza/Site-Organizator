import { useDashboard } from '../../context/DashboardContext';
import SiteCard from './SiteCard';
import Pagination from '../ui/Pagination';

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
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
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
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
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
