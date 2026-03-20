import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { SparklesIcon, GlobeIcon, EditIcon, TrashIcon, PlusIcon, CloseIcon, CheckmarkIcon, FolderIcon, TagIcon } from '../ui/Icons';

function normalizeArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.name || '').filter(Boolean);
    if (typeof val === 'string') return val.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    return [];
}

function buildUrlMap(sites) {
    const map = new Map();
    for (const s of (sites || [])) {
        if (s.url) map.set(s.url.trim().toLowerCase().replace(/\/+$/, ''), s);
    }
    return map;
}

function buildItem(s, i, urlMap) {
    const importCats = normalizeArray(s.categories || s.categories_array || s.category);
    const importTags = normalizeArray(s.tags || s.tags_array || s.tag);
    const urlKey = (s.url || '').trim().toLowerCase().replace(/\/+$/, '');
    const existing = urlKey ? urlMap.get(urlKey) : null;
    const base = { ...s, _id: i, _selected: true, categories: importCats, tags: importTags };
    if (!existing) return base;
    const curCats = (existing.categories_array || []).map(c => c.name).filter(Boolean);
    const curTags = (existing.tags_array || []).map(t => t.name).filter(Boolean);
    // Case-insensitive union preserving casing (import wins)
    const catMap = new Map(); curCats.forEach(c => catMap.set(c.toLowerCase(), c)); importCats.forEach(c => catMap.set(c.toLowerCase(), c));
    const tagMap = new Map(); curTags.forEach(t => tagMap.set(t.toLowerCase(), t)); importTags.forEach(t => tagMap.set(t.toLowerCase(), t));
    return {
        ...base,
        categories: [...catMap.values()],
        tags: [...tagMap.values()],
        _currentCats: curCats, _currentTags: curTags,
        _importCats: importCats, _importTags: importTags,
        _currentDesc: existing.description || '', _currentUseCase: existing.use_case || '', _currentPricing: existing.pricing || 'freemium',
        _importDesc: s.description || '', _importUseCase: s.use_case || '', _importPricing: s.pricing || 'freemium',
        description: s.description || existing.description || '',
        use_case: s.use_case || existing.use_case || '',
        pricing: s.pricing && s.pricing !== 'freemium' ? s.pricing : (existing.pricing || s.pricing || 'freemium'),
    };
}

const PRICING_OPTIONS = [
    { value: 'fully_free', label: 'Free', color: 'green' },
    { value: 'freemium', label: 'Freemium', color: 'blue' },
    { value: 'free_trial', label: 'Free Trial', color: 'yellow' },
    { value: 'paid', label: 'Paid', color: 'red' },
];
const PRICING_LABELS = Object.fromEntries(PRICING_OPTIONS.map(p => [p.value, p.label]));
const PRICING_COLORS = Object.fromEntries(PRICING_OPTIONS.map(p => [p.value, p.color]));

const INPUT = 'w-full px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-purple-500/50';

