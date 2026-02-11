/** @deprecated UNUSED — Sidebar.js has its own inline sort UI. Safe to delete. */
import { useState, useEffect, useRef } from 'react';
import { FilterIcon, ChevronDownIcon } from './Icons';

export default function SortButton({ sortBy, setSortBy, sortOrder, setSortOrder, options = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Click-outside and Escape key handlers
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-sm text-app-text-secondary hover:bg-app-bg-hover hover:text-app-text-primary transition-colors"
                title="Sort options"
            >
                <FilterIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Sort</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
