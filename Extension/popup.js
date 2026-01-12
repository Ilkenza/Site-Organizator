// Initialize Supabase client (from vendor UMD global)
/* Attempt to create client if Supabase lib is present. If not, supabaseClient will be null and we'll show a clear error when user tries to use auth or DB. */
const supabaseClient = (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function')
    ? supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true
        }
    })
    : null;

// Initialize pricing options from configuration
function initializePricingOptions() {
    const pricingSelect = document.getElementById('pricing');
    if (!pricingSelect) return;

    // Clear existing options
    pricingSelect.innerHTML = '';

    // Add new options from PRICING_OPTIONS
    PRICING_OPTIONS.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.label;
        pricingSelect.appendChild(optElement);
    });
}

function ensureSupabase() {
    if (!supabaseClient) {
        try { showMessage('Error: Supabase library not loaded. Download UMD to vendor/supabase.umd.min.js.', 'error'); } catch (e) { }
        console.error('Supabase library not loaded. CDN is blocked by CSP. Put UMD file in vendor/ and reference it in popup.html');
        return false;
    }
    return true;
}

let currentUser = null;

// When true, ignore palette clicks/activation because user is actively typing in an inline input
let inlineInputActive = false;

// Capture printable keydowns at the document level and prevent other handlers from
// responding while an inline input is active. Use capture phase for robustness.
document.addEventListener('keydown', function (e) {
    try {
        if (inlineInputActive && e.key && e.key.length === 1) {
            e.stopImmediatePropagation();
            // prevent default only if necessary (don't block typing itself)
            // don't call preventDefault so the character still appears in the input
        }
    } catch (err) {
        console.debug('keydown capture guard err', err);
    }
}, true);

// Prevent clicks from inadvertently toggling inline forms/palettes. Run in capture
// phase and stop propagation for clicks that should be ignored (e.g., clicks
// that happen while an inline input is active, or clicks inside the inline add area
// which shouldn't trigger global hide/show behavior).
document.addEventListener('click', function (e) {
    try {
        const t = e.target;
        if (!t) return;

        // If user is typing in an inline input, ignore click (typing guard)
        if (inlineInputActive) { e.stopImmediatePropagation(); return; }

        // clicks inside inline-add-wrapper should not bubble to global handlers
        // but do NOT stop the event if the click target is the add button itself
        if (t.closest && t.closest('.inline-add-wrapper')) {
            if (t.closest('.btn-add')) {
                // allow the button click to proceed to its handler
                return;
            }
            // allow other clicks inside the wrapper to proceed as well (no stop)
            return;
        }
    } catch (err) {
        console.debug('click capture guard err', err);
    }
}, true);

// Manual session token management
const TOKEN_KEY = 'supabaseAuthToken';

async function saveAuthToken(session) {
    if (session) {
        const authData = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
            user: session.user
        };
        // Save for same-origin quick access
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify(authData)); } catch (e) { console.warn('localStorage save failed', e); }

        // Also persist the compact authData and the full session to chrome.storage.local for popup lifecycle persistence
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await new Promise((resolve) => {
                    chrome.storage.local.set({ supabaseAuthToken: authData, supabaseSession: session }, function () { console.debug('Saved auth token + session to chrome.storage.local'); resolve(); });
                });
            }
        } catch (e) { console.warn('chrome.storage.local set failed', e); }



        console.debug('saveAuthToken:', { user: authData.user?.email, expiresAt: authData.expiresAt });
    }
}

function getStoredAuthToken() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored auth token:', e);
            return null;
        }
    }
    return null;
}

// Async fallback that checks chrome.storage.local if localStorage is empty (used by restoreSession)
async function getStoredAuthTokenAsync() {
    const local = getStoredAuthToken();
    if (local) {
        console.debug('getStoredAuthTokenAsync: found token in localStorage');
        return local;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
            try {
                chrome.storage.local.get(['supabaseAuthToken', 'supabaseSession'], (res) => {
                    console.debug('getStoredAuthTokenAsync: chrome.storage.local result:', res);
                    if (res && res.supabaseAuthToken) {
                        console.debug('getStoredAuthTokenAsync: found token in chrome.storage.local (auth token)');
                        resolve(res.supabaseAuthToken);
                    } else if (res && res.supabaseSession) {
                        // Fallback: extract tokens from saved full session
                        console.debug('getStoredAuthTokenAsync: found full session in chrome.storage.local');
                        const s = res.supabaseSession;
                        resolve({ accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at, user: s.user });
                    } else {
                        resolve(null);
                    }
                });
            } catch (e) {
                console.warn('chrome.storage.local.get failed', e);
                resolve(null);
            }
        });
    }

    return null;
}

async function restoreSession() {
    // Prefer the async getter which checks localStorage first and then chrome.storage.local
    const storedAuth = await getStoredAuthTokenAsync();
    console.debug('restoreSession: storedAuth present?', !!storedAuth, storedAuth ? { user: storedAuth.user?.email, expiresAt: storedAuth.expiresAt } : null);
    if (storedAuth) {
        // Basic validation
        if (!storedAuth.refreshToken && !storedAuth.accessToken) {
            console.warn('restoreSession: stored auth missing refreshToken and accessToken');
            return false;
        }

        console.debug('restoreSession: attempting token refresh using stored refresh token');

        try {
            // Try to refresh the token using Supabase auth
            const { data, error } = await supabaseClient.auth.refreshSession({
                refresh_token: storedAuth.refreshToken
            });

            if (!error && data && data.session) {
                console.debug('restoreSession: refreshSession succeeded');
                currentUser = data.session.user;
                await saveAuthToken(data.session);
                return true;
            }

            console.warn('   ⚠️  Token refresh did not return a session or failed:', error || 'no-session');

            // Fallback: try setSession if we have tokens
            if (storedAuth.accessToken || storedAuth.refreshToken) {
                try {
                    if (typeof supabaseClient.auth.setSession === 'function') {
                        console.debug('restoreSession: attempting setSession fallback with stored tokens');
                        const { data: setData, error: setErr } = await supabaseClient.auth.setSession({ access_token: storedAuth.accessToken, refresh_token: storedAuth.refreshToken });
                        if (!setErr && setData && setData.session) {
                            console.debug('restoreSession: setSession fallback succeeded');
                            currentUser = setData.session.user;
                            await saveAuthToken(setData.session);
                            return true;
                        }
                        console.warn('   ⚠️  setSession fallback failed:', setErr || 'unknown');
                    } else {
                        console.debug('restoreSession: supabaseClient.auth.setSession not available');
                    }
                } catch (setEx) {
                    console.warn('   ⚠️  setSession fallback threw', setEx);
                }
            }

            // Final attempt: try to read session from supabase.getSession to see if SDK persisted it elsewhere
            try {
                const { data: { session }, error: getErr } = await supabaseClient.auth.getSession();
                if (!getErr && session) {
                    console.debug('restoreSession: supabase.getSession returned a session');
                    currentUser = session.user;
                    await saveAuthToken(session);
                    return true;
                }
                console.debug('restoreSession: supabase.getSession had no session or returned error', getErr);
            } catch (getEx) {
                console.debug('restoreSession: getSession threw', getEx);
            }

            // If we reached here, attempts failed
            console.warn('restoreSession: all restore attempts failed — user will need to sign in');
            return false;
        } catch (e) {
            console.error('   ❌ Exception during token refresh:', e && e.message ? e.message : e);
            return false;
        }
    } else {
        console.debug('restoreSession: no storedAuth found');
    }

    return false;
}

function clearAuthToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }

    // Remove from chrome.storage.local as well (if available)
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['supabaseAuthToken', 'supabaseSession'], () => {
                console.debug('Removed auth token and session from chrome.storage.local');
            });
        }
    } catch (e) {
        console.warn('Failed to remove auth token from chrome.storage.local', e);
    }

}

// Set up auth state change listener to automatically save tokens
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.debug('auth.onAuthStateChange', { event, hasSession: !!session });
        if (session) {
            saveAuthToken(session);
        } else {
            clearAuthToken();
        }
    });
}

// Debug helper: inspect persistent auth storage (call from popup console)
window.debugAuthStorage = async function () {
    try {
        const local = getStoredAuthToken();
        console.debug('debugAuthStorage: localStorage token', local);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['supabaseAuthToken', 'supabaseSession'], (res) => {
                console.debug('debugAuthStorage: chrome.storage.local', res);
            });
        }
    } catch (err) {
        console.error('debugAuthStorage err', err);
    }
};





// Persist cached categories/tags to chrome.storage.local for offline use
async function persistCachedCategories(categories) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            await new Promise((resolve) => {
                chrome.storage.local.set({ cachedCategories: categories }, () => {
                    console.debug('persistCachedCategories: saved', categories && categories.length);
                    resolve();
                });
            });
        } catch (e) { console.debug('persistCachedCategories failed', e); }
    }
}

async function persistCachedTags(tags) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            await new Promise((resolve) => {
                chrome.storage.local.set({ cachedTags: tags }, () => {
                    console.debug('persistCachedTags: saved', tags && tags.length);
                    resolve();
                });
            });
        } catch (e) { console.debug('persistCachedTags failed', e); }
    }
}

// Cache of detected site table columns (to avoid repeated calls)
let sitesColumnsCache = null;

// Try to detect the columns present on the server-side `sites` table so we can
// adapt payload keys for deployments that use different column names (e.g. `name` vs `title`)
async function detectSitesColumns() {
    if (!ensureSupabase()) return [];
    if (sitesColumnsCache) return sitesColumnsCache;
    try {
        // Request one row (if available) to inspect returned keys
        const { data, error } = await supabaseClient.from('sites').select().limit(1);
        if (error) {
            console.debug('detectSitesColumns: supabase select error', error);
            return [];
        }
        sitesColumnsCache = (data && data[0]) ? Object.keys(data[0]) : [];
        console.debug('detectSitesColumns: detected columns', sitesColumnsCache);
        return sitesColumnsCache;
    } catch (e) {
        console.debug('detectSitesColumns threw', e);
        return [];
    }
} 

// API URL
const API_URL = 'http://localhost:3000';

// Save and load form data from localStorage
const FORM_CACHE_KEY = 'siteFormCache';

// Safe wrapper for loading categories/tags with graceful fallback when API is unreachable.
function safeLoadCategoriesAndTags() {
    return loadCategoriesAndTags().catch(e => {
        console.debug('safeLoadCategoriesAndTags: failed to load categories/tags', e);
        try { showMessage('Could not load categories/tags — using cached values', 'warning'); } catch (e) { }
        try { loadFormFromCache(); } catch (e) { console.debug('loadFormFromCache after safeLoad failure failed', e); }
    });
}
let currentTabId = null;

function getFormCacheKey() {
    return currentTabId ? `${FORM_CACHE_KEY}_${currentTabId}` : FORM_CACHE_KEY;
}

