import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDashboard } from '../../context/DashboardContext';
import SiteCard from './SiteCard';
import CategoryColorIndicator from '../layout/CategoryColorIndicator';
import Pagination from '../ui/Pagination';

const ITEMS_PER_PAGE = 30;

export default function SitesList({ onEdit, onDelete }) {
    const router = useRouter();
    const { filteredSites, loading, searchQuery, selectedCategory, selectedTag, categories } = useDashboard();

    // Get current page from URL or default to 1
    const currentPage = parseInt(router.query.page) || 1;

    // Calculate pagination
    const totalItems = filteredSites.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedSites = filteredSites.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        if (currentPage > 1 && (searchQuery || selectedCategory || selectedTag)) {
            router.push({
                pathname: router.pathname,
                query: { ...router.query, page: 1 }
            }, undefined, { shallow: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, selectedCategory, selectedTag]);

    // Handle page change
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            router.push({
                pathname: router.pathname,
                query: { ...router.query, page: newPage }
            }, undefined, { shallow: true });
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (loading) {
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
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
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
            {totalItems > 0 && (
                <div className="px-3 sm:px-6 pt-3 sm:pt-4 text-sm text-app-text-secondary">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} sites
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
                {paginatedSites.map((site, index) => (
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

            {selectedCategory && <CategoryColorIndicator category={categories.find(c => c.id === selectedCategory)} />}
        </div>
    );
}
