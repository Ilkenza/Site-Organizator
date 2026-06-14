import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const COMMON_LOCATIONS = ['Google Drive', 'Dropbox', 'OneDrive', 'iCloud', 'MEGA', 'pCloud', 'Backblaze', 'AWS S3', 'Local', 'NAS', 'USB', 'External HDD'];

const TYPE_GROUPS = [
    { label: 'Images', color: '#f472b6', formats: ['PNG', 'JPG', 'SVG', 'GIF', 'WEBP', 'ICO', 'BMP', 'TIFF'] },
    { label: 'Documents', color: '#60a5fa', formats: ['PDF', 'TXT', 'DOC', 'DOCX', 'RTF', 'MD'] },
    { label: 'Spreadsheets', color: '#34d399', formats: ['XLS', 'XLSX', 'CSV', 'ODS'] },
    { label: 'Presentations', color: '#fbbf24', formats: ['PPT', 'PPTX', 'KEY'] },
    { label: 'Video', color: '#a78bfa', formats: ['MP4', 'MOV', 'AVI', 'WEBM', 'MKV'] },
    { label: 'Audio', color: '#fb923c', formats: ['MP3', 'WAV', 'OGG', 'FLAC', 'AAC'] },
    { label: 'Code', color: '#4ade80', formats: ['JSON', 'HTML', 'CSS', 'JS', 'TS', 'PY', 'SQL', 'XML', 'YAML'] },
    { label: 'Archives', color: '#94a3b8', formats: ['ZIP', 'RAR', '7Z', 'TAR', 'GZ'] },
    { label: 'Design', color: '#f43f5e', formats: ['PSD', 'AI', 'FIGMA', 'SKETCH', 'XD', 'INDD'] },
    { label: 'Fonts', color: '#e879f9', formats: ['TTF', 'OTF', 'WOFF', 'WOFF2'] },
];
const ALL_KNOWN = TYPE_GROUPS.flatMap(g => [g.label, ...g.formats]);