function saveFormToCache() {
    try {
        const siteNameInput = document.getElementById('siteName');
        const urlInput = document.getElementById('url');
        const pricingSelect = document.getElementById('pricing');

        // Get selected checkboxes
        const selectedCategoryCheckboxes = Array.from(
            document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]:checked')
        );
        const selectedTagCheckboxes = Array.from(
            document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]:checked')
        );

        const formData = {
            siteName: siteNameInput?.value || '',
            url: urlInput?.value || '',
            pricing: pricingSelect?.value || '',
            selectedCategories: selectedCategoryCheckboxes.map(cb => cb.value),
            selectedTags: selectedTagCheckboxes.map(cb => cb.value),
            timestamp: Date.now()
        };

        const key = getFormCacheKey();
        // Save to localStorage (fast, same-origin)
        // check for existing cache first
        let existingRaw = null;
        try { existingRaw = localStorage.getItem(key); } catch (e) { /* ignore */ }
        // Also save a generic fallback so data saved before tabId is available isn't lost
        let existingParsed = null;
        try { existingParsed = existingRaw ? JSON.parse(existingRaw) : null; } catch (e) { existingParsed = null; }

        const hasExistingData = existingParsed && (
            (existingParsed.siteName && existingParsed.siteName.trim()) ||
            (existingParsed.pricing && existingParsed.pricing.toString().trim()) ||
            (existingParsed.selectedCategories && existingParsed.selectedCategories.length > 0) ||
            (existingParsed.selectedTags && existingParsed.selectedTags.length > 0)
        );

        const hasNewNonUrl = (formData.siteName && formData.siteName.trim()) ||
            (formData.pricing && formData.pricing.toString().trim()) ||
            (formData.selectedCategories && formData.selectedCategories.length > 0) ||
            (formData.selectedTags && formData.selectedTags.length > 0);

        // If existing has data and new form only includes URL (no non-url data), skip saving to prevent overwriting restored state.
        if (hasExistingData && !hasNewNonUrl) {
            try { console.debug('saveFormToCache: skipping overwrite because existing cache contains data and new form is empty (only url).', key); } catch (e) { }

        } else {

            // Also persist to chrome.storage.local for durability across popup instances
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    const toSave = {};
                    toSave[key] = formData;
                    toSave[FORM_CACHE_KEY] = formData;
                    chrome.storage.local.set(toSave, () => {
                        try { console.debug('saveFormToCache: chrome.storage.local saved', key); } catch (e) { }
                    });
                }
            } catch (err) { console.debug('saveFormToCache: chrome.storage.local.set failed', err); }

            // Helpful debug: what keys we wrote and the data
            try { console.debug('saveFormToCache: wrote to keys', key, FORM_CACHE_KEY, 'formData:', formData); } catch (e) { }


        }

    } catch (e) {
        console.error('❌ Error saving form:', e);

    }
}

function loadFormFromCache(attempt = 0) {
    const key = getFormCacheKey();
    console.debug('loadFormFromCache: attempting to read cache for key', key, 'attempt', attempt);

    // Helper to apply parsed form data. Returns true if all referenced checkboxes were found/applied
    function applyFormData(formData) {
        if (!formData) return true;
        try {
            console.debug('loadFormFromCache: applying formData', formData);
            const siteNameInput = document.getElementById('siteName');
            const urlInput = document.getElementById('url');
            const pricingSelect = document.getElementById('pricing');

            if (siteNameInput) siteNameInput.value = formData.siteName || '';
            if (urlInput) urlInput.value = formData.url || '';
            if (pricingSelect) pricingSelect.value = formData.pricing || '';

            let missing = 0;

            // Restore checkbox selections for categories
            if (formData.selectedCategories && Array.isArray(formData.selectedCategories)) {
                formData.selectedCategories.forEach(categoryId => {
                    const checkbox = document.getElementById(`category-${categoryId}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        console.debug('loadFormFromCache: restored category', categoryId);

                        // Apply outline to restored item
                        const itemDiv = checkbox.closest('div[style*="background"]');
                        if (itemDiv) {
                            const catColor = itemDiv.style.color || '#6CBBFB';
                            itemDiv.style.outline = '1px solid ' + catColor;
                            itemDiv.style.outlineOffset = '2px';
                            itemDiv.style.fontWeight = '700';
                        }
                    } else {
                        console.warn('❌ Category checkbox not found (yet):', categoryId);
                        missing++;
                    }
                });
            }

            // Restore checkbox selections for tags
            if (formData.selectedTags && Array.isArray(formData.selectedTags)) {
                formData.selectedTags.forEach(tagId => {
                    const checkbox = document.getElementById(`tag-${tagId}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        console.debug('loadFormFromCache: restored tag', tagId);

                        // Apply outline to restored item
                        const itemDiv = checkbox.closest('div[style*="background"]');
                        if (itemDiv) {
                            const tagColor = itemDiv.style.color || '#667eea';
                            itemDiv.style.outline = '1px solid ' + tagColor;
                            itemDiv.style.outlineOffset = '2px';
                            itemDiv.style.fontWeight = '700';
                        }
                    } else {
                        console.warn('❌ Tag checkbox not found (yet):', tagId);
                        missing++;
                    }
                });
            }

            return missing === 0;
        } catch (err) {
            console.error('Error applying cached form data', err);
            return true;
        }
    }

    // If chrome.storage.local available, try that first
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            chrome.storage.local.get([key, FORM_CACHE_KEY], (res) => {
                const chromeCached = res && (res[key] || res[FORM_CACHE_KEY]);
                if (chromeCached) {
                    console.debug('loadFormFromCache: using chrome.storage.local cache for key', key);

                    const allApplied = applyFormData(chromeCached);
                    if (!allApplied && attempt < 5) {
                        const delay = 100 * Math.pow(2, attempt);
                        console.debug('loadFormFromCache: not all items present, retrying in', delay, 'ms');
                        setTimeout(() => loadFormFromCache(attempt + 1), delay);
                    }
                    return;
                }

                // Fallback to localStorage
                const localCached = localStorage.getItem(key) || localStorage.getItem(FORM_CACHE_KEY);
                if (localCached) {
                    try {
                        const parsed = JSON.parse(localCached);

                        const allApplied = applyFormData(parsed);
                        if (!allApplied && attempt < 5) {
                            const delay = 100 * Math.pow(2, attempt);
                            console.debug('loadFormFromCache: not all items present (localCached), retrying in', delay, 'ms');
                            setTimeout(() => loadFormFromCache(attempt + 1), delay);
                        }
                    } catch (e) { console.debug('loadFormFromCache: parse localCached failed', e); }
                    return;
                }
                console.debug('loadFormFromCache: no cache found');
            });
        } catch (err) {
            console.debug('loadFormFromCache: chrome.storage.local.get failed', err);
            const localCached = localStorage.getItem(key) || localStorage.getItem(FORM_CACHE_KEY);
            if (localCached) {
                try {
                    const parsed = JSON.parse(localCached);
                    const allApplied = applyFormData(parsed);
                    if (!allApplied && attempt < 5) {
                        const delay = 100 * Math.pow(2, attempt);
                        console.debug('loadFormFromCache: not all items present (localCached, after chrome.get failure), retrying in', delay, 'ms');
                        setTimeout(() => loadFormFromCache(attempt + 1), delay);
                    }
                } catch (e) { console.debug('loadFormFromCache: parse localCached failed', e); }
            }
        }
    } else {
        const localCached = localStorage.getItem(key) || localStorage.getItem(FORM_CACHE_KEY);
        if (localCached) {
            try {
                const parsed = JSON.parse(localCached);
                const allApplied = applyFormData(parsed);
                if (!allApplied && attempt < 5) {
                    const delay = 100 * Math.pow(2, attempt);
                    console.debug('loadFormFromCache: not all items present (no chrome.storage), retrying in', delay, 'ms');
                    setTimeout(() => loadFormFromCache(attempt + 1), delay);
                }
            } catch (e) { console.debug('loadFormFromCache: parse localCached failed', e); }
        }
    }
}

