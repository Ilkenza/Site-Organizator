import { useDashboard } from '../../context/DashboardContext';
import { SearchIcon, PlusIcon } from '../ui/Icons';


export default function MobileToolbar({ onAddClick }) {
    const { activeTab, searchInput, handleSearchInput, clearSearch } = useDashboard();

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
                    <SearchIcon
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-text-tertiary"
                    />
                    <input
                        type="text"
                        placeholder={getPlaceholder()}
                        value={searchInput}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary text-sm placeholder-app-text-tertiary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    {searchInput && (
                        <button
                            onClick={() => clearSearch()}
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
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
