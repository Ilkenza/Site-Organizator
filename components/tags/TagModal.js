import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

// 3 vibrant tag colors (different from category colors)
const TAG_COLORS = [
    { hex: '#5B8DEE', name: 'Ocean Blue' },
    { hex: '#4CAF7D', name: 'Emerald Green' },
    { hex: '#E57399', name: 'Rose Pink' },
];

export default function TagModal({ isOpen, onClose, tag = null }) {
    const { addTag, updateTag } = useDashboard();
    const { user } = useAuth();
    const isEditing = !!tag;

    const [name, setName] = useState('');
    const [color, setColor] = useState(TAG_COLORS[0].hex);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setName(tag?.name || '');
            setColor(tag?.color || TAG_COLORS[0].hex);
            setError(null);
        }
    }, [isOpen, tag]);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!name.trim()) {
                throw new Error('Tag name is required');
            }

            const payload = { name: name.trim(), color, user_id: user?.id };

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
                />

                {/* Color Picker */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-app-text-primary">Color</label>
                    <div className="flex items-center gap-3">
                        {TAG_COLORS.map((c) => (
                            <button
                                key={c.hex}
                                type="button"
                                onClick={() => setColor(c.hex)}
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
                    <span className="text-sm text-gray-400">Preview:</span>
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
            </form>
        </Modal>
    );
}