// Load categories and tags from database (Supabase-first, with cache fallback and legacy API fallback)
async function loadCategoriesAndTags() {
    try {
        let categoriesList = null;
        let tagsList = null;

        // 1) Try Supabase as the authoritative source (if available)
        if (ensureSupabase()) {
            try {
                const { data: cats, error: catErr } = await supabaseClient.from('categories').select('id,name,color').order('name', { ascending: true });
                if (!catErr && Array.isArray(cats)) {
                    categoriesList = cats;
                    try { await persistCachedCategories(categoriesList); } catch (e) { console.debug('persistCachedCategories failed', e); }
                } else if (catErr) {
                    console.debug('Supabase categories query error', catErr);
                }
            } catch (err) { console.debug('Supabase categories fetch threw', err); }

            try {
                const { data: tags, error: tagErr } = await supabaseClient.from('tags').select('id,name,color').order('name', { ascending: true });
                if (!tagErr && Array.isArray(tags)) {
                    tagsList = tags;
                    try { await persistCachedTags(tagsList); } catch (e) { console.debug('persistCachedTags failed', e); }
                } else if (tagErr) {
                    console.debug('Supabase tags query error', tagErr);
                }
            } catch (err) { console.debug('Supabase tags fetch threw', err); }
        }

        // 2) If Supabase didn't provide data, try chrome.storage.local cached copies
        if ((!categoriesList || categoriesList.length === 0) || (!tagsList || tagsList.length === 0)) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await new Promise(resolve => chrome.storage.local.get(['cachedCategories', 'cachedTags'], resolve));
                if ((!categoriesList || categoriesList.length === 0) && res && res.cachedCategories) categoriesList = res.cachedCategories;
                if ((!tagsList || tagsList.length === 0) && res && res.cachedTags) tagsList = res.cachedTags;
            }
        }

        // 3) Legacy fallback to local API if still empty (keeps backward compatibility)
        if (!categoriesList || categoriesList.length === 0) {
            try {
                const categoriesResp = await fetch(`${API_URL}/api/categories`);
                const categoriesData = await categoriesResp.json();
                if (categoriesData && categoriesData.success && Array.isArray(categoriesData.data)) categoriesList = categoriesData.data;
            } catch (e) { console.debug('local API categories fetch failed', e); }
        }

        if (!tagsList || tagsList.length === 0) {
            try {
                const tagsResp = await fetch(`${API_URL}/api/tags`);
                const tagsData = await tagsResp.json();
                if (tagsData && tagsData.success && Array.isArray(tagsData.data)) tagsList = tagsData.data;
            } catch (e) { console.debug('local API tags fetch failed', e); }
        }

        // Render categories
        const categoriesCheckboxList = document.getElementById('categoriesCheckboxList');
        if (categoriesCheckboxList && categoriesList && categoriesList.length > 0) {
            categoriesCheckboxList.innerHTML = '';
            categoriesList.forEach(cat => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'category-checkbox';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `category-${cat.id}`;
                checkbox.value = cat.id;
                checkbox.dataset.categoryName = cat.name;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = cat.name;

                // Apply colored badge styling
                const catColor = cat.color || '#6CBBFB';
                itemDiv.style.background = catColor + '20';
                itemDiv.style.color = catColor;
                itemDiv.style.border = '1px solid ' + catColor + '40';
                itemDiv.style.display = 'inline-block';
                itemDiv.style.padding = '2px 8px';
                itemDiv.style.borderRadius = '12px';
                itemDiv.style.cursor = 'pointer';
                itemDiv.style.marginBottom = '6px';
                itemDiv.style.marginRight = '6px';
                label.style.color = catColor;

                // Hide checkbox
                checkbox.style.display = 'none';

                itemDiv.appendChild(checkbox);
                itemDiv.appendChild(label);

                // Click to toggle checkbox
                itemDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                });

                // Add outline effect on checked
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        itemDiv.style.outline = '1px solid ' + catColor;
                        itemDiv.style.outlineOffset = '2px';
                        itemDiv.style.fontWeight = '700';
                    } else {
                        itemDiv.style.outline = 'none';
                        itemDiv.style.fontWeight = 'normal';
                    }
                    saveFormToCache();
                });

                // Add save listener
                checkbox.addEventListener('change', saveFormToCache);

                categoriesCheckboxList.appendChild(itemDiv);
            });
            // Apply active category filter (if user typed into input)
            try { if (document.getElementById('categoriesSearchInput')?.value) filterCheckboxList('categoriesCheckboxList', document.getElementById('categoriesSearchInput').value); } catch (e) { }
        }

        // Render tags
        const tagsCheckboxList = document.getElementById('tagsCheckboxList');
        if (tagsCheckboxList && tagsList && tagsList.length > 0) {
            tagsCheckboxList.innerHTML = '';
            tagsList.forEach(tag => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tag-checkbox';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `tag-${tag.id}`;
                checkbox.value = tag.id;
                checkbox.dataset.tagName = tag.name;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = tag.name;

                // Apply colored badge styling
                const tagColor = tag.color || '#667eea';
                itemDiv.style.background = tagColor + '20';
                itemDiv.style.color = tagColor;
                itemDiv.style.border = '1px solid ' + tagColor + '40';
                itemDiv.style.display = 'inline-block';
                itemDiv.style.padding = '2px 8px';
                itemDiv.style.borderRadius = '12px';
                itemDiv.style.cursor = 'pointer';
                itemDiv.style.marginBottom = '6px';
                itemDiv.style.marginRight = '6px';
                label.style.color = tagColor;

                // Hide checkbox
                checkbox.style.display = 'none';

                itemDiv.appendChild(checkbox);
                itemDiv.appendChild(label);

                // Click to toggle checkbox
                itemDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                });

                // Add outline effect on checked
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        itemDiv.style.outline = '1px solid ' + tagColor;
                        itemDiv.style.outlineOffset = '2px';
                        itemDiv.style.fontWeight = '700';
                    } else {
                        itemDiv.style.outline = 'none';
                        itemDiv.style.fontWeight = 'normal';
                    }
                    saveFormToCache();
                });

                // Add save listener
                checkbox.addEventListener('change', saveFormToCache);

                tagsCheckboxList.appendChild(itemDiv);
            });
            // Apply active tag filter (if user typed into input)
            try { if (document.getElementById('tagsSearchInput')?.value) filterCheckboxList('tagsCheckboxList', document.getElementById('tagsSearchInput').value); } catch (e) { }
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
        // Fallback: try to create placeholder category/tag checkboxes based on cached selected ids
        try {
            const key = getFormCacheKeyForCurrentTab();
            let raw = null;
            try { raw = localStorage.getItem(key); } catch (e) { /* ignore */ }
            let parsed = null;
            try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
            const categoriesList = document.getElementById('categoriesCheckboxList');
            const tagsList = document.getElementById('tagsCheckboxList');
            if (parsed) {
                const missingCategories = (parsed.selectedCategories || []).filter(id => !document.getElementById(`category-${id}`));
                const missingTags = (parsed.selectedTags || []).filter(id => !document.getElementById(`tag-${id}`));
                if (categoriesList && missingCategories.length > 0) {
                    console.debug('loadCategoriesAndTags: creating placeholder categories for missing ids', missingCategories);
                    missingCategories.forEach(id => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'category-checkbox';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `category-${id}`;
                        checkbox.value = id;
                        // Hide the native checkbox (we use the div/label as the clickable badge)
                        checkbox.style.display = 'none';
                        checkbox.dataset.categoryName = 'Unknown';

                        const label = document.createElement('label');
                        label.htmlFor = checkbox.id;
                        label.textContent = 'Unknown category';

                        // Apply a default placeholder color so outline shows when restored
                        const catColor = '#6CBBFB';
                        itemDiv.style.background = catColor + '20';
                        itemDiv.style.color = catColor;
                        itemDiv.style.border = '1px solid ' + catColor + '40';
                        itemDiv.style.display = 'inline-block';
                        itemDiv.style.padding = '2px 8px';
                        itemDiv.style.borderRadius = '12px';
                        itemDiv.style.cursor = 'pointer';
                        itemDiv.style.marginBottom = '6px';
                        itemDiv.style.marginRight = '6px';
                        label.style.color = catColor;

                        // Toggle behavior (same as real renderer)
                        itemDiv.addEventListener('click', (e) => {
                            e.preventDefault();
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        });

                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                itemDiv.style.outline = '1px solid ' + catColor;
                                itemDiv.style.outlineOffset = '2px';
                                itemDiv.style.fontWeight = '700';
                            } else {
                                itemDiv.style.outline = 'none';
                                itemDiv.style.fontWeight = 'normal';
                            }
                            try { saveFormToCache(); } catch (e) { console.debug('saveFormToCache in placeholder change failed', e); }
                        });

                        itemDiv.appendChild(checkbox);
                        itemDiv.appendChild(label);
                        categoriesList.appendChild(itemDiv);
                    });
                }
                if (tagsList && missingTags.length > 0) {
                    console.debug('loadCategoriesAndTags: creating placeholder tags for missing ids', missingTags);
                    missingTags.forEach(id => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'tag-checkbox';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `tag-${id}`;
                        checkbox.value = id;
                        checkbox.style.display = 'none';
                        checkbox.dataset.tagName = 'Unknown';

                        const label = document.createElement('label');
                        label.htmlFor = checkbox.id;
                        label.textContent = 'Unknown tag';

                        // Apply a default placeholder color so outline shows when restored
                        const tagColor = '#667eea';
                        itemDiv.style.background = tagColor + '20';
                        itemDiv.style.color = tagColor;
                        itemDiv.style.border = '1px solid ' + tagColor + '40';
                        itemDiv.style.display = 'inline-block';
                        itemDiv.style.padding = '2px 8px';
                        itemDiv.style.borderRadius = '12px';
                        itemDiv.style.cursor = 'pointer';
                        itemDiv.style.marginBottom = '6px';
                        itemDiv.style.marginRight = '6px';
                        label.style.color = tagColor;

                        // Toggle behavior (same as real renderer)
                        itemDiv.addEventListener('click', (e) => {
                            e.preventDefault();
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        });

                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                itemDiv.style.outline = '1px solid ' + tagColor;
                                itemDiv.style.outlineOffset = '2px';
                                itemDiv.style.fontWeight = '700';
                            } else {
                                itemDiv.style.outline = 'none';
                                itemDiv.style.fontWeight = 'normal';
                            }
                            try { saveFormToCache(); } catch (e) { console.debug('saveFormToCache in placeholder change failed', e); }
                        });

                        itemDiv.appendChild(checkbox);
                        itemDiv.appendChild(label);
                        tagsList.appendChild(itemDiv);
                    });
                }
                try { loadFormFromCache(); } catch (e) { console.debug('loadFormFromCache after fallback failed', e); }
            }
        } catch (e) { console.debug('fallback restore failed', e); }
        showMessage('Error loading categories and tags', 'error');
    }
}





function clearFormCache() {
    const key = getFormCacheKey();

    try {
        localStorage.removeItem(key);
        localStorage.removeItem(FORM_CACHE_KEY);
    } catch (e) { /* ignore */ }

    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const toRemove = [key, FORM_CACHE_KEY];
            chrome.storage.local.remove(toRemove, () => {
                console.debug('clearFormCache: removed keys from chrome.storage.local', toRemove);
            });
        }
    } catch (err) {
        console.debug('clearFormCache: failed to remove from chrome.storage.local', err);
    }
}

// DOM elements - defined lazily so we can re-query after DOM is ready
let authSection = null;
let loginForm = null;
let registerForm = null;
let siteFormSection = null;
let messageEl = null;

const _requiredCriticalIds = ['authSection', 'siteFormSection', 'message'];
const _optionalIds = ['loginForm'];
let domCheckAttempts = 0;
const DOM_CHECK_MAX_ATTEMPTS = 12;

function checkDomAndInit() {
    // Re-query DOM elements
    authSection = document.getElementById('authSection');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    siteFormSection = document.getElementById('siteFormSection');
    messageEl = document.getElementById('message');

    const missingCritical = _requiredCriticalIds.filter(id => !document.getElementById(id));
    const missingOptional = _optionalIds.filter(id => !document.getElementById(id));

    if (missingCritical.length) {
        domCheckAttempts = (domCheckAttempts || 0) + 1;
        console.error(`Missing CRITICAL DOM elements in popup.html: ${missingCritical.join(', ')} (attempt ${domCheckAttempts}/${DOM_CHECK_MAX_ATTEMPTS})`);
        console.debug('checkDomAndInit: document.readyState=', document.readyState);

        // Provide a short snapshot of elements that *do* exist (helps debugging)
        try {
            const foundIds = Array.from(document.querySelectorAll('[id]')).slice(0, 200).map(el => el.id);
            console.debug(`Found IDs (${foundIds.length}):`, foundIds.slice(0, 50).join(', ') + (foundIds.length > 50 ? ', ...' : ''));
        } catch (dbgErr) {
            console.debug('Could not enumerate IDs', dbgErr);
        }

        // Retry with backoff
        if (domCheckAttempts < DOM_CHECK_MAX_ATTEMPTS) {
            const delay = Math.min(500, 120 * domCheckAttempts);
            setTimeout(checkDomAndInit, delay);
        } else {
            console.error('DOM check failed after multiple attempts; missing critical:', missingCritical.join(', '));
            // As a final attempt, call after window.load in case some resources block rendering
            window.addEventListener('load', () => {
                setTimeout(checkDomAndInit, 40);
            }, { once: true });
        }
        return;
    }

    if (missingOptional.length) {
        console.warn('Optional DOM elements missing (login/register not present):', missingOptional.join(', '));
    }

    // All critical elements present — proceed
    try {
        // Populate URL asap (even if site form is hidden) so it's available when the form shows
        tryPopulateUrlInput();

        checkAuth();
    } catch (err) {
        console.error('Error during checkAuth:', err);
    }
}

// In some environments, DOMContentLoaded may have already fired yet some dynamic pieces
// take a tiny bit longer; ensure we attempt init again on full load as a safety net
window.addEventListener('load', () => {
    setTimeout(checkDomAndInit, 10);
});

// When popup becomes visible / focused again, repopulate URL from active tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        tryPopulateUrlInput();
    } else {
        // Popup is hidden/closing — ensure the current form is cached
        try {
            console.debug('visibilitychange: hidden — saving form cache');
            saveFormToCache();
        } catch (e) {
            console.debug('saveFormToCache failed on visibilitychange hidden', e);
        }
    }
});
// Some browsers may reuse the popup window; also respond to focus
window.addEventListener('focus', () => {
    tryPopulateUrlInput();
});

// Also attempt to populate URL at script load time (best-effort)
tryPopulateUrlInput();

// Run the DOM check immediately; it will re-run on DOMContentLoaded if necessary
checkDomAndInit();
// Ensure categories/tags load uses the safe loader during initial popup setup so cached selections can be applied when API is down.
safeLoadCategoriesAndTags().then(() => { try { loadFormFromCache(); } catch (e) { console.debug('loadFormFromCache after safeLoad failed', e); } try { addFormCacheListeners(); } catch (e) { /* ignore */ } }).catch(e => { console.debug('safeLoadCategoriesAndTags failed in init', e); try { loadFormFromCache(); } catch (e2) { console.debug('loadFormFromCache fallback failed', e2); } try { addFormCacheListeners(); } catch (e3) { /* ignore */ } });

