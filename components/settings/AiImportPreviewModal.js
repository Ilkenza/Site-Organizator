import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { SparklesIcon, GlobeIcon, EditIcon, TrashIcon, PlusIcon, CloseIcon, CheckmarkIcon, FolderIcon, TagIcon, SearchIcon } from '../ui/Icons';

function normalizeArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.name || '').filter(Boolean);
    if (typeof val === 'string') return val.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    return [];
}

const PRICING_OPTIONS = [
    { value: 'fully_free', label: 'Free', color: 'green' },
    { value: 'freemium', label: 'Freemium', color: 'blue' },
    { value: 'free_trial', label: 'Free Trial', color: 'yellow' },
    { value: 'paid', label: 'Paid', color: 'red' },
];
const PRICING_LABELS = Object.fromEntries(PRICING_OPTIONS.map(p => [p.value, p.label]));
const PRICING_COLORS = Object.fromEntries(PRICING_OPTIONS.map(p => [p.value, p.color]));

const EMPTY_SITE = { name: '', url: '', categories: [], tags: [], description: '', use_case: '', pricing: 'freemium' };
const INPUT = 'w-full px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-purple-500/50';

/* ── Tag/Category badge picker with autocomplete dropdown ── */
function ItemPicker({ items, allExisting, existingNames, onToggle, onAdd, icon: Icon, activeColor, newColor, label }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handle = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [open]);

    const selectedSet = useMemo(() => new Set(items.map(n => n.toLowerCase())), [items]);

    // Filter existing items by search
    const filtered = useMemo(() => {
        if (!search.trim()) return allExisting;
        const q = search.toLowerCase();
        return allExisting.filter(name => name.toLowerCase().includes(q));
    }, [allExisting, search]);

    const searchTrimmed = search.trim();
    const isNewName = searchTrimmed && !existingNames.has(searchTrimmed.toLowerCase()) && !selectedSet.has(searchTrimmed.toLowerCase());

    const handleSelect = (name) => {
        if (selectedSet.has(name.toLowerCase())) {
            onToggle(name);
        } else {
            onAdd(name);
        }
    };

    const handleCreateNew = () => {
        if (searchTrimmed) {
            onAdd(searchTrimmed);
            setSearch('');
        }
    };

    return (
        <div ref={wrapRef}>
            <div className="flex items-center gap-1 mb-1">
                <Icon className="w-3 h-3 text-app-text-muted" />
                <span className="text-[10px] text-app-text-muted uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
                {/* Selected items */}
                {items.map((name) => {
                    const isExisting = existingNames.has(name.toLowerCase());
                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onToggle(name)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md border transition-colors cursor-pointer ${isExisting
                                    ? `${activeColor} hover:opacity-80`
                                    : `${newColor} border-dashed hover:opacity-80`
                                }`}
                            title={isExisting ? name : `${name} (new — will be created on import)`}
                        >
                            {!isExisting && <PlusIcon className="w-2.5 h-2.5" />}
                            {name}
                            <CloseIcon className="w-2.5 h-2.5 opacity-50 hover:opacity-100" />
                        </button>
                    );
                })}

                {/* Add button / Search input */}
                <div className="relative">
                    {open ? (
                        <input
                            ref={inputRef}
                            className="px-1.5 py-0.5 text-[11px] bg-app-bg-secondary border border-app-border rounded w-32 text-app-text-primary focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                                if (e.key === 'Enter' && isNewName) handleCreateNew();
                            }}
                            autoFocus
                            placeholder="Search or create..."
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setOpen(true); setSearch(''); }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-app-text-muted hover:text-app-text-secondary border border-dashed border-app-border rounded-md transition-colors"
                        >
                            <PlusIcon className="w-2.5 h-2.5" /> Add
                        </button>
                    )}

                    {/* Dropdown */}
                    {open && (
                        <div className="absolute left-0 top-full mt-1 w-48 max-h-40 overflow-y-auto bg-app-bg-secondary border border-app-border rounded-lg shadow-xl z-50">
                            {filtered.length === 0 && !isNewName && (
                                <div className="px-2 py-1.5 text-[11px] text-app-text-muted">No matches</div>
                            )}
                            {filtered.map(name => {
                                const isSelected = selectedSet.has(name.toLowerCase());
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => { handleSelect(name); }}
                                        className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-1.5 hover:bg-app-bg-light transition-colors ${isSelected ? 'text-app-text-primary' : 'text-app-text-secondary'}`}
                                    >
                                        <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-app-border'}`}>
                                            {isSelected && <CheckmarkIcon className="w-2 h-2 text-white" />}
                                        </span>
                                        <span className="truncate">{name}</span>
                                    </button>
                                );
                            })}
                            {isNewName && (
                                <button
                                    type="button"
                                    onClick={handleCreateNew}
                                    className="w-full text-left px-2 py-1 text-[11px] flex items-center gap-1.5 hover:bg-app-bg-light transition-colors text-amber-300 border-t border-app-border/50"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    <span>Create &quot;{searchTrimmed}&quot;</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AiImportPreviewModal({ isOpen, onClose, sites: initialSites, existingCategories = [], existingTags = [], existingSites = [], onConfirm, importing }) {
    const [items, setItems] = useState(() => (initialSites || []).map((s, i) => ({
        ...s,
        _id: i,
        _selected: true,
        categories: normalizeArray(s.categories || s.categories_array || s.category),
        tags: normalizeArray(s.tags || s.tags_array || s.tag),
    })));
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [nextId, setNextId] = useState(initialSites?.length || 0);

    // Build URL → existing site lookup map
    const sitesByUrl = useMemo(() => {
        const map = new Map();
        for (const s of existingSites) {
            if (s.url) map.set(s.url.trim().toLowerCase().replace(/\/+$/, ''), s);
        }
        return map;
    }, [existingSites]);

    // Existing names sets for lookup + sorted name lists for dropdown
    const existingCatNames = useMemo(() => new Set((existingCategories || []).map(c => (c.name || '').toLowerCase())), [existingCategories]);
    const existingTagNames = useMemo(() => new Set((existingTags || []).map(t => (t.name || '').toLowerCase())), [existingTags]);
    const allCatNamesList = useMemo(() => (existingCategories || []).map(c => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [existingCategories]);
    const allTagNamesList = useMemo(() => (existingTags || []).map(t => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [existingTags]);

    // Reset when sites prop changes
    const siteCount = initialSites?.length || 0;
    useMemo(() => {
        setItems((initialSites || []).map((s, i) => ({
            ...s,
            _id: i,
            _selected: true,
            categories: normalizeArray(s.categories || s.categories_array || s.category),
            tags: normalizeArray(s.tags || s.tags_array || s.tag),
        })));
        setNextId(siteCount);
        setEditingId(null);
    }, [siteCount]);

    const selectedCount = items.filter(s => s._selected).length;
    const allSelected = selectedCount === items.length && items.length > 0;

    const toggleAll = () => setItems(prev => prev.map(s => ({ ...s, _selected: !allSelected })));
    const toggleOne = (id) => setItems(prev => prev.map(s => s._id === id ? { ...s, _selected: !s._selected } : s));

    const removeSite = useCallback((id) => {
        setItems(prev => prev.filter(s => s._id !== id));
        if (editingId === id) { setEditingId(null); setEditForm(null); }
    }, [editingId]);

    // Toggle a category/tag on a site directly (view mode)
    const toggleSiteCat = useCallback((siteId, catName) => {
        setItems(prev => prev.map(s => {
            if (s._id !== siteId) return s;
            const cats = [...s.categories];
            const idx = cats.findIndex(c => c.toLowerCase() === catName.toLowerCase());
            if (idx >= 0) cats.splice(idx, 1);
            else cats.push(catName);
            return { ...s, categories: cats };
        }));
    }, []);

    const toggleSiteTag = useCallback((siteId, tagName) => {
        setItems(prev => prev.map(s => {
            if (s._id !== siteId) return s;
            const tags = [...s.tags];
            const idx = tags.findIndex(t => t.toLowerCase() === tagName.toLowerCase());
            if (idx >= 0) tags.splice(idx, 1);
            else tags.push(tagName);
            return { ...s, tags };
        }));
    }, []);

    const addSiteCat = useCallback((siteId, name) => {
        setItems(prev => prev.map(s => {
            if (s._id !== siteId) return s;
            if (s.categories.some(c => c.toLowerCase() === name.toLowerCase())) return s;
            return { ...s, categories: [...s.categories, name] };
        }));
    }, []);

    const addSiteTag = useCallback((siteId, name) => {
        setItems(prev => prev.map(s => {
            if (s._id !== siteId) return s;
            if (s.tags.some(t => t.toLowerCase() === name.toLowerCase())) return s;
            return { ...s, tags: [...s.tags, name] };
        }));
    }, []);

    const startEdit = useCallback((site) => {
        setEditingId(site._id);
        setEditForm({
            name: site.name || site.title || '',
            url: site.url || '',
            description: site.description || '',
            use_case: site.use_case || '',
            pricing: site.pricing || 'freemium',
        });
    }, []);

    const saveEdit = useCallback(() => {
        if (!editForm) return;
        setItems(prev => prev.map(s => {
            if (s._id !== editingId) return s;
            return { ...s, name: editForm.name, url: editForm.url, description: editForm.description, use_case: editForm.use_case, pricing: editForm.pricing };
        }));
        setEditingId(null);
        setEditForm(null);
    }, [editForm, editingId]);

    const cancelEdit = () => { setEditingId(null); setEditForm(null); };

    const addSite = useCallback(() => {
        const id = nextId;
        setNextId(id + 1);
        const newSite = { ...EMPTY_SITE, _id: id, _selected: true, categories: [], tags: [] };
        setItems(prev => [...prev, newSite]);
        startEdit(newSite);
    }, [nextId, startEdit]);

    const handleConfirm = () => {
        const toImport = items.filter(s => s._selected).map(({ _id, _selected, ...rest }) => rest);
        onConfirm(toImport);
    };

    if (!items.length && !initialSites?.length) return null;

    const CAT_ACTIVE = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    const CAT_NEW = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    const TAG_ACTIVE = 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    const TAG_NEW = 'bg-amber-500/10 text-amber-300 border-amber-500/30';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Import Preview" size="full">
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-400" />
                        <span className="text-sm text-app-text-secondary">
                            <strong className="text-app-text-primary">{selectedCount}</strong> of {items.length} selected
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={toggleAll} className="text-xs text-app-accent hover:text-app-accent/80 transition-colors">
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="border border-app-border rounded-lg overflow-y-auto max-h-[60vh] divide-y divide-app-border/50">
                    {items.map((site) => {
                        const isEditing = editingId === site._id;
                        const pricing = site.pricing || 'freemium';
                        const urlKey = (site.url || '').trim().toLowerCase().replace(/\/+$/, '');
                        const currentSite = urlKey ? sitesByUrl.get(urlKey) : null;
                        const currentCats = currentSite?.categories_array?.map(c => c.name).filter(Boolean) || [];
                        const currentTags = currentSite?.tags_array?.map(t => t.name).filter(Boolean) || [];

                        return (
                            <div key={site._id} className={`transition-colors ${site._selected ? '' : 'opacity-40'}`}>
                                {/* Main row */}
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={site._selected}
                                        onChange={() => toggleOne(site._id)}
                                        className="w-3.5 h-3.5 mt-1 rounded border-app-border bg-app-bg-secondary cursor-pointer accent-purple-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="font-medium text-sm text-app-text-primary truncate">{site.name || site.title || '-'}</div>
                                                    {currentSite ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 flex-shrink-0">EXISTS</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex-shrink-0">NEW</span>
                                                    )}
                                                </div>
                                                <a href={site.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-app-accent hover:underline truncate" title={site.url} onClick={e => e.stopPropagation()}>
                                                    <GlobeIcon className="w-3 h-3 flex-shrink-0" />
                                                    {site.url?.replace(/^https?:\/\//, '').slice(0, 50)}
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button type="button" onClick={() => isEditing ? cancelEdit() : startEdit(site)} className={`p-1 rounded transition-colors ${isEditing ? 'text-purple-400 bg-purple-500/10' : 'text-app-text-muted hover:text-app-accent'}`} title="Edit">
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" onClick={() => removeSite(site._id)} className="p-1 text-app-text-muted hover:text-red-400 rounded transition-colors" title="Remove">
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Current data (for existing sites) */}
                                        {!isEditing && currentSite && (
                                            <div className="mt-1.5 px-2 py-1.5 rounded bg-app-bg-secondary/50 border border-app-border/50 space-y-1">
                                                <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Current</span>
                                                {currentCats.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <FolderIcon className="w-3 h-3 text-app-text-muted flex-shrink-0" />
                                                        {currentCats.map((cat, i) => (
                                                            <span key={`cc${i}`} className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md border border-app-border/60 text-app-text-muted bg-app-bg-secondary">
                                                                {cat}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {currentTags.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <TagIcon className="w-3 h-3 text-app-text-muted flex-shrink-0" />
                                                        {currentTags.map((tag, i) => (
                                                            <span key={`ct${i}`} className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md border border-app-border/60 text-app-text-muted bg-app-bg-secondary">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge size="xs" color={PRICING_COLORS[currentSite.pricing] || 'gray'}>
                                                        {PRICING_LABELS[currentSite.pricing] || currentSite.pricing || 'Freemium'}
                                                    </Badge>
                                                </div>
                                                {currentSite.description && (
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Desc:</span>
                                                        <span className="text-[10px] text-app-text-muted line-clamp-2">{currentSite.description}</span>
                                                    </div>
                                                )}
                                                {currentSite.use_case && (
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Use:</span>
                                                        <span className="text-[10px] text-app-text-muted line-clamp-2">{currentSite.use_case}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Categories & Tags — read-only badges in view mode */}
                                        {!isEditing && (
                                            <div className={`space-y-1 mt-1.5 ${currentSite ? 'px-2 py-1.5 rounded bg-purple-500/5 border border-purple-500/15' : ''}`}>
                                                {currentSite && <span className="text-[10px] text-purple-300 uppercase tracking-wider">Import</span>}
                                                {/* Categories row */}
                                                {site.categories.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <FolderIcon className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                                        {site.categories.map((cat, i) => {
                                                            const isNew = !existingCatNames.has(cat.toLowerCase());
                                                            return (
                                                                <span key={`c${i}`} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md border ${isNew ? `${CAT_NEW} border-dashed` : CAT_ACTIVE}`}>
                                                                    {isNew && <PlusIcon className="w-2.5 h-2.5" />}{cat}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {/* Tags row */}
                                                {site.tags.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <TagIcon className="w-3 h-3 text-teal-400 flex-shrink-0" />
                                                        {site.tags.map((tag, i) => {
                                                            const isNew = !existingTagNames.has(tag.toLowerCase());
                                                            return (
                                                                <span key={`t${i}`} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md border ${isNew ? `${TAG_NEW} border-dashed` : TAG_ACTIVE}`}>
                                                                    {isNew && <PlusIcon className="w-2.5 h-2.5" />}{tag}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {/* Pricing + description + use_case */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge size="xs" color={PRICING_COLORS[pricing] || 'gray'}>
                                                        {PRICING_LABELS[pricing] || pricing}
                                                    </Badge>
                                                </div>
                                                {site.description && (
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Desc:</span>
                                                        <span className="text-[11px] text-app-text-secondary line-clamp-2">{site.description}</span>
                                                    </div>
                                                )}
                                                {site.use_case && (
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Use:</span>
                                                        <span className="text-[11px] text-app-text-secondary line-clamp-2">{site.use_case}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Edit form (text fields only — cats/tags are always inline above) */}
                                {isEditing && editForm && (
                                    <div className="px-3 pb-3 pt-0 space-y-2 bg-purple-500/5 border-t border-purple-500/10">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                            <div>
                                                <label className="text-[10px] text-app-text-muted uppercase mb-0.5 block">Name</label>
                                                <input className={INPUT} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Site name" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-app-text-muted uppercase mb-0.5 block">URL</label>
                                                <input className={INPUT} value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-app-text-muted uppercase mb-0.5 block">Description</label>
                                            <textarea className={`${INPUT} resize-none`} rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-app-text-muted uppercase mb-0.5 block">Use Case</label>
                                                <input className={INPUT} value={editForm.use_case} onChange={e => setEditForm(f => ({ ...f, use_case: e.target.value }))} placeholder="What is it used for?" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-app-text-muted uppercase mb-0.5 block">Pricing</label>
                                                <select className={INPUT} value={editForm.pricing} onChange={e => setEditForm(f => ({ ...f, pricing: e.target.value }))}>
                                                    {PRICING_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Categories & Tags pickers */}
                                        <div className="space-y-1.5">
                                            <ItemPicker
                                                items={site.categories}
                                                allExisting={allCatNamesList}
                                                existingNames={existingCatNames}
                                                onToggle={(name) => toggleSiteCat(site._id, name)}
                                                onAdd={(name) => addSiteCat(site._id, name)}
                                                icon={FolderIcon}
                                                activeColor={CAT_ACTIVE}
                                                newColor={CAT_NEW}
                                                label="Categories"
                                            />
                                            <ItemPicker
                                                items={site.tags}
                                                allExisting={allTagNamesList}
                                                existingNames={existingTagNames}
                                                onToggle={(name) => toggleSiteTag(site._id, name)}
                                                onAdd={(name) => addSiteTag(site._id, name)}
                                                icon={TagIcon}
                                                activeColor={TAG_ACTIVE}
                                                newColor={TAG_NEW}
                                                label="Tags"
                                            />
                                        </div>
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button type="button" onClick={cancelEdit} className="px-2.5 py-1 text-xs text-app-text-muted hover:text-app-text-primary transition-colors">
                                                Cancel
                                            </button>
                                            <button type="button" onClick={saveEdit} disabled={!editForm.url?.trim()} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded transition-colors disabled:opacity-40">
                                                <CheckmarkIcon className="w-3.5 h-3.5" /> Save
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {items.length === 0 && (
                        <div className="p-8 text-center text-sm text-app-text-muted">
                            No sites found in file.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end pt-2">
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={onClose} disabled={importing}>Cancel</Button>
                        <Button variant="primary" onClick={handleConfirm} loading={importing} disabled={selectedCount === 0}>
                            Import {selectedCount} Site{selectedCount !== 1 ? 's' : ''}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
