import { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { fetchAPI, supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { LightbulbIcon, PlusIcon, FolderIcon, TagIcon, SparklesIcon, CloseIcon, SpinnerIcon, StarIcon } from '../ui/Icons';
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
    ai: {
        container: 'bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 border border-violet-500/30 rounded-lg p-3 space-y-2.5',
        header: 'flex items-center gap-2 text-sm font-medium text-violet-300',
        section: 'flex items-center gap-2 flex-wrap',
        catButton: 'px-2 py-1 text-xs bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 rounded-md transition-colors cursor-pointer',
        tagButton: 'px-2 py-1 text-xs bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30 rounded-md transition-colors cursor-pointer',
        newButton: 'px-2 py-1 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-md transition-colors cursor-pointer flex items-center gap-1',
        pricingButton: 'px-2 py-1 text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-md transition-colors cursor-pointer',
        label: 'text-[10px] text-app-text-muted uppercase tracking-wider font-semibold flex-shrink-0',
        dismissButton: 'ml-auto text-app-text-muted hover:text-app-text-secondary transition-colors',
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
    PRICING_REQUIRED: 'Pricing model is required',
};

// Pricing options
const PRICING_OPTIONS = [
    { value: 'fully_free', label: 'Fully Free', icon: '✓', bgSelected: 'bg-emerald-600', ring: 'ring-emerald-400', bgHover: 'hover:bg-emerald-900/30' },
    { value: 'freemium', label: 'Freemium', icon: '◐', bgSelected: 'bg-blue-600', ring: 'ring-blue-400', bgHover: 'hover:bg-blue-900/30' },
    { value: 'free_trial', label: 'Free Trial', icon: '⏱', bgSelected: 'bg-amber-600', ring: 'ring-amber-400', bgHover: 'hover:bg-amber-900/30' },
    { value: 'paid', label: 'Paid', icon: '$', bgSelected: 'bg-rose-600', ring: 'ring-rose-400', bgHover: 'hover:bg-rose-900/30' }
];

// Shared color palettes
import { CATEGORY_COLORS, TAG_COLORS } from '../../lib/sharedColors';



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

// Helper to format tag name (capitalize first letter)
function formatTagName(name) {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

export default function SiteModal({ isOpen, onClose, site = null, prefill = null, defaultFavorite = false, defaultCategoryId = null, defaultTagId = null, onNeedsSaveConfirm = null, restoreFormData = null }) {
    const { categories, tags, addSite, updateSite, failedRelationUpdates, retrySiteRelations, addCategory, addTag, user, showToast } = useDashboard();
    const { user: authUser } = useAuth();
    const isEditing = !!site;
    const currentUser = user || authUser;

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        description: '',
        use_case: '',
        pricing: 'fully_free',
        is_favorite: false,
        is_needed: false,
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
    const [categoryDuplicateError, setCategoryDuplicateError] = useState(null);
    const [tagDuplicateError, setTagDuplicateError] = useState(null);

    // Duplicate URL check state
    const [duplicateUrl, setDuplicateUrl] = useState(null);

    // AI suggestion state
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [aiError, setAiError] = useState(null);

    // AI suggest handler
    const handleAiSuggest = useCallback(async () => {
        if (!formData.url?.trim() || aiLoading) return;

        setAiLoading(true);
        setAiError(null);
        setAiResult(null);

        try {
            const res = await fetchAPI('/ai/suggest', {
                method: 'POST',
                body: JSON.stringify({
                    url: formData.url.trim(),
                    name: formData.name?.trim() || '',
                    categories: categories.map(c => ({ id: c.id, name: c.name })),
                    tags: tags.map(t => ({ id: t.id, name: t.name }))
                })
            });

            if (res?.success && res?.data) {
                setAiResult(res.data);
            } else {
                setAiError(res?.error || 'AI suggestion failed');
            }
        } catch (err) {
            setAiError(err.message || 'Failed to get AI suggestions');
        } finally {
            setAiLoading(false);
        }
    }, [formData.url, formData.name, categories, tags, aiLoading]);

    // Apply an AI-suggested existing category
    const applyAiCategory = useCallback((catName) => {
        const match = categories.find(c => c.name?.toLowerCase() === catName.toLowerCase());
        if (match && !formData.categoryIds.includes(match.id)) {
            addToArrayField(setFormData, 'categoryIds', match.id);
        }
    }, [categories, formData.categoryIds]);

    // Apply an AI-suggested existing tag
    const applyAiTag = useCallback((tagName) => {
        const match = tags.find(t => t.name?.toLowerCase() === tagName.toLowerCase());
        if (match && !formData.tagIds.includes(match.id)) {
            addToArrayField(setFormData, 'tagIds', match.id);
        }
    }, [tags, formData.tagIds]);

    // Apply AI-suggested pricing
    const applyAiPricing = useCallback((pricing) => {
        setFormData(prev => ({ ...prev, pricing }));
    }, []);

    // Apply ALL AI suggestions at once
    const applyAllAiSuggestions = useCallback(async () => {
        if (!aiResult) return;

        // Apply existing categories
        const newCatIds = [...formData.categoryIds];
        (aiResult.existingCategories || []).forEach(name => {
            const match = categories.find(c => c.name?.toLowerCase() === name.toLowerCase());
            if (match && !newCatIds.includes(match.id)) newCatIds.push(match.id);
        });

        // Apply existing tags
        const newTagIds = [...formData.tagIds];
        (aiResult.existingTags || []).forEach(name => {
            const match = tags.find(t => t.name?.toLowerCase() === name.toLowerCase());
            if (match && !newTagIds.includes(match.id)) newTagIds.push(match.id);
        });

        // Create and apply new categories (skip duplicates)
        for (const catName of (aiResult.newCategories || [])) {
            const existingCat = categories.find(c => c.name?.toLowerCase() === capitalize(catName).toLowerCase());
            if (existingCat) {
                if (!newCatIds.includes(existingCat.id)) newCatIds.push(existingCat.id);
                continue;
            }
            try {
                const catData = { name: capitalize(catName), color: getRandomColor(CATEGORY_COLORS) };
                if (currentUser?.id) catData.user_id = currentUser.id;
                const newCat = await addCategory(catData);
                if (newCat?.id) newCatIds.push(newCat.id);
            } catch (e) { console.warn('Failed to create AI category:', e); }
        }

        // Create and apply new tags (skip duplicates)
        for (const tagName of (aiResult.newTags || [])) {
            const existingTag = tags.find(t => t.name?.toLowerCase() === capitalize(tagName).toLowerCase());
            if (existingTag) {
                if (!newTagIds.includes(existingTag.id)) newTagIds.push(existingTag.id);
                continue;
            }
            try {
                const tagData = { name: capitalize(tagName), color: getRandomColor(TAG_COLORS).hex };
                if (currentUser?.id) tagData.user_id = currentUser.id;
                const newTag = await addTag(tagData);
                if (newTag?.id) newTagIds.push(newTag.id);
            } catch (e) { console.warn('Failed to create AI tag:', e); }
        }

        // Apply pricing if suggested
        const pricingUpdate = aiResult.pricing || formData.pricing;

        setFormData(prev => ({
            ...prev,
            categoryIds: newCatIds,
            tagIds: newTagIds,
            pricing: pricingUpdate
        }));

        setAiResult(null);
    }, [aiResult, formData.categoryIds, formData.tagIds, formData.pricing, categories, tags, currentUser, addCategory, addTag]);

    // Reset form when modal opens/closes or site changes
    useEffect(() => {
        if (isOpen) {
            // Restore form data if coming back from confirm modal
            if (restoreFormData) {
                setFormData({
                    ...restoreFormData,
                    use_case: restoreFormData.use_case || '',
                    is_needed: restoreFormData.is_needed ?? false,
                });
            } else if (site) {
                const siteCategories = site.categories_array || site.categories || site.site_categories?.map(sc => sc.category) || [];
                const siteTags = site.tags_array || site.tags || site.site_tags?.map(st => st.tag) || [];

                setFormData({
                    name: site.name || '',
                    url: site.url || '',
                    description: site.description || '',
                    use_case: site.use_case || '',
                    pricing: site.pricing || 'fully_free',
                    is_favorite: site.is_favorite || false,
                    is_needed: site.is_needed ?? false,
                    categoryIds: extractRelationIds(siteCategories),
                    tagIds: extractRelationIds(siteTags)
                });
            } else {
                setFormData({
                    name: prefill?.name || '',
                    url: prefill?.url || '',
                    description: '',
                    use_case: '',
                    pricing: 'fully_free',
                    is_favorite: defaultFavorite,
                    is_needed: false,
                    categoryIds: defaultCategoryId ? [defaultCategoryId] : [],
                    tagIds: defaultTagId ? [defaultTagId] : []
                });
            }
            setError(null);
            setDuplicateUrl(null);
            setCategorySearch('');
            setTagSearch('');
            setAiResult(null);
            setAiError(null);
            setAiLoading(false);
            setCategoryDuplicateError(null);
            setTagDuplicateError(null);
        }
    }, [isOpen, site, prefill, defaultCategoryId, defaultFavorite, defaultTagId, restoreFormData]);

    // Auto-suggest categories based on URL (only when URL has a valid domain)
    useEffect(() => {
        const hasValidUrl = formData.url?.trim() && /^https?:\/\/.+\..+/.test(formData.url.trim());
        if (hasValidUrl) {
            const { suggestions } = suggestCategories(
                formData.url,
                formData.name,
                categories
            );

            // Show suggestions for both new and edit
            setSuggestedCategories(suggestions);

            // Find suggestions that don't exist yet
            setNewCategorySuggestions(filterNewSuggestions(suggestions, categories));
        } else {
            setSuggestedCategories([]);
            setNewCategorySuggestions([]);
        }
    }, [formData.url, formData.name, categories]);

    // Auto-suggest tags based on URL (only when URL has a valid domain)
    useEffect(() => {
        const hasValidUrl = formData.url?.trim() && /^https?:\/\/.+\..+/.test(formData.url.trim());
        if (hasValidUrl) {
            const { suggestions } = suggestTags(
                formData.url,
                formData.name,
                tags
            );

            // Show suggestions for both new and edit
            setSuggestedTags(suggestions);

            // Find suggestions that don't exist yet
            setNewTagSuggestions(filterNewSuggestions(suggestions, tags));
        } else {
            setSuggestedTags([]);
            setNewTagSuggestions([]);
        }
    }, [formData.url, formData.name, tags]);

    // Check for duplicate URL (debounced) — only for new sites
    useEffect(() => {
        if (isEditing) {
            setDuplicateUrl(null);
            return;
        }
        const url = formData.url?.trim();
        if (!url) {
            setDuplicateUrl(null);
            return;
        }

        const normalized = normalizeUrl(url);
        if (!/^https?:\/\/.+\..+/.test(normalized)) {
            setDuplicateUrl(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                let query = supabase
                    .from('sites')
                    .select('id')
                    .eq('url', normalized)
                    .limit(1);

                // Only check current user's sites
                if (currentUser?.id) {
                    query = query.eq('user_id', currentUser.id);
                }

                // When editing, exclude the current site
                if (isEditing && site?.id) {
                    query = query.neq('id', site.id);
                }

                const { data } = await query;

                if (data && data.length > 0) {
                    setDuplicateUrl(true);
                } else {
                    setDuplicateUrl(null);
                }
            } catch {
                setDuplicateUrl(null);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.url, isEditing, site, currentUser?.id]);

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
        const normalized = capitalize(categoryName);
        const existing = categories.find(c => c.name?.toLowerCase() === normalized.toLowerCase());
        if (existing) {
            setCategoryDuplicateError(`Category "${normalized}" already exists`);
            setTimeout(() => setCategoryDuplicateError(null), 4000);
            // Auto-select the existing one if not already selected
            if (!formData.categoryIds.includes(existing.id)) {
                addToArrayField(setFormData, 'categoryIds', existing.id);
            }
            removeFromSuggestions(setNewCategorySuggestions, categoryName);
            return;
        }
        setCategoryDuplicateError(null);
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
        const normalized = formatTagName(tagName);
        const existing = tags.find(t => t.name?.toLowerCase() === normalized.toLowerCase());
        if (existing) {
            setTagDuplicateError(`Tag "${normalized}" already exists`);
            setTimeout(() => setTagDuplicateError(null), 4000);
            // Auto-select the existing one if not already selected
            if (!formData.tagIds.includes(existing.id)) {
                addToArrayField(setFormData, 'tagIds', existing.id);
            }
            removeFromSuggestions(setNewTagSuggestions, tagName);
            return;
        }
        setTagDuplicateError(null);
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

    const doSave = async () => {
        setLoading(true);
        setError(null);

        try {
            // Normalize URL
            const url = normalizeUrl(formData.url);

            const payload = {
                name: formData.name.trim(),
                url,
                description: formData.description?.trim() || '',
                use_case: formData.use_case?.trim() || '',
                pricing: formData.pricing,
                category_ids: formData.categoryIds,
                tag_ids: formData.tagIds,
                is_favorite: formData.is_favorite,
                is_needed: formData.is_needed
            };

            if (isEditing) {
                await updateSite(site.id, payload);
                // Wait for complete refetch including categories/tags
                await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY));
            } else {
                await addSite(payload);
            }

            // Show toast warning after save if missing categories/tags
            const missing = [];
            if (formData.categoryIds.length === 0) missing.push('categories');
            if (formData.tagIds.length === 0) missing.push('tags');
            if (missing.length > 0) {
                showToast(`Saved without ${missing.join(' & ')} — you can add them later`, 'warning', 4000);
            }

            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setError(null);

        // Validate required fields
        if (!formData.name.trim()) {
            setError(VALIDATION_MESSAGES.NAME_REQUIRED);
            return;
        }
        if (!formData.url.trim()) {
            setError(VALIDATION_MESSAGES.URL_REQUIRED);
            return;
        }
        if (!formData.pricing) {
            setError(VALIDATION_MESSAGES.PRICING_REQUIRED);
            return;
        }

        // Block if duplicate URL (only when adding new site)
        if (duplicateUrl && !isEditing) {
            return;
        }

        // Check if missing categories/tags → ask for confirmation via external modal
        const missing = [];
        if (formData.categoryIds.length === 0) missing.push('categories');
        if (formData.tagIds.length === 0) missing.push('tags');
        if (missing.length > 0 && onNeedsSaveConfirm) {
            const url = normalizeUrl(formData.url);
            const payload = {
                name: formData.name.trim(),
                url,
                description: formData.description?.trim() || '',
                use_case: formData.use_case?.trim() || '',
                pricing: formData.pricing,
                category_ids: formData.categoryIds,
                tag_ids: formData.tagIds,
                is_favorite: formData.is_favorite,
                is_needed: formData.is_needed
            };
            onNeedsSaveConfirm(payload, missing, !!site, { ...formData });
            return;
        }

        await doSave();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Site' : 'Add New Site'}
            size="lg"
            dataTour="site-modal"
            glowAnimation={aiLoading}
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

                {/* Duplicate URL warning (only for new sites) */}
                {duplicateUrl && !isEditing && (
                    <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                        A site with this URL already exists
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

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-app-text-secondary">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Optional notes about this site..."
                        rows={2}
                        className="w-full bg-app-bg-light border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/50 focus:border-app-accent/50 resize-none transition-colors"
                    />
                </div>

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-app-text-secondary">How can this site help me?</label>
                    <textarea
                        name="use_case"
                        value={formData.use_case}
                        onChange={handleChange}
                        placeholder="e.g., Free icons for my projects, Learn React hooks, Track expenses..."
                        rows={2}
                        className="w-full bg-app-bg-light border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-primary placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none transition-colors"
                    />
                    <p className="text-xs text-app-text-muted">Helps you remember why you saved this site.</p>
                </div>

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

                {/* AI Suggest Button — all tiers (free gets limited uses) */}
                {formData.url?.trim() && /^https?:\/\/.+\..+/.test(formData.url.trim()) && (
                    <button
                        type="button"
                        onClick={handleAiSuggest}
                        disabled={aiLoading}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all border ${aiLoading
                            ? 'bg-violet-900/20 text-violet-400/60 border-violet-500/20 cursor-wait'
                            : 'bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-pink-600/20 text-violet-300 border-violet-500/30 hover:border-violet-500/50 hover:from-violet-600/30 hover:via-fuchsia-600/30 hover:to-pink-600/30 hover:shadow-lg hover:shadow-violet-900/20'
                            }`}
                    >
                        {aiLoading ? (
                            <>
                                <SpinnerIcon className="w-4 h-4" />
                                Analyzing site...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4" />
                                AI Suggest Categories & Tags
                            </>
                        )}
                    </button>
                )}

                {/* AI Error */}
                {aiError && (
                    <div className="p-2.5 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-xs flex items-center justify-between">
                        <span>AI: {aiError}</span>
                        <button type="button" onClick={() => setAiError(null)} className="text-red-400/60 hover:text-red-400">
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* AI Suggestions Panel */}
                {aiResult && (
                    <div className={STYLES.ai.container}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-violet-300">
                                <SparklesIcon className="w-4 h-4 text-violet-400" />
                                <span>AI Suggestions</span>
                                <span className="text-[10px] text-app-text-muted font-normal">
                                    ({Math.round((aiResult.confidence || 0) * 100)}% confidence)
                                </span>
                            </div>
                            <button type="button" onClick={() => setAiResult(null)} className="text-app-text-muted hover:text-app-text-secondary transition-colors -mt-0.5">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Existing categories */}
                        {aiResult.existingCategories?.length > 0 && (
                            <div className={STYLES.ai.section}>
                                <span className={STYLES.ai.label}>📂 Categories:</span>
                                {aiResult.existingCategories.map(name => {
                                    const match = categories.find(c => c.name?.toLowerCase() === name.toLowerCase());
                                    const isApplied = match && formData.categoryIds.includes(match.id);
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => applyAiCategory(name)}
                                            disabled={isApplied}
                                            className={`${STYLES.ai.catButton} ${isApplied ? 'opacity-40 cursor-default' : ''}`}
                                        >
                                            {isApplied && '✓ '}{name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* New categories */}
                        {aiResult.newCategories?.length > 0 && (
                            <div className={STYLES.ai.section}>
                                <span className={STYLES.ai.label}>📂 New:</span>
                                {aiResult.newCategories.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={async () => {
                                            await handleCreateAndAddCategory(name);
                                            setAiResult(prev => prev ? {
                                                ...prev,
                                                newCategories: prev.newCategories.filter(n => n !== name),
                                                existingCategories: [...(prev.existingCategories || []), capitalize(name)]
                                            } : null);
                                        }}
                                        className={STYLES.ai.newButton}
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                        {capitalize(name)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Existing tags */}
                        {aiResult.existingTags?.length > 0 && (
                            <div className={STYLES.ai.section}>
                                <span className={STYLES.ai.label}>🏷️ Tags:</span>
                                {aiResult.existingTags.map(name => {
                                    const match = tags.find(t => t.name?.toLowerCase() === name.toLowerCase());
                                    const isApplied = match && formData.tagIds.includes(match.id);
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => applyAiTag(name)}
                                            disabled={isApplied}
                                            className={`${STYLES.ai.tagButton} ${isApplied ? 'opacity-40 cursor-default' : ''}`}
                                        >
                                            {isApplied && '✓ '}{name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* New tags */}
                        {aiResult.newTags?.length > 0 && (
                            <div className={STYLES.ai.section}>
                                <span className={STYLES.ai.label}>🏷️ New:</span>
                                {aiResult.newTags.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={async () => {
                                            await handleCreateAndAddTag(name);
                                            setAiResult(prev => prev ? {
                                                ...prev,
                                                newTags: prev.newTags.filter(n => n !== name),
                                                existingTags: [...(prev.existingTags || []), capitalize(name)]
                                            } : null);
                                        }}
                                        className={STYLES.ai.newButton}
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                        {capitalize(name)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Pricing suggestion */}
                        {aiResult.pricing && aiResult.pricing !== formData.pricing && (
                            <div className={STYLES.ai.section}>
                                <span className={STYLES.ai.label}>💰 Pricing:</span>
                                <button
                                    type="button"
                                    onClick={() => applyAiPricing(aiResult.pricing)}
                                    className={STYLES.ai.pricingButton}
                                >
                                    {PRICING_OPTIONS.find(p => p.value === aiResult.pricing)?.icon}{' '}
                                    {PRICING_OPTIONS.find(p => p.value === aiResult.pricing)?.label}
                                </button>
                            </div>
                        )}

                        {/* Apply All button */}
                        <div className="flex justify-end pt-1 border-t border-violet-500/20">
                            <button
                                type="button"
                                onClick={applyAllAiSuggestions}
                                className="px-3 py-1.5 text-xs font-semibold bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 rounded-md transition-colors flex items-center gap-1.5"
                            >
                                <SparklesIcon className="w-3.5 h-3.5" />
                                Apply All
                            </button>
                        </div>
                    </div>
                )}

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
                            <StarIcon className={`w-6 h-6 ${formData.is_favorite ? 'text-yellow-400' : 'text-app-text-secondary'}`} fill={formData.is_favorite ? 'currentColor' : 'none'} strokeWidth={formData.is_favorite ? 0 : 1.5} />
                        </span>
                        <span>{formData.is_favorite ? 'Added to Favorites!' : 'Click to add to Favorites'}</span>
                    </button>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-app-text-primary">Needed</label>
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-lg border border-app-border bg-app-bg-secondary/60">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, is_needed: true }))}
                            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${formData.is_needed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'text-app-text-secondary hover:text-app-text-primary'
                                }`}
                        >
                            Needed
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, is_needed: false }))}
                            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${!formData.is_needed
                                ? 'bg-app-bg-light text-app-text-primary border border-app-border'
                                : 'text-app-text-secondary hover:text-app-text-primary'
                                }`}
                        >
                            Not needed
                        </button>
                    </div>
                    <p className="text-xs text-app-text-muted">Used for filtering and badges.</p>
                </div>

                {/* Categories */}
                {categories.length > 0 ? (
                    <div className="space-y-1.5">
                        {/* Quick suggestions (local pattern matching) */}
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
                                                Quick:
                                            </span>
                                            {(() => {
                                                const seen = new Set();
                                                return suggestedCategories.map(suggestion => {
                                                    const matchedCategory = categories.find(c => c?.name?.toLowerCase() === suggestion.toLowerCase());
                                                    if (!matchedCategory || seen.has(matchedCategory.id)) return null;
                                                    seen.add(matchedCategory.id);
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
                                                });
                                            })()}
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
                        <div className="space-y-0.5">
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
                            <p className="text-[10px] text-app-text-muted pl-0.5">Broad groups — e.g. Development, Design, AI Tools</p>
                            {categoryDuplicateError && (
                                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 flex items-center gap-1.5">
                                    <span>⚠️</span> {categoryDuplicateError}
                                </p>
                            )}
                        </div>
                        <div className={`bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 ${MAX_LIST_HEIGHT} overflow-y-auto`}>
                            {(() => {
                                if (categories.length === 0) {
                                    return (
                                        <div className="w-full text-center py-4">
                                            <p className="text-xs text-app-text-muted italic mb-2">📂 No categories exist yet</p>
                                            <p className="text-[10px] text-app-text-muted">You must first create categories from the Categories tab</p>
                                        </div>
                                    );
                                }

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
                ) : (
                    <div className="bg-app-bg-light/30 border border-app-border/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-app-text-muted">📂 No categories yet — <button type="button" className="text-app-accent hover:underline" onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('openAddCategoryModal')), 200); }}>create categories</button> first to organize your sites</p>
                    </div>
                )}

                {/* Tags */}
                {tags.length > 0 ? (
                    <div className="space-y-1.5">
                        {/* Quick tag suggestions (local) */}
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
                                            {(() => {
                                                const seen = new Set();
                                                return suggestedTags.map(suggestion => {
                                                    const matchedTag = tags.find(t => t?.name?.toLowerCase() === suggestion.toLowerCase());
                                                    if (!matchedTag || seen.has(matchedTag.id)) return null;
                                                    seen.add(matchedTag.id);
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
                                                });
                                            })()}
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
                        <div className="space-y-0.5">
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
                            <p className="text-[10px] text-app-text-muted pl-0.5">Specific labels — e.g. React, Free, Tutorial, Color Picker</p>
                            {tagDuplicateError && (
                                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 flex items-center gap-1.5">
                                    <span>⚠️</span> {tagDuplicateError}
                                </p>
                            )}
                        </div>
                        <div className={`bg-app-bg-light border border-app-border rounded-lg p-2 flex flex-wrap gap-1.5 ${MAX_LIST_HEIGHT} overflow-y-auto`}>
                            {(() => {
                                if (tags.length === 0) {
                                    return (
                                        <div className="w-full text-center py-4">
                                            <p className="text-xs text-app-text-muted italic mb-2">🏷️ No tags exist yet</p>
                                            <p className="text-[10px] text-app-text-muted">You must first create tags from the Tags tab</p>
                                        </div>
                                    );
                                }

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
                ) : (
                    <div className="bg-app-bg-light/30 border border-app-border/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-app-text-muted">🏷️ No tags yet — <button type="button" className="text-app-accent hover:underline" onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('openAddTagModal')), 200); }}>create tags</button> first to label your sites</p>
                    </div>
                )}
            </form>
        </Modal>
    );
}