// Reset form when tab switches (detect tab change)
chrome.tabs.onActivated.addListener((activeInfo) => {
    currentTabId = activeInfo.tabId;

    try {
        chrome.tabs.get(currentTabId, (tab) => {

            // Reset form before loading new tab data
            const siteNameInput = document.getElementById('siteName');
            const urlInput = document.getElementById('url');
            const pricingSelect = document.getElementById('pricing');

            // Don't blindly reset the form here; instead populate URL and restore the cache for the new tab
            if (urlInput) urlInput.value = tab?.url || '';

            // Reload lists and then restore cached selections for the tab (use safe loader)
            safeLoadCategoriesAndTags().then(() => {
                setTimeout(() => {
                    loadFormFromCache();
                    addFormCacheListeners();
                }, 50);
            }).catch(e => console.debug('Error loading categories/tags on tab change', e));
        });
    } catch (e) {
        console.debug('chrome.tabs.get onActivated failed', e);
    }

    // Load URL from the new tab (robustly: handle missing URL / permissions by retrying once)
    try {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            const siteFormSection = document.getElementById('siteFormSection');

            if (urlInput && siteFormSection && !siteFormSection.classList.contains('hidden')) {
                const tabUrl = tab && tab.url ? tab.url : null;
                if (tabUrl) {
                    urlInput.value = tabUrl;
                } else {
                    // Retry once after a short delay in case URL wasn't available immediately
                    setTimeout(() => {
                        try {
                            chrome.tabs.get(activeInfo.tabId, (t2) => {
                                if (t2 && t2.url && urlInput) urlInput.value = t2.url;
                                else if (urlInput && !urlInput.value) urlInput.placeholder = 'URL unavailable';
                            });
                        } catch (err) {
                            console.debug('tabs.get retry err', err);
                            if (urlInput && !urlInput.value) urlInput.placeholder = 'URL unavailable';
                        }
                    }, 150);
                }

                // Load form data for this tab from cache (if it exists)
                setTimeout(() => {
                    loadFormFromCache();
                }, 100);
            }
        });
    } catch (err) {
        console.debug('chrome.tabs.get threw', err);
        if (urlInput && !urlInput.value) urlInput.placeholder = 'URL unavailable';
    }
});

async function checkAuth() {
    if (!ensureSupabase()) {
        showAuthForm();
        return;
    }

    try {
        // First, try to restore session from localStorage
        const restored = await restoreSession();
        if (restored) {
            showSiteForm();
            return;
        }

        // If no saved session, Supabase will check IndexedDB and other sources
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (session && session.user) {
            currentUser = session.user;
            saveAuthToken(session);
            showSiteForm();
        } else {
            showAuthForm();
        }
    } catch (error) {
        console.error('❌ Error checking auth:', error);
        showAuthForm();
    }
}

function showAuthForm() {
    if (authSection && siteFormSection) {
        authSection.classList.remove('hidden');
        siteFormSection.classList.add('hidden');
    }

    // Hide header user info when not signed in
    const headerUserInfo = document.getElementById('headerUserInfo');
    if (headerUserInfo) headerUserInfo.classList.add('hidden');
}

// Robustly populate the URL input from the active tab. Retries once briefly if URL isn't
// immediately available (some pages/browsers or permission timing issues).
function tryPopulateUrlInput(retryCount = 3) {
    const urlInput = document.getElementById('url');
    if (!urlInput) return;
    try {
        console.debug('tryPopulateUrlInput: attempting to query active tab (retryCount=', retryCount, ')');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            try {
                console.debug('tryPopulateUrlInput: tabs result', tabs && tabs[0] ? { id: tabs[0].id, url: tabs[0].url, title: tabs[0].title } : tabs);
            } catch (dbg) { console.debug('tryPopulateUrlInput: tabs debug err', dbg); }

            // If we got a URL, use it
            if (tabs && tabs[0] && tabs[0].url) {
                const tabUrl = tabs[0].url;
                urlInput.value = tabUrl;
                try { currentTabId = tabs[0].id; } catch (e) { }
                // Persist to form cache immediately so it's available after sign-in or reopen
                try { console.debug('tryPopulateUrlInput: populated URL from tabs.query', tabUrl); } catch (e) { }
                return;
            }

            // If we have a tab id but no URL in the short query result, try a full get
            if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
                const tid = tabs[0].id;
                try {
                    chrome.tabs.get(tid, (t) => {
                        try {
                            console.debug('tryPopulateUrlInput: chrome.tabs.get result', t && { id: t.id, url: t.url, title: t.title });
                        } catch (dbg) { console.debug('tryPopulateUrlInput: tabs.get debug err', dbg); }

                        if (t && t.url) {
                            urlInput.value = t.url;
                            try { currentTabId = t.id; } catch (e) { }
                            try { console.debug('tryPopulateUrlInput: populated URL from tabs.get', t.url); } catch (e) { }
                            return;
                        } else {
                            // if still missing, fall through to retry logic below
                        }
                    });
                    // allow the get callback to populate; still continue to the retry scheduling below if needed
                } catch (getErr) {
                    console.debug('tryPopulateUrlInput: chrome.tabs.get threw', getErr);
                }
            }

            if (retryCount > 0) {
                // Try a slightly wider query (lastFocusedWindow) in some environments
                setTimeout(() => tryPopulateUrlInput(retryCount - 1), 150);
                return;
            }

            // Final fallback: try to use previously saved currentTabId if present
            if (currentTabId) {
                try {
                    chrome.tabs.get(currentTabId, (t) => {
                        try {
                            if (t && t.url) {
                                urlInput.value = t.url;
                                try { console.debug('tryPopulateUrlInput: populated URL from saved currentTabId', t.url); } catch (e) { }
                                return;
                            } else {
                                console.debug('tryPopulateUrlInput: saved currentTabId had no url', t);
                            }
                        } catch (innerErr) {
                            console.debug('tryPopulateUrlInput: tabs.get (saved id) debug err', innerErr);
                        }
                    });
                } catch (err2) {
                    console.debug('tryPopulateUrlInput: chrome.tabs.get(saved id) threw', err2);
                }
            }

            // If we reach here, we couldn't find a URL to populate
            if (!urlInput.value) urlInput.placeholder = 'URL unavailable';
        });
    } catch (err) {
        console.debug('tryPopulateUrlInput err', err);
        if (!urlInput.value) urlInput.placeholder = 'URL unavailable';
    }
}

