import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { suggestCategories } from '../../lib/categorySuggestions';
import { suggestTags } from '../../lib/tagSuggestions';

// Constants
const REFETCH_DELAY = 500;
const MAX_LIST_HEIGHT = 'max-h-32';
const ICON_SIZE_SM = 'w-3 h-3';
const ICON_SIZE_MD = 'w-4 h-4';

// CSS classes for reusability
const STYLES = {
    suggestion: {
        existing: 'flex items-center gap-2 flex-wrap p-2 rounded-lg',
        createNew: 'flex items-center gap-2 flex-wrap p-2 bg-green-500/5 border border-green-500/20 rounded-lg',
        button: 'px-2 py-1 text-xs rounded-md transition-colors',
        createButton: 'px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-md transition-colors flex items-center gap-1',
    },
    category: {
        suggestion: 'bg-app-accent/5 border border-app-accent/20',
        button: 'bg-app-accent/10 hover:bg-app-accent/20 text-app-accent border border-app-accent/30',
        iconColor: 'text-app-accent',
        selected: 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30',
        unselected: 'bg-app-bg-secondary/50 text-app-text-secondary border-transparent hover:bg-app-bg-lighter hover:border-app-border',
    },
    tag: {
        suggestion: 'bg-purple-500/5 border border-purple-500/20',
        button: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30',
        iconColor: 'text-purple-400',
        selected: 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30',
        unselected: 'bg-app-bg-secondary/50 text-app-text-secondary border-transparent hover:bg-app-bg-lighter hover:border-app-border',
    },
    common: {
        searchInput: 'px-2 py-1 text-xs bg-app-bg-secondary border border-app-border rounded text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-1 w-28',
        listContainer: 'bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 overflow-y-auto',
        itemButton: 'px-2.5 py-1 text-xs font-medium transition-all flex items-center border',
    },
};

// Validation messages
const VALIDATION_MESSAGES = {
    NAME_REQUIRED: 'Site name is required',
    URL_REQUIRED: 'URL is required',
    CATEGORY_REQUIRED: 'Minimum 1 category is required',
    TAG_REQUIRED: 'Minimum 1 tag is required',
    PRICING_REQUIRED: 'Pricing model is required',
};

// Pricing options
const PRICING_OPTIONS = [
    { value: 'fully_free', label: 'Fully Free', icon: '✓', bgSelected: 'bg-emerald-600', ring: 'ring-emerald-400', bgHover: 'hover:bg-emerald-900/30' },
    { value: 'freemium', label: 'Freemium', icon: '◐', bgSelected: 'bg-blue-600', ring: 'ring-blue-400', bgHover: 'hover:bg-blue-900/30' },
    { value: 'free_trial', label: 'Free Trial', icon: '⏱', bgSelected: 'bg-amber-600', ring: 'ring-amber-400', bgHover: 'hover:bg-amber-900/30' },
    { value: 'paid', label: 'Paid', icon: '$', bgSelected: 'bg-rose-600', ring: 'ring-rose-400', bgHover: 'hover:bg-rose-900/30' }
];

// Predefined colors for categories (same as CategoryModal.js)
const CATEGORY_COLORS = [
    '#667eea', // Purple
    '#6CBBFB', // Blue
    '#52A69B', // Teal
    '#D98B8B', // Coral
    '#E0A96D', // Orange
    '#D98BAC', // Pink
    '#D4B86A', // Yellow/Gold
];

// Tag colors (same as TagModal.js)
const TAG_COLORS = [
    { hex: '#7B9FD3', name: 'Ocean Blue' },
    { hex: '#6EAF8D', name: 'Emerald Green' },
    { hex: '#D8899E', name: 'Rose Pink' },
    { hex: '#A788C9', name: 'Purple' },
    { hex: '#D4A574', name: 'Orange' },
    { hex: '#85C5CE', name: 'Cyan' },
];

// SVG Icons
const LightbulbIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

const PlusIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const FolderIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
);

const TagIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
);

// Helper to capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper to sort items with selected first
function sortWithSelectedFirst(items, selectedIds, nameKey = 'name') {
    return items.sort((a, b) => {
        const aSelected = selectedIds.includes(a.id);
        const bSelected = selectedIds.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a[nameKey].localeCompare(b[nameKey]);
    });
}

