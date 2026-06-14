import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const COMMON_PLATFORMS = ['Udemy', 'Coursera', 'Pluralsight', 'Skillshare', 'LinkedIn Learning', 'Frontend Masters', 'Egghead', 'YouTube', 'freeCodeCamp', 'Codecademy', 'edX', 'Khan Academy', 'Domestika', 'Laracasts'];

const STATUS_OPTIONS = [
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
];

export default function CourseModal({ isOpen, onClose, course = null }) {
    const { addCourse, updateCourse } = useDashboard();
    const isEditing = !!course;

    const [formData, setFormData] = useState({
        name: '', platform: '', link: '', status: 'not_started', progress: 0, category: '', notes_text: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (course) {
                setFormData({
                    name: course.name || '',
                    platform: course.platform || '',
                    link: course.link || '',
                    status: course.status || 'not_started',
                    progress: course.progress || 0,
                    category: course.category || '',
                    notes_text: course.notes_text || '',
                });
            } else {
                setFormData({ name: '', platform: '', link: '', status: 'not_started', progress: 0, category: '', notes_text: '' });
            }
            setError(null);
        }
    }, [isOpen, course]);

    const handleStatusChange = (status) => {
        setFormData(prev => ({
            ...prev,
            status,
            progress: status === 'completed' ? 100 : (status === 'not_started' ? 0 : prev.progress),
        }));
    };

    const handleProgressChange = (progress) => {
        const p = Math.max(0, Math.min(100, parseInt(progress, 10) || 0));
        setFormData(prev => ({
            ...prev,
            progress: p,
            status: p === 100 ? 'completed' : (p > 0 ? 'in_progress' : prev.status),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { setError('Name is required'); return; }
        setLoading(true);
        setError(null);
        try {
            const data = {
                name: formData.name.trim(),
                platform: formData.platform.trim(),
                link: formData.link.trim(),
                status: formData.status,
                progress: formData.progress,
                category: formData.category.trim(),
                notes_text: formData.notes_text.trim(),
            };
            if (isEditing) {
                await updateCourse(course.id, data);
            } else {
                await addCourse(data);
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Course' : 'Add Course'} size="md">
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
                        placeholder="Course name..."
                        autoFocus
                    />
                </div>

                {/* Platform + Category row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-1">Platform</label>
                        <input
                            type="text"
                            value={formData.platform}
                            onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                            className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                            placeholder="Udemy..."
                            list="platform-suggestions"
                        />
                        <datalist id="platform-suggestions">
                            {COMMON_PLATFORMS.map(p => <option key={p} value={p} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-1">Category</label>
                        <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent"
                            placeholder="Web Development..."
                        />
                    </div>
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

                {/* Status + Progress */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-1 focus:ring-app-accent"
                        >
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-1">Progress ({formData.progress}%)</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={formData.progress}
                            onChange={(e) => handleProgressChange(e.target.value)}
                            className="w-full h-2 mt-2.5 bg-app-bg-card rounded-lg appearance-none cursor-pointer accent-app-accent"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">Notes</label>
                    <textarea
                        value={formData.notes_text}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes_text: e.target.value }))}
                        className="w-full px-3 py-2 bg-app-bg-light border border-app-border rounded-lg text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent resize-y min-h-[80px]"
                        placeholder="Personal notes about this course..."
                        rows={3}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={loading} disabled={loading || !formData.name.trim()}>
                        {isEditing ? 'Save Changes' : 'Add Course'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
