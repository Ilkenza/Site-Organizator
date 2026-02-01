import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { suggestCategories } from '../../lib/categorySuggestions';

export default function SiteModal({ isOpen, onClose, site = null, defaultFavorite = false, defaultCategoryId = null, defaultTagId = null }) {
    const { categories, tags, addSite, updateSite, failedRelationUpdates, retrySiteRelations } = useDashboard();
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
    const [suggestedCategories, setSuggestedCategories] = useState([]);
    const [retryingRelations, setRetryingRelations] = useState(false);

    // Reset form when modal opens/closes or site changes
    useEffect(() => {
        if (isOpen) {
            if (site) {
                const siteCategories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
                const siteTags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];

                // Filter and map to IDs, handling both object and string formats
                const categoryIds = (Array.isArray(siteCategories) ? siteCategories : [])
                    .map(c => typeof c === 'object' && c?.id ? c.id : null)
                    .filter(Boolean);
                const tagIds = (Array.isArray(siteTags) ? siteTags : [])
                    .map(t => typeof t === 'object' && t?.id ? t.id : null)
                    .filter(Boolean);


                setFormData({
                    name: site.name || '',
                    url: site.url || '',
                    pricing: site.pricing || 'fully_free',
                    is_favorite: site.is_favorite || false,
                    categoryIds,
                    tagIds
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
    }, [isOpen, site, defaultCategoryId, defaultFavorite, defaultTagId]);

    // Auto-suggest categories based on URL
    useEffect(() => {
        if (formData.url && formData.url.trim()) {
            const { categoryIds, suggestions } = suggestCategories(
                formData.url,
                formData.name,
                categories
            );

            if (categoryIds.length > 0 && !site) {
                // Only auto-apply suggestions for new sites
                setSuggestedCategories(suggestions);
            }
        } else {
            setSuggestedCategories([]);
        }
    }, [formData.url, formData.name, categories, site]);

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
                throw new Error('Minimum 1 category is required');
            }
            if (formData.tagIds.length === 0) {
                throw new Error('Minimum 1 tag is required');
            }
            if (!formData.pricing) {
                throw new Error('Pricing model is required');
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

                {/* Retry relations banner (shown when previous update failed to attach categories/tags) */}
                {isEditing && site?.id && failedRelationUpdates?.[site.id] && (
                    <div className="mb-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg text-yellow-200 text-sm flex items-center justify-between gap-3">
                        <div>
                            Relation updates for this site previously failed (missing SUPABASE_SERVICE_ROLE_KEY or RLS). You can retry attaching categories/tags now.
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    setRetryingRelations(true);
                                    try {
                                        await retrySiteRelations(site.id);
                                        setError(null);
                                    } catch (err) {
                                        setError(err.message || String(err));
                                    } finally {
                                        setRetryingRelations(false);
                                    }
                                }}
                                disabled={retryingRelations}
                                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg font-medium disabled:opacity-60"
                            >
                                {retryingRelations ? 'Retrying...' : 'Retry relations'}
                            </button>
                        </div>
                    </div>
                )}

                <Input
                    label="Name *"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., GitHub"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const urlInput = document.querySelector('input[name="url"]');
                            urlInput?.focus();
                        }
                    }}
                />

                <Input
                    label="URL *"
                    name="url"
                    type="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="https://github.com"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const pricingButtons = document.querySelectorAll('button[type="button"]');
                            const fullyFreeButton = Array.from(pricingButtons).find(btn => btn.textContent.includes('✓'));
                            if (fullyFreeButton) {
                                fullyFreeButton.focus();
                            }
                        }
                    }}
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
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                data-pricing={option.value}
                                onClick={() => setFormData(prev => ({ ...prev, pricing: option.value }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        setFormData(prev => ({ ...prev, pricing: option.value }));
                                        const favoriteButton = document.querySelector('button[data-favorite]');
                                        if (favoriteButton) {
                                            favoriteButton.focus();
                                        }
                                    }
                                }}
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
                        data-favorite="toggle"
                        onClick={() => setFormData(prev => ({ ...prev, is_favorite: !prev.is_favorite }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                setFormData(prev => ({ ...prev, is_favorite: !prev.is_favorite }));
                                const categoryButtons = document.querySelectorAll('button[data-category-id]');
                                if (categoryButtons.length > 0) {
                                    categoryButtons[0].focus();
                                }
                            }
                        }}
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
                        {/* Suggested categories */}
                        {suggestedCategories.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mb-2 p-2 bg-app-accent/5 border border-app-accent/20 rounded-lg">
                                <svg className="w-4 h-4 text-app-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <span className="text-xs text-app-text-secondary">
                                    Suggested:
                                </span>
                                {suggestedCategories.map(suggestion => {
                                    const matchedCategory = categories.find(c => c.name.toLowerCase() === suggestion.toLowerCase());
                                    if (!matchedCategory) return null;
                                    return (
                                        <button
                                            key={matchedCategory.id}
                                            type="button"
                                            onClick={() => handleCategoryToggle(matchedCategory.id)}
                                            className="px-2 py-1 text-xs bg-app-accent/10 hover:bg-app-accent/20 text-app-accent border border-app-accent/30 rounded-md transition-colors"
                                        >
                                            + {matchedCategory.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const tagSearchInputs = document.querySelectorAll('input[placeholder="Search..."]');
                                        const tagSearchInput = tagSearchInputs[1];
                                        if (tagSearchInput) {
                                            tagSearchInput.focus();
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div className="bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {(() => {
                                const filtered = categories
                                    .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .sort((a, b) => {
                                        const aSelected = formData.categoryIds.includes(a.id);
                                        const bSelected = formData.categoryIds.includes(b.id);
                                        if (aSelected && !bSelected) return -1;
                                        if (!aSelected && bSelected) return 1;
                                        return a.name.localeCompare(b.name);
                                    });
                                if (filtered.length === 0) {
                                    return <span className="text-xs text-app-text-muted italic">No categories found</span>;
                                }
                                return filtered.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        data-category-id={cat.id}
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
                                ));
                            })()}
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
                                className="px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-purple-500 w-28" onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }} />
                        </div>
                        <div className="bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {(() => {
                                const filtered = tags
                                    .filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                    .sort((a, b) => {
                                        const aSelected = formData.tagIds.includes(a.id);
                                        const bSelected = formData.tagIds.includes(b.id);
                                        if (aSelected && !bSelected) return -1;
                                        if (!aSelected && bSelected) return 1;
                                        return a.name.localeCompare(b.name);
                                    });
                                if (filtered.length === 0) {
                                    return <span className="text-xs text-app-text-muted italic">No tags found</span>;
                                }
                                return filtered.map(tag => (
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
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
}
