import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { TAG_COLORS } from '../../lib/sharedColors';

export default function TagModal({ isOpen, onClose, tag = null }) {
    const { addTag, updateTag } = useDashboard();
    const { user } = useAuth();
    const isEditing = !!tag;

    const [name, setName] = useState('');
    const [color, setColor] = useState(TAG_COLORS[0].hex);
    const [isNeeded, setIsNeeded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setName(tag?.name || '');
            setColor(tag?.color || TAG_COLORS[0].hex);
            setIsNeeded(tag?.is_needed ?? false);
            setError(null);
        }
    }, [isOpen, tag]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!name.trim()) {
                throw new Error('Tag name is required');
            }

            if (!user?.id) {
                throw new Error('You must be logged in to create tags');
            }

            const payload = { name: name.trim(), color, is_needed: isNeeded, user_id: user.id };

            if (isEditing) {
                await updateTag(tag.id, payload);
            } else {
                await addTag(payload);
            }

            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Tag' : 'Add New Tag'}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} loading={loading}>
                        {isEditing ? 'Save Changes' : 'Add Tag'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                <Input
                    label="Tag Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., tutorial"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const colorButtons = document.querySelectorAll('button[data-tag-color]');
                            if (colorButtons.length > 0) {
                                colorButtons[0].focus();
                            }
                        }
                    }}
                />

                {/* Color Picker */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-app-text-primary">Color</label>
                    <div className="flex items-center gap-3">
                        {TAG_COLORS.map((c) => (
                            <button
                                key={c.hex}
                                type="button"
                                data-tag-color={c.hex}
                                onClick={() => setColor(c.hex)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        setColor(c.hex);
                                        handleSubmit(e);
                                    }
                                }}
                                className={`w-10 h-10 rounded-full transition-all ${color === c.hex
                                    ? 'ring-2 ring-white ring-offset-2 ring-offset-app-bg-primary scale-110'
                                    : 'hover:scale-105'
                                    }`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-app-text-secondary">Preview:</span>
                    <span
                        className="px-3 py-1 rounded-full text-sm font-medium border"
                        style={{
                            backgroundColor: `${color}20`,
                            color: color,
                            borderColor: `${color}50`
                        }}
                    >
                        #{name || 'tagname'}
                    </span>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-app-text-primary">Needed</label>
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-lg border border-app-border bg-app-bg-secondary/60">
                        <button
                            type="button"
                            onClick={() => setIsNeeded(true)}
                            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${isNeeded
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'text-app-text-secondary hover:text-app-text-primary'
                                }`}
                        >
                            Needed
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsNeeded(false)}
                            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${!isNeeded
                                ? 'bg-app-bg-light text-app-text-primary border border-app-border'
                                : 'text-app-text-secondary hover:text-app-text-primary'
                                }`}
                        >
                            Not needed
                        </button>
                    </div>
                    <p className="text-xs text-app-text-muted">Used for filtering and badges.</p>
                </div>
            </form>
        </Modal>
    );
}