function showSiteForm() {
    console.log('[popup] showSiteForm init');
    // delegated click listener so we detect clicks even if per-element listeners fail
    // Attach only once to avoid duplicate handling when showSiteForm is called multiple times
    if (!window.__inlineFilterDelegatedAttached) {
        window.__inlineFilterDelegatedAttached = true;
        document.addEventListener('click', function (e) {
            try {
                const t = e.target && e.target.closest && e.target.closest('.inline-filter-toggle');
                if (t) console.log('[popup] delegated click on inline-filter-toggle', t.id || t.className);
            } catch (err) { console.log('[popup] delegated click handler error', err); }
        });
    }
    if (authSection && siteFormSection) {
        authSection.classList.add('hidden');
        siteFormSection.classList.remove('hidden');
    }

    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl && currentUser) {
        userEmailEl.textContent = currentUser.email;
    }

    // Populate header user info (email + logout)
    const headerUserEmailEl = document.getElementById('headerUserEmail');
    const headerUserInfo = document.getElementById('headerUserInfo');
    if (headerUserEmailEl && currentUser) headerUserEmailEl.textContent = currentUser.email;
    if (headerUserInfo) headerUserInfo.classList.remove('hidden');

    // Initialize pricing options
    initializePricingOptions();

    // Attempt to populate the URL input from the active tab (may retry once)
    tryPopulateUrlInput();

    // Add save listeners immediately for form inputs
    const siteNameInput = document.getElementById('siteName');
    const urlInput = document.getElementById('url');
    const pricingSelect = document.getElementById('pricing');

    if (siteNameInput) {
        siteNameInput.addEventListener('input', saveFormToCache);
    }
    if (urlInput) {
        urlInput.addEventListener('input', saveFormToCache);
    }
    if (pricingSelect) {
        pricingSelect.addEventListener('change', saveFormToCache);
    }

    // Get current tab ID first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            currentTabId = tabs[0].id;

            const urlInput = document.getElementById('url');
            if (urlInput) {
                urlInput.value = tabs[0].url;
            }

            // Load categories and tags using safe loader, then restore form from cache
            safeLoadCategoriesAndTags().then(() => {
                // Wait a tick for DOM to update
                setTimeout(() => {
                    const cacheKey = getFormCacheKey();
                    const cachedData = localStorage.getItem(cacheKey);


                    loadFormFromCache();
                    addFormCacheListeners();

                    // Attach inline filter listeners (debounced) for tags & categories
                    const tagsFilter = document.getElementById('tagsSearchInput');
                    const tagsClear = document.getElementById('tagsSearchClear');
                    // helper to show/hide clear button
                    function updateClearVisibility(inputEl, clearEl) {
                        if (!inputEl || !clearEl) return;
                        if (inputEl.value && inputEl.value.trim().length > 0) {
                            clearEl.classList.remove('hidden');
                        } else {
                            clearEl.classList.add('hidden');
                        }
                    }
                    // Attach tags filter handlers only once
                    try {
                        if (tagsFilter && !tagsFilter.dataset.filterWired) {
                            tagsFilter.dataset.filterWired = '1';
                            tagsFilter.addEventListener('input', debounce((e) => { updateClearVisibility(tagsFilter, tagsClear); filterCheckboxList('tagsCheckboxList', e.target.value); }, 150));
                            tagsFilter.addEventListener('keydown', function (e) {
                                if (e.key === 'Escape') {
                                    if (tagsFilter.value && tagsFilter.value.trim().length > 0) {
                                        tagsFilter.value = '';
                                        updateClearVisibility(tagsFilter, tagsClear);
                                        filterCheckboxList('tagsCheckboxList', '');
                                    } else {
                                        const wrapper = document.getElementById('tagsFilterWrapper');
                                        const toggle = document.getElementById('tagsSearchToggle');
                                        if (wrapper) wrapper.classList.remove('open');
                                        if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
                                        if (tagsFilter) tagsFilter.classList.add('hidden');
                                        // Also hide the clear (×) button when the input is closed
                                        if (tagsClear) { tagsClear.classList.add('hidden'); tagsClear.style.display = 'none'; }
                                    }
                                }
                            });
                        }
                        if (tagsClear && !tagsClear.dataset.clearWired) {
                            tagsClear.dataset.clearWired = '1';
                            tagsClear.addEventListener('click', function () {
                                if (!tagsFilter) return;
                                // if there is text, clear it
                                if (tagsFilter.value && tagsFilter.value.trim().length > 0) {
                                    tagsFilter.value = '';
                                    tagsFilter.focus();
                                    updateClearVisibility(tagsFilter, tagsClear);
                                    filterCheckboxList('tagsCheckboxList', '');
                                    return;
                                }
                                // if already empty, close the inline search and return focus to the toggle
                                const wrapper = document.getElementById('tagsFilterWrapper');
                                if (wrapper) wrapper.classList.remove('open');
                                const toggle = document.getElementById('tagsSearchToggle');
                                if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
                                if (tagsFilter) tagsFilter.classList.add('hidden');
                                // hide the clear button as well
                                if (tagsClear) { tagsClear.classList.add('hidden'); tagsClear.style.display = 'none'; tagsClear.textContent = '✕'; tagsClear.setAttribute('aria-label','Clear search'); }
                            });
                        }
                    } catch (err) { console.debug('attach tags filter handlers failed', err); }

                    // Prevent accidental activation of the tag color palette while typing in the tag search
                    if (tagsFilter && !tagsFilter.dataset.focusWired) {
                        tagsFilter.dataset.focusWired = '1';
                        tagsFilter.addEventListener('focus', function () {
                            const w = tagsFilter.closest('.inline-add-wrapper');
                            if (w) w.classList.add('inline-input-focused');
                            inlineInputActive = true;
                            // Hide tag palette and make swatches unfocusable while searching
                            const pal = document.getElementById('tagPalette');
                            if (pal) {
                                if (document.activeElement && pal.contains(document.activeElement)) try { document.activeElement.blur(); } catch (e) { }
                                pal.classList.remove('show');
                                pal.setAttribute('aria-hidden', 'true');
                                try { pal.inert = true; } catch (e) { }
                                pal.querySelectorAll('.color-swatch-inline').forEach(b => b.setAttribute('tabindex', '-1'));
                            }
                            const colorBtn = document.getElementById('tagColorBtn'); if (colorBtn) colorBtn.setAttribute('tabindex', '-1');
                        });
                        tagsFilter.addEventListener('blur', function () {
                            const w = tagsFilter.closest('.inline-add-wrapper');
                            if (w) w.classList.remove('inline-input-focused');
                            inlineInputActive = false;
                            const pal = document.getElementById('tagPalette'); if (pal) pal.querySelectorAll('.color-swatch-inline').forEach(b => b.removeAttribute('tabindex'));
                            const colorBtn = document.getElementById('tagColorBtn'); if (colorBtn) colorBtn.removeAttribute('tabindex');
                        });
                    }

                    const categoriesFilter = document.getElementById('categoriesSearchInput');
                    const categoriesClear = document.getElementById('categoriesSearchClear');

                    // ensure clear buttons reflect initial state (if inputs were pre-populated)
                    try { updateClearVisibility(tagsFilter, tagsClear); } catch (e) { }

                    // toggles for magnifier -> open/close behavior
                    const tagsToggle = document.getElementById('tagsSearchToggle');
                    const categoriesToggle = document.getElementById('categoriesSearchToggle');

                    if (tagsToggle && !tagsToggle.dataset.toggleWired) {
                        tagsToggle.dataset.toggleWired = '1';
                        tagsToggle.addEventListener('pointerdown', function (e) {
                            console.log('[popup] tagsToggle pointerdown', e);
                        });
                        tagsToggle.addEventListener('click', function (e) {
                            e.stopPropagation();
                            console.log('[popup] tagsToggle click', e);
                            const wrapper = document.getElementById('tagsFilterWrapper');
                            if (!wrapper) {
                                console.log('[popup] tagsToggle: wrapper not found');
                                return;
                            }
                            const isOpen = wrapper.classList.toggle('open');
                            tagsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                            if (isOpen) {
                                // show input and focus
                                tagsFilter?.classList.remove('hidden');
                                // show the clear button when search opens so user can immediately close it
                                if (tagsClear) {
                                    tagsClear.classList.remove('hidden');
                                    tagsClear.style.display = 'inline-flex';
                                }
                                console.log('[popup] tagsToggle: opened wrapper.className=', wrapper.className, 'tagsFilter.className=', tagsFilter?.className, 'computedDisplay=', tagsFilter ? window.getComputedStyle(tagsFilter).display : 'no-el');
                                setTimeout(() => { try { tagsFilter?.focus(); if (tagsFilter.value && tagsFilter.value.trim().length > 0) updateClearVisibility(tagsFilter, tagsClear); } catch (e) { } }, 0);
                            } else {
                                // closing: clear and reset
                                try { tagsFilter.value = ''; updateClearVisibility(tagsFilter, tagsClear); filterCheckboxList('tagsCheckboxList', ''); } catch (e) { }
                                tagsFilter?.classList.add('hidden');
                                // also hide the clear button
                                if (tagsClear) { tagsClear.classList.add('hidden'); tagsClear.style.display = 'none'; }
                                console.log('[popup] tagsToggle: closed wrapper.className=', wrapper.className, 'tagsFilter.className=', tagsFilter?.className, 'computedDisplay=', tagsFilter ? window.getComputedStyle(tagsFilter).display : 'no-el');
                                tagsToggle.focus();
                            }
                        });
                    }

                    if (categoriesToggle && !categoriesToggle.dataset.toggleWired) {
                        categoriesToggle.dataset.toggleWired = '1';
                        categoriesToggle.addEventListener('pointerdown', function (e) {
                            console.log('[popup] categoriesToggle pointerdown', e);
                        });
                        categoriesToggle.addEventListener('click', function (e) {
                            e.stopPropagation();
                            console.log('[popup] categoriesToggle click', e);
                            const wrapper = document.getElementById('categoriesFilterWrapper');
                            if (!wrapper) {
                                console.log('[popup] categoriesToggle: wrapper not found');
                                return;
                            }
                            const isOpen = wrapper.classList.toggle('open');
                            categoriesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                            if (isOpen) {
                                categoriesFilter?.classList.remove('hidden');
                                // show clear button when search opens
                                if (categoriesClear) { categoriesClear.classList.remove('hidden'); categoriesClear.style.display = 'inline-flex'; }
                                console.log('[popup] categoriesToggle: opened wrapper.className=', wrapper.className, 'categoriesFilter.className=', categoriesFilter?.className, 'computedDisplay=', categoriesFilter ? window.getComputedStyle(categoriesFilter).display : 'no-el');
                                setTimeout(() => { try { categoriesFilter?.focus(); if (categoriesFilter.value && categoriesFilter.value.trim().length > 0) updateClearVisibility(categoriesFilter, categoriesClear); } catch (e) { } }, 0);
                            } else {
                                try { categoriesFilter.value = ''; updateClearVisibility(categoriesFilter, categoriesClear); filterCheckboxList('categoriesCheckboxList', ''); } catch (e) { }
                                categoriesFilter?.classList.add('hidden');
                                // hide clear button when search closes
                                if (categoriesClear) { categoriesClear.classList.add('hidden'); categoriesClear.style.display = 'none'; }
                                console.log('[popup] categoriesToggle: closed wrapper.className=', wrapper.className, 'categoriesFilter.className=', categoriesFilter?.className, 'computedDisplay=', categoriesFilter ? window.getComputedStyle(categoriesFilter).display : 'no-el');
                                categoriesToggle.focus();
                            }
                        });
                    }
                    try { updateClearVisibility(categoriesFilter, categoriesClear); } catch (e) { }
                    // Attach categories filter handlers only once
                    try {
                        if (categoriesFilter && !categoriesFilter.dataset.filterWired) {
                            categoriesFilter.dataset.filterWired = '1';
                            categoriesFilter.addEventListener('input', debounce((e) => { updateClearVisibility(categoriesFilter, categoriesClear); filterCheckboxList('categoriesCheckboxList', e.target.value); }, 150));
                            categoriesFilter.addEventListener('keydown', function (e) {
                                if (e.key === 'Escape') {
                                    if (categoriesFilter.value && categoriesFilter.value.trim().length > 0) {
                                        categoriesFilter.value = '';
                                        updateClearVisibility(categoriesFilter, categoriesClear);
                                        filterCheckboxList('categoriesCheckboxList', '');
                                    } else {
                                        const wrapper = document.getElementById('categoriesFilterWrapper');
                                        const toggle = document.getElementById('categoriesSearchToggle');
                                        if (wrapper) wrapper.classList.remove('open');
                                        if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
                                        if (categoriesFilter) categoriesFilter.classList.add('hidden');
                                        // Also hide the clear (×) button when the input is closed
                                        if (categoriesClear) { categoriesClear.classList.add('hidden'); categoriesClear.style.display = 'none'; }
                                    }
                                }
                            });

                            // Prevent accidental activation of the category color palette while typing in the category search
                            if (!categoriesFilter.dataset.focusWired) {
                                categoriesFilter.dataset.focusWired = '1';
                                categoriesFilter.addEventListener('focus', function () {
                                    const w = categoriesFilter.closest('.inline-add-wrapper');
                                    if (w) w.classList.add('inline-input-focused');
                                    inlineInputActive = true;
                                    const pal = document.getElementById('categoryPalette');
                                    if (pal) {
                                        if (document.activeElement && pal.contains(document.activeElement)) try { document.activeElement.blur(); } catch (e) { }
                                        pal.classList.remove('show');
                                        pal.setAttribute('aria-hidden', 'true');
                                        try { pal.inert = true; } catch (e) { }
                                        pal.querySelectorAll('.color-swatch-inline').forEach(b => b.setAttribute('tabindex', '-1'));
                                    }
                                    const colorBtn = document.getElementById('categoryColorBtn'); if (colorBtn) colorBtn.setAttribute('tabindex', '-1');
                                });
                                categoriesFilter.addEventListener('blur', function () {
                                    const w = categoriesFilter.closest('.inline-add-wrapper');
                                    if (w) w.classList.remove('inline-input-focused');
                                    inlineInputActive = false;
                                    const pal = document.getElementById('categoryPalette'); if (pal) pal.querySelectorAll('.color-swatch-inline').forEach(b => b.removeAttribute('tabindex'));
                                    const colorBtn = document.getElementById('categoryColorBtn'); if (colorBtn) colorBtn.removeAttribute('tabindex');
                                });
                            }
                        }
                        if (categoriesClear && !categoriesClear.dataset.clearWired) {
                            categoriesClear.dataset.clearWired = '1';
                            categoriesClear.addEventListener('click', function () {
                                if (!categoriesFilter) return;
                                // if there is text, clear it
                                if (categoriesFilter.value && categoriesFilter.value.trim().length > 0) {
                                    categoriesFilter.value = '';
                                    categoriesFilter.focus();
                                    updateClearVisibility(categoriesFilter, categoriesClear);
                                    filterCheckboxList('categoriesCheckboxList', '');
                                    return;
                                }
                                // if already empty, close the inline search and return focus to the toggle
                                const wrapper = document.getElementById('categoriesFilterWrapper');
                                if (wrapper) wrapper.classList.remove('open');
                                const toggle = document.getElementById('categoriesSearchToggle');
                                if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
                                if (categoriesFilter) categoriesFilter.classList.add('hidden');
                                // hide the clear button as well
                                if (categoriesClear) { categoriesClear.classList.add('hidden'); categoriesClear.style.display = 'none'; categoriesClear.textContent = '✕'; categoriesClear.setAttribute('aria-label','Clear search'); }
                            });
                        }
                    } catch (err) { console.debug('attach categories filter handlers failed', err); }

                    // Apply any existing filter values after render
                    try { if (document.getElementById('tagsSearchInput')?.value) filterCheckboxList('tagsCheckboxList', document.getElementById('tagsSearchInput').value); } catch (e) { }
                    try { if (document.getElementById('categoriesSearchInput')?.value) filterCheckboxList('categoriesCheckboxList', document.getElementById('categoriesSearchInput').value); } catch (e) { }

                    // Auto-save form data every 500ms while form is visible
                    setInterval(() => {
                        if (siteFormSection && !siteFormSection.classList.contains('hidden')) {
                            saveFormToCache();
                        }
                    }, 500);
                }, 50);
            });
        }
    });
}