// Helper to focus next element
function focusElement(selector) {
    const element = document.querySelector(selector);
    if (element) element.focus();
}

// Helper to extract relation IDs from site data
function extractRelationIds(relations) {
    return (Array.isArray(relations) ? relations : [])
        .map(item => typeof item === 'object' && item?.id ? item.id : null)
        .filter(Boolean);
}

// Helper to normalize URL
function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return 'https://' + trimmed;
    }
    return trimmed;
}

// Helper to filter existing suggestions
function filterExistingSuggestions(suggestions, existingItems) {
    return suggestions.filter(suggestion =>
        existingItems.find(item => item?.name?.toLowerCase() === suggestion.toLowerCase())
    );
}

// Helper to filter new suggestions
function filterNewSuggestions(suggestions, existingItems) {
    return suggestions.filter(suggestion =>
        !existingItems.find(item => item?.name?.toLowerCase() === suggestion.toLowerCase())
    );
}

// Helper to get random color from array
function getRandomColor(colorArray) {
    return colorArray[Math.floor(Math.random() * colorArray.length)];
}

// Helper to format tag name (lowercase)
function formatTagName(name) {
    return name.toLowerCase();
}

// Helper to add item to array field
function addToArrayField(setFormData, field, itemId) {
    setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], itemId]
    }));
}

// Helper to remove from suggestions
function removeFromSuggestions(setSuggestions, value) {
    setSuggestions(prev => prev.filter(s => s !== value));
}

