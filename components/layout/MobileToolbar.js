import { useDashboard } from '../../context/DashboardContext';


export default function MobileToolbar({ onAddClick }) {
    const { activeTab, searchQuery, setSearchQuery } = useDashboard();

    // Don't show on settings tab or desktop
    if (activeTab === 'settings') return null;

    const getAddButtonText = () => {
        switch (activeTab) {
            case 'sites':
            case 'favorites':
                return 'Add Site';
            case 'categories':
                return 'Add Category';
            case 'tags':
                return 'Add Tag';
            default:
                return 'Add';
        }
    };

    const getPlaceholder = () => {
        switch (activeTab) {
            case 'sites':
                return 'Search sites...';
            case 'favorites':
                return 'Search favorites...';
            case 'categories':
                return 'Search categories...';
            case 'tags':
                return 'Search tags...';
            default:
                return 'Search...';
        }
    };

    return (
        <div className="md:hidden px-3 py-3 bg-app-bg-secondary border-b border-app-border">
            <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative flex-1" data-tour="mobile-search">
                    <svg
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-text-tertiary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    <input
                        type="text"
                        placeholder={getPlaceholder()}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary text-sm placeholder-app-text-tertiary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-tertiary hover:text-app-text-primary transition-colors"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Add Button - Icon only on mobile */}
                <button
                    onClick={onAddClick}
                    data-tour="mobile-add-button"
                    className="flex-shrink-0 p-2.5 bg-app-accent hover:bg-app-accentLight text-app-bg-primary rounded-lg transition-colors shadow-sm"
                    title={getAddButtonText()}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
