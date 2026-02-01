import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';

export default function CommandMenu({ isOpen, onClose, onAction }) {
    const { sites, categories, tags, setActiveTab, setSearchQuery } = useDashboard();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    const commands = [
        {
            id: 'new-site',
            label: 'Add New Site',
            icon: '🌐',
            shortcut: 'N',
            action: () => onAction('new-site'),
            category: 'Actions'
        },
        {
            id: 'new-category',
            label: 'Create Category',
            icon: '📁',
            shortcut: 'C',
            action: () => onAction('new-category'),
            category: 'Actions'
        },
        {
            id: 'new-tag',
            label: 'Create Tag',
            icon: '🏷️',
            shortcut: 'T',
            action: () => onAction('new-tag'),
            category: 'Actions'
        },
        {
            id: 'goto-sites',
            label: 'Go to Sites',
            icon: '🏠',
            action: () => { setActiveTab('sites'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'goto-favorites',
            label: 'Go to Favorites',
            icon: '⭐',
            action: () => { setActiveTab('favorites'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'goto-categories',
            label: 'Go to Categories',
            icon: '📂',
            action: () => { setActiveTab('categories'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'goto-tags',
            label: 'Go to Tags',
            icon: '🔖',
            action: () => { setActiveTab('tags'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'goto-settings',
            label: 'Go to Settings',
            icon: '⚙️',
            action: () => { setActiveTab('settings'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'shortcuts-search',
            label: 'Search (Ctrl+K)',
            icon: '🔍',
            subtitle: 'Focus search input',
            shortcut: 'Ctrl+K',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-new-site',
            label: 'New Site (N)',
            icon: '🌐',
            subtitle: 'Quick add site',
            shortcut: 'N',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-multi-select',
            label: 'Multi-Select (M)',
            icon: '☑️',
            subtitle: 'Toggle selection mode',
            shortcut: 'M',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-select-all',
            label: 'Select All (Ctrl+A)',
            icon: '✅',
            subtitle: 'Select all items',
            shortcut: 'Ctrl+A',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-deselect',
            label: 'Deselect (Ctrl+D)',
            icon: '❌',
            subtitle: 'Clear selection',
            shortcut: 'Ctrl+D',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-cancel',
            label: 'Cancel (Esc)',
            icon: '⎋',
            subtitle: 'Close modals',
            shortcut: 'Esc',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-save',
            label: 'Save (Enter)',
            icon: '✓',
            subtitle: 'Confirm changes',
            shortcut: 'Enter',
            action: () => { },
            category: 'Keyboard Shortcuts'
        },
        {
            id: 'shortcuts-tip',
            label: 'Quick Shortcuts',
            icon: '⌨️',
            subtitle: 'Type command or use hotkeys N, C, T',
            action: () => { },
            category: 'Help'
        }
    ];

    // Add recent sites to quick access
    const recentSites = sites.slice(0, 5).map(site => ({
        id: `site-${site.id}`,
        label: site.name,
        icon: '🔗',
        subtitle: site.url,
        action: () => {
            window.open(site.url, '_blank');
            onClose();
        },
        category: 'Recent Sites'
    }));

    const allCommands = [...commands, ...recentSites];

    const filteredCommands = search.trim()
        ? allCommands.filter(cmd =>
            cmd.label.toLowerCase().includes(search.toLowerCase()) ||
            cmd.subtitle?.toLowerCase().includes(search.toLowerCase())
        )
        : allCommands;

    // Group by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {});

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setSearch('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                filteredCommands[selectedIndex]?.action();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, filteredCommands]);

    if (!isOpen) return null;

    let currentIndex = 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] animate-fadeIn" onClick={onClose}>
            <div
                className="bg-app-bg-light border border-app-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 animate-slideUp overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="p-4 border-b border-app-border">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type a command or search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-app-text-primary placeholder-app-text-muted text-sm"
                        />
                        <kbd className="px-2 py-1 text-xs bg-app-bg-light border border-app-border rounded">Esc</kbd>
                    </div>
                </div>

                {/* Commands List */}
                <div className="max-h-[400px] overflow-y-auto p-2">
                    {Object.keys(groupedCommands).length === 0 ? (
                        <div className="text-center py-8 text-app-text-muted text-sm">
                            No results found
                        </div>
                    ) : (
                        Object.entries(groupedCommands).map(([category, cmds]) => (
                            <div key={category} className="mb-4 last:mb-0">
                                <div className="px-3 py-1 text-xs font-semibold text-app-text-tertiary uppercase tracking-wider">
                                    {category}
                                </div>
                                <div className="space-y-1">
                                    {cmds.map((cmd) => {
                                        const itemIndex = currentIndex++;
                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={cmd.action}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${itemIndex === selectedIndex
                                                    ? 'bg-app-accent/20 text-app-accent'
                                                    : 'text-app-text-secondary hover:bg-app-bg-light hover:text-app-text-primary'
                                                    }`}
                                            >
                                                <span className="text-lg">{cmd.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium">{cmd.label}</div>
                                                    {cmd.subtitle && (
                                                        <div className="text-xs text-app-text-muted truncate">{cmd.subtitle}</div>
                                                    )}
                                                </div>
                                                {cmd.shortcut && (
                                                    <kbd className="px-2 py-1 text-xs bg-app-bg-light border border-app-border rounded">
                                                        {cmd.shortcut}
                                                    </kbd>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-app-border bg-app-bg-card/50 space-y-2">
                    {/* Navigation Shortcuts */}
                    <div className="flex items-center justify-between text-xs text-app-text-muted">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">↓</kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">↵</kbd>
                                Select
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">Esc</kbd>
                                Close
                            </span>
                        </div>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">Ctrl</kbd>
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded">/</kbd>
                            Toggle
                        </span>
                    </div>

                    {/* Global Shortcuts */}
                    <div className="flex items-center justify-between text-xs text-app-text-tertiary">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">Ctrl+K</kbd>
                                Search
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">N</kbd>
                                New Site
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">M</kbd>
                                Multi-Select
                            </span>
                        </div>
                    </div>

                    {/* Multi-Select Shortcuts */}
                    <div className="flex items-center gap-3 text-xs text-app-text-tertiary">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">Ctrl+A</kbd>
                            Select All
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">Ctrl+D</kbd>
                            Deselect
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">Enter</kbd>
                            Save
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-app-bg-card border border-app-border rounded text-[10px]">Esc</kbd>
                            Cancel
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