export default function SiteModal({ isOpen, onClose, site = null, defaultFavorite = false, defaultCategoryId = null, defaultTagId = null }) {
    const { categories, tags, addSite, updateSite, failedRelationUpdates, retrySiteRelations, addCategory, addTag, user } = useDashboard();
    const { user: authUser } = useAuth();
    const isEditing = !!site;
    const currentUser = user || authUser;

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
    const [newCategorySuggestions, setNewCategorySuggestions] = useState([]);
    const [suggestedTags, setSuggestedTags] = useState([]);
    const [newTagSuggestions, setNewTagSuggestions] = useState([]);
    const [retryingRelations, setRetryingRelations] = useState(false);

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
                    categoryIds: extractRelationIds(siteCategories),
                    tagIds: extractRelationIds(siteTags)
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
        if (formData.url && formData.url.trim() && !site) {
            const { suggestions } = suggestCategories(
                formData.url,
                formData.name,
                categories
            );

            // Only auto-apply suggestions for new sites
            setSuggestedCategories(suggestions);

            // Find suggestions that don't exist yet
            setNewCategorySuggestions(filterNewSuggestions(suggestions, categories));
        } else {
            setSuggestedCategories([]);
            setNewCategorySuggestions([]);
        }
    }, [formData.url, formData.name, categories, site]);

    // Auto-suggest tags based on URL
    useEffect(() => {
        if (formData.url && formData.url.trim() && !site) {
            const { suggestions } = suggestTags(
                formData.url,
                formData.name,
                tags
            );

            // Only auto-apply suggestions for new sites
            setSuggestedTags(suggestions);

            // Find suggestions that don't exist yet
            setNewTagSuggestions(filterNewSuggestions(suggestions, tags));
        } else {
            setSuggestedTags([]);
            setNewTagSuggestions([]);
        }
    }, [formData.url, formData.name, tags, site]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const createToggleHandler = (fieldName) => (itemId) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: prev[fieldName].includes(itemId)
                ? prev[fieldName].filter(id => id !== itemId)
                : [...prev[fieldName], itemId]
        }));
    };

    const handleCategoryToggle = createToggleHandler('categoryIds');

    const handleCreateAndAddCategory = async (categoryName) => {
        try {
            const categoryData = {
                name: capitalize(categoryName),
                color: getRandomColor(CATEGORY_COLORS)
            };

            if (currentUser?.id) {
                categoryData.user_id = currentUser.id;
            }
            const newCategory = await addCategory(categoryData);
            addToArrayField(setFormData, 'categoryIds', newCategory.id);
            removeFromSuggestions(setNewCategorySuggestions, categoryName);
        } catch (err) {
            console.error('Failed to create category:', err);
        }
    };

    const handleCreateAndAddTag = async (tagName) => {
        try {
            const tagData = {
                name: formatTagName(tagName),
                color: getRandomColor(TAG_COLORS).hex
            };

            if (currentUser?.id) {
                tagData.user_id = currentUser.id;
            }

            const newTag = await addTag(tagData);
            addToArrayField(setFormData, 'tagIds', newTag.id);
            removeFromSuggestions(setNewTagSuggestions, tagName);
        } catch (err) {
            console.error('Failed to create tag:', err);
        }
    };

    const handleTagToggle = createToggleHandler('tagIds');

    const handleRetryRelations = async () => {
        setRetryingRelations(true);
        try {
            await retrySiteRelations(site.id);
            setError(null);
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setRetryingRelations(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate
            if (!formData.name.trim()) {
                throw new Error(VALIDATION_MESSAGES.NAME_REQUIRED);
            }
            if (!formData.url.trim()) {
                throw new Error(VALIDATION_MESSAGES.URL_REQUIRED);
            }
            if (formData.categoryIds.length === 0) {
                throw new Error(VALIDATION_MESSAGES.CATEGORY_REQUIRED);
            }
            if (formData.tagIds.length === 0) {
                throw new Error(VALIDATION_MESSAGES.TAG_REQUIRED);
            }
            if (!formData.pricing) {
                throw new Error(VALIDATION_MESSAGES.PRICING_REQUIRED);
            }

            // Normalize URL
            const url = normalizeUrl(formData.url);

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
                await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY));
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
                                onClick={handleRetryRelations}
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
                            focusElement('input[name="url"]');
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
                            const pricingButtons = document.querySelectorAll('button[data-pricing]');
                            if (pricingButtons.length > 0) pricingButtons[0].focus();
                        }
                    }}
                />

                {/* Pricing Model */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-app-text-primary">Pricing Model *</label>
                    <div className="bg-app-bg-light border border-app-border rounded-lg p-2 grid grid-cols-2 gap-2">
                        {PRICING_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                data-pricing={option.value}
                                onClick={() => setFormData(prev => ({ ...prev, pricing: option.value }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        setFormData(prev => ({ ...prev, pricing: option.value }));
                                        focusElement('button[data-favorite]');
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
                                if (categoryButtons.length > 0) categoryButtons[0].focus();
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
                        {(suggestedCategories.length > 0 || newCategorySuggestions.length > 0) && (
                            <div className="space-y-2">
                                {/* Existing category suggestions */}
                                {(() => {
                                    const existing = filterExistingSuggestions(suggestedCategories, categories);
                                    if (existing.length === 0) return null;

                                    return (
                                        <div className={`${STYLES.suggestion.existing} ${STYLES.category.suggestion}`}>
                                            <LightbulbIcon className={`w-4 h-4 ${STYLES.category.iconColor} flex-shrink-0`} />
                                            <span className="text-xs text-app-text-secondary">
                                                Suggested:
                                            </span>
                                            {suggestedCategories.map(suggestion => {
                                                const matchedCategory = categories.find(c => c?.name?.toLowerCase() === suggestion.toLowerCase());
                                                if (!matchedCategory) return null;
                                                return (
                                                    <button
                                                        key={matchedCategory.id}
                                                        type="button"
                                                        onClick={() => handleCategoryToggle(matchedCategory.id)}
                                                        className={`${STYLES.suggestion.button} ${STYLES.category.button}`}
                                                    >
                                                        {matchedCategory.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* New category suggestions (not in database yet) */}
                                {newCategorySuggestions.length > 0 && (
                                    <div className={STYLES.suggestion.createNew}>
                                        <PlusIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                                        <span className="text-xs text-app-text-secondary">
                                            Create new:
                                        </span>
                                        {newCategorySuggestions.map(suggestion => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => handleCreateAndAddCategory(suggestion)}
                                                className={STYLES.suggestion.createButton}
                                            >
                                                <PlusIcon className={ICON_SIZE_SM} />
                                                {capitalize(suggestion)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                            <label className=" text-sm font-medium text-app-text-primary flex items-center gap-2">
                                <FolderIcon className={ICON_SIZE_MD} />
                                <span>Categories *
                                    {formData.categoryIds.length > 0 && (
                                        <span className="ml-2 text-xs text-app-accent">({formData.categoryIds.length} selected)</span>
                                    )}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                placeholder="Search..."
                                className={`${STYLES.common.searchInput} focus:ring-app-accent`}
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
                        <div className={`bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 ${MAX_LIST_HEIGHT} overflow-y-auto`}>
                            {(() => {
                                const filtered = categories
                                    .filter(cat => cat?.name?.toLowerCase().includes(categorySearch.toLowerCase()));

                                if (filtered.length === 0) {
                                    return <span className="text-xs text-app-text-muted italic">No categories found</span>;
                                }

                                return sortWithSelectedFirst(filtered, formData.categoryIds).map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        data-category-id={cat.id}
                                        onClick={() => handleCategoryToggle(cat.id)}
                                        className={`${STYLES.common.itemButton} rounded-md gap-1.5 ${formData.categoryIds.includes(cat.id)
                                            ? STYLES.category.selected
                                            : STYLES.category.unselected
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
                        {/* Suggested tags */}
                        {(suggestedTags.length > 0 || newTagSuggestions.length > 0) && (
                            <div className="space-y-2">
                                {/* Existing tag suggestions */}
                                {(() => {
                                    const existing = filterExistingSuggestions(suggestedTags, tags);
                                    if (existing.length === 0) return null;

                                    return (
                                        <div className={`${STYLES.suggestion.existing} ${STYLES.tag.suggestion}`}>
                                            <LightbulbIcon className={`w-4 h-4 ${STYLES.tag.iconColor} flex-shrink-0`} />
                                            <span className="text-xs text-app-text-secondary">
                                                Suggested:
                                            </span>
                                            {suggestedTags.map(suggestion => {
                                                const matchedTag = tags.find(t => t?.name?.toLowerCase() === suggestion.toLowerCase());
                                                if (!matchedTag) return null;
                                                return (
                                                    <button
                                                        key={matchedTag.id}
                                                        type="button"
                                                        onClick={() => handleTagToggle(matchedTag.id)}
                                                        className={`${STYLES.suggestion.button} ${STYLES.tag.button}`}
                                                    >
                                                        {matchedTag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* New tag suggestions (not in database yet) */}
                                {newTagSuggestions.length > 0 && (
                                    <div className={STYLES.suggestion.createNew}>
                                        <PlusIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                                        <span className="text-xs text-app-text-secondary">
                                            Create new:
                                        </span>
                                        {newTagSuggestions.map(suggestion => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => handleCreateAndAddTag(suggestion)}
                                                className={STYLES.suggestion.createButton}
                                            >
                                                <PlusIcon className={ICON_SIZE_SM} />
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-sm font-medium text-app-text-primary flex items-center gap-2">
                                <TagIcon className={ICON_SIZE_MD} />
                                <span>Tags *
                                    {formData.tagIds.length > 0 && (
                                        <span className="ml-2 text-xs text-purple-400">({formData.tagIds.length} selected)</span>
                                    )}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                placeholder="Search..."
                                className={`${STYLES.common.searchInput} focus:ring-purple-500`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            />
                        </div>
                        <div className={`bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 ${MAX_LIST_HEIGHT} overflow-y-auto`}>
                            {(() => {
                                const filtered = tags
                                    .filter(tag => tag?.name?.toLowerCase().includes(tagSearch.toLowerCase()));

                                if (filtered.length === 0) {
                                    return <span className="text-xs text-app-text-muted italic">No tags found</span>;
                                }

                                return sortWithSelectedFirst(filtered, formData.tagIds).map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => handleTagToggle(tag.id)}
                                        className={`${STYLES.common.itemButton} rounded-full ${formData.tagIds.includes(tag.id)
                                            ? STYLES.tag.selected
                                            : STYLES.tag.unselected
                                            }`}
                                    >
                                        {tag.name}
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
