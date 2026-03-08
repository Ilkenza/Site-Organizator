import { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Pagination from '../ui/Pagination';
import { ConfirmModal } from '../ui/Modal';
import { DocumentIcon, SearchIcon, EditIcon, TrashIcon, SpinnerIcon, PlusIcon, CloseIcon } from '../ui/Icons';

const ITEMS_PER_PAGE = 30;

export default function NotesList({ onEdit }) {
    const {
        notes,
        noteGroups,
        deleteNote,
        loading,
        searchQuery,
    } = useDashboard();

    const [deletingId, setDeletingId] = useState(null);
    const [noteToDelete, setNoteToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [localSearch, setLocalSearch] = useState('');
    const [selectedGroupFilter, setSelectedGroupFilter] = useState(null);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const filterRef = useRef(null);
    const sortRef = useRef(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDropdown(false);
            if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortDropdown(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filteredNotes = useMemo(() => {
        const seen = new Set();
        let list = notes.filter(n => {
            if (!n?.id || seen.has(n.id)) return false;
            seen.add(n.id);
            return true;
        });

        const q = (localSearch || searchQuery || '').trim().toLowerCase();
        if (q) {
            list = list.filter(n =>
                n.name?.toLowerCase().includes(q) ||
                n.description?.toLowerCase().includes(q) ||
                n.note_groups?.name?.toLowerCase().includes(q)
            );
        }

        if (selectedGroupFilter === 'ungrouped') {
            list = list.filter(n => !n.group_id);
        } else if (selectedGroupFilter) {
            list = list.filter(n => n.group_id === selectedGroupFilter);
        }

        list.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name') {
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
            } else if (sortBy === 'group') {
                aVal = (a.note_groups?.name || '').toLowerCase();
                bVal = (b.note_groups?.name || '').toLowerCase();
            } else {
                aVal = new Date(a[sortBy] || 0).getTime();
                bVal = new Date(b[sortBy] || 0).getTime();
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [notes, localSearch, searchQuery, selectedGroupFilter, sortBy, sortOrder]);

    useEffect(() => { setCurrentPage(1); }, [localSearch, selectedGroupFilter, sortBy, sortOrder]);

    const totalPages = Math.ceil(filteredNotes.length / ITEMS_PER_PAGE);
    const paginatedNotes = filteredNotes.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleDeleteClick = (note) => {
        setNoteToDelete(note);
    };

    const confirmDelete = async () => {
        if (!noteToDelete) return;
        setDeletingId(noteToDelete.id);
        try {
            await deleteNote(noteToDelete.id);
            setNoteToDelete(null);
        } catch {
            // error handled in context
        } finally {
            setDeletingId(null);
        }
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder(field === 'name' || field === 'group' ? 'asc' : 'desc');
        }
        setShowSortDropdown(false);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatRelativeDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const SORT_OPTIONS = [
        { key: 'created_at', label: 'Date Created' },
        { key: 'updated_at', label: 'Last Updated' },
        { key: 'name', label: 'Name' },
        { key: 'group', label: 'Group' },
    ];

    const activeFilterLabel = selectedGroupFilter === 'ungrouped'
        ? 'Ungrouped'
        : selectedGroupFilter
            ? noteGroups.find(g => g.id === selectedGroupFilter)?.name || 'Group'
            : null;

    const activeSortLabel = SORT_OPTIONS.find(s => s.key === sortBy)?.label || 'Sort';

    if (loading) {
        return (
            <div className="p-3 sm:p-6">
                {/* Header skeleton */}
                <div className="mb-6">
                    <div className="h-7 bg-app-bg-card rounded w-40 mb-2 animate-pulse" />
                    <div className="h-4 bg-app-bg-card rounded w-64 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-app-bg-light border border-app-border rounded-xl p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                            <div className="h-4 bg-app-bg-card rounded w-32 mb-3" />
                            <div className="h-3 bg-app-bg-card rounded w-full mb-2" />
                            <div className="h-3 bg-app-bg-card rounded w-20" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6">
            {/* Header */}
            <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-app-text-primary">Notes</h1>
                <p className="text-sm text-app-text-secondary mt-0.5">
                    {notes.length} note{notes.length !== 1 ? 's' : ''}{noteGroups.length > 0 ? ` across ${noteGroups.length} group${noteGroups.length !== 1 ? 's' : ''}` : ''}
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mb-4">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                    />
                    {localSearch && (
                        <button onClick={() => setLocalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-primary">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sort Dropdown */}
                    <div className="relative" ref={sortRef}>
                        <button
                            onClick={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${showSortDropdown ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/20'}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                            <span className="hidden sm:inline">{activeSortLabel}</span>
                            <span className="text-[10px] opacity-60">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        </button>
                        {showSortDropdown && (
                            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 w-44 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1">
                                {SORT_OPTIONS.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => handleSort(s.key)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${sortBy === s.key ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'}`}
                                    >
                                        {s.label}
                                        {sortBy === s.key && <span className="float-right opacity-60">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${activeFilterLabel || showFilterDropdown ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/20'}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <span className="hidden sm:inline">{activeFilterLabel || 'Filter'}</span>
                            {activeFilterLabel && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setSelectedGroupFilter(null); setShowFilterDropdown(false); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedGroupFilter(null); setShowFilterDropdown(false); } }}
                                    className="ml-0.5 hover:text-app-text-primary"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </span>
                            )}
                        </button>
                        {showFilterDropdown && (
                            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 w-52 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1">
                                <div className="px-3 py-1.5 text-[10px] font-semibold text-app-text-muted uppercase tracking-wider">Filter by Group</div>
                                <button
                                    onClick={() => { setSelectedGroupFilter(null); setShowFilterDropdown(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedGroupFilter ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'}`}
                                >
                                    All Groups
                                </button>
                                <button
                                    onClick={() => { setSelectedGroupFilter('ungrouped'); setShowFilterDropdown(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedGroupFilter === 'ungrouped' ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'}`}
                                >
                                    Ungrouped
                                </button>
                                {noteGroups.length > 0 && <div className="border-t border-app-border my-1" />}
                                {noteGroups.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => { setSelectedGroupFilter(g.id); setShowFilterDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${selectedGroupFilter === g.id ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'}`}
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || '#6366f1' }} />
                                        <span className="truncate">{g.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Note Button */}
                    <button
                        onClick={() => onEdit && onEdit(null)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">New Note</span>
                    </button>
                </div>
            </div>

            {/* Active filters bar */}
            {(activeFilterLabel || localSearch) && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {activeFilterLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-app-accent/10 text-app-accent border border-app-accent/20 rounded-md">
                            Group: {activeFilterLabel}
                            <button onClick={() => setSelectedGroupFilter(null)} className="hover:text-app-text-primary">
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {localSearch && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-app-accent/10 text-app-accent border border-app-accent/20 rounded-md">
                            Search: &quot;{localSearch}&quot;
                            <button onClick={() => setLocalSearch('')} className="hover:text-app-text-primary">
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    <button
                        onClick={() => { setSelectedGroupFilter(null); setLocalSearch(''); }}
                        className="text-xs text-app-text-muted hover:text-app-text-secondary"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Results count */}
            {filteredNotes.length > 0 && filteredNotes.length !== notes.length && (
                <div className="text-xs text-app-text-muted mb-3">
                    {filteredNotes.length > ITEMS_PER_PAGE
                        ? `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredNotes.length)} of ${filteredNotes.length} notes`
                        : `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''} found`
                    }
                </div>
            )}

            {/* Empty state */}
            {filteredNotes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-4">
                        <DocumentIcon className="w-8 h-8 sm:w-10 sm:h-10 text-app-accent" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-app-text-primary mb-2">
                        {localSearch || searchQuery || selectedGroupFilter ? 'No notes found' : 'No notes yet'}
                    </h3>
                    <p className="text-app-text-secondary text-center mb-4">
                        {localSearch || searchQuery || selectedGroupFilter
                            ? 'Try adjusting your search or filters.'
                            : 'Create your first quick note to get started.'}
                    </p>
                    {!localSearch && !searchQuery && !selectedGroupFilter && (
                        <button
                            onClick={() => onEdit && onEdit(null)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Create your first note
                        </button>
                    )}
                </div>
            )}

            {/* Notes grid */}
            {paginatedNotes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {paginatedNotes.map(note => (
                        <div
                            key={note.id}
                            className="bg-app-bg-light border border-app-border rounded-xl p-4 hover:border-app-accent/30 transition-all group cursor-pointer"
                            onClick={() => onEdit && onEdit(note)}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-sm font-semibold text-app-text-primary truncate flex-1 mr-2">
                                    {note.name || 'Untitled'}
                                </h3>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(note); }}
                                        className="p-1.5 text-app-text-muted hover:text-app-accent hover:bg-app-accent/10 rounded-md transition-colors"
                                        title="Edit"
                                    >
                                        <EditIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(note); }}
                                        className="p-1.5 text-app-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                        title="Delete"
                                        disabled={deletingId === note.id}
                                    >
                                        {deletingId === note.id ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Description preview */}
                            {note.description ? (
                                <p className="text-xs text-app-text-secondary line-clamp-3 mb-3 leading-relaxed">
                                    {note.description}
                                </p>
                            ) : (
                                <p className="text-xs text-app-text-muted italic mb-3">No description</p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-app-border/50">
                                {note.note_groups ? (
                                    <span
                                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: `${note.note_groups.color || '#6366f1'}15`,
                                            color: note.note_groups.color || '#6366f1'
                                        }}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: note.note_groups.color || '#6366f1' }} />
                                        {note.note_groups.name}
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-app-text-muted">Ungrouped</span>
                                )}
                                <span className="text-[11px] text-app-text-muted" title={formatDate(note.updated_at || note.created_at)}>
                                    {formatRelativeDate(note.updated_at || note.created_at)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!noteToDelete}
                onClose={() => setNoteToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Note"
                message={`Are you sure you want to delete "${noteToDelete?.name}"?`}
                confirmLabel="Delete"
                variant="danger"
            />
        </div>
    );
}
