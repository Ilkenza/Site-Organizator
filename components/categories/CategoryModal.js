import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

const COLORS = [
    '#667eea', // Purple
    '#6CBBFB', // Blue
    '#52A69B', // Teal
    '#D98B8B', // Coral
    '#E0A96D', // Orange
    '#D98BAC', // Pink
    '#D4B86A', // Yellow/Gold
];

export default function CategoryModal({ isOpen, onClose, category = null }) {
    const { addCategory, updateCategory } = useDashboard();
    const { user } = useAuth();
    const isEditing = !!category;

    const [formData, setFormData] = useState({
        name: '',
        color: COLORS[0]
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (category) {
                setFormData({
                    name: category.name || '',
                    color: category.color || COLORS[0]
                });
            } else {
                setFormData({
                    name: '',
                    color: COLORS[Math.floor(Math.random() * COLORS.length)]
                });
            }
            setError(null);
        }
    }, [isOpen, category]);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!formData.name.trim()) {
                throw new Error('Category name is required');
            }

            const payload = {
                name: formData.name.trim(),
                color: formData.color,
                user_id: user?.id
            };

            if (isEditing) {
                await updateCategory(category.id, payload);
            } else {
                await addCategory(payload);
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
            title={isEditing ? 'Edit Category' : 'Add New Category'}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} loading={loading}>
                        {isEditing ? 'Save Changes' : 'Add Category'}
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
                    label="Category Name *"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Development Tools"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            // Focus na prvi color button
                            const colorButtons = document.querySelectorAll('button[data-color]');
                            if (colorButtons.length > 0) {
                                colorButtons[0].focus();
                            }
                        }
                    }}
                />

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Color</label>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                data-color={color}
                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        setFormData(prev => ({ ...prev, color }));
                                        handleSubmit(e);
                                    }
                                }}
                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 
                  ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-gray-400">Preview:</span>
                    <span
                        className="px-3 py-1 rounded-lg text-sm text-white"
                        style={{ backgroundColor: formData.color }}
                    >
                        {formData.name || 'Category Name'}
                    </span>
                </div>
            </form>
        </Modal>
    );
}
