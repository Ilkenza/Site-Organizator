import { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Pagination from '../ui/Pagination';
import { ConfirmModal } from '../ui/Modal';
import { SearchIcon, EditIcon, TrashIcon, SpinnerIcon, PlusIcon, CloseIcon, ExternalLinkIcon } from '../ui/Icons';
import CourseModal from './CourseModal';

const ITEMS_PER_PAGE = 50;

const STATUS_CONFIG = {
    not_started: { label: 'Not Started', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
    in_progress: { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

export default function CoursesList() {
    const { courses, deleteCourse, loading } = useDashboard();

    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [courseToDelete, setCourseToDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const sortRef = useRef(null);
    const statusRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortDropdown(false);
            if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatusDropdown(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = useMemo(() => {
        let list = [...courses];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(c =>
                c.name?.toLowerCase().includes(q) ||
                c.platform?.toLowerCase().includes(q) ||
                c.category?.toLowerCase().includes(q) ||
                c.notes_text?.toLowerCase().includes(q)
            );
        }
        if (filterStatus) list = list.filter(c => c.status === filterStatus);

        list.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'name' || sortBy === 'platform' || sortBy === 'status') {
                aVal = (a[sortBy] || '').toLowerCase();
                bVal = (b[sortBy] || '').toLowerCase();
            } else if (sortBy === 'progress') {
                aVal = a.progress || 0;
                bVal = b.progress || 0;
            } else {
                aVal = new Date(a[sortBy] || 0).getTime();
                bVal = new Date(b[sortBy] || 0).getTime();
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [courses, search, filterStatus, sortBy, sortOrder]);

    const filterChangeRef = useRef(false);
    useEffect(() => {
        if (filterChangeRef.current) setCurrentPage(1);
        else filterChangeRef.current = true;
    }, [search, filterStatus, sortBy, sortOrder]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const confirmDelete = async () => {
        if (!courseToDelete) return;
        setDeletingId(courseToDelete.id);
        try {
            await deleteCourse(courseToDelete.id);
            setCourseToDelete(null);
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
        { key: 'platform', label: 'Platform' },
        { key: 'progress', label: 'Progress' },
        { key: 'status', label: 'Status' },
    ];

    const STATUS_FILTERS = [
        { value: '', label: 'All' },
        { value: 'not_started', label: 'Not Started' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
    ];

    // Stats
    const statusCounts = useMemo(() => {
        const counts = { not_started: 0, in_progress: 0, completed: 0 };
        courses.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
        return counts;
    }, [courses]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-app-bg-light border border-app-border rounded-xl p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="h-4 bg-app-bg-card rounded w-32 mb-3" />
                        <div className="h-2 bg-app-bg-card rounded w-full mb-3" />
                        <div className="h-3 bg-app-bg-card rounded w-20" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            {/* Stats bar */}
            {courses.length > 0 && (
                <div className="flex items-center gap-4 mb-4 text-xs">
                    <span className="text-app-text-muted">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
                    <span className="text-yellow-400">{statusCounts.in_progress} in progress</span>
                    <span className="text-green-400">{statusCounts.completed} completed</span>
                    <span className="text-gray-400">{statusCounts.not_started} not started</span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-0">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
                    <input
                        type="text"
                        placeholder="Search courses..."
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
                        <button onClick={() => { setShowSortDropdown(!showSortDropdown); setShowStatusDropdown(false); }}
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

                    {/* Status filter */}
                    <div className="relative" ref={statusRef}>
                        <button onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowSortDropdown(false); }}
                            className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${filterStatus ? 'bg-app-accent/10 border-app-accent/30 text-app-accent' : 'bg-app-bg-light border-app-border text-app-text-secondary hover:text-app-text-primary'}`}>
                            <span className="hidden sm:inline">{filterStatus ? STATUS_CONFIG[filterStatus]?.label : 'Status'}</span>
                            {filterStatus && <button onClick={(e) => { e.stopPropagation(); setFilterStatus(''); }} className="ml-0.5"><CloseIcon className="w-3 h-3" /></button>}
                        </button>
                        {showStatusDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-app-bg-card border border-app-border rounded-lg shadow-xl z-20 py-1">
                                {STATUS_FILTERS.map(s => (
                                    <button key={s.value} onClick={() => { setFilterStatus(s.value); setShowStatusDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${filterStatus === s.value ? 'text-app-accent bg-app-accent/10' : 'text-app-text-secondary hover:bg-app-bg-light'}`}>{s.label}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add button */}
                    <button onClick={() => { setEditingCourse(null); setModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors whitespace-nowrap">
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">New Course</span>
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-app-text-primary mb-2">
                        {search || filterStatus ? 'No courses found' : 'No courses yet'}
                    </h3>
                    <p className="text-app-text-secondary text-center mb-4">
                        {search || filterStatus ? 'Try adjusting your search or filters.' : 'Track all the courses you own and your progress.'}
                    </p>
                    {!search && !filterStatus && (
                        <button onClick={() => { setEditingCourse(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-app-accent hover:bg-app-accent/90 text-white rounded-lg transition-colors">
                            <PlusIcon className="w-4 h-4" /> Add your first course
                        </button>
                    )}
                </div>
            )}

            {/* Grid */}
            {paginated.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {paginated.map(course => {
                        const sc = STATUS_CONFIG[course.status] || STATUS_CONFIG.not_started;
                        return (
                            <div key={course.id}
                                className="bg-app-bg-light border border-app-border rounded-xl p-4 hover:border-app-accent/30 transition-all group cursor-pointer"
                                onClick={() => { setEditingCourse(course); setModalOpen(true); }}>
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-app-text-primary truncate flex-1 mr-2">{course.name}</h3>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {course.link && (
                                            <a href={course.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                                className="p-1.5 text-app-text-muted hover:text-app-accent hover:bg-app-accent/10 rounded-md transition-colors">
                                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setEditingCourse(course); setModalOpen(true); }}
                                            className="p-1.5 text-app-text-muted hover:text-app-accent hover:bg-app-accent/10 rounded-md transition-colors"><EditIcon className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setCourseToDelete(course); }}
                                            className="p-1.5 text-app-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" disabled={deletingId === course.id}>
                                            {deletingId === course.id ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                        <span className={`font-medium px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.color} ${sc.border} border`}>{sc.label}</span>
                                        <span className="text-app-text-muted">{course.progress || 0}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-app-bg-card rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${course.status === 'completed' ? 'bg-green-500' : course.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-600'}`}
                                            style={{ width: `${course.progress || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {course.notes_text && (
                                    <p className="text-xs text-app-text-secondary line-clamp-2 mb-2">{course.notes_text}</p>
                                )}

                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-app-border/50">
                                    <div className="flex items-center gap-2">
                                        {course.platform && (
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{course.platform}</span>
                                        )}
                                        {course.category && (
                                            <span className="text-[11px] text-app-text-muted truncate max-w-[100px]">{course.category}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}

            <CourseModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingCourse(null); }} course={editingCourse} />
            <ConfirmModal isOpen={!!courseToDelete} onClose={() => setCourseToDelete(null)} onConfirm={confirmDelete}
                title="Delete Course" message={`Are you sure you want to delete "${courseToDelete?.name}"?`} confirmLabel="Delete" variant="danger" />
        </>
    );
}