// Add event listeners to save form as user types/selects
function addFormCacheListeners() {

    const siteNameInput = document.getElementById('siteName');
    const urlInput = document.getElementById('url');
    const pricingSelect = document.getElementById('pricing');
    const categoryCheckboxes = document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]');
    const tagCheckboxes = document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]');

    console.debug('addFormCacheListeners: attaching listeners', 'categories:', categoryCheckboxes.length, 'tags:', tagCheckboxes.length);

    console.debug('addFormCacheListeners: attaching listeners', 'categories:', categoryCheckboxes.length, 'tags:', tagCheckboxes.length);


    // Save on input
    if (siteNameInput) {
        siteNameInput.addEventListener('input', saveFormToCache);
    }
    if (urlInput) {
        urlInput.addEventListener('input', saveFormToCache);
    }
    if (pricingSelect) {
        pricingSelect.addEventListener('change', saveFormToCache);
    }

    // Save on checkbox change
    categoryCheckboxes.forEach((cb, i) => {
        cb.addEventListener('change', saveFormToCache);
    });
    tagCheckboxes.forEach((cb, i) => {
        cb.addEventListener('change', saveFormToCache);
    });
}

// Debounce helper
function debounce(fn, wait = 150) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Filter checkbox list by query (case-insensitive, matches label text or dataset name)
function filterCheckboxList(containerId, query) {
    const q = (query || '').trim().toLowerCase();
    const container = document.getElementById(containerId);
    if (!container) return;

    Array.from(container.children).forEach(itemDiv => {
        try {
            const labelText = (itemDiv.querySelector('label')?.textContent || '').toLowerCase();
            const input = itemDiv.querySelector('input[type="checkbox"]');
            const metaName = (input?.dataset?.tagName || input?.dataset?.categoryName || '').toLowerCase();
            const matches = !q || labelText.includes(q) || metaName.includes(q);
            itemDiv.style.display = matches ? '' : 'none';
        } catch (e) {
            // ignore
        }
    });
}

// Save form data before popup closes (more reliable than beforeunload)
window.addEventListener('beforeunload', () => {
    saveFormToCache();
});

window.addEventListener('pagehide', () => {
    saveFormToCache();
});

window.addEventListener('unload', () => {
    saveFormToCache();
});

// Test - allow manual save from console
window.testSaveFormToCache = saveFormToCache;
window.testGetCacheKey = getFormCacheKey;
window.testCheckLocalStorage = () => {
    const key = getFormCacheKey();
    const data = localStorage.getItem(key);
    return data;
};

// Login toggle
const showLoginBtn = document.getElementById('showLogin');
const pricingSelect = document.getElementById('pricing');

if (showLoginBtn) {
    // Ensure login form remains visible when toggling
    showLoginBtn.addEventListener('click', () => {
        if (loginForm) loginForm.classList.remove('hidden');
    });
}

// Save form data on every change
if (pricingSelect) {
    pricingSelect.addEventListener('change', saveFormToCache);
}

// Login
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');

        if (!emailInput || !passwordInput) {
            showMessage('Email/password fields missing from form', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Please enter email and password', 'error');
            return;
        }

        if (!ensureSupabase()) return;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        let data, error;
        try {
            ({ data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            }));
        } catch (err) {
            console.error('signInWithPassword exception:', err);
            showMessage('Error during sign in (network). Check console.', 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
            return;
        }

        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';

        if (error) {
            showMessage(error.message, 'error');
        } else {
            currentUser = data.user;
            // Save session immediately to reduce chance of losing it when popup closes quickly
            if (data && data.session) {
                await saveAuthToken(data.session);
                console.debug('Login: saved session immediately to storage');
            }
            showMessage('Successfully signed in!', 'success');
            setTimeout(showSiteForm, 1000);
        }
    });
}



// Logout
const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('headerLogoutBtn') || document.getElementById('logoutCompactBtn');
async function logoutUser() {
    if (!ensureSupabase()) return;
    try {
        await supabaseClient.auth.signOut();
        clearAuthToken();
        currentUser = null;
        showAuthForm();
        showMessage('Successfully signed out', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('Error during logout', 'error');
    }
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
}

// Cancel button
const cancelBtn = document.getElementById('cancelBtn');
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        window.close();
    });
}