/* ── Tag/Category badge picker with autocomplete dropdown ── */
function ItemPicker({ items, allExisting, existingNames, onToggle, onAdd, icon: Icon, activeColor, newColor, label, currentSet, importSet, originImportClass }) {
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
            <div className="flex flex-wrap items-center gap-1.5">
                {/* Selected items */}
                {items.map((name) => {
                    const key = name.toLowerCase();
                    const isExisting = existingNames.has(key);
                    const hasOrigin = currentSet && importSet;
                    const inCur = hasOrigin && currentSet.has(key);
                    const inImp = hasOrigin && importSet.has(key);
                    let originLabel, originClass;
                    if (hasOrigin) {
                        originLabel = inCur && inImp ? 'C+I' : inCur ? 'C' : 'I';
                        originClass = inCur && inImp ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : inCur ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : (originImportClass || 'bg-purple-500/20 text-purple-300 border-purple-500/30');
                    }
                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onToggle(name)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors cursor-pointer ${isExisting
                                    ? `${activeColor} hover:opacity-80`
                                    : `${newColor} border-dashed hover:opacity-80`
                                }`}
                            title={isExisting ? name : `${name} (new — will be created on import)`}
                        >
                            {hasOrigin && <span className={`text-[8px] font-bold px-1 py-px rounded border leading-none ${originClass}`}>{originLabel}</span>}
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
    const [items, setItems] = useState(() => {
        const urlMap = buildUrlMap(existingSites);
        return (initialSites || []).map((s, i) => buildItem(s, i, urlMap));
    });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editSnapshot, setEditSnapshot] = useState(null);

    // Build URL → existing site lookup map
    const sitesByUrl = useMemo(() => buildUrlMap(existingSites), [existingSites]);

    // Existing names sets for lookup + sorted name lists for dropdown
    const existingCatNames = useMemo(() => new Set((existingCategories || []).map(c => (c.name || '').toLowerCase())), [existingCategories]);
    const existingTagNames = useMemo(() => new Set((existingTags || []).map(t => (t.name || '').toLowerCase())), [existingTags]);
    const allCatNamesList = useMemo(() => (existingCategories || []).map(c => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [existingCategories]);
    const allTagNamesList = useMemo(() => (existingTags || []).map(t => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [existingTags]);

    // Reset when sites prop changes
    const siteCount = initialSites?.length || 0;
    useMemo(() => {
        const urlMap = buildUrlMap(existingSites);
        setItems((initialSites || []).map((s, i) => buildItem(s, i, urlMap)));
        setEditingId(null);
    }, [siteCount]);

    const selectedCount = items.filter(s => s._selected).length;
    const allSelected = selectedCount === items.length && items.length > 0;

    const toggleAll = () => setItems(prev => prev.map(s => ({ ...s, _selected: !allSelected })));
    const toggleOne = (id) => setItems(prev => prev.map(s => s._id === id ? { ...s, _selected: !s._selected } : s));
    const setFieldValue = useCallback((id, field, value) => setItems(prev => prev.map(s => s._id === id ? { ...s, [field]: value } : s)), []);

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
        setEditSnapshot({ ...site, categories: [...site.categories], tags: [...site.tags] });
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
        setEditSnapshot(null);
    }, [editForm, editingId]);

    const cancelEdit = useCallback(() => {
        if (editSnapshot) {
            setItems(prev => prev.map(s => s._id === editSnapshot._id ? editSnapshot : s));
        }
        setEditingId(null);
        setEditForm(null);
        setEditSnapshot(null);
    }, [editSnapshot]);

    const handleConfirm = () => {
        const toImport = items.filter(s => s._selected).map(({ _id, _selected, _currentCats, _currentTags, _importCats, _importTags, _currentDesc, _currentUseCase, _currentPricing, _importDesc, _importUseCase, _importPricing, ...rest }) => rest);
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
                <div className="border border-app-border rounded-lg overflow-y-auto max-h-[55vh] sm:max-h-[60vh] divide-y divide-app-border/50">
                    {items.map((site) => {
                        const isEditing = editingId === site._id;
                        const pricing = site.pricing || 'freemium';
                        const urlKey = (site.url || '').trim().toLowerCase().replace(/\/+$/, '');
                        const currentSite = urlKey ? sitesByUrl.get(urlKey) : null;

                        return (
                            <div key={site._id} className={`transition-colors ${site._selected ? '' : 'opacity-40'}`}>
                                {/* Main row */}
                                <div className="flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={site._selected}
                                        onChange={() => toggleOne(site._id)}
                                        className="w-4 h-4 sm:w-3.5 sm:h-3.5 mt-1 rounded border-app-border bg-app-bg-secondary cursor-pointer accent-purple-500 flex-shrink-0"
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
                                                <a href={site.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-app-accent hover:underline max-w-full truncate" title={site.url} onClick={e => e.stopPropagation()}>
                                                    <GlobeIcon className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{site.url?.replace(/^https?:\/\//, '').slice(0, 50)}</span>
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button type="button" onClick={() => isEditing ? cancelEdit() : startEdit(site)} className={`p-1.5 sm:p-1 rounded transition-colors ${isEditing ? 'text-purple-400 bg-purple-500/10' : 'text-app-text-muted hover:text-app-accent'}`} title="Edit">
                                                    <EditIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                </button>
                                                <button type="button" onClick={() => removeSite(site._id)} className="p-1.5 sm:p-1 text-app-text-muted hover:text-red-400 rounded transition-colors" title="Remove">
                                                    <TrashIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* ── Unified merge view for EXISTING sites ── */}
                                        {!isEditing && currentSite && (() => {
                                            const curCatSet = new Set((site._currentCats || []).map(c => c.toLowerCase()));
                                            const impCatSet = new Set((site._importCats || []).map(c => c.toLowerCase()));
                                            const allCatsMap = new Map();
                                            (site._currentCats || []).forEach(c => allCatsMap.set(c.toLowerCase(), c));
                                            (site._importCats || []).forEach(c => allCatsMap.set(c.toLowerCase(), c));
                                            (site.categories || []).forEach(c => allCatsMap.set(c.toLowerCase(), c));
                                            const allCats = [...allCatsMap.values()];

                                            const curTagSet = new Set((site._currentTags || []).map(t => t.toLowerCase()));
                                            const impTagSet = new Set((site._importTags || []).map(t => t.toLowerCase()));
                                            const allTagsMap = new Map();
                                            (site._currentTags || []).forEach(t => allTagsMap.set(t.toLowerCase(), t));
                                            (site._importTags || []).forEach(t => allTagsMap.set(t.toLowerCase(), t));
                                            (site.tags || []).forEach(t => allTagsMap.set(t.toLowerCase(), t));
                                            const allTags = [...allTagsMap.values()];

                                            const diffDesc = site._currentDesc !== site._importDesc && (site._currentDesc || site._importDesc);
                                            const diffUse = site._currentUseCase !== site._importUseCase && (site._currentUseCase || site._importUseCase);
                                            const diffPricing = site._currentPricing !== site._importPricing;

                                            return (
                                                <div className="mt-1.5 space-y-0 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded bg-app-bg-secondary/30 border border-app-border/50">
                                                    {/* Categories — toggleable */}
                                                    {allCats.length > 0 && (
                                                        <div className="space-y-1.5 pb-2.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <FolderIcon className="w-3 h-3 text-purple-400" />
                                                                <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Categories</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {allCats.map(cat => {
                                                                    const key = cat.toLowerCase();
                                                                    const selected = site.categories.some(c => c.toLowerCase() === key);
                                                                    const inCur = curCatSet.has(key);
                                                                    const inImp = impCatSet.has(key);
                                                                    const isNew = !existingCatNames.has(key);
                                                                    const originLabel = inCur && inImp ? 'C+I' : inCur ? 'C' : 'I';
                                                                    const originClass = inCur && inImp ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : inCur ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                                                                    return (
                                                                        <button key={cat} type="button" onClick={() => toggleSiteCat(site._id, cat)}
                                                                            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                                                                                selected
                                                                                    ? (isNew ? `${CAT_NEW} border-dashed` : CAT_ACTIVE)
                                                                                    : 'border-app-border/30 text-app-text-muted/40 line-through opacity-50'
                                                                            }`}
                                                                            title={`${cat} (${inCur && inImp ? 'current + import' : inCur ? 'current' : 'import'}) — click to ${selected ? 'remove' : 'add'}`}
                                                                        >
                                                                            <span className={`text-[8px] font-bold px-1 py-px rounded border leading-none ${originClass}`}>{originLabel}</span>
                                                                            {isNew && <PlusIcon className="w-2.5 h-2.5" />}
                                                                            {cat}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Tags — toggleable */}
                                                    {allTags.length > 0 && (
                                                        <div className={`space-y-1.5 pb-2.5 ${allCats.length > 0 ? 'pt-2.5 border-t border-app-border/30' : ''}`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <TagIcon className="w-3 h-3 text-teal-400" />
                                                                <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Tags</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {allTags.map(tag => {
                                                                    const key = tag.toLowerCase();
                                                                    const selected = site.tags.some(t => t.toLowerCase() === key);
                                                                    const inCur = curTagSet.has(key);
                                                                    const inImp = impTagSet.has(key);
                                                                    const isNew = !existingTagNames.has(key);
                                                                    const originLabel = inCur && inImp ? 'C+I' : inCur ? 'C' : 'I';
                                                                    const originClass = inCur && inImp ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : inCur ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30';
                                                                    return (
                                                                        <button key={tag} type="button" onClick={() => toggleSiteTag(site._id, tag)}
                                                                            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                                                                                selected
                                                                                    ? (isNew ? `${TAG_NEW} border-dashed` : TAG_ACTIVE)
                                                                                    : 'border-app-border/30 text-app-text-muted/40 line-through opacity-50'
                                                                            }`}
                                                                            title={`${tag} (${inCur && inImp ? 'current + import' : inCur ? 'current' : 'import'}) — click to ${selected ? 'remove' : 'add'}`}
                                                                        >
                                                                            <span className={`text-[8px] font-bold px-1 py-px rounded border leading-none ${originClass}`}>{originLabel}</span>
                                                                            {isNew && <PlusIcon className="w-2.5 h-2.5" />}
                                                                            {tag}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Pricing picker */}
                                                    <div className={`space-y-1.5 pb-2.5 ${(allCats.length > 0 || allTags.length > 0) ? 'pt-2.5 border-t border-app-border/30' : ''}`}>
                                                        <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Pricing</span>
                                                        {diffPricing ? (
                                                            <div className="flex flex-col sm:flex-row gap-1.5">
                                                                <button type="button" onClick={() => setFieldValue(site._id, 'pricing', site._currentPricing)}
                                                                    className={`px-2 py-1 sm:py-0.5 text-[10px] rounded border transition-colors ${site.pricing === site._currentPricing ? 'bg-app-bg-secondary border-app-border text-app-text-primary' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                    <span className="text-[9px] text-app-text-muted mr-1">Current:</span>{PRICING_LABELS[site._currentPricing] || site._currentPricing}
                                                                </button>
                                                                <button type="button" onClick={() => setFieldValue(site._id, 'pricing', site._importPricing)}
                                                                    className={`px-2 py-1 sm:py-0.5 text-[10px] rounded border transition-colors ${site.pricing === site._importPricing ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                    <span className="text-[9px] text-purple-300/70 mr-1">Import:</span>{PRICING_LABELS[site._importPricing] || site._importPricing}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <Badge size="xs" color={PRICING_COLORS[pricing] || 'gray'}>{PRICING_LABELS[pricing] || pricing}</Badge>
                                                        )}
                                                    </div>

                                                    {/* Description picker */}
                                                    {diffDesc ? (
                                                        <div className="space-y-1.5 pb-2.5 pt-2.5 border-t border-app-border/30">
                                                            <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Description</span>
                                                            <div className="space-y-1">
                                                                {site._currentDesc && (
                                                                    <button type="button" onClick={() => setFieldValue(site._id, 'description', site._currentDesc)}
                                                                        className={`w-full text-left px-2 py-1.5 sm:py-1 text-[11px] rounded border transition-colors ${site.description === site._currentDesc ? 'bg-app-bg-secondary border-app-border text-app-text-primary' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                        <span className="text-[9px] uppercase text-app-text-muted mr-1">Current:</span>
                                                                        <span className="line-clamp-2">{site._currentDesc}</span>
                                                                    </button>
                                                                )}
                                                                {site._importDesc && (
                                                                    <button type="button" onClick={() => setFieldValue(site._id, 'description', site._importDesc)}
                                                                        className={`w-full text-left px-2 py-1.5 sm:py-1 text-[11px] rounded border transition-colors ${site.description === site._importDesc ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                        <span className="text-[9px] uppercase text-purple-300/70 mr-1">Import:</span>
                                                                        <span className="line-clamp-2">{site._importDesc}</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : site.description ? (
                                                        <div className="flex items-start gap-1.5 pb-2.5 pt-2.5 border-t border-app-border/30">
                                                            <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Desc:</span>
                                                            <span className="text-[11px] text-app-text-secondary line-clamp-2">{site.description}</span>
                                                        </div>
                                                    ) : null}

                                                    {/* Use Case picker */}
                                                    {diffUse ? (
                                                        <div className="space-y-1.5 pb-2.5 pt-2.5 border-t border-app-border/30">
                                                            <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Use Case</span>
                                                            <div className="space-y-1">
                                                                {site._currentUseCase && (
                                                                    <button type="button" onClick={() => setFieldValue(site._id, 'use_case', site._currentUseCase)}
                                                                        className={`w-full text-left px-2 py-1.5 sm:py-1 text-[11px] rounded border transition-colors ${site.use_case === site._currentUseCase ? 'bg-app-bg-secondary border-app-border text-app-text-primary' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                        <span className="text-[9px] uppercase text-app-text-muted mr-1">Current:</span>
                                                                        <span className="line-clamp-2">{site._currentUseCase}</span>
                                                                    </button>
                                                                )}
                                                                {site._importUseCase && (
                                                                    <button type="button" onClick={() => setFieldValue(site._id, 'use_case', site._importUseCase)}
                                                                        className={`w-full text-left px-2 py-1.5 sm:py-1 text-[11px] rounded border transition-colors ${site.use_case === site._importUseCase ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'border-app-border/30 text-app-text-muted hover:border-app-border/60'}`}>
                                                                        <span className="text-[9px] uppercase text-purple-300/70 mr-1">Import:</span>
                                                                        <span className="line-clamp-2">{site._importUseCase}</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : site.use_case ? (
                                                        <div className="flex items-start gap-1.5 pb-2.5 pt-2.5 border-t border-app-border/30">
                                                            <span className="text-[10px] text-app-text-muted uppercase flex-shrink-0 mt-px">Use:</span>
                                                            <span className="text-[11px] text-app-text-secondary line-clamp-2">{site.use_case}</span>
                                                        </div>
                                                    ) : null}

                                                    {/* Legend */}
                                                    <div className="flex items-center gap-4 pt-2.5 border-t border-app-border/30">
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] text-app-text-muted">
                                                            <span className="text-[8px] font-bold px-1 py-px rounded border bg-gray-500/20 text-gray-300 border-gray-500/30 leading-none">C</span>current
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] text-app-text-muted">
                                                            <span className="text-[8px] font-bold px-1 py-px rounded border bg-purple-500/20 text-purple-300 border-purple-500/30 leading-none">I</span>import
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] text-app-text-muted">
                                                            <span className="text-[8px] font-bold px-1 py-px rounded border bg-blue-500/20 text-blue-300 border-blue-500/30 leading-none">C+I</span>both
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* ── Simple view for NEW sites ── */}
                                        {!isEditing && !currentSite && (
                                            <div className="space-y-1 mt-1.5">
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
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge size="xs" color={PRICING_COLORS[pricing] || 'gray'}>{PRICING_LABELS[pricing] || pricing}</Badge>
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
                                    <div className="px-2 sm:px-3 pb-3 pt-0 space-y-2 bg-purple-500/5 border-t border-purple-500/10">
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
                                                currentSet={site._currentCats ? new Set(site._currentCats.map(c => c.toLowerCase())) : null}
                                                importSet={site._importCats ? new Set(site._importCats.map(c => c.toLowerCase())) : null}
                                                originImportClass="bg-purple-500/20 text-purple-300 border-purple-500/30"
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
                                                currentSet={site._currentTags ? new Set(site._currentTags.map(t => t.toLowerCase())) : null}
                                                importSet={site._importTags ? new Set(site._importTags.map(t => t.toLowerCase())) : null}
                                                originImportClass="bg-teal-500/20 text-teal-300 border-teal-500/30"
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
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button variant="secondary" onClick={onClose} disabled={importing} className="flex-1 sm:flex-none">Cancel</Button>
                        <Button variant="primary" onClick={handleConfirm} loading={importing} disabled={selectedCount === 0} className="flex-1 sm:flex-none">
                            Import {selectedCount} Site{selectedCount !== 1 ? 's' : ''}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
