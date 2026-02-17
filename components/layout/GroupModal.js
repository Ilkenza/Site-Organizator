import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';

const GROUP_COLORS = [
    '#f472b6', '#60a5fa', '#38bdf8', '#4ade80', '#2dd4bf',
    '#818cf8', '#c084fc', '#fbbf24', '#f87171', '#fb923c',
    '#a3e635', '#a78bfa', '#6ee7b7', '#fcd34d', '#f97316',
    '#34d399', '#f43f5e', '#e879f9', '#67e8f9', '#86efac',
];

const GROUP_ICONS = [
    '📁', '🎨', '🖥️', '⚙️', '📱', '🗄️', '🚀', '🧠', '📊',
    '🔒', '🔧', '🧪', '📚', '📦', '💼', '🛒', '📝', '💬',
    '🎬', '🧩', '🌐', '⭐', '🔥', '💡', '🎯', '🏠', '🎵',
    '📐', '🖌️', '💎', '🌍', '📡', '🛡️', '⚡', '🔗', '📌',
];

export default function GroupModal({ isOpen, onClose, categories, editGroup, onSave }) {
    const [name, setName] = useState(editGroup?.label || '');
    const [icon, setIcon] = useState(editGroup?.icon || '📁');
    const [color, setColor] = useState(editGroup?.color || '#60a5fa');
    const [selectedCatIds, setSelectedCatIds] = useState(new Set(editGroup?.categoryIds || []));
    const [search, setSearch] = useState('');
    const [showIcons, setShowIcons] = useState(false);

    const filteredCats = useMemo(() =>
        (categories || [])
            .filter(c => c?.name?.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                const aSelected = selectedCatIds.has(a.id) ? 0 : 1;
                const bSelected = selectedCatIds.has(b.id) ? 0 : 1;
                if (aSelected !== bSelected) return aSelected - bSelected;
                return a.name.localeCompare(b.name);
            }),
        [categories, search, selectedCatIds]
    );

    const toggleCat = (id) => {
        setSelectedCatIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            key: editGroup?.key || `custom_${Date.now()}`,
            label: name.trim(),
            icon,
            color,
            categoryIds: Array.from(selectedCatIds),
            isCustom: true,
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editGroup ? 'Edit Group' : 'New Group'} size="md">
            <div className="space-y-4">
                {/* Name + Icon */}
                <div className="flex gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowIcons(!showIcons)}
                            className="w-10 h-10 rounded-lg border border-app-border flex items-center justify-center text-xl hover:bg-app-bg-light transition-colors"
                            style={{ backgroundColor: `${color}20`, borderColor: `${color}50` }}
                            title="Pick icon"
                        >
                            {icon}
                        </button>
                        {showIcons && (
                            <div className="absolute top-12 left-0 z-50 bg-gray-800 border border-gray-700 rounded-lg p-2 grid grid-cols-6 gap-1 shadow-xl w-52">
                                {GROUP_ICONS.map(ic => (
                                    <button
                                        key={ic}
                                        onClick={() => { setIcon(ic); setShowIcons(false); }}
                                        className={`w-8 h-8 rounded flex items-center justify-center text-base hover:bg-gray-700 ${icon === ic ? 'bg-app-accent/20 ring-1 ring-app-accent' : ''}`}
                                    >
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Group name..."
                        className="flex-1 px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-sm text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-1 focus:ring-app-accent"
                        autoFocus
                    />
                </div>

                {/* Color picker */}
                <div>
                    <label className="block text-xs font-semibold text-app-text-tertiary uppercase mb-1.5">Color</label>
                    <div className="flex flex-wrap gap-1.5">
                        {GROUP_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110' : 'hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                {/* Categories selection */}
                <div>
                    <label className="block text-xs font-semibold text-app-text-tertiary uppercase mb-1.5">
                        Categories ({selectedCatIds.size} selected)
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full px-2 py-1.5 mb-2 bg-app-bg-light border border-app-border rounded text-xs text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-1 focus:ring-app-accent"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                        {filteredCats.map(cat => {
                            const isSelected = selectedCatIds.has(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => toggleCat(cat.id)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 ${isSelected
                                        ? 'bg-app-accent/15 text-app-accent border border-app-accent/30'
                                        : 'text-app-text-secondary hover:bg-app-bg-light border border-transparent'
                                        }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0"
                                        style={{ backgroundColor: cat.color || '#6b7280' }}
                                    />
                                    <span className="truncate flex-1">{cat.name}</span>
                                    {isSelected && <span className="text-app-accent">✓</span>}
                                </button>
                            );
                        })}
                        {filteredCats.length === 0 && (
                            <p className="text-xs text-app-text-muted text-center py-3">No categories found</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-app-border">
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-app-text-secondary border border-app-border hover:bg-app-bg-light"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-app-accent text-white hover:bg-app-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {editGroup ? 'Save' : 'Create Group'}
                </button>
            </div>
        </Modal>
    );
}
