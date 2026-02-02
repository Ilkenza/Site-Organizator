import { useEffect, useCallback } from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
    // Wrapper to scroll to top when changing pages
    const handlePageChange = useCallback((page) => {
        // Use instant scroll before navigation so it completes before page re-renders
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Also try scrolling the main content area if it exists
        const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
        if (mainContent) mainContent.scrollTop = 0;
        onPageChange(page);
    }, [onPageChange]);

    // Keyboard navigation for pagination
    useEffect(() => {

        const handleKeyDown = (e) => {
            // Ignore if user is typing in an input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Arrow Left - Previous page
            if (e.key === 'ArrowLeft' && currentPage > 1) {
                e.preventDefault();
                handlePageChange(currentPage - 1);
            }
            // Arrow Right - Next page
            else if (e.key === 'ArrowRight' && currentPage < totalPages) {
                e.preventDefault();
                handlePageChange(currentPage + 1);
            }
            // Home - First page
            else if (e.key === 'Home' && currentPage !== 1) {
                e.preventDefault();
                handlePageChange(1);
            }
            // End - Last page
            else if (e.key === 'End' && currentPage !== totalPages) {
                e.preventDefault();
                handlePageChange(totalPages);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages, handlePageChange]);

    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="flex items-center justify-center gap-2 py-4 px-4">
            {/* Previous Button */}
            <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${currentPage === 1
                        ? 'text-app-text-muted cursor-not-allowed'
                        : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'
                    }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
            </button>

            {/* First page + ellipsis */}
            {startPage > 1 && (
                <>
                    <button
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light transition-colors"
                    >
                        1
                    </button>
                    {startPage > 2 && (
                        <span className="text-app-text-muted">...</span>
                    )}
                </>
            )}

            {/* Page Numbers */}
            {pages.map(page => (
                <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${page === currentPage
                            ? 'bg-app-accent text-app-bg-primary'
                            : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'
                        }`}
                >
                    {page}
                </button>
            ))}

            {/* Last page + ellipsis */}
            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && (
                        <span className="text-app-text-muted">...</span>
                    )}
                    <button
                        onClick={() => handlePageChange(totalPages)}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light transition-colors"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            {/* Next Button */}
            <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${currentPage === totalPages
                        ? 'text-app-text-muted cursor-not-allowed'
                        : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'
                    }`}
            >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Page info */}
            <span className="ml-2 text-xs text-app-text-muted">
                Page {currentPage} of {totalPages}
            </span>
        </div>
    );
}
