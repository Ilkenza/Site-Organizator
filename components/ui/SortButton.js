import { useState } from 'react';

export default function SortButton({ sortBy, setSortBy, sortOrder, setSortOrder, options = [] }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-sm text-app-text-secondary hover:bg-app-bg-hover hover:text-app-text-primary transition-colors"
                title="Sort options"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="hidden sm:inline text-xs">Sort</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-app-bg-primary border border-app-border rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-app-border">
                        <p className="text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">Sort By</p>
                    </div>

                    <div className="p-2">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    setSortBy(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${sortBy === option.value
                                        ? 'bg-app-accent/20 text-app-accent'
                                        : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-app-border p-2">
                        <button
                            onClick={() => {
                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary transition-colors"
                        >
                            <span>Order</span>
                            <span className="text-xs font-semibold">
                                {sortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
