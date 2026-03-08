import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { PlusIcon } from '../ui/Icons';

export default function NoteModal({ isOpen, onClose, note = null }) {
    const { noteGroups, addNote, updateNote, addNoteGroup } = useDashboard();
    const isEditing = !!note;

    const [formData, setFormData] = useState({ name: '', description: '', group_id: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#6366f1');
    const [creatingGroup, setCreatingGroup] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (note) {
                setFormData({
                    name: note.name || '',
                    description: note.description || '',
                    group_id: note.group_id || '',
                });
            } else {
                setFormData({ name: '', description: '', group_id: '' });
            }
            setError(null);
            setShowNewGroup(false);
            setNewGroupName('');
        }
    }, [isOpen, note]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                group_id: formData.group_id || null,
            };
            if (isEditing) {
                await updateNote(note.id, data);
            } else {
                await addNote(data);
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        setCreatingGroup(true);
        try {
            const group = await addNoteGroup({ name: newGroupName.trim(), color: newGroupColor });
            setFormData(prev => ({ ...prev, group_id: group.id }));
            setShowNewGroup(false);
            setNewGroupName('');
        } catch {
            // error handled in context
        } finally {
            setCreatingGroup(false);
        }
    };

    const GROUP_COLORS = [
        '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
        '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Note' : 'Add Quick Note'}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                        placeholder="Note name..."
                        autoFocus
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent resize-y min-h-[100px]"
                        placeholder="Write your note..."
                        rows={4}
                    />
                </div>

                {/* Group */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Group</label>
                    <div className="flex gap-2">
                        <select
                            value={formData.group_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, group_id: e.target.value }))}
                            className="flex-1 px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-1 focus:ring-app-accent"
                        >
                            <option value="">No group</option>
                            {noteGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setShowNewGroup(!showNewGroup)}
                            className="px-2 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-secondary hover:text-app-accent hover:border-app-accent/30 transition-colors"
                            title="Create new group"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Inline new group creation */}
                    {showNewGroup && (
                        <div className="mt-2 p-3 bg-app-bg-card border border-app-border rounded-lg space-y-2">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Group name..."
                                className="w-full px-3 py-1.5 text-sm bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateGroup(); } }}
                            />
                            <div className="flex items-center gap-1.5">
                                {GROUP_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setNewGroupColor(color)}
                                        className={`w-5 h-5 rounded-full border-2 transition-transform ${newGroupColor === color ? 'border-white scale-125' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim() || creatingGroup}
                                    loading={creatingGroup}
                                >
                                    Create Group
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={loading} disabled={loading || !formData.name.trim()}>
                        {isEditing ? 'Save Changes' : 'Add Note'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
