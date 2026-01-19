import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function TagModal({ isOpen, onClose, tag = null }) {
    const { addTag, updateTag } = useDashboard();
    const isEditing = !!tag;

    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setName(tag?.name || '');
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

            const payload = { name: name.trim() };

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

                <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-gray-400">Preview:</span>
                    <span className="px-3 py-1 bg-purple-900/50 text-purple-300 border border-purple-700 rounded-full text-sm">
                        #{name || 'tagname'}
                    </span>
                </div>
            </form>
        </Modal>
    );
}