// Submit site form
const siteForm = document.getElementById('siteForm');
if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Getting values from fields
        const urlInput = document.getElementById('url');
        const pricingSelect = document.getElementById('pricing');
        const saveBtn = document.getElementById('saveBtn');
        const siteNameInput = document.getElementById('siteName');

        if (!urlInput || !pricingSelect || !saveBtn || !siteNameInput) {
            showMessage('Error: Some form fields are missing', 'error');
            return;
        }

        const url = urlInput.value.trim();
        const siteName = siteNameInput.value.trim();

        // Get only selected checkboxes for categories
        const selectedCategoryCheckboxes = Array.from(
            document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]:checked')
        );
        const categoryIds = selectedCategoryCheckboxes.map(cb => cb.value);
        const categoryNames = selectedCategoryCheckboxes.map(cb => cb.dataset.categoryName);

        // Get only selected checkboxes for tags
        const selectedTagCheckboxes = Array.from(
            document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]:checked')
        );
        const tagIds = selectedTagCheckboxes.map(cb => cb.value);
        const tagNames = selectedTagCheckboxes.map(cb => {
            // If dataset.tagName is not available, use textContent from label
            return cb.dataset.tagName || cb.nextElementSibling?.textContent || 'Unknown';
        }).filter(name => name !== 'Unknown' && name);

        const pricing = pricingSelect.value;

        if (!siteName) {
            showMessage('Site name is required!', 'error');
            return;
        }
        if (!url) {
            showMessage('URL address is required!', 'error');
            return;
        }
        if (categoryIds.length === 0) {
            showMessage('Please select at least one category!', 'error');
            return;
        }
        if (tagIds.length === 0) {
            showMessage('You must select at least one tag!', 'error');
            return;
        }
        if (!pricing) {
            showMessage('Please select a pricing model!', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Get user_id from session
            if (!ensureSupabase()) throw new Error('Supabase not available');

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) {
                showMessage('You are not signed in!', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Site';
                return;
            }

            const userId = session.user.id;

            // Prepare base payload to send to Supabase
            const siteDataBase = {
                title: siteName,
                url: url,
                // If multiple categories selected, use the first as the site's main category
                category: (categoryNames && categoryNames.length > 0) ? categoryNames[0] : null,
                // send tag names as a text[] field
                tags: tagNames && tagNames.length > 0 ? tagNames : null,
                pricing: pricing,
                user_id: userId
            };

            // Adapt payload to server-side column naming when possible (most deployments use `title`/`category`,
            // but some older setups may use `name`/`categories`). We detect columns and remap so values don't end up as null.
            let siteData = Object.assign({}, siteDataBase);
            try {
                const cols = await detectSitesColumns();
                if (cols && cols.length > 0) {
                    // If server has `name` but not `title`, map title -> name
                    if (cols.includes('name') && !cols.includes('title')) {
                        siteData.name = siteData.title;
                        delete siteData.title;
                    }
                    // If server has `categories` (plural) but not `category`, map category -> categories (as array)
                    if (cols.includes('categories') && !cols.includes('category')) {
                        siteData.categories = siteData.category ? [siteData.category] : null;
                        delete siteData.category;
                    }
                }
            } catch (e) {
                console.debug('siteData column-detect/map failed', e);
            }

            console.debug('Preparing siteData for insert (adjusted):', siteDataBase, '=>', siteData);


            // Prefer direct Supabase insert when available (no localhost required)
            let result = null;

            if (ensureSupabase()) {
                try {
                    // First, check whether a site with the same url+user already exists to avoid duplicate-key errors
                    try {
                        const { data: existing, error: checkErr } = await supabaseClient.from('sites').select('id').eq('url', url).eq('user_id', userId).limit(1);
                        if (checkErr) {
                            console.error('Error checking existing site', checkErr);
                            showMessage('Error checking existing sites', 'error');
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Site';
                            return;
                        }
                        if (existing && existing.length > 0) {
                            console.debug('Site already exists locally (user_id+url)', { userId, url, existing });
                            showMessage('⚠️ Site already exists in your collection!', 'error');
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Site';
                            return;
                        }
                    } catch (checkEx) {
                        console.error('Exception during existing-site check', checkEx);
                        // Continue to attempt insert as a best-effort if check failed unexpectedly
                    }

                    // Primary insert attempt
                    let inserted = null;
                    let insertErr = null;
                    try {
                        const resp = await supabaseClient.from('sites').insert([siteData]).select();
                        inserted = resp.data;
                        insertErr = resp.error;
                    } catch (ie) {
                        insertErr = ie;
                    }

                    if (insertErr) {
                        console.error('Supabase insert error', insertErr);

                        // If PostgREST schema cache error (PGRST204), attempt iterative fallback
                        if (insertErr && insertErr.code === 'PGRST204' && typeof insertErr.message === 'string') {
                            let attemptPayload = Object.assign({}, siteData);
                            let lastErr = insertErr;
                            let triedAltCategoryId = false;
                            let triedAltTagIds = false;
                            let success = false;

                            for (let attempt = 0; attempt < 4 && !success; attempt++) {
                                const m = lastErr.message.match(/Could not find the '([^']+)' column of '([^']+)'/);
                                if (!m) break;
                                const missingCol = m[1];
                                console.warn('Supabase schema mismatch: missing column', missingCol, '— attempt', attempt + 1);

                                // Try sensible remaps first (only once per variant)
                                if (missingCol === 'category' && categoryIds && categoryIds.length > 0 && !triedAltCategoryId) {
                                    attemptPayload.category_id = categoryIds[0];
                                    delete attemptPayload.category;
                                    triedAltCategoryId = true;
                                } else if (missingCol === 'tags' && tagIds && tagIds.length > 0 && !triedAltTagIds) {
                                    attemptPayload.tag_ids = tagIds;
                                    delete attemptPayload.tags;
                                    triedAltTagIds = true;
                                } else {
                                    // Remove the missing property if present, or related fallback (e.g., base name for *_id)
                                    if (attemptPayload.hasOwnProperty(missingCol)) {
                                        delete attemptPayload[missingCol];
                                    } else if (missingCol.endsWith('_id')) {
                                        const base = missingCol.replace(/_id$/, '');
                                        if (attemptPayload.hasOwnProperty(base)) delete attemptPayload[base];
                                    }
                                }

                                // Try inserting with the modified payload
                                try {
                                    const { data: inserted2, error: insertErr2 } = await supabaseClient.from('sites').insert([attemptPayload]).select();
                                    if (insertErr2) {
                                        console.error('Fallback insert attempt failed', insertErr2);
                                        lastErr = insertErr2;
                                        continue; // try another iteration
                                    }
                                    // success
                                    result = { success: true, data: inserted2 };
                                    success = true;
                                    break;
                                } catch (tryErr) {
                                    console.error('Fallback insert threw', tryErr);
                                    lastErr = tryErr;
                                    continue;
                                }
                            }

                            if (!success) {
                                showMessage('Error saving to Supabase: ' + (lastErr.message || JSON.stringify(lastErr)), 'error');
                                saveBtn.disabled = false;
                                saveBtn.textContent = 'Save Site';
                                return;
                            }
                        } else {
                            // Non-schema or generic errors
                            showMessage('Error saving to Supabase: ' + (insertErr.message || JSON.stringify(insertErr)), 'error');
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Site';
                            return;
                        }
                    } else {
                        result = { success: true, data: inserted };
                    }
                } catch (err) {
                    console.error('Supabase insert threw', err);
                    showMessage('Error saving to Supabase: ' + (err.message || String(err)), 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Site';
                    return;
                }
            } else {                // Legacy fallback to local API for environments that still use it
                try {
                    const response = await fetch(`${API_URL}/api/sites`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify(siteData)
                    });
                    try {
                        result = await response.json();
                    } catch (e) {
                        console.error('Legacy API response parse failed', e);
                        showMessage('Error saving: legacy API returned invalid response', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Site';
                        return;
                    }
                    if (!response.ok || !result || !result.success) {
                        console.error('Legacy API error', result);
                        showMessage('Error saving: ' + (result && result.error ? result.error : 'Legacy API error'), 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Site';
                        return;
                    }
                } catch (e) {
                    console.error('Legacy API request failed', e);
                    showMessage('Error saving: network error contacting legacy API', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Site';
                    return;
                }
            }

            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Site';

            // Normalize success detection across Supabase and legacy API
            const saveSucceeded = (typeof response === 'undefined') ? (result && result.success) : (response.ok && result && result.success);

            if (!saveSucceeded) {
                // Check if site already exists
                if (result && result.existing) {
                    showMessage('⚠️ Site already exists in your collection!', 'error');
                } else {
                    // Prefer descriptive messages from Supabase or legacy API
                    const errMsg = (result && (result.error || result.message)) ? (result.error || result.message) : 'Unknown error';
                    showMessage('Error saving: ' + errMsg, 'error');
                }
            } else {
                showMessage('✓ Site saved successfully!', 'success');

                // Form reset - reset all fields except URL
                setTimeout(() => {
                    const siteNameInputReset = document.getElementById('siteName');
                    if (siteNameInputReset) {
                        siteNameInputReset.value = '';
                        siteNameInputReset.focus();
                    }

                    // Reset pricing model
                    const pricingSelectReset = document.getElementById('pricing');
                    if (pricingSelectReset) pricingSelectReset.value = '';

                    // Deselect all category checkboxes and clear visual outlines
                    const categoryCheckboxes = document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]');
                    categoryCheckboxes.forEach(cb => {
                        if (cb.checked) {
                            cb.checked = false;
                            // Trigger change listeners so UI updates (outline, font weight, cache)
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        const itemDiv = cb.closest('.category-checkbox');
                        if (itemDiv) {
                            itemDiv.style.outline = 'none';
                            itemDiv.style.fontWeight = 'normal';
                        }
                    });

                    // Deselect all tag checkboxes and clear visual outlines
                    const tagCheckboxes = document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]');
                    tagCheckboxes.forEach(cb => {
                        if (cb.checked) {
                            cb.checked = false;
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        const itemDiv = cb.closest('.tag-checkbox');
                        if (itemDiv) {
                            itemDiv.style.outline = 'none';
                            itemDiv.style.fontWeight = 'normal';
                        }
                    });

                    // Clear per-tab cache and save only the URL so popup reopens with defaults + URL
                    clearFormCache();
                    try { saveFormToCache(); } catch (e) { console.debug('saveFormToCache after clear failed', e); }
                }, 1500);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            showMessage('Error saving: ' + errorMsg, 'error');
        }
    });
}

// Display message
function showMessage(text, type) {
    if (!messageEl) return;

    messageEl.textContent = text;
    messageEl.className = `message ${type} show`;

    setTimeout(() => {
        if (messageEl) messageEl.classList.remove('show');
    }, 3000);
}

// Category / Tag add handlers 🔧
const addCategoryBtn = document.getElementById('addCategoryBtn');
const addTagBtn = document.getElementById('addTagBtn');
const addCategoryForm = document.getElementById('addCategoryForm');
const addTagForm = document.getElementById('addTagForm');
const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
const cancelTagBtn = document.getElementById('cancelTagBtn');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const saveTagBtn = document.getElementById('saveTagBtn');
const categoryColorBtn = document.getElementById('categoryColorBtn');
const tagColorBtn = document.getElementById('tagColorBtn');

// Accessibility helpers: show/hide inline forms/palettes without hiding a focused element
function showInlineForm(formEl, addBtn) {
    if (!formEl) return;

    // Close any other inline forms so only one is open at a time
    try { if (formEl !== addCategoryForm) hideInlineForm(addCategoryForm, addCategoryBtn); } catch (e) { }
    try { if (formEl !== addTagForm) hideInlineForm(addTagForm, addTagBtn); } catch (e) { }

    formEl.classList.remove('hidden');
    formEl.setAttribute('aria-hidden', 'false');
    try { formEl.inert = false; } catch (e) { }

    // Show inline form. Toggle the add button symbol to '✕' so it can close the form as well
    if (addBtn) {
        addBtn.classList.add('open');
        // Show the X so the left-side button acts as close while the form is open
        try { addBtn.innerHTML = '✕'; } catch (e) { /* ignore */ }
        const isCategory = addBtn.id && addBtn.id.toLowerCase().includes('category');
        addBtn.setAttribute('aria-label', isCategory ? 'Close add category' : 'Close add tag');
    }
}

function hideInlineForm(formEl, addBtn) {
    if (!formEl) return;
    // If a child has focus, blur it first so we do not hide a focused element.
    if (document.activeElement && formEl.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (e) { }
    }
    formEl.classList.add('hidden');
    formEl.setAttribute('aria-hidden', 'true');
    try { formEl.inert = true; } catch (e) { }

    // Restore the add button back to '+' and focus it
    if (addBtn) {
        addBtn.classList.remove('open');
        addBtn.innerHTML = '+';
        const isCategory = addBtn.id && addBtn.id.toLowerCase().includes('category');
        addBtn.setAttribute('aria-label', isCategory ? 'Add category' : 'Add tag');

        // Clear any input fields and reset swatches for the form being hidden
        try {
            if (formEl === addTagForm) {
                const el = document.getElementById('newTagName'); if (el) el.value = '';
                const colorEl = document.getElementById('newTagColor'); if (colorEl) colorEl.value = '#667eea';
                const sw = document.getElementById('tagColorBtn'); if (sw) sw.style.background = '#667eea';
            }
            if (formEl === addCategoryForm) {
                const el = document.getElementById('newCategoryName'); if (el) el.value = '';
                const colorEl = document.getElementById('newCategoryColor'); if (colorEl) colorEl.value = '#6CBBFB';
                const sw = document.getElementById('categoryColorBtn'); if (sw) sw.style.background = '#6CBBFB';
            }
        } catch (e) { console.debug('clearing inline form fields in hideInlineForm failed', e); }

        // Do not modify search clear controls here — closing the add form should not affect an open search.
        // Keep the right-side clear visibility tied to the search input state only.
    }
}

function togglePalette(palId) {
    if (inlineInputActive) return;
    const pal = document.getElementById(palId);
    if (!pal) return;
    const isOpen = pal.classList.toggle('show');
    pal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    try { pal.inert = !isOpen; } catch (e) { }
    if (!isOpen && document.activeElement && pal.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (e) { }
    }
}

// Ensure hidden inline forms/palettes are inert on load
['addCategoryForm', 'addTagForm', 'categoryPalette', 'tagPalette'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        if (el.classList.contains('hidden') || el.getAttribute('aria-hidden') === 'true') {
            // If a descendant is focused for some reason, blur it first to avoid hiding a focused element
            if (document.activeElement && el.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }
            try { el.inert = true; } catch (e) { }
            el.setAttribute('aria-hidden', 'true');
        } else {
            try { el.inert = false; } catch (e) { }
            el.setAttribute('aria-hidden', 'false');
        }
    }
});

// Show/hide inline forms next to + and focus field (toggle behavior: + -> ✕ when open)
if (addCategoryBtn) addCategoryBtn.addEventListener('click', (e) => {
    if (e && e.target && e.target.closest && e.target.closest('.btn-add') !== addCategoryBtn) return;
    e.stopPropagation();
    if (addCategoryForm && !addCategoryForm.classList.contains('hidden')) {
        hideInlineForm(addCategoryForm, addCategoryBtn);
    } else {
        showInlineForm(addCategoryForm, addCategoryBtn);
        document.getElementById('newCategoryName')?.focus();
    }
});
if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', () => { hideInlineForm(addCategoryForm, addCategoryBtn); const el = document.getElementById('newCategoryName'); if (el) el.value = ''; const colorEl = document.getElementById('newCategoryColor'); if (colorEl) colorEl.value = '#6CBBFB'; if (categoryColorBtn) categoryColorBtn.style.background = '#6CBBFB'; });
if (addTagBtn) addTagBtn.addEventListener('click', (e) => {
    if (e && e.target && e.target.closest && e.target.closest('.btn-add') !== addTagBtn) return;
    e.stopPropagation();
    if (addTagForm && !addTagForm.classList.contains('hidden')) {
        hideInlineForm(addTagForm, addTagBtn);
    } else {
        showInlineForm(addTagForm, addTagBtn);
        document.getElementById('newTagName')?.focus();
    }
});
if (cancelTagBtn) cancelTagBtn.addEventListener('click', () => { hideInlineForm(addTagForm, addTagBtn); const el = document.getElementById('newTagName'); if (el) el.value = ''; const colorEl = document.getElementById('newTagColor'); if (colorEl) colorEl.value = '#667eea'; if (tagColorBtn) tagColorBtn.style.background = '#667eea'; });

// Color swatch toggles a small inline palette and mirrors the color on the circle
if (categoryColorBtn) categoryColorBtn.addEventListener('click', (e) => { e.stopPropagation(); if (inlineInputActive) { e.preventDefault(); return; } togglePalette('categoryPalette'); });
if (tagColorBtn) tagColorBtn.addEventListener('click', (e) => { e.stopPropagation(); if (inlineInputActive) { e.preventDefault(); return; } togglePalette('tagPalette'); });
const catColorInput = document.getElementById('newCategoryColor'); if (catColorInput) catColorInput.addEventListener('change', (e) => { if (categoryColorBtn) categoryColorBtn.style.background = e.target.value; });
const tagColorInput = document.getElementById('newTagColor'); if (tagColorInput) tagColorInput.addEventListener('change', (e) => { if (tagColorBtn) tagColorBtn.style.background = e.target.value; });

// Setup palette selection handlers
function setupInlinePalette(paletteId, colorInputId, swatchBtnId) {
    const pal = document.getElementById(paletteId);
    if (!pal) return;
    pal.querySelectorAll('.color-swatch-inline').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            if (inlineInputActive) { ev.stopPropagation(); ev.preventDefault(); return; }
            const color = btn.dataset.color;
            const input = document.getElementById(colorInputId);
            const sw = document.getElementById(swatchBtnId);
            if (input) input.value = color;
            if (sw) sw.style.background = color;

            // If a child currently has focus, blur it before hiding to avoid aria-hidden on focused element
            if (document.activeElement && pal.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }

            pal.classList.remove('show');
            pal.setAttribute('aria-hidden', 'true');
            try { pal.inert = true; } catch (e) { }

            // Return focus to the swatch trigger so focus is not hidden
            if (sw) {
                try { sw.focus(); } catch (e) { }
            }
        });
    });
}