export default function StorageModal({ isOpen, onClose, item = null }) {
    const { tags, addStorageItem, updateStorageItem } = useDashboard();
    const isEditing = !!item;

    const [formData, setFormData] = useState({ name: '', location: '', link: '', type: [], description: '' });
    const [selectedTagIds, setSelectedTagIds] = useState(new Set());
    const [tagSearch, setTagSearch] = useState('');
    const [customType, setCustomType] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (item) {
                setFormData({
                    name: item.name || '',
                    location: item.location || '',
                    link: item.link || '',
                    type: Array.isArray(item.type) ? item.type : (item.type ? [item.type] : []),
                    description: item.description || '',
                });
                setSelectedTagIds(new Set((item.tags_array || []).map(t => t.id)));
            } else {
                setFormData({ name: '', location: '', link: '', type: [], description: '' });
                setSelectedTagIds(new Set());
            }
            setError(null);
            setTagSearch('');
            setCustomType('');
        }
    }, [isOpen, item]);

    const toggleType = (t) => {
        setFormData(prev => {
            const arr = prev.type || [];
            return { ...prev, type: arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t] };
        });
    };

    const toggleGroup = (group) => {
        setFormData(prev => {
            const arr = prev.type || [];
            const allItems = [group.label, ...group.formats];
            const allSelected = allItems.every(t => arr.includes(t));
            if (allSelected) {
                return { ...prev, type: arr.filter(x => !allItems.includes(x)) };
            } else {
                const toAdd = allItems.filter(t => !arr.includes(t));
                return { ...prev, type: [...arr, ...toAdd] };
            }
        });
    };

    const addCustomType = () => {
        const val = customType.trim().toUpperCase();
        if (val && !(formData.type || []).includes(val)) {
            setFormData(prev => ({ ...prev, type: [...(prev.type || []), val] }));
        }
        setCustomType('');
    };

    const toggleTag = (id) => {
        setSelectedTagIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const filteredTags = (tags || [])
        .filter(t => t?.name?.toLowerCase().includes(tagSearch.toLowerCase()))
        .sort((a, b) => {
            const as = selectedTagIds.has(a.id) ? 0 : 1;
            const bs = selectedTagIds.has(b.id) ? 0 : 1;
            if (as !== bs) return as - bs;
            return a.name.localeCompare(b.name);
        });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { setError('Name is required'); return; }
        setLoading(true);
        setError(null);
        try {
            const data = {
                name: formData.name.trim(),
                location: formData.location.trim(),
                link: formData.link.trim(),
                type: formData.type || [],
                description: formData.description.trim(),
                tagIds: Array.from(selectedTagIds),
            };
            if (isEditing) {
                await updateStorageItem(item.id, data);
            } else {
                await addStorageItem(data);
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Storage Item' : 'Add Storage Item'} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
                )}

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                        placeholder="File or image name..."
                        autoFocus
                    />
                </div>

                {/* Location */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Location</label>
                    <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                        placeholder="Google Drive..."
                        list="location-suggestions"
                    />
                    <datalist id="location-suggestions">
                        {COMMON_LOCATIONS.map(l => <option key={l} value={l} />)}
                    </datalist>
                </div>

                {/* File Types (grouped multi-select) */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">
                        File Types ({(formData.type || []).length} selected)
                    </label>
                    <div className="max-h-48 overflow-y-auto p-2 bg-app-bg-light border border-app-border rounded-lg space-y-2">
                        {TYPE_GROUPS.map(group => {
                            const arr = formData.type || [];
                            const allItems = [group.label, ...group.formats];
                            const selectedCount = allItems.filter(t => arr.includes(t)).length;
                            const allSelected = selectedCount === allItems.length;
                            const categorySelected = arr.includes(group.label);
                            return (
                                <div key={group.label}>
                                    <button type="button" onClick={() => toggleGroup(group)}
                                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold transition-all ${allSelected
                                            ? 'bg-app-accent/15 text-app-accent'
                                            : selectedCount > 0 ? 'text-app-text-primary' : 'text-app-text-secondary hover:text-app-text-primary'
                                            }`}>
                                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: group.color }} />
                                        {group.label}
                                        {selectedCount > 0 && <span className="text-[10px] text-app-text-muted ml-auto">{selectedCount}/{allItems.length}</span>}
                                    </button>
                                    <div className="flex flex-wrap gap-1 mt-1 ml-5">
                                        <button type="button" onClick={() => toggleType(group.label)}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${categorySelected
                                                ? 'text-white border border-transparent' : 'bg-app-bg-dark text-app-text-muted border border-app-border hover:border-app-text-muted'
                                                }`}
                                            style={categorySelected ? { backgroundColor: group.color + 'cc', borderColor: group.color } : {}}>
                                            {group.label}
                                        </button>
                                        {group.formats.map(fmt => {
                                            const isSel = arr.includes(fmt);
                                            return (
                                                <button key={fmt} type="button" onClick={() => toggleType(fmt)}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${isSel
                                                        ? 'bg-app-accent/20 text-app-accent border border-app-accent/40'
                                                        : 'bg-app-bg-dark text-app-text-muted border border-app-border hover:border-app-text-muted'
                                                        }`}>{fmt}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input type="text" value={customType} onChange={e => setCustomType(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomType(); } }}
                            className="flex-1 px-2 py-1.5 bg-app-bg-light border border-app-border rounded text-xs text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent"
                            placeholder="Custom type..."
                        />
                        <button type="button" onClick={addCustomType} className="px-3 py-1.5 bg-app-accent/10 text-app-accent rounded text-xs hover:bg-app-accent/20 transition-colors">Add</button>
                    </div>
                    {(formData.type || []).filter(t => !ALL_KNOWN.includes(t)).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {(formData.type || []).filter(t => !ALL_KNOWN.includes(t)).map(t => (
                                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-app-accent/15 text-app-accent rounded text-xs">
                                    {t}
                                    <button type="button" onClick={() => toggleType(t)} className="hover:text-red-400">×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Link */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Link</label>
                    <input
                        type="url"
                        value={formData.link}
                        onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                        placeholder="https://..."
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent resize-y min-h-[80px]"
                        placeholder="Description..."
                        rows={3}
                    />
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Tags ({selectedTagIds.size} selected)</label>
                    <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full px-3 py-1.5 mb-2 bg-app-bg-light border border-app-border rounded-lg text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent"
                    />
                    <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                        {filteredTags.slice(0, 50).map(tag => {
                            const isSelected = selectedTagIds.has(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => toggleTag(tag.id)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 ${isSelected
                                        ? 'bg-app-accent/15 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#6b7280' }} />
                                    <span className="truncate flex-1">{tag.name}</span>
                                    {isSelected && <span className="text-app-accent text-xs">✓</span>}
                                </button>
                            );
                        })}
                        {filteredTags.length === 0 && <p className="text-xs text-app-text-muted text-center py-2">No tags found</p>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={loading} disabled={loading || !formData.name.trim()}>
                        {isEditing ? 'Save Changes' : 'Add Item'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
