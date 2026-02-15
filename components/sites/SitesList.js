import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import SiteCard from './SiteCard';
import CategoryColorIndicator from '../layout/CategoryColorIndicator';
import Pagination from '../ui/Pagination';
import { SearchIcon, GlobeIcon } from '../ui/Icons';
import { fetchAPI } from '../../lib/supabase';

const RENDER_DELAY_MS = 500;

export default function SitesList({ onEdit, onDelete, excludedCategoryIds = new Set(), excludedTagIds = new Set(), excludedImportSources = new Set() }) {
    const {
        filteredSites: rawFilteredSites, loading, searchQuery, selectedCategory, selectedTag, categories,
        currentPage, totalPages, totalSitesCount, fetchSitesPage, fetchAllSites, SITES_PAGE_SIZE,
        selectedImportSource, neededFilterSites, initialDataLoaded
    } = useDashboard();

    // Client-side exclusion filter — sites use categories_array/tags_array (objects with .id)
    const hasExclusions = excludedCategoryIds.size > 0 || excludedTagIds.size > 0 || excludedImportSources.size > 0;

    // When exclusions become active, fetch ALL sites so client-side filtering works on the full dataset
    const prevHadExclusions = useRef(false);
    useEffect(() => {
        if (hasExclusions && !prevHadExclusions.current) {
            fetchAllSites();
        } else if (!hasExclusions && prevHadExclusions.current) {
            // Exclusions cleared — go back to paginated mode
            fetchSitesPage(1);
        }
        prevHadExclusions.current = hasExclusions;
    }, [hasExclusions, fetchAllSites, fetchSitesPage]);

    const allFilteredSites = useMemo(() => {
        if (!hasExclusions) return rawFilteredSites;
        return rawFilteredSites.filter(site => {
            if (excludedCategoryIds.size > 0) {
                if (excludedCategoryIds.has('all')) return false;
                const catIds = (site.categories_array || []).map(c => c?.id).filter(Boolean);
                if (excludedCategoryIds.has('uncategorized') && catIds.length === 0) return false;
                if (catIds.some(id => excludedCategoryIds.has(id))) return false;
            }
            if (excludedTagIds.size > 0) {
                if (excludedTagIds.has('all')) return false;
                const tIds = (site.tags_array || []).map(t => t?.id).filter(Boolean);
                if (excludedTagIds.has('untagged') && tIds.length === 0) return false;
                if (tIds.some(id => excludedTagIds.has(id))) return false;
            }
            if (excludedImportSources.size > 0) {
                if (excludedImportSources.has('all')) return false;
                const src = site.import_source || 'manual';
                if (excludedImportSources.has(src)) return false;
            }
            return true;
        });
    }, [rawFilteredSites, excludedCategoryIds, excludedTagIds, excludedImportSources, hasExclusions]);

    // Client-side pagination when exclusions are active
    const [excludePage, setExcludePage] = useState(1);
    // Reset client page when exclusions change
    useEffect(() => { setExcludePage(1); }, [excludedCategoryIds, excludedTagIds, excludedImportSources]);

    const excludeTotalPages = Math.ceil(allFilteredSites.length / SITES_PAGE_SIZE) || 1;
    const filteredSites = hasExclusions
        ? allFilteredSites.slice((excludePage - 1) * SITES_PAGE_SIZE, excludePage * SITES_PAGE_SIZE)
        : allFilteredSites;

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
    const startIndex = hasExclusions
        ? (excludePage - 1) * SITES_PAGE_SIZE
        : (currentPage - 1) * SITES_PAGE_SIZE;
    const endIndex = startIndex + filteredSites.length;

    // Track site click for Rediscover (fire & forget)
    const handleVisitSite = useCallback((siteId) => {
        fetchAPI('/rediscover', { method: 'POST', body: JSON.stringify({ siteId }) }).catch(() => { });
    }, []);

    // Handle page change — server-side or client-side depending on exclusions
    const handlePageChange = (newPage) => {
        if (hasExclusions) {
            if (newPage >= 1 && newPage <= excludeTotalPages) {
                setExcludePage(newPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            if (newPage >= 1 && newPage <= totalPages) {
                fetchSitesPage(newPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };

    if (loading || (!showSites && filteredSites.length > 0) || (!initialDataLoaded && filteredSites.length === 0)) {
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
        const hasFilters = searchQuery || selectedCategory || selectedTag || selectedImportSource || (neededFilterSites && neededFilterSites !== 'all') || hasExclusions;

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

    const displayTotal = hasExclusions ? allFilteredSites.length : totalSitesCount;
    const displayTotalPages = hasExclusions ? excludeTotalPages : totalPages;
    const displayCurrentPage = hasExclusions ? excludePage : currentPage;

    return (
        <div>
            {/* Results count */}
            {displayTotal > 0 && (
                <div className="px-3 sm:px-6 pt-3 sm:pt-4 flex items-center gap-3 text-sm text-app-text-secondary">
                    {hasExclusions
                        ? <span>Showing {startIndex + 1}-{Math.min(endIndex, displayTotal)} of {displayTotal} sites ({rawFilteredSites.length - allFilteredSites.length} excluded)</span>
                        : <span>Showing {startIndex + 1}-{Math.min(endIndex, displayTotal)} of {displayTotal} sites</span>
                    }
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

            {/* Pagination — client-side when exclusions active, server-side otherwise */}
            <Pagination
                currentPage={displayCurrentPage}
                totalPages={displayTotalPages}
                onPageChange={handlePageChange}
            />

            {selectedCategory && <CategoryColorIndicator category={categories.find(c => c.id === selectedCategory)} />}
        </div>
    );
}