setupInlinePalette('categoryPalette', 'newCategoryColor', 'categoryColorBtn');
setupInlinePalette('tagPalette', 'newTagColor', 'tagColorBtn');

// Hide palettes when clicking outside them (but do not interfere with other form handlers)
document.addEventListener('click', function (e) {
    if (!e.target.closest('#categoryPalette') && !e.target.closest('#categoryColorBtn')) {
        const p = document.getElementById('categoryPalette');
        const trigger = document.getElementById('categoryColorBtn');
        if (p) {
            if (document.activeElement && p.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }
            p.classList.remove('show');
            p.setAttribute('aria-hidden', 'true');
            try { p.inert = true; } catch (e) { }
            if (trigger) { try { trigger.focus(); } catch (e) { } }
        }
    }
    if (!e.target.closest('#tagPalette') && !e.target.closest('#tagColorBtn')) {
        const p = document.getElementById('tagPalette');
        const trigger = document.getElementById('tagColorBtn');
        if (p) {
            if (document.activeElement && p.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }
            p.classList.remove('show');
            p.setAttribute('aria-hidden', 'true');
            try { p.inert = true; } catch (e) { }
            if (trigger) { try { trigger.focus(); } catch (e) { } }
        }
    }
});

// Keyboard shortcuts while focused on inline input: Enter = save, Escape = cancel
const newCatInput = document.getElementById('newCategoryName'); if (newCatInput) {
    newCatInput.addEventListener('keydown', function (e) {
        // Stop printable characters from bubbling to global handlers while typing
        if (e.key && e.key.length === 1) {
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter') { e.preventDefault(); saveCategoryBtn && saveCategoryBtn.click(); }
        else if (e.key === 'Escape') { cancelCategoryBtn && cancelCategoryBtn.click(); }
    });
    // Prevent accidental clicks on color while typing: toggle a class on wrapper
    newCatInput.addEventListener('focus', () => {
        const w = newCatInput.closest('.inline-add-wrapper');
        if (w) w.classList.add('inline-input-focused');

        // Mark input as active so other handlers ignore palette activation
        inlineInputActive = true;

        // Hide palettes and remove focusability while typing
        const pal = document.getElementById('categoryPalette');
        if (pal) {
            if (document.activeElement && pal.contains(document.activeElement)) try { document.activeElement.blur(); } catch (e) { }
            pal.classList.remove('show');
            pal.setAttribute('aria-hidden', 'true');
            try { pal.inert = true; } catch (e) { }
            pal.querySelectorAll('.color-swatch-inline').forEach(b => b.setAttribute('tabindex', '-1'));
        }
        const colorBtn = document.getElementById('categoryColorBtn');
        if (colorBtn) colorBtn.setAttribute('tabindex', '-1');
    });

    newCatInput.addEventListener('blur', () => {
        const w = newCatInput.closest('.inline-add-wrapper');
        if (w) w.classList.remove('inline-input-focused');

        // Clear the typing guard and restore swatch focusability
        inlineInputActive = false;
        const pal = document.getElementById('categoryPalette');
        if (pal) pal.querySelectorAll('.color-swatch-inline').forEach(b => b.removeAttribute('tabindex'));
        const colorBtn = document.getElementById('categoryColorBtn');
        if (colorBtn) colorBtn.removeAttribute('tabindex');
    });
}
const newTagInput = document.getElementById('newTagName'); if (newTagInput) {
    newTagInput.addEventListener('keydown', function (e) {
        // Stop printable characters from bubbling to global handlers while typing
        if (e.key && e.key.length === 1) {
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter') { e.preventDefault(); saveTagBtn && saveTagBtn.click(); }
        else if (e.key === 'Escape') { cancelTagBtn && cancelTagBtn.click(); }
    });
    newTagInput.addEventListener('focus', () => {
        const w = newTagInput.closest('.inline-add-wrapper');
        if (w) w.classList.add('inline-input-focused');

        // Mark input as active so other handlers ignore palette activation
        inlineInputActive = true;

        // Hide palettes and remove focusability while typing
        const pal = document.getElementById('tagPalette');
        if (pal) {
            if (document.activeElement && pal.contains(document.activeElement)) try { document.activeElement.blur(); } catch (e) { }
            pal.classList.remove('show');
            pal.setAttribute('aria-hidden', 'true');
            try { pal.inert = true; } catch (e) { }
            pal.querySelectorAll('.color-swatch-inline').forEach(b => b.setAttribute('tabindex', '-1'));
        }
        const colorBtn = document.getElementById('tagColorBtn');
        if (colorBtn) colorBtn.setAttribute('tabindex', '-1');
    });

    newTagInput.addEventListener('blur', () => {
        const w = newTagInput.closest('.inline-add-wrapper');
        if (w) w.classList.remove('inline-input-focused');

        // Clear the typing guard and restore swatch focusability
        inlineInputActive = false;
        const pal = document.getElementById('tagPalette');
        if (pal) pal.querySelectorAll('.color-swatch-inline').forEach(b => b.removeAttribute('tabindex'));
        const colorBtn = document.getElementById('tagColorBtn');
        if (colorBtn) colorBtn.removeAttribute('tabindex');
    });
}

// Close inline forms when clicking outside them (respect inline wrapper)
document.addEventListener('click', function (e) {
    // If click happens inside an inline filter wrapper, don't close add forms (we allow interacting with filters)
    if (!e.target.closest('#addCategoryForm') && !e.target.closest('#addCategoryBtn') && !e.target.closest('.inline-add-wrapper') && !e.target.closest('.inline-filter-wrapper')) {
        hideInlineForm(addCategoryForm, addCategoryBtn);
    }
    if (!e.target.closest('#addTagForm') && !e.target.closest('#addTagBtn') && !e.target.closest('.inline-add-wrapper') && !e.target.closest('.inline-filter-wrapper')) {
        hideInlineForm(addTagForm, addTagBtn);
    }
    // Also hide palettes if click is outside wrapper/palette controls (handled elsewhere too)
    if (!e.target.closest('#categoryPalette') && !e.target.closest('#categoryColorBtn') && !e.target.closest('.inline-add-wrapper')) {
        const p = document.getElementById('categoryPalette'); const trigger = document.getElementById('categoryColorBtn');
        if (p) {
            if (document.activeElement && p.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }
            p.classList.remove('show');
            p.setAttribute('aria-hidden', 'true');
            try { p.inert = true; } catch (e) { }
            if (trigger) { try { trigger.focus(); } catch (e) { } }
        }
    }
    if (!e.target.closest('#tagPalette') && !e.target.closest('#tagColorBtn') && !e.target.closest('.inline-add-wrapper')) {
        const p = document.getElementById('tagPalette'); const trigger = document.getElementById('tagColorBtn');
        if (p) {
            if (document.activeElement && p.contains(document.activeElement)) {
                try { document.activeElement.blur(); } catch (e) { }
            }
            p.classList.remove('show');
            p.setAttribute('aria-hidden', 'true');
            try { p.inert = true; } catch (e) { }
            if (trigger) { try { trigger.focus(); } catch (e) { } }
        }
    }
});

// Save handlers: show small spinner while saving and restore checkmark on finish
if (saveCategoryBtn) saveCategoryBtn.addEventListener('click', async () => {
    const nameEl = document.getElementById('newCategoryName');
    const colorEl = document.getElementById('newCategoryColor');
    const name = nameEl?.value.trim();
    const color = colorEl?.value || '#6CBBFB';
    if (!name) return showMessage('Category name is required', 'error');
    saveCategoryBtn.disabled = true;
    const prev = saveCategoryBtn.textContent;
    // Keep checkmark visible; show spinner overlay via CSS
    saveCategoryBtn.classList.add('loading');
    saveCategoryBtn.setAttribute('aria-busy', 'true');
    try {
        if (ensureSupabase()) {
            const { data: inserted, error: insertErr } = await supabaseClient.from('categories').insert([{ name, color }]).select();
            if (insertErr) {
                console.error('Supabase insert category error', insertErr);
                showMessage(insertErr.message || 'Error creating category', 'error');
            } else {
                showMessage('Category created', 'success');
                // Refresh lists and persist cache
                await safeLoadCategoriesAndTags();
                hideInlineForm(addCategoryForm, addCategoryBtn);
                const el = document.getElementById('newCategoryName'); if (el) el.value = '';
            }
        } else {
            const resp = await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
            const text = await resp.text(); let result; try { result = JSON.parse(text); } catch (e) { result = { error: text }; }
            if (!resp.ok || !result.success) { showMessage(result.error || 'Error creating category', 'error'); } else { showMessage('Category created', 'success'); await safeLoadCategoriesAndTags(); hideInlineForm(addCategoryForm, addCategoryBtn); const el = document.getElementById('newCategoryName'); if (el) el.value = ''; }
        }
    } catch (e) { console.error(e); showMessage('Network error', 'error'); }
    saveCategoryBtn.disabled = false; saveCategoryBtn.classList.remove('loading'); saveCategoryBtn.removeAttribute('aria-busy'); saveCategoryBtn.textContent = prev || '✓';
});

if (saveTagBtn) saveTagBtn.addEventListener('click', async () => {
    const nameEl = document.getElementById('newTagName');
    const colorEl = document.getElementById('newTagColor');
    const name = nameEl?.value.trim();
    const color = colorEl?.value || '#667eea';
    if (!name) return showMessage('Tag name is required', 'error');
    saveTagBtn.disabled = true;
    const prev = saveTagBtn.textContent;
    // Keep checkmark visible; show spinner overlay via CSS
    saveTagBtn.classList.add('loading');
    saveTagBtn.setAttribute('aria-busy', 'true');
    try {
        if (ensureSupabase()) {
            const { data: inserted, error: insertErr } = await supabaseClient.from('tags').insert([{ name, color }]).select();
            if (insertErr) {
                console.error('Supabase insert tag error', insertErr);
                showMessage(insertErr.message || 'Error creating tag', 'error');
            } else {
                showMessage('Tag created', 'success');
                await safeLoadCategoriesAndTags();
                hideInlineForm(addTagForm, addTagBtn);
                const el = document.getElementById('newTagName'); if (el) el.value = '';
            }
        } else {
            const resp = await fetch(`${API_URL}/api/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
            const text = await resp.text(); let result; try { result = JSON.parse(text); } catch (e) { result = { error: text }; }
            if (!resp.ok || !result.success) { showMessage(result.error || 'Error creating tag', 'error'); } else { showMessage('Tag created', 'success'); await safeLoadCategoriesAndTags(); hideInlineForm(addTagForm, addTagBtn); const el = document.getElementById('newTagName'); if (el) el.value = ''; }
        }
    } catch (e) { console.error(e); showMessage('Network error', 'error'); }
    saveTagBtn.disabled = false; saveTagBtn.classList.remove('loading'); saveTagBtn.removeAttribute('aria-busy'); saveTagBtn.textContent = prev || '✓';
});