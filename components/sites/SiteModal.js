import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';

export default function SiteModal({ isOpen, onClose, site = null, defaultFavorite = false, defaultCategoryId = null, defaultTagId = null }) {
    const { categories, tags, addSite, updateSite } = useDashboard();
    const isEditing = !!site;

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        pricing: 'fully_free',
        is_favorite: false,
        categoryIds: [],
        tagIds: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [categorySearch, setCategorySearch] = useState('');
    const [tagSearch, setTagSearch] = useState('');

    // Reset form when modal opens/closes or site changes
    useEffect(() => {
        if (isOpen) {
            if (site) {
                const siteCategories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
                const siteTags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];

                setFormData({
                    name: site.name || '',
                    url: site.url || '',
                    pricing: site.pricing || 'fully_free',
                    is_favorite: site.is_favorite || false,
                    categoryIds: siteCategories.map(c => c.id),
                    tagIds: siteTags.map(t => t.id)
                });
            } else {
                setFormData({
                    name: '',
                    url: '',
                    pricing: 'fully_free',
                    is_favorite: defaultFavorite,
                    categoryIds: defaultCategoryId ? [defaultCategoryId] : [],
                    tagIds: defaultTagId ? [defaultTagId] : []
                });
            }
            setError(null);
            setCategorySearch('');
            setTagSearch('');
        }
    }, [isOpen, site]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCategoryToggle = (categoryId) => {
        setFormData(prev => ({
            ...prev,
            categoryIds: prev.categoryIds.includes(categoryId)
                ? prev.categoryIds.filter(id => id !== categoryId)
                : [...prev.categoryIds, categoryId]
        }));
    };

    const handleTagToggle = (tagId) => {
        setFormData(prev => ({
            ...prev,
            tagIds: prev.tagIds.includes(tagId)
                ? prev.tagIds.filter(id => id !== tagId)
                : [...prev.tagIds, tagId]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate
            if (!formData.name.trim()) {
                throw new Error('Site name is required');
            }
            if (!formData.url.trim()) {
                throw new Error('URL is required');
            }
            if (formData.categoryIds.length === 0) {
                throw new Error('Trebam minimum 1 kategoriju');
            }
            if (formData.tagIds.length === 0) {
                throw new Error('Trebam minimum 1 tag');
            }
            if (!formData.pricing) {
                throw new Error('Trebam pricing model');
            }

            // Normalize URL
            let url = formData.url.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const payload = {
                name: formData.name.trim(),
                url,
                pricing: formData.pricing,
                category_ids: formData.categoryIds,
                tag_ids: formData.tagIds,
                is_favorite: formData.is_favorite
            };

            if (isEditing) {
                await updateSite(site.id, payload);
                // Wait for complete refetch including categories/tags
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                await addSite(payload);
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
            title={isEditing ? 'Edit Site' : 'Add New Site'}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} loading={loading}>
                        {isEditing ? 'Save Changes' : 'Add Site'}
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
                    label="Site Name *"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., GitHub"
                    autoFocus
                />

                <Input
                    label="URL *"
                    name="url"
                    type="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="https://github.com"
                />

                {/* Pricing Model */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-app-text-primary">Pricing Model *</label>
                    <div className="bg-app-bg-light border border-app-border rounded-lg p-2 grid grid-cols-2 gap-2">
                        {[
                            { value: 'fully_free', label: 'Fully Free', icon: '✓', bgSelected: 'bg-emerald-600', ring: 'ring-emerald-400', bgHover: 'hover:bg-emerald-900/30' },
                            { value: 'freemium', label: 'Freemium', icon: '◐', bgSelected: 'bg-blue-600', ring: 'ring-blue-400', bgHover: 'hover:bg-blue-900/30' },
                            { value: 'free_trial', label: 'Free Trial', icon: '⏱', bgSelected: 'bg-amber-600', ring: 'ring-amber-400', bgHover: 'hover:bg-amber-900/30' },
                            { value: 'paid', label: 'Paid', icon: '$', bgSelected: 'bg-rose-600', ring: 'ring-rose-400', bgHover: 'hover:bg-rose-900/30' }
                        ].map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, pricing: option.value }))}
                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${formData.pricing === option.value
                                    ? `${option.bgSelected} text-white ${option.ring} ring-2 border-transparent shadow-lg`
                                    : `bg-app-bg-secondary/50 text-app-text-secondary border-app-border/50 ${option.bgHover}`
                                    }`}
                            >
                                <span className="text-base">{option.icon}</span>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Favorites Toggle */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-app-text-primary">Favorites</label>
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, is_favorite: !prev.is_favorite }))}
                        className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-all border-2 ${formData.is_favorite
                            ? 'bg-gradient-to-r from-yellow-600/20 to-amber-600/20 text-yellow-400 border-yellow-500/40 shadow-lg shadow-yellow-900/20'
                            : 'bg-app-bg-light text-app-text-secondary border-app-border hover:border-app-border hover:bg-app-bg-lighter/30'
                            }`}
                    >
                        <span className={`transition-transform ${formData.is_favorite ? 'scale-110' : ''}`}>
                            <svg className={`w-6 h-6 ${formData.is_favorite ? 'text-yellow-400' : 'text-app-text-secondary'}`} fill={formData.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={formData.is_favorite ? 0 : 1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </span>
                        <span>{formData.is_favorite ? 'Added to Favorites!' : 'Click to add to Favorites'}</span>
                    </button>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="block text-sm font-medium text-app-text-primary">
                                Categories *
                                {formData.categoryIds.length > 0 && (
                                    <span className="ml-2 text-xs text-app-accent">({formData.categoryIds.length} selected)</span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                placeholder="Search..."
                                className="px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent w-28"
                            />
                        </div>
                        <div className="bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                            {categories
                                .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                .map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleCategoryToggle(cat.id)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${formData.categoryIds.includes(cat.id)
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                                            : 'bg-app-bg-secondary/50 text-app-text-secondary border-transparent hover:bg-app-bg-lighter hover:border-app-border'
                                            }`}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full ring-1 ring-white/20"
                                            style={{ backgroundColor: cat.color || '#6b7280' }}
                                        />
                                        {cat.name}
                                    </button>
                                ))}
                        </div>
                    </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="block text-sm font-medium text-app-text-primary">
                                Tags *
                                {formData.tagIds.length > 0 && (
                                    <span className="ml-2 text-xs text-purple-400">({formData.tagIds.length} selected)</span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                placeholder="Search..."
                                className="px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-purple-500 w-28"
                            />
                        </div>
                        <div className="bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                            {tags
                                .filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                .map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => handleTagToggle(tag.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${formData.tagIds.includes(tag.id)
                                            ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                                            : 'bg-app-bg-secondary/50 text-app-text-secondary border-transparent hover:bg-app-bg-lighter hover:border-app-border'
                                            }`}
                                    >
                                        #{tag.name}
                                    </button>
                                ))}
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
}
