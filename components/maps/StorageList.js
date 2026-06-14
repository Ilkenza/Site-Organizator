import { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Pagination from '../ui/Pagination';
import { ConfirmModal } from '../ui/Modal';
import { SearchIcon, EditIcon, TrashIcon, SpinnerIcon, PlusIcon, CloseIcon, ExternalLinkIcon } from '../ui/Icons';
import StorageModal from './StorageModal';

const ITEMS_PER_PAGE = 50;

export default function StorageList() {
    const { storageItems, deleteStorageItem, loading } = useDashboard();

    const [search, setSearch] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterType, setFilterType] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showLocDropdown, setShowLocDropdown] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const sortRef = useRef(null);
    const locRef = useRef(null);
    const typeRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortDropdown(false);
            if (locRef.current && !locRef.current.contains(e.target)) setShowLocDropdown(false);
            if (typeRef.current && !typeRef.current.contains(e.target)) setShowTypeDropdown(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Distinct locations and types from data
    const locations = useMemo(() => [...new Set(storageItems.map(i => i.location).filter(Boolean))].sort(), [storageItems]);
    const types = useMemo(() => [...new Set(storageItems.flatMap(i => Array.isArray(i.type) ? i.type : (i.type ? [i.type] : [])))].sort(), [storageItems]);

    const filtered = useMemo(() => {
        let list = [...storageItems];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(i =>
                i.name?.toLowerCase().includes(q) ||
                i.location?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                (Array.isArray(i.type) ? i.type.some(t => t.toLowerCase().includes(q)) : i.type?.toLowerCase().includes(q))
            );
        }
        if (filterLocation) list = list.filter(i => i.location === filterLocation);
        if (filterType) list = list.filter(i => Array.isArray(i.type) ? i.type.includes(filterType) : i.type === filterType);

        list.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name' || sortBy === 'location') {
                aVal = (a[sortBy] || '').toLowerCase();
                bVal = (b[sortBy] || '').toLowerCase();
            } else if (sortBy === 'type') {
                aVal = (Array.isArray(a.type) ? a.type.join(',') : (a.type || '')).toLowerCase();
                bVal = (Array.isArray(b.type) ? b.type.join(',') : (b.type || '')).toLowerCase();
            } else {
                aVal = new Date(a[sortBy] || 0).getTime();
                bVal = new Date(b[sortBy] || 0).getTime();
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [storageItems, search, filterLocation, filterType, sortBy, sortOrder]);

    // Reset page on filter change
    const filterChangeRef = useRef(false);
    useEffect(() => {
        if (filterChangeRef.current) setCurrentPage(1);
        else filterChangeRef.current = true;
    }, [search, filterLocation, filterType, sortBy, sortOrder]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setDeletingId(itemToDelete.id);
        try {
            await deleteStorageItem(itemToDelete.id);
            setItemToDelete(null);
        } catch { } finally {
            setDeletingId(null);
        }
    };

    const handleSort = (field) => {
        if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortOrder(field === 'name' ? 'asc' : 'desc'); }
        setShowSortDropdown(false);
    };

    const SORT_OPTIONS = [
        { key: 'created_at', label: 'Date Created' },
        { key: 'name', label: 'Name' },
        { key: 'location', label: 'Location' },
        { key: 'type', label: 'Type' },
    ];

    const formatDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-app-bg-light border border-app-border rounded-xl p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="h-4 bg-app-bg-card rounded w-32 mb-3" />
                        <div className="h-3 bg-app-bg-card rounded w-full mb-2" />
                        <div className="h-3 bg-app-bg-card rounded w-20" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            {/* Count */}
            {filtered.length > 0 && (
                <div className="text-xs text-app-text-muted mb-3">
                    {filtered.length > ITEMS_PER_PAGE
                        ? `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} items`
                        : `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`
                    }
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-0">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
                    <input
                        type="text"
                        placeholder="Search storage items..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-primary">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Sort */}
                    <div className="relative" ref={sortRef}>
                        <button onClick={() => { setShowSortDropdown(!showSortDropdown); setShowLocDropdown(false); setShowTypeDropdown(false); }}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${showSortDropdown ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary'}`}>
                            <span className="hidden sm:inline">{SORT_OPTIONS.find(s => s.key === sortBy)?.label}</span>
                            <span className="text-[10px] opacity-60">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        </button>
                        {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1">
                                {SORT_OPTIONS.map(s => (
                                    <button key={s.key} onClick={() => handleSort(s.key)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${sortBy === s.key ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>
                                        {s.label}{sortBy === s.key && <span className="float-right opacity-60">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Location filter */}
                    {locations.length > 0 && (
                        <div className="relative" ref={locRef}>
                            <button onClick={() => { setShowLocDropdown(!showLocDropdown); setShowSortDropdown(false); setShowTypeDropdown(false); }}
                                className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${filterLocation ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary'}`}>
                                <span className="hidden sm:inline">{filterLocation || 'Location'}</span>
                                {filterLocation && <button onClick={(e) => { e.stopPropagation(); setFilterLocation(''); }} className="ml-0.5"><CloseIcon className="w-3 h-3" /></button>}
                            </button>
                            {showLocDropdown && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1 max-h-48 overflow-y-auto">
                                    <button onClick={() => { setFilterLocation(''); setShowLocDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm ${!filterLocation ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>All</button>
                                    {locations.map(l => (
                                        <button key={l} onClick={() => { setFilterLocation(l); setShowLocDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm truncate ${filterLocation === l ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>{l}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Type filter */}
                    {types.length > 0 && (
                        <div className="relative" ref={typeRef}>
                            <button onClick={() => { setShowTypeDropdown(!showTypeDropdown); setShowSortDropdown(false); setShowLocDropdown(false); }}
                                className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${filterType ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary'}`}>
                                <span className="hidden sm:inline">{filterType || 'Type'}</span>
                                {filterType && <button onClick={(e) => { e.stopPropagation(); setFilterType(''); }} className="ml-0.5"><CloseIcon className="w-3 h-3" /></button>}
                            </button>
                            {showTypeDropdown && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1 max-h-48 overflow-y-auto">
                                    <button onClick={() => { setFilterType(''); setShowTypeDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm ${!filterType ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>All</button>
                                    {types.map(t => (
                                        <button key={t} onClick={() => { setFilterType(t); setShowTypeDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm truncate ${filterType === t ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>{t}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add button */}
                    <button onClick={() => { setEditingItem(null); setModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors whitespace-nowrap">
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">New Item</span>
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-2">
                        {search || filterLocation || filterType ? 'No items found' : 'No storage items yet'}
                    </h3>
                    <p className="text-app-text-secondary text-center mb-4">
                        {search || filterLocation || filterType ? 'Try adjusting your search or filters.' : 'Track your files and images across different storage services.'}
                    </p>
                    {!search && !filterLocation && !filterType && (
                        <button onClick={() => { setEditingItem(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors">
                            <PlusIcon className="w-4 h-4" /> Add your first item
                        </button>
                    )}
                </div>
            )}

            {/* Grid */}
            {paginated.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {paginated.map(item => (
                        <div key={item.id}
                            className="bg-app-bg-light border border-app-border rounded-xl p-4 hover:border-app-accent/30 transition-all group cursor-pointer"
                            onClick={() => { setEditingItem(item); setModalOpen(true); }}>
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-sm font-semibold text-app-text-primary truncate flex-1 mr-2">{item.name}</h3>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.link && (
                                        <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 text-app-text-muted hover:text-app-accent hover:bg-app-accent/10 rounded-md transition-colors">
                                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setModalOpen(true); }}
                                        className="p-1.5 text-app-text-muted hover:text-app-accent hover:bg-app-accent/10 rounded-md transition-colors"><EditIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                                        className="p-1.5 text-app-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" disabled={deletingId === item.id}>
                                        {deletingId === item.id ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {item.description ? (
                                <p className="text-xs text-app-text-secondary line-clamp-2 mb-3">{item.description}</p>
                            ) : (
                                <p className="text-xs text-app-text-muted italic mb-3">No description</p>
                            )}

                            {/* Tags */}
                            {item.tags_array?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {item.tags_array.slice(0, 3).map(tag => (
                                        <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-app-bg-card text-app-text-muted border border-app-border">
                                            {tag.name || tag.id?.slice(0, 6)}
                                        </span>
                                    ))}
                                    {item.tags_array.length > 3 && <span className="text-[10px] text-app-text-muted">+{item.tags_array.length - 3}</span>}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-app-border/50">
                                <div className="flex items-center gap-2">
                                    {item.location && (
                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{item.location}</span>
                                    )}
                                    {item.type && (Array.isArray(item.type) ? item.type : [item.type]).filter(Boolean).map(t => (
                                        <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{t}</span>
                                    ))}
                                </div>
                                <span className="text-[11px] text-app-text-muted">{formatDate(item.created_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}

            <StorageModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingItem(null); }} item={editingItem} />
            <ConfirmModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={confirmDelete}
                title="Delete Storage Item" message={`Are you sure you want to delete "${itemToDelete?.name}"?`} confirmLabel="Delete" variant="danger" />
        </>
    );
}
