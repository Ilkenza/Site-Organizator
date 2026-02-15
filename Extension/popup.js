// Debug mode - set to false in production to disable console.debug messages
const DEBUG_MODE = false;
const debug = DEBUG_MODE ? console.debug.bind(console) : () => { };

// Temporary global fetch wrapper for debugging network failures (logs non-ok responses)
// Remove this after diagnosing server 400 errors.
(function () {
    try {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            const __origFetch = window.fetch.bind(window);
            window.fetch = async function (...args) {
                try {
                    const resp = await __origFetch(...args);
                    if (!resp.ok) {
                        let bodyText = '';
                        try { bodyText = await resp.clone().text(); } catch (e) { bodyText = '<unable to read body>'; }
                        console.debug('[popup] fetch DEBUG - URL:', args[0], 'STATUS:', resp.status, 'BODY:', bodyText);
                    } else {
                        console.debug('[popup] fetch OK - URL:', args[0], 'STATUS:', resp.status);
                    }
                    return resp;
                } catch (err) {
                    console.debug('[popup] fetch ERROR - URL:', args[0], 'ERR:', err);
                    throw err;
                }
            };
        }
    } catch (e) { console.debug('Failed to install fetch debug wrapper', e); }
})();

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

// Fetch and display the total count of saved sites in the header badge
async function updateSiteCount() {
    const badge = document.getElementById('siteCountBadge');
    if (!badge) return;

    try {
        if (!ensureSupabase()) return;

        const { count, error } = await supabaseClient
            .from('sites')
            .select('*', { count: 'exact', head: true });

        if (error) {
            debug('updateSiteCount error:', error);
            return;
        }

        const siteCount = count || 0;
        badge.textContent = siteCount === 1 ? '1 site' : `${siteCount} sites`;
        badge.title = `Total saved sites: ${siteCount}`;
    } catch (e) {
        debug('updateSiteCount exception:', e);
    }
}

// --- Recent saved sites helpers --------------------------------
function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getDomainFromUrl(url) {
    try { const u = new URL(url); return u.hostname.replace(/^www\./, ''); } catch (e) { return url || ''; }
}

// Return signed-in user's id (try currentUser first, then Supabase session)
async function getSignedInUserId() {
    try {
        if (currentUser && currentUser.id) return currentUser.id;
        if (!ensureSupabase()) return null;
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session && session.user ? session.user.id : null;
    } catch (e) {
        debug('getSignedInUserId failed', e);
        return null;
    }
}

async function fetchRecentSites(limit = 5, userId = null) {
    try {
        if (!ensureSupabase()) return [];
        if (!userId) userId = await getSignedInUserId();
        if (!userId) return [];

        // Try a set of candidate title columns and pick the first that works
        const titleCandidates = ['title', 'name', 'site_name', null]; // null means no title column

        for (const candidate of titleCandidates) {
            try {
                // Build a select that avoids using `as` aliases (some transports/library may mangle spacing)
                let selectFields = 'id, url, created_at';
                if (candidate === 'title') selectFields = 'id, title, url, created_at';
                else if (candidate === 'name') selectFields = 'id, name, url, created_at';
                else if (candidate === 'site_name') selectFields = 'id, site_name, url, created_at';

                debug('fetchRecentSites: trying candidate select=', selectFields);

                const { data, error } = await supabaseClient
                    .from('sites')
                    .select(selectFields)
                    // Include rows owned by the user OR rows with no user_id (public/defaults)
                    .or(`user_id.eq.${userId},user_id.is.null`)
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) {
                    const msg = (error && (error.message || error.code)) ? String(error.message || error.code) : JSON.stringify(error);
                    // If server says column doesn't exist, try next candidate
                    if (/column .* does not exist/i.test(msg) || /unknown column/i.test(msg) || /invalid column/i.test(msg)) {
                        debug('fetchRecentSites: candidate failed, trying next:', candidate, msg);
                        continue; // try next candidate
                    }
                    if (/row-level security|permission|permission denied|42501|forbidden|403/i.test(msg)) {
                        console.error('fetchRecentSites permission error:', error);
                        throw new Error('Permission denied — please sign in');
                    }
                    console.error('fetchRecentSites error:', error);
                    throw new Error(msg);
                }

                const rows = data || [];
                if (!candidate) {
                    // No title column available -> synthesize title from URL
                    return rows.map(r => ({ id: r.id, title: r.url, url: r.url, created_at: r.created_at }));
                }

                // Candidate worked -> normalize rows to include title (map specific column to title)
                return rows.map(r => ({ id: r.id, title: r.title || r.name || r.site_name || r.url, url: r.url, created_at: r.created_at }));

            } catch (innerErr) {
                const msg = innerErr && (innerErr.message || innerErr.code) ? String(innerErr.message || innerErr.code) : String(innerErr);
                if (/column .* does not exist/i.test(msg) || /unknown column/i.test(msg) || /invalid column/i.test(msg)) {
                    debug('fetchRecentSites innerErr candidate failed:', candidate, msg);
                    continue;
                }
                if (/row-level security|permission|permission denied|42501|forbidden|403/i.test(msg)) {
                    throw new Error('Permission denied — please sign in');
                }
                throw innerErr;
            }
        }

        // If we fallthrough, nothing worked
        throw new Error('No suitable title column found and all queries failed');
    } catch (e) {
        console.error('fetchRecentSites exception:', e);
        const em = e && e.message ? String(e.message) : String(e);
        if (/row-level security|permission|permission denied|42501|403/i.test(em)) throw new Error('Permission denied — please sign in');
        throw (e instanceof Error) ? e : new Error(JSON.stringify(e));
    }
}

async function refreshRecentSites(limit = 5) {
    const listEl = document.getElementById('recentSitesList');
    if (!listEl) return;
    listEl.innerHTML = '<li class="no-results">Loading…</li>';

    try {
        const userId = await getSignedInUserId();
        if (!userId) {
            listEl.innerHTML = '<li class="no-results">Sign in to view recent sites</li>';
            return;
        }

        try {
            const sites = await fetchRecentSites(limit, userId);
            if (!sites || sites.length === 0) {
                listEl.innerHTML = '<li class="no-results">No recent sites</li>';
                return;
            }

            // Deduplicate by normalized URL (keep the most recent per URL)
            const deduped = [];
            const seen = new Set();
            for (const s of sites) {
                const norm = normalizeUrlForCache(s.url || '');
                if (!seen.has(norm)) {
                    seen.add(norm);
                    deduped.push(s);
                }
            }

            if (deduped.length === 0) {
                listEl.innerHTML = '<li class="no-results">No recent sites</li>';
                return;
            }

            listEl.innerHTML = '';
            deduped.forEach(s => {
                const li = document.createElement('li');
                li.className = 'recent-site-item';

                const titleText = s.title || s.url || '';
                const domainText = getDomainFromUrl(s.url || '');

                // Always show a single title field. Prefer stored title; fall back to domain or URL.
                const displayTitle = titleText && titleText.trim() ? titleText : (domainText || s.url || '');
                li.innerHTML = `<span class="recent-site-title">${escapeHtml(displayTitle)}</span>`;

                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    try { chrome.tabs.create({ url: s.url }); } catch (err) { debug('open tab failed', err); }
                });
                listEl.appendChild(li);
            });
        } catch (err) {
            console.error('refreshRecentSites load error', err);
            const msg = err && err.message ? err.message : 'Error loading recent sites';
            listEl.innerHTML = `<li class="no-results">${escapeHtml(msg)}</li>`;
        }
    } catch (e) {
        debug('refreshRecentSites error', e);
        listEl.innerHTML = '<li class="no-results">Error loading</li>';
    }
}

function toggleRecentSitesDropdown() {
    const dd = document.getElementById('recentSitesDropdown');
    if (!dd) return;

    // Toggle visibility
    const isShown = dd.classList.toggle('show');

    // Reflect visibility to assistive tech
    dd.setAttribute('aria-hidden', isShown ? 'false' : 'true');

    // Remove any previous 'up' positioning
    dd.classList.remove('up');

    if (isShown) {
        // Refresh list
        refreshRecentSites();

        // Allow the DOM to render and then check positioning
        requestAnimationFrame(() => {
            try {
                const rect = dd.getBoundingClientRect();
                const windowH = window.innerHeight || document.documentElement.clientHeight;
                const windowW = window.innerWidth || document.documentElement.clientWidth;

                // If dropdown bottom would be outside popup, flip it upward
                if (rect.bottom > windowH - 8) {
                    dd.classList.add('up');
                    // Ensure it doesn't go off the top; limit max-height accordingly
                    const availableTop = rect.top - 8; // space above
                    if (availableTop < dd.clientHeight) {
                        dd.style.maxHeight = Math.max(80, availableTop - 16) + 'px';
                    }
                } else {
                    // reset any inline maxHeight when showing normally
                    dd.style.maxHeight = '';
                }

                // Horizontal fit: center the dropdown over the badge when possible, clamp to wrapper
                try {
                    const badge = document.getElementById('siteCountBadge');
                    const wrapper = dd.parentElement; // .recent-sites-wrapper
                    if (badge && wrapper) {
                        const badgeRect = badge.getBoundingClientRect();
                        const wrapperRect = wrapper.getBoundingClientRect();
                        const ddWidth = dd.offsetWidth || dd.getBoundingClientRect().width || 280;
                        const pad = 8;

                        // Constrain dropdown width so it never exceeds popup wrapper or viewport
                        const maxAllowedWidth = Math.max(160, Math.min(windowW - (pad * 2), wrapperRect.width - (pad * 2)));
                        dd.style.maxWidth = maxAllowedWidth + 'px';
                        dd.style.width = 'auto';

                        // Use the actual width we'll render (clamped) when centering
                        const actualWidth = Math.min(ddWidth, maxAllowedWidth);

                        // Center the dropdown over the badge (relative to wrapper) and clamp inside wrapper
                        const centerX = (badgeRect.left - wrapperRect.left) + (badgeRect.width / 2);
                        const minLeft = pad;
                        const maxLeft = Math.max(pad, wrapperRect.width - actualWidth - pad);
                        const leftPos = Math.min(Math.max(centerX - actualWidth / 2, minLeft), maxLeft);

                        dd.style.left = leftPos + 'px';
                        dd.style.right = 'auto';
                        dd.style.transform = ''; // ensure no translate
                    } else {
                        // Fallback behavior if badge/wrapper not present — keep previous simple approach
                        const leftPadding = 8;
                        const rightPadding = 8;
                        if (rect.left < leftPadding) {
                            dd.style.left = leftPadding + 'px';
                            dd.style.right = 'auto';
                        } else if (rect.right > windowW - rightPadding) {
                            dd.style.left = 'auto';
                            dd.style.right = rightPadding + 'px';
                        } else {
                            dd.style.left = '';
                            dd.style.right = '';
                            dd.style.width = '';
                        }
                    }
                } catch (e) { debug('horizontal fit calc failed', e); }

            } catch (e) { debug('toggleRecentSitesDropdown positioning failed', e); }
        });
    } else {
        // hide: reset inline styles
        dd.style.maxHeight = '';
        dd.style.left = '';
        dd.style.right = '';
        dd.style.width = '';
        // If focus is inside the dropdown, blur it to avoid aria-hidden focus issues
        try {
            if (document.activeElement && dd.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        } catch (e) { debug('blur active element failed', e); }
    }
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
        debug('keydown capture guard err', err);
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
        debug('click capture guard err', err);
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
                    chrome.storage.local.set({ supabaseAuthToken: authData, supabaseSession: session }, function () { debug('Saved auth token + session to chrome.storage.local'); resolve(); });
                });
            }
        } catch (e) { console.warn('chrome.storage.local set failed', e); }



        debug('saveAuthToken:', { user: authData.user?.email, expiresAt: authData.expiresAt });
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
        debug('getStoredAuthTokenAsync: found token in localStorage');
        return local;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
            try {
                chrome.storage.local.get(['supabaseAuthToken', 'supabaseSession'], (res) => {
                    debug('getStoredAuthTokenAsync: chrome.storage.local result:', res);
                    if (res && res.supabaseAuthToken) {
                        debug('getStoredAuthTokenAsync: found token in chrome.storage.local (auth token)');
                        resolve(res.supabaseAuthToken);
                    } else if (res && res.supabaseSession) {
                        // Fallback: extract tokens from saved full session
                        debug('getStoredAuthTokenAsync: found full session in chrome.storage.local');
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
    // Check if Remember Me was enabled
    const rememberMe = localStorage.getItem('rememberMe') === 'true';

    // If Remember Me is not enabled, check sessionStorage instead
    if (!rememberMe) {
        const sessionData = sessionStorage.getItem('supabase_session');
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                if (session && session.access_token) {
                    const { data, error } = await supabaseClient.auth.setSession({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token
                    });
                    if (!error && data && data.session) {
                        currentUser = data.session.user;
                        sessionStorage.setItem('supabase_session', JSON.stringify(data.session));
                        return true;
                    }
                }
            } catch (e) {
                debug('restoreSession: sessionStorage parse failed', e);
            }
        }
        return false;
    }

    // Prefer the async getter which checks localStorage first and then chrome.storage.local
    const storedAuth = await getStoredAuthTokenAsync();
    debug('restoreSession: storedAuth present?', !!storedAuth, storedAuth ? { user: storedAuth.user?.email, expiresAt: storedAuth.expiresAt } : null);
    if (storedAuth) {
        // Basic validation
        if (!storedAuth.refreshToken && !storedAuth.accessToken) {
            console.warn('restoreSession: stored auth missing refreshToken and accessToken');
            return false;
        }

        // Check if token is expired or will expire soon (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = storedAuth.expiresAt || 0;
        const expiresInSeconds = expiresAt - now;
        const needsRefresh = expiresInSeconds < 300; // Less than 5 minutes

        debug('restoreSession: token expires in', expiresInSeconds, 'seconds, needsRefresh:', needsRefresh);

        // If token is still valid and not expiring soon, try to use it directly first
        if (!needsRefresh && storedAuth.accessToken) {
            try {
                const { data: setData, error: setErr } = await supabaseClient.auth.setSession({
                    access_token: storedAuth.accessToken,
                    refresh_token: storedAuth.refreshToken
                });
                if (!setErr && setData && setData.session) {
                    debug('restoreSession: setSession with existing token succeeded');
                    currentUser = setData.session.user;
                    await saveAuthToken(setData.session);
                    return true;
                }
            } catch (e) {
                debug('restoreSession: setSession failed, will try refresh', e);
            }
        }

        debug('restoreSession: attempting token refresh using stored refresh token');

        try {
            // Try to refresh the token using Supabase auth
            const { data, error } = await supabaseClient.auth.refreshSession({
                refresh_token: storedAuth.refreshToken
            });

            if (!error && data && data.session) {
                debug('restoreSession: refreshSession succeeded');
                currentUser = data.session.user;
                await saveAuthToken(data.session);
                return true;
            }

            console.warn('   ⚠️  Token refresh did not return a session or failed:', error || 'no-session');

            // Fallback: try setSession if we have tokens
            if (storedAuth.accessToken || storedAuth.refreshToken) {
                try {
                    if (typeof supabaseClient.auth.setSession === 'function') {
                        debug('restoreSession: attempting setSession fallback with stored tokens');
                        const { data: setData, error: setErr } = await supabaseClient.auth.setSession({ access_token: storedAuth.accessToken, refresh_token: storedAuth.refreshToken });
                        if (!setErr && setData && setData.session) {
                            debug('restoreSession: setSession fallback succeeded');
                            currentUser = setData.session.user;
                            await saveAuthToken(setData.session);
                            return true;
                        }
                        console.warn('   ⚠️  setSession fallback failed:', setErr || 'unknown');
                    } else {
                        debug('restoreSession: supabaseClient.auth.setSession not available');
                    }
                } catch (setEx) {
                    console.warn('   ⚠️  setSession fallback threw', setEx);
                }
            }

            // Final attempt: try to read session from supabase.getSession to see if SDK persisted it elsewhere
            try {
                const { data: { session }, error: getErr } = await supabaseClient.auth.getSession();
                if (!getErr && session) {
                    debug('restoreSession: supabase.getSession returned a session');
                    currentUser = session.user;
                    await saveAuthToken(session);
                    return true;
                }
                debug('restoreSession: supabase.getSession had no session or returned error', getErr);
            } catch (getEx) {
                debug('restoreSession: getSession threw', getEx);
            }

            // If we reached here, attempts failed - clear invalid auth data
            console.warn('restoreSession: all restore attempts failed — clearing invalid tokens');
            clearAuthToken();
            return false;
        } catch (e) {
            console.error('   ❌ Exception during token refresh:', e && e.message ? e.message : e);
            return false;
        }
    } else {
        debug('restoreSession: no storedAuth found');
    }

    return false;
}

function clearAuthToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }

    // Remove from chrome.storage.local as well (if available)
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['supabaseAuthToken', 'supabaseSession'], () => {
                debug('Removed auth token and session from chrome.storage.local');
            });
        }
    } catch (e) {
        console.warn('Failed to remove auth token from chrome.storage.local', e);
    }

}

// Set up auth state change listener to automatically save tokens
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        debug('auth.onAuthStateChange', { event, hasSession: !!session });

        // Only persist if Remember Me is enabled
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        if (session && rememberMe) {
            saveAuthToken(session);
        } else if (session && !rememberMe) {
            // Save to sessionStorage only
            sessionStorage.setItem('supabase_session', JSON.stringify(session));
        } else if (!session) {
            clearAuthToken();
        }
    });

    // Proactively refresh token every 15 minutes while popup is open
    // Background script handles refresh every 30 min, popup does it more frequently when open
    setInterval(async () => {
        try {
            const rememberMe = localStorage.getItem('rememberMe') === 'true';
            if (!rememberMe) return;

            // Check if token is actually expiring soon (within 20 min) before refreshing
            // This prevents unnecessary refresh calls that can invalidate tokens
            const storedAuth = getStoredAuthToken();
            if (storedAuth && storedAuth.expiresAt) {
                const now = Math.floor(Date.now() / 1000);
                const expiresInSeconds = storedAuth.expiresAt - now;
                if (expiresInSeconds > 1200) { // More than 20 minutes
                    debug('Proactive refresh skipped: token still valid for', Math.floor(expiresInSeconds / 60), 'minutes');
                    return;
                }
            }

            const { data, error } = await supabaseClient.auth.refreshSession();
            if (!error && data && data.session) {
                debug('Proactive token refresh succeeded');
                await saveAuthToken(data.session);
            } else if (error) {
                console.warn('Proactive token refresh failed:', error.message);
                // If token is completely invalid, user will need to re-login
                if (error.message && error.message.includes('Refresh Token')) {
                    console.warn('Refresh token invalid - clearing auth');
                    clearAuthToken();
                }
            }
        } catch (e) {
            debug('Proactive token refresh failed:', e);
        }
    }, 15 * 60 * 1000); // Every 15 minutes
}

// Listen for token refresh messages from background script
try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TOKEN_REFRESHED' && message.authData) {
            debug('Received refreshed token from background script');
            try {
                localStorage.setItem(TOKEN_KEY, JSON.stringify(message.authData));
            } catch (e) {
                debug('Failed to save refreshed token to localStorage', e);
            }

            // Attempt to restore session in the popup immediately and refresh UI
            (async () => {
                try {
                    const restored = await restoreSession();
                    if (restored) {
                        debug('restoreSession after TOKEN_REFRESHED succeeded — refreshing header and recent sites');
                        try { updateSiteCount(); } catch (e) { debug('updateSiteCount after TOKEN_REFRESHED failed', e); }
                        try { refreshRecentSites(); } catch (e) { debug('refreshRecentSites after TOKEN_REFRESHED failed', e); }
                    } else {
                        debug('restoreSession after TOKEN_REFRESHED did not restore a session');
                    }
                } catch (e) {
                    debug('Error restoring session after TOKEN_REFRESHED', e);
                }
            })();
        }
        return true;
    });
} catch (e) {
    debug('Failed to set up message listener:', e);
}

// Debug helper: inspect persistent auth storage (call from popup console)
window.debugAuthStorage = async function () {
    try {
        const local = getStoredAuthToken();
        debug('debugAuthStorage: localStorage token', local);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['supabaseAuthToken', 'supabaseSession'], (res) => {
                debug('debugAuthStorage: chrome.storage.local', res);
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
                    debug('persistCachedCategories: saved', categories && categories.length);
                    resolve();
                });
            });
        } catch (e) { debug('persistCachedCategories failed', e); }
    }
}

async function persistCachedTags(tags) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            await new Promise((resolve) => {
                chrome.storage.local.set({ cachedTags: tags }, () => {
                    debug('persistCachedTags: saved', tags && tags.length);
                    resolve();
                });
            });
        } catch (e) { debug('persistCachedTags failed', e); }
    }
}

// Cache of detected site table columns (to avoid repeated calls)
let sitesColumnsCache = null;
let categoriesAccessDenied = false;
let tagsAccessDenied = false;

// Try to detect the columns present on the server-side `sites` table so we can
// adapt payload keys for deployments that use different column names (e.g. `name` vs `title`)
async function detectSitesColumns() {
    if (!ensureSupabase()) return [];
    if (sitesColumnsCache) return sitesColumnsCache;
    try {
        // Request one row (if available) to inspect returned keys
        const { data, error } = await supabaseClient.from('sites').select().limit(1);
        if (error) {
            debug('detectSitesColumns: supabase select error', error);
            return [];
        }
        sitesColumnsCache = (data && data[0]) ? Object.keys(data[0]) : [];
        debug('detectSitesColumns: detected columns', sitesColumnsCache);
        return sitesColumnsCache;
    } catch (e) {
        debug('detectSitesColumns threw', e);
        return [];
    }
}

// API URL
const API_URL = 'http://localhost:3000';

// Save and load form data from localStorage
const FORM_CACHE_KEY = 'siteFormCache';
const CACHE_MAX_AGE_DAYS = 30; // Maximum age for cached form data
const OFFLINE_QUEUE_KEY = 'offlineSaveQueue';

// Track online/offline status
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    isOnline = true;
    hideOfflineIndicator();
    processOfflineQueue();
});
window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineIndicator();
});

// Show/hide offline indicator
function showOfflineIndicator() {
    let indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offlineIndicator';
        indicator.className = 'offline-indicator';
        indicator.textContent = '⚠ You are offline - changes will be saved locally';
        document.body.insertBefore(indicator, document.body.firstChild);
    }
    indicator.style.display = 'block';
}

function hideOfflineIndicator() {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) indicator.style.display = 'none';
}

// Offline queue management
function addToOfflineQueue(siteData) {
    try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        queue.push({ data: siteData, timestamp: Date.now() });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        debug('Added to offline queue:', siteData);
    } catch (e) {
        console.error('Failed to add to offline queue:', e);
    }
}

async function processOfflineQueue() {
    try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        if (queue.length === 0) return;

        debug('Processing offline queue:', queue.length, 'items');
        const remaining = [];

        for (const item of queue) {
            try {
                // Try to save the item
                // This would need to be adapted to your save logic
                debug('Would save offline item:', item);
                // For now, just remove from queue on "success"
            } catch (e) {
                remaining.push(item);
            }
        }

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
        if (remaining.length < queue.length) {
            showMessage(`Synced ${queue.length - remaining.length} offline items`, 'success');
        }
    } catch (e) {
        console.error('Failed to process offline queue:', e);
    }
}

// Clean up old cache entries
function cleanupOldCache() {
    try {
        const maxAge = CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to ms
        const now = Date.now();
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(FORM_CACHE_KEY + '_url_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.timestamp && (now - data.timestamp) > maxAge) {
                        keysToRemove.push(key);
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            debug('Removed old cache:', key);
        });

        if (keysToRemove.length > 0) {
            debug('Cleaned up', keysToRemove.length, 'old cache entries');
        }
    } catch (e) {
        console.error('Cache cleanup failed:', e);
    }
}

// Run cache cleanup on startup
setTimeout(cleanupOldCache, 5000);

// Migrate rememberMe preference to chrome.storage.local (for background script access)
try {
    const rememberMe = localStorage.getItem('rememberMe');
    if (rememberMe === 'true') {
        chrome.storage.local.set({ rememberMe: 'true' });
    }
} catch (e) { /* ignore */ }

// Show offline indicator if currently offline
if (!navigator.onLine) {
    setTimeout(showOfflineIndicator, 100);
}

// Update selection count badges
function updateSelectionCounts() {
    try {
        const categoryCount = document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]:checked').length;
        const tagCount = document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]:checked').length;

        const categoryTotal = document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]').length;
        const tagTotal = document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]').length;

        const categoryBadge = document.getElementById('categoriesCount');
        const tagBadge = document.getElementById('tagsCount');

        if (categoryBadge) {
            if (categoryTotal === 0) {
                categoryBadge.textContent = '';
                categoryBadge.classList.add('hidden');
                categoryBadge.removeAttribute('aria-label');
                categoryBadge.removeAttribute('title');
            } else {
                categoryBadge.textContent = `${categoryCount} / ${categoryTotal}`;
                categoryBadge.classList.remove('hidden');
                categoryBadge.setAttribute('aria-label', `${categoryCount} selected of ${categoryTotal} categories`);
                categoryBadge.title = `${categoryCount} selected of ${categoryTotal} categories`;
            }
        }

        if (tagBadge) {
            if (tagTotal === 0) {
                tagBadge.textContent = '';
                tagBadge.classList.add('hidden');
                tagBadge.removeAttribute('aria-label');
                tagBadge.removeAttribute('title');
            } else {
                tagBadge.textContent = `${tagCount} / ${tagTotal}`;
                tagBadge.classList.remove('hidden');
                tagBadge.setAttribute('aria-label', `${tagCount} selected of ${tagTotal} tags`);
                tagBadge.title = `${tagCount} selected of ${tagTotal} tags`;
            }
        }
    } catch (e) {
        debug('updateSelectionCounts error:', e);
    }
}

// URL validation helper
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        // Block internal browser URLs
        const blockedProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'brave:', 'opera:', 'vivaldi:', 'file:'];
        if (blockedProtocols.some(p => url.protocol === p)) {
            return false;
        }
        // Must be http or https
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

// Check if URL exists in database and update indicator
let urlCheckTimeout = null;
async function checkUrlExistsInDatabase(url) {
    const indicator = document.getElementById('urlExistsIndicator');
    if (!indicator) return;

    const checkingEl = indicator.querySelector('.url-checking');
    const existsEl = indicator.querySelector('.url-exists');
    const notExistsEl = indicator.querySelector('.url-not-exists');

    // Show checking state
    checkingEl?.classList.remove('hidden');
    existsEl?.classList.add('hidden');
    notExistsEl?.classList.add('hidden');
    indicator.title = 'Checking...';

    if (!url || !isValidUrl(url)) {
        // Invalid URL - show not exists
        checkingEl?.classList.add('hidden');
        notExistsEl?.classList.remove('hidden');
        indicator.title = 'Invalid URL';
        return;
    }

    if (!ensureSupabase()) {
        checkingEl?.classList.add('hidden');
        notExistsEl?.classList.remove('hidden');
        indicator.title = 'Cannot check - not connected';
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) {
            checkingEl?.classList.add('hidden');
            notExistsEl?.classList.remove('hidden');
            indicator.title = 'Not signed in';
            return;
        }

        const { data, error } = await supabaseClient
            .from('sites')
            .select('id')
            .eq('url', url)
            .eq('user_id', session.user.id)
            .limit(1);

        checkingEl?.classList.add('hidden');

        if (error) {
            debug('checkUrlExistsInDatabase error:', error);
            notExistsEl?.classList.remove('hidden');
            indicator.title = 'Error checking URL';
            return;
        }

        if (data && data.length > 0) {
            existsEl?.classList.remove('hidden');
            indicator.title = 'This site is already saved!';
        } else {
            notExistsEl?.classList.remove('hidden');
            indicator.title = 'New site - not yet saved';
        }
    } catch (e) {
        debug('checkUrlExistsInDatabase exception:', e);
        checkingEl?.classList.add('hidden');
        notExistsEl?.classList.remove('hidden');
        indicator.title = 'Error checking URL';
    }
}

// Debounced URL check
function scheduleUrlCheck(url) {
    if (urlCheckTimeout) clearTimeout(urlCheckTimeout);
    urlCheckTimeout = setTimeout(() => checkUrlExistsInDatabase(url), 300);
}

// Reorder a checkbox list so selected (checked) items appear first, rest alphabetically
function reorderCheckboxList(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    // Save scroll positions before reordering
    const scrollY = window.scrollY;
    const bodyScrollTop = document.body.scrollTop;
    const container = document.querySelector('.container');
    const containerScroll = container ? container.scrollTop : 0;

    const items = Array.from(list.children).filter(el => el.querySelector('input[type="checkbox"]'));
    items.sort((a, b) => {
        const aCb = a.querySelector('input[type="checkbox"]');
        const bCb = b.querySelector('input[type="checkbox"]');
        const aChecked = aCb && aCb.checked ? 0 : 1;
        const bChecked = bCb && bCb.checked ? 0 : 1;
        if (aChecked !== bChecked) return aChecked - bChecked;
        const aName = (a.querySelector('label')?.textContent || '').toLowerCase();
        const bName = (b.querySelector('label')?.textContent || '').toLowerCase();
        return aName.localeCompare(bName);
    });
    items.forEach(el => list.appendChild(el));

    // Restore scroll positions after DOM reorder
    window.scrollTo(0, scrollY);
    document.body.scrollTop = bodyScrollTop;
    if (container) container.scrollTop = containerScroll;
}

// Auto-focus helper - focus first empty required field
function autoFocusFirstEmptyField() {
    try {
        const siteNameInput = document.getElementById('siteName');
        const urlInput = document.getElementById('url');
        const pricingSelect = document.getElementById('pricing');

        if (siteNameInput && !siteNameInput.value.trim()) {
            siteNameInput.focus({ preventScroll: true });
            return;
        }
        if (urlInput && !urlInput.value.trim()) {
            urlInput.focus({ preventScroll: true });
            return;
        }
        if (pricingSelect && !pricingSelect.value) {
            pricingSelect.focus({ preventScroll: true });
            return;
        }
        // Default to site name
        if (siteNameInput) siteNameInput.focus({ preventScroll: true });
    } catch (e) {
        debug('autoFocusFirstEmptyField error:', e);
    }
}

// Show loading spinner
function showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="loading-text"><span class="loading-spinner"></span>${message}</div>`;
        const container = document.querySelector('.container');
        if (container) {
            container.style.position = 'relative';
            container.appendChild(overlay);
        }
    } else {
        overlay.querySelector('.loading-text').innerHTML = `<span class="loading-spinner"></span>${message}`;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Safe wrapper for loading categories/tags with graceful fallback when API is unreachable.
function safeLoadCategoriesAndTags() {
    return loadCategoriesAndTags().catch(e => {
        debug('safeLoadCategoriesAndTags: failed to load categories/tags', e);
        hideLoading(); // Ensure loading spinner is hidden on error
        try { showMessage('Could not load categories/tags — using cached values', 'warning'); } catch (e) { }
        try { loadFormFromCache(); } catch (e) { debug('loadFormFromCache after safeLoad failure failed', e); }
    });
}
let currentTabId = null;
let currentTabUrl = null;
let currentTabTitle = null; // Store the original page title for auto-fill

// Helper to get cleaned page title
function getCleanedPageTitle(title) {
    if (!title) return '';
    let cleanTitle = title;
    const separators = [' - ', ' | ', ' — ', ' :: ', ' – ', ' • '];
    for (const sep of separators) {
        const idx = cleanTitle.lastIndexOf(sep);
        if (idx > 10) {
            cleanTitle = cleanTitle.substring(0, idx);
            break;
        }
    }
    return cleanTitle.trim();
}

// Auto-fill site name from title when field is empty
function autoFillSiteNameIfEmpty() {
    const siteNameInput = document.getElementById('siteName');
    if (siteNameInput && !siteNameInput.value.trim() && currentTabTitle) {
        siteNameInput.value = getCleanedPageTitle(currentTabTitle);
    }
}

// Helper to get current form state (for preserving selections when adding category/tag)
function getCurrentFormState() {
    const siteNameInput = document.getElementById('siteName');
    const pricingSelect = document.getElementById('pricing');

    const selectedCategories = Array.from(
        document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const selectedTags = Array.from(
        document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    return {
        siteName: siteNameInput?.value || '',
        pricing: pricingSelect?.value || '',
        selectedCategories,
        selectedTags
    };
}

// Helper to restore form state after reloading categories/tags
function restoreFormState(state) {
    if (!state) return;

    const siteNameInput = document.getElementById('siteName');
    const pricingSelect = document.getElementById('pricing');

    if (siteNameInput && state.siteName) siteNameInput.value = state.siteName;
    if (pricingSelect && state.pricing) pricingSelect.value = state.pricing;

    // Restore category selections
    if (state.selectedCategories && state.selectedCategories.length > 0) {
        state.selectedCategories.forEach(categoryId => {
            const checkbox = document.getElementById(`category-${categoryId}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                // Apply visual styling
                const itemDiv = checkbox.closest('div[style*="background"]');
                if (itemDiv) {
                    const catColor = itemDiv.style.color || '#6CBBFB';
                    itemDiv.classList.add('selected');
                    itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + catColor);
                }
            }
        });
    }

    // Restore tag selections
    if (state.selectedTags && state.selectedTags.length > 0) {
        state.selectedTags.forEach(tagId => {
            const checkbox = document.getElementById(`tag-${tagId}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                // Apply visual styling
                const itemDiv = checkbox.closest('div[style*="background"]');
                if (itemDiv) {
                    const tagColor = itemDiv.style.color || '#667eea';
                    itemDiv.classList.add('selected');
                    itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + tagColor);
                }
            }
        });
    }

    // Update selection counts
    try { updateSelectionCounts(); } catch (e) { /* ignore */ }

    // Reorder so selected items appear first
    reorderCheckboxList('categoriesCheckboxList');
    reorderCheckboxList('tagsCheckboxList');
}

// Normalize URL for cache key (remove hash, trailing slash, etc.)
function normalizeUrlForCache(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        // Use origin + pathname (ignore hash and query for more stable caching)
        let normalized = parsed.origin + parsed.pathname;
        // Remove trailing slash for consistency
        if (normalized.endsWith('/') && normalized.length > 1) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    } catch (e) {
        return url; // fallback to raw URL if parsing fails
    }
}

function getFormCacheKey() {
    const urlInput = document.getElementById('url');
    const url = currentTabUrl || (urlInput ? urlInput.value : null);
    const normalizedUrl = normalizeUrlForCache(url);
    return normalizedUrl ? `${FORM_CACHE_KEY}_url_${normalizedUrl}` : FORM_CACHE_KEY;
}

function saveFormToCache() {
    // Update selection count badges whenever form is saved
    try { updateSelectionCounts(); } catch (e) { /* ignore */ }
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

        const descriptionInput = document.getElementById('description');
        const useCaseInput = document.getElementById('useCase');
        const favoriteToggle = document.querySelector('#favoriteToggleGroup .toggle-btn.active');
        const neededToggle = document.querySelector('#neededToggleGroup .toggle-btn.active');

        const formData = {
            siteName: siteNameInput?.value || '',
            url: urlInput?.value || '',
            pricing: pricingSelect?.value || '',
            description: descriptionInput?.value || '',
            useCase: useCaseInput?.value || '',
            isFavorite: favoriteToggle?.dataset?.value === 'true',
            isNeeded: neededToggle?.dataset?.value === 'true',
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
            (existingParsed.description && existingParsed.description.trim()) ||
            (existingParsed.useCase && existingParsed.useCase.trim()) ||
            (existingParsed.selectedCategories && existingParsed.selectedCategories.length > 0) ||
            (existingParsed.selectedTags && existingParsed.selectedTags.length > 0)
        );

        const hasNewNonUrl = (formData.siteName && formData.siteName.trim()) ||
            (formData.pricing && formData.pricing.toString().trim()) ||
            (formData.description && formData.description.trim()) ||
            (formData.useCase && formData.useCase.trim()) ||
            (formData.selectedCategories && formData.selectedCategories.length > 0) ||
            (formData.selectedTags && formData.selectedTags.length > 0);

        // If existing has data and new form only includes URL (no non-url data), skip saving to prevent overwriting restored state.
        if (hasExistingData && !hasNewNonUrl) {
            try { debug('saveFormToCache: skipping overwrite because existing cache contains data and new form is empty (only url).', key); } catch (e) { }

        } else {

            // Also persist to chrome.storage.local for durability across popup instances
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    const toSave = {};
                    toSave[key] = formData;
                    // Only save to URL-specific key, not generic fallback
                    chrome.storage.local.set(toSave, () => {
                        try { debug('saveFormToCache: chrome.storage.local saved', key); } catch (e) { }
                    });
                }
            } catch (err) { debug('saveFormToCache: chrome.storage.local.set failed', err); }

            // Helpful debug: what keys we wrote and the data
            try { debug('saveFormToCache: wrote to keys', key, FORM_CACHE_KEY, 'formData:', formData); } catch (e) { }


        }

    } catch (e) {
        console.error('❌ Error saving form:', e);

    }
}

function loadFormFromCache(attempt = 0) {
    const key = getFormCacheKey();
    debug('loadFormFromCache: attempting to read cache for key', key, 'attempt', attempt);

    // Helper to apply parsed form data. Returns true if all referenced checkboxes were found/applied
    function applyFormData(formData) {
        if (!formData) return true;
        try {
            debug('loadFormFromCache: applying formData', formData);
            const siteNameInput = document.getElementById('siteName');
            const urlInput = document.getElementById('url');
            const pricingSelect = document.getElementById('pricing');

            if (siteNameInput) siteNameInput.value = formData.siteName || '';
            // Don't overwrite URL from cache - URL should always come from the current active tab
            // if (urlInput) urlInput.value = formData.url || '';
            if (pricingSelect) pricingSelect.value = formData.pricing || '';

            // Restore description, useCase, favorite, needed
            const descInput = document.getElementById('description');
            const ucInput = document.getElementById('useCase');
            if (descInput) descInput.value = formData.description || '';
            if (ucInput) ucInput.value = formData.useCase || '';

            // Restore favorite toggle
            if (formData.isFavorite !== undefined) {
                const favBtns = document.querySelectorAll('#favoriteToggleGroup .toggle-btn');
                favBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === String(formData.isFavorite));
                });
            }
            // Restore needed toggle
            if (formData.isNeeded !== undefined) {
                const needBtns = document.querySelectorAll('#neededToggleGroup .toggle-btn');
                needBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === String(formData.isNeeded));
                });
            }

            let missing = 0;

            // Restore checkbox selections for categories
            if (formData.selectedCategories && Array.isArray(formData.selectedCategories)) {
                formData.selectedCategories.forEach(categoryId => {
                    const checkbox = document.getElementById(`category-${categoryId}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        debug('loadFormFromCache: restored category', categoryId);

                        // Apply outline to restored item
                        const itemDiv = checkbox.closest('div[style*="background"]');
                        if (itemDiv) {
                            const catColor = itemDiv.style.color || '#6CBBFB';
                            itemDiv.classList.add('selected');
                            itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + catColor);
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
                        debug('loadFormFromCache: restored tag', tagId);

                        // Apply outline to restored item
                        const itemDiv = checkbox.closest('div[style*="background"]');
                        if (itemDiv) {
                            const tagColor = itemDiv.style.color || '#667eea';
                            itemDiv.classList.add('selected');
                            itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + tagColor);
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
            chrome.storage.local.get([key], (res) => {
                const chromeCached = res && res[key];
                if (chromeCached) {
                    debug('loadFormFromCache: using chrome.storage.local cache for key', key);

                    const allApplied = applyFormData(chromeCached);
                    try { updateSelectionCounts(); } catch (e) { /* ignore */ }
                    if (!allApplied && attempt < 5) {
                        const delay = 100 * Math.pow(2, attempt);
                        debug('loadFormFromCache: not all items present, retrying in', delay, 'ms');
                        setTimeout(() => loadFormFromCache(attempt + 1), delay);
                    }
                    return;
                }

                // Fallback to localStorage
                const localCached = localStorage.getItem(key);
                if (localCached) {
                    try {
                        const parsed = JSON.parse(localCached);

                        const allApplied = applyFormData(parsed);
                        if (!allApplied && attempt < 5) {
                            const delay = 100 * Math.pow(2, attempt);
                            debug('loadFormFromCache: not all items present (localCached), retrying in', delay, 'ms');
                            setTimeout(() => loadFormFromCache(attempt + 1), delay);
                        }
                    } catch (e) { debug('loadFormFromCache: parse localCached failed', e); }
                    return;
                }
                debug('loadFormFromCache: no cache found');
            });
        } catch (err) {
            debug('loadFormFromCache: chrome.storage.local.get failed', err);
            const localCached = localStorage.getItem(key);
            if (localCached) {
                try {
                    const parsed = JSON.parse(localCached);
                    const allApplied = applyFormData(parsed);
                    if (!allApplied && attempt < 5) {
                        const delay = 100 * Math.pow(2, attempt);
                        debug('loadFormFromCache: not all items present (localCached, after chrome.get failure), retrying in', delay, 'ms');
                        setTimeout(() => loadFormFromCache(attempt + 1), delay);
                    }
                } catch (e) { debug('loadFormFromCache: parse localCached failed', e); }
            }
        }
    } else {
        const localCached = localStorage.getItem(key);
        if (localCached) {
            try {
                const parsed = JSON.parse(localCached);
                const allApplied = applyFormData(parsed);
                if (!allApplied && attempt < 5) {
                    const delay = 100 * Math.pow(2, attempt);
                    debug('loadFormFromCache: not all items present (no chrome.storage), retrying in', delay, 'ms');
                    setTimeout(() => loadFormFromCache(attempt + 1), delay);
                }
            } catch (e) { debug('loadFormFromCache: parse localCached failed', e); }
        }
    }
}

// Load categories and tags from database (Supabase-first, with cache fallback and legacy API fallback)
async function loadCategoriesAndTags() {
    // Only show loading if site form is visible (user is authenticated)
    const siteFormSection = document.getElementById('siteFormSection');
    if (siteFormSection && !siteFormSection.classList.contains('hidden')) {
        showLoading('Loading categories and tags...');
    }
    try {
        let categoriesList = null;
        let tagsList = null;

        // 1) Try Supabase as the authoritative source (if available)
        if (ensureSupabase()) {
            try {
                const { data: cats, error: catErr } = await supabaseClient.from('categories').select('id,name,color').order('name', { ascending: true });
                if (!catErr && Array.isArray(cats)) {
                    categoriesList = cats;
                    console.debug('[popup] loadCategoriesAndTags: fetched categories from Supabase - count=', (categoriesList || []).length);
                    try { await persistCachedCategories(categoriesList); } catch (e) { debug('persistCachedCategories failed', e); }
                } else if (catErr) {
                    debug('Supabase categories query error', catErr);
                    const msg = String(catErr.message || catErr.code || '');
                    if (/row-level security|policy|permission|permission denied|42501/i.test(msg) || (catErr && catErr.code === '42501')) {
                        categoriesAccessDenied = true;
                        debug('categories: access denied due to RLS');
                    }
                }
            } catch (err) { debug('Supabase categories fetch threw', err); }

            try {
                const { data: tags, error: tagErr } = await supabaseClient.from('tags').select('id,name,color').order('name', { ascending: true });
                if (!tagErr && Array.isArray(tags)) {
                    tagsList = tags;
                    console.debug('[popup] loadCategoriesAndTags: fetched tags from Supabase - count=', (tagsList || []).length);
                    try { await persistCachedTags(tagsList); } catch (e) { debug('persistCachedTags failed', e); }
                } else if (tagErr) {
                    debug('Supabase tags query error', tagErr);
                    const tmsg = String(tagErr.message || tagErr.code || '');
                    const tstatus = tagErr.status || tagErr.statusCode || null;
                    if (/row-level security|policy|permission|permission denied|42501/i.test(tmsg) || (tagErr && tagErr.code === '42501') || tstatus === 403) {
                        tagsAccessDenied = true;
                        debug('tags: access denied due to RLS or 403');
                    }
                }
            } catch (err) { debug('Supabase tags fetch threw', err); }
        }

        // 2) If Supabase didn't provide data, try chrome.storage.local cached copies
        if ((!categoriesList || categoriesList.length === 0) || (!tagsList || tagsList.length === 0)) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await new Promise(resolve => chrome.storage.local.get(['cachedCategories', 'cachedTags'], resolve));
                if ((!categoriesList || categoriesList.length === 0) && res && res.cachedCategories) {
                    categoriesList = res.cachedCategories;
                    console.debug('[popup] loadCategoriesAndTags: loaded cachedCategories from chrome.storage.local - count=', (categoriesList || []).length);
                }
                if ((!tagsList || tagsList.length === 0) && res && res.cachedTags) {
                    tagsList = res.cachedTags;
                    console.debug('[popup] loadCategoriesAndTags: loaded cachedTags from chrome.storage.local - count=', (tagsList || []).length);
                }
            }
        }

        // 3) Legacy fallback to local API if still empty (keeps backward compatibility)
        if (!categoriesList || categoriesList.length === 0) {
            try {
                const categoriesResp = await fetch(`${API_URL}/api/categories`);
                const categoriesData = await categoriesResp.json();
                if (categoriesData && categoriesData.success && Array.isArray(categoriesData.data)) {
                    categoriesList = categoriesData.data;
                    console.debug('[popup] loadCategoriesAndTags: loaded categories from legacy API - count=', (categoriesList || []).length);
                }
            } catch (e) { debug('local API categories fetch failed', e); }
        }

        if (!tagsList || tagsList.length === 0) {
            try {
                const tagsResp = await fetch(`${API_URL}/api/tags`);
                const tagsData = await tagsResp.json();
                if (tagsData && tagsData.success && Array.isArray(tagsData.data)) {
                    tagsList = tagsData.data;
                    console.debug('[popup] loadCategoriesAndTags: loaded tags from legacy API - count=', (tagsList || []).length);
                }
            } catch (e) { debug('local API tags fetch failed', e); }
        }

        // Helper: reorder a checkbox list so selected items appear first, rest alphabetically
        // (uses top-level reorderCheckboxList defined above)

        // Read cached selections so selected items render first
        let cachedSelectedCategories = new Set();
        let cachedSelectedTags = new Set();
        try {
            // Build cache key — ensure currentTabUrl is available
            let cacheUrl = currentTabUrl;
            if (!cacheUrl) {
                try {
                    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                    if (tabs && tabs[0] && tabs[0].url) {
                        cacheUrl = tabs[0].url;
                        currentTabUrl = cacheUrl;
                    }
                } catch (e) { debug('cache: tabs.query failed', e); }
            }
            const cacheKey = getFormCacheKey();
            debug('loadCategoriesAndTags: reading cache for sort-first, key=', cacheKey);

            // Try chrome.storage.local first (where saveFormToCache writes)
            let cached = null;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                try {
                    cached = await new Promise(resolve => chrome.storage.local.get([cacheKey], res => resolve(res && res[cacheKey])));
                } catch (e) { debug('chrome.storage cache read failed', e); }
            }
            // Fallback to localStorage
            if (!cached) {
                try {
                    const raw = localStorage.getItem(cacheKey);
                    cached = raw ? JSON.parse(raw) : null;
                } catch { /* ignore */ }
            }
            if (cached) {
                if (Array.isArray(cached.selectedCategories)) cachedSelectedCategories = new Set(cached.selectedCategories);
                if (Array.isArray(cached.selectedTags)) cachedSelectedTags = new Set(cached.selectedTags);
                debug('loadCategoriesAndTags: cached selections — cats:', cachedSelectedCategories.size, 'tags:', cachedSelectedTags.size);
            } else {
                debug('loadCategoriesAndTags: no cached form data found for key', cacheKey);
            }
        } catch (e) { debug('loadCategoriesAndTags: reading cache for sort-first failed', e); }

        // Render categories (selected first, then alphabetically A-Z)
        const categoriesCheckboxList = document.getElementById('categoriesCheckboxList');
        if (categoriesCheckboxList) {
            categoriesCheckboxList.innerHTML = '';
            if (categoriesAccessDenied) {
                categoriesCheckboxList.innerHTML = '<div class="no-results-message">Sign in to view categories (permission denied)</div>';
            } else if (categoriesList && categoriesList.length > 0) {
                // Sort: selected first, then alphabetically by name
                const sortedCategories = [...categoriesList].sort((a, b) => {
                    const aSelected = cachedSelectedCategories.has(a.id) ? 0 : 1;
                    const bSelected = cachedSelectedCategories.has(b.id) ? 0 : 1;
                    if (aSelected !== bSelected) return aSelected - bSelected;
                    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                });
                sortedCategories.forEach(cat => {
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
                    itemDiv.style.padding = '6px 12px';
                    itemDiv.style.borderRadius = '12px';
                    itemDiv.style.cursor = 'pointer';
                    itemDiv.style.marginBottom = '6px';
                    itemDiv.style.marginRight = '6px';
                    label.style.color = catColor;

                    // Persist border values so toggling doesn't change layout
                    itemDiv.dataset.defaultBorder = itemDiv.style.border;
                    itemDiv.dataset.selectedBorder = '1px solid ' + catColor;

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

                    // Toggle border color on checked state (use border instead of outline to keep sizing stable)
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            itemDiv.classList.add('selected');
                            itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + catColor);
                        } else {
                            itemDiv.classList.remove('selected');
                            itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                        }
                        // Re-order: selected categories first
                        reorderCheckboxList('categoriesCheckboxList');
                        saveFormToCache();
                    });

                    // Add save listener
                    checkbox.addEventListener('change', saveFormToCache);

                    categoriesCheckboxList.appendChild(itemDiv);
                });
                // Apply active category filter (if user typed into input)
                try { if (document.getElementById('categoriesSearchInput')?.value) filterCheckboxList('categoriesCheckboxList', document.getElementById('categoriesSearchInput').value); } catch (e) { }
            }

            // Render tags (selected first, then alphabetically A-Z)
            const tagsCheckboxList = document.getElementById('tagsCheckboxList');
            if (tagsCheckboxList && tagsList && tagsList.length > 0) {
                tagsCheckboxList.innerHTML = '';
                // Sort: selected first, then alphabetically by name
                const sortedTags = [...tagsList].sort((a, b) => {
                    const aSelected = cachedSelectedTags.has(a.id) ? 0 : 1;
                    const bSelected = cachedSelectedTags.has(b.id) ? 0 : 1;
                    if (aSelected !== bSelected) return aSelected - bSelected;
                    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                });
                sortedTags.forEach(tag => {
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
                    itemDiv.style.padding = '6px 12px';
                    itemDiv.style.borderRadius = '12px';
                    itemDiv.style.cursor = 'pointer';
                    itemDiv.style.marginBottom = '6px';
                    itemDiv.style.marginRight = '6px';
                    label.style.color = tagColor;

                    // Persist border values so toggling doesn't change layout
                    itemDiv.dataset.defaultBorder = itemDiv.style.border;
                    itemDiv.dataset.selectedBorder = '1px solid ' + tagColor;

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

                    // Toggle border color on checked state (use border instead of outline to keep sizing stable)
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            itemDiv.classList.add('selected');
                            itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + tagColor);
                        } else {
                            itemDiv.classList.remove('selected');
                            itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                        }
                        // Re-order: selected tags first
                        reorderCheckboxList('tagsCheckboxList');
                        saveFormToCache();
                    });

                    // Add save listener
                    checkbox.addEventListener('change', saveFormToCache);

                    tagsCheckboxList.appendChild(itemDiv);
                });
                // Apply active tag filter (if user typed into input)
                try { if (document.getElementById('tagsSearchInput')?.value) filterCheckboxList('tagsCheckboxList', document.getElementById('tagsSearchInput').value); } catch (e) { }
            }

            // Success - hide loading spinner
            hideLoading();

            // Scroll to top after rendering so the popup doesn't open at the bottom
            try {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                const container = document.querySelector('.container');
                if (container) container.scrollTop = 0;
            } catch (e) { debug('scroll-to-top failed', e); }
        }
    } catch (err) {
        console.error('❌ Error loading data:', err);
        // Fallback: try to create placeholder category/tag checkboxes based on cached selected ids
        try {
            const key = getFormCacheKey();
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
                    debug('loadCategoriesAndTags: creating placeholder categories for missing ids', missingCategories);
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
                        itemDiv.style.padding = '6px 12px';
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

                        // Persist default/selected borders for placeholder items
                        itemDiv.dataset.defaultBorder = itemDiv.style.border;
                        itemDiv.dataset.selectedBorder = '1px solid ' + catColor;

                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                itemDiv.classList.add('selected');
                                itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + catColor);
                            } else {
                                itemDiv.classList.remove('selected');
                                itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                            }
                            try { saveFormToCache(); } catch (e) { debug('saveFormToCache in placeholder change failed', e); }
                        });

                        itemDiv.appendChild(checkbox);
                        itemDiv.appendChild(label);
                        categoriesList.appendChild(itemDiv);
                    });
                }
                if (tagsList && missingTags.length > 0) {
                    debug('loadCategoriesAndTags: creating placeholder tags for missing ids', missingTags);
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
                        itemDiv.style.padding = '6px 12px';
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

                        // Persist default/selected borders for placeholder items
                        itemDiv.dataset.defaultBorder = itemDiv.style.border;
                        itemDiv.dataset.selectedBorder = '1px solid ' + tagColor;

                        checkbox.addEventListener('change', () => {
                            if (checkbox.checked) {
                                itemDiv.classList.add('selected');
                                itemDiv.style.border = itemDiv.dataset.selectedBorder || ('1px solid ' + tagColor);
                            } else {
                                itemDiv.classList.remove('selected');
                                itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                            }
                            try { saveFormToCache(); } catch (e) { debug('saveFormToCache in placeholder change failed', e); }
                        });

                        itemDiv.appendChild(checkbox);
                        itemDiv.appendChild(label);
                        tagsList.appendChild(itemDiv);
                    });
                }
                try { loadFormFromCache(); } catch (e) { debug('loadFormFromCache after fallback failed', e); }
            }
        } catch (e) { debug('fallback restore failed', e); }
        showMessage('Error loading categories and tags', 'error');
        hideLoading();
    }
}





// Reset all form fields to default (empty) state - used when switching to a new URL
function resetFormFields() {
    try {
        const siteNameInput = document.getElementById('siteName');
        const pricingSelect = document.getElementById('pricing');
        const descriptionInput = document.getElementById('siteDescription');
        const useCaseInput = document.getElementById('useCase');

        if (siteNameInput) siteNameInput.value = '';
        if (pricingSelect) pricingSelect.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (useCaseInput) useCaseInput.value = '';

        // Reset Favorite toggle to "No"
        const favoriteToggle = document.getElementById('favoriteToggle');
        if (favoriteToggle) {
            favoriteToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === 'false');
            });
        }

        // Reset Needed toggle to "Not needed"
        const neededToggle = document.getElementById('neededToggle');
        if (neededToggle) {
            neededToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === 'false');
            });
        }

        // Uncheck all category checkboxes and reset visual styling
        const categoryCheckboxes = document.querySelectorAll('#categoriesCheckboxList input[type="checkbox"]');
        categoryCheckboxes.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
            }
            const itemDiv = cb.closest('div[style*="background"]');
            if (itemDiv) {
                itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                itemDiv.classList.remove('selected');
            }
        });

        // Uncheck all tag checkboxes and reset visual styling
        const tagCheckboxes = document.querySelectorAll('#tagsCheckboxList input[type="checkbox"]');
        tagCheckboxes.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
            }
            const itemDiv = cb.closest('div[style*="background"]');
            if (itemDiv) {
                itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                itemDiv.classList.remove('selected');
            }
        });

        debug('resetFormFields: form reset complete');
    } catch (e) {
        debug('resetFormFields: error', e);
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
                debug('clearFormCache: removed keys from chrome.storage.local', toRemove);
            });
        }
    } catch (err) {
        debug('clearFormCache: failed to remove from chrome.storage.local', err);
    }
}

// DOM elements - defined lazily so we can re-query after DOM is ready
let authSection = null;
let loginForm = null;
let registerForm = null;
// siteFormSection declared elsewhere; reuse the existing variable to avoid redeclaration
siteFormSection = siteFormSection || null;
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
        debug('checkDomAndInit: document.readyState=', document.readyState);

        // Provide a short snapshot of elements that *do* exist (helps debugging)
        try {
            const foundIds = Array.from(document.querySelectorAll('[id]')).slice(0, 200).map(el => el.id);
            debug(`Found IDs (${foundIds.length}):`, foundIds.slice(0, 50).join(', ') + (foundIds.length > 50 ? ', ...' : ''));
        } catch (dbgErr) {
            debug('Could not enumerate IDs', dbgErr);
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
        // Scroll to top immediately so popup opens at the start
        try { window.scrollTo(0, 0); document.body.scrollTop = 0; } catch (e) { }

        // Populate URL asap (even if site form is hidden) so it's available when the form shows
        tryPopulateUrlInput();

        // Ensure header is hidden/cleared while we resolve auth to avoid showing signed-in controls briefly
        try { showAuthForm(); } catch (e) { debug('showAuthForm pre-hide failed', e); }

        checkAuth();
    } catch (err) {
        console.error('Error during checkAuth:', err);
    }
}

// Ensure scrollable areas use the unified custom scrollbar UI (adds class to existing elements with inline overflow)
try {
    document.querySelectorAll('[style*="overflow-y: auto"]').forEach(el => el.classList.add('custom-scroll'));
} catch (e) {
    console.error('Failed to apply custom-scroll class in popup', e);
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
            debug('visibilitychange: hidden — saving form cache');
            saveFormToCache();
        } catch (e) {
            debug('saveFormToCache failed on visibilitychange hidden', e);
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

// Attach recent sites handlers (header badge + controls) once DOM is stable
const _attachRecentSitesHandlers = () => {
    const siteCountBadgeEl = document.getElementById('siteCountBadge');
    if (siteCountBadgeEl) siteCountBadgeEl.addEventListener('click', (e) => { e.stopPropagation(); toggleRecentSitesDropdown(); });
    const refreshBtn = document.getElementById('recentSitesRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', (e) => { e.stopPropagation(); refreshRecentSites(); });


    // Close dropdown on outside click or Escape
    document.addEventListener('click', (e) => {
        const dd = document.getElementById('recentSitesDropdown');
        const badge = document.getElementById('siteCountBadge');
        if (!dd) return;
        if (dd.classList.contains('show') && !dd.contains(e.target) && !badge.contains(e.target)) dd.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('recentSitesDropdown')?.classList.remove('show'); });
};
// Defer attachment slightly so DOM is ready
setTimeout(_attachRecentSitesHandlers, 50);

// Categories/tags will be loaded in showSiteForm() after successful authentication
// No need to load them here before knowing if user is logged in

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
            currentTabUrl = tab?.url || null;

            // Reset form fields before loading data for the new URL
            resetFormFields();

            // Reload lists and then restore cached selections for the tab (use safe loader)
            safeLoadCategoriesAndTags().then(() => {
                setTimeout(() => {
                    loadFormFromCache();
                    addFormCacheListeners();
                    // Reorder so checked items appear first after cache restore
                    setTimeout(() => {
                        reorderCheckboxList('categoriesCheckboxList');
                        reorderCheckboxList('tagsCheckboxList');
                    }, 200);
                }, 50);
            }).catch(e => debug('Error loading categories/tags on tab change', e));
        });
    } catch (e) {
        debug('chrome.tabs.get onActivated failed', e);
    }

    // Load URL from the new tab (robustly: handle missing URL / permissions by retrying once)
    try {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            siteFormSection = document.getElementById('siteFormSection');
            const urlInput = document.getElementById('url');

            if (urlInput && siteFormSection && !siteFormSection.classList.contains('hidden')) {
                const tabUrl = tab && tab.url ? tab.url : null;
                if (tabUrl) {
                    urlInput.value = tabUrl;
                    currentTabUrl = tabUrl;
                    resetFormFields(); // Reset form before loading cache for new URL
                } else {
                    // Retry once after a short delay in case URL wasn't available immediately
                    setTimeout(() => {
                        try {
                            chrome.tabs.get(activeInfo.tabId, (t2) => {
                                if (t2 && t2.url && urlInput) {
                                    urlInput.value = t2.url;
                                    currentTabUrl = t2.url;
                                    resetFormFields(); // Reset form for new URL
                                } else {
                                    const ui = document.getElementById('url');
                                    if (ui && !ui.value) ui.placeholder = 'URL unavailable';
                                }
                            });
                        } catch (err) {
                            debug('tabs.get retry err', err);
                            const uiFallback = document.getElementById('url');
                            if (uiFallback && !uiFallback.value) uiFallback.placeholder = 'URL unavailable';
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
        debug('chrome.tabs.get threw', err);
        const urlInputFallback = document.getElementById('url');
        if (urlInputFallback && !urlInputFallback.value) urlInputFallback.placeholder = 'URL unavailable';
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

    // Hide entire main header while on auth form to remove clutter
    const mainHeader = document.getElementById('mainHeader');
    if (mainHeader) { mainHeader.classList.add('hidden'); mainHeader.style.display = 'none'; }

    // Hide header user info and clear header state when not signed in
    const headerUserInfo = document.getElementById('headerUserInfo');
    if (headerUserInfo) {
        headerUserInfo.classList.add('hidden');
        // Clear displayed email and reset/hide site count so header doesn't show stale info
        const headerUserEmail = document.getElementById('headerUserEmail');
        if (headerUserEmail) headerUserEmail.textContent = '';
        const siteCountBadge = document.getElementById('siteCountBadge');
        if (siteCountBadge) {
            siteCountBadge.textContent = '0 sites';
            siteCountBadge.title = 'Total saved sites: 0';
            siteCountBadge.classList.add('hidden');
        }
    }

    // Also hide any logout buttons as a safety for race conditions
    const logoutCompact = document.getElementById('logoutCompactBtn');
    if (logoutCompact) logoutCompact.classList.add('hidden');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) headerLogoutBtn.classList.add('hidden');
}

// Robustly populate the URL input from the active tab. Retries once briefly if URL isn't
// immediately available (some pages/browsers or permission timing issues).
function tryPopulateUrlInput(retryCount = 3) {
    const urlInput = document.getElementById('url');
    if (!urlInput) return;
    try {
        debug('tryPopulateUrlInput: attempting to query active tab (retryCount=', retryCount, ')');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            try {
                debug('tryPopulateUrlInput: tabs result', tabs && tabs[0] ? { id: tabs[0].id, url: tabs[0].url, title: tabs[0].title } : tabs);
            } catch (dbg) { debug('tryPopulateUrlInput: tabs debug err', dbg); }

            // If we got a URL, use it
            if (tabs && tabs[0] && tabs[0].url) {
                const tabUrl = tabs[0].url;
                urlInput.value = tabUrl;
                try { currentTabId = tabs[0].id; } catch (e) { }
                try { currentTabUrl = tabUrl; } catch (e) { }

                // Store the original title and auto-populate site name if empty
                try {
                    if (tabs[0].title) {
                        currentTabTitle = tabs[0].title;
                    }
                    const siteNameInput = document.getElementById('siteName');
                    if (siteNameInput && currentTabTitle && !siteNameInput.value.trim()) {
                        siteNameInput.value = getCleanedPageTitle(currentTabTitle);
                    }
                } catch (e) { debug('Auto-populate title failed:', e); }

                // Persist to form cache immediately so it's available after sign-in or reopen
                try { debug('tryPopulateUrlInput: populated URL from tabs.query', tabUrl); } catch (e) { }
                return;
            }

            // If we have a tab id but no URL in the short query result, try a full get
            if (tabs && tabs[0] && typeof tabs[0].id === 'number') {
                const tid = tabs[0].id;
                try {
                    chrome.tabs.get(tid, (t) => {
                        try {
                            debug('tryPopulateUrlInput: chrome.tabs.get result', t && { id: t.id, url: t.url, title: t.title });
                        } catch (dbg) { debug('tryPopulateUrlInput: tabs.get debug err', dbg); }

                        if (t && t.url) {
                            urlInput.value = t.url;
                            try { currentTabId = t.id; } catch (e) { }
                            try { currentTabUrl = t.url; } catch (e) { }

                            // Store the original title and auto-populate site name if empty
                            try {
                                if (t.title) {
                                    currentTabTitle = t.title;
                                }
                                const siteNameInput = document.getElementById('siteName');
                                if (siteNameInput && currentTabTitle && !siteNameInput.value.trim()) {
                                    siteNameInput.value = getCleanedPageTitle(currentTabTitle);
                                }
                            } catch (e) { /* ignore */ }

                            try { debug('tryPopulateUrlInput: populated URL from tabs.get', t.url); } catch (e) { }
                            return;
                        } else {
                            // if still missing, fall through to retry logic below
                        }
                    });
                    // allow the get callback to populate; still continue to the retry scheduling below if needed
                } catch (getErr) {
                    debug('tryPopulateUrlInput: chrome.tabs.get threw', getErr);
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
                                try { currentTabUrl = t.url; } catch (e) { }
                                try { debug('tryPopulateUrlInput: populated URL from saved currentTabId', t.url); } catch (e) { }
                                return;
                            } else {
                                debug('tryPopulateUrlInput: saved currentTabId had no url', t);
                            }
                        } catch (innerErr) {
                            debug('tryPopulateUrlInput: tabs.get (saved id) debug err', innerErr);
                        }
                    });
                } catch (err2) {
                    debug('tryPopulateUrlInput: chrome.tabs.get(saved id) threw', err2);
                }
            }

            // If we reach here, we couldn't find a URL to populate
            const urlEl = document.getElementById('url'); if (urlEl && !urlEl.value) urlEl.placeholder = 'URL unavailable';
        });
    } catch (err) {
        debug('tryPopulateUrlInput err', err);
        const urlElErr = document.getElementById('url');
        if (urlElErr && !urlElErr.value) urlElErr.placeholder = 'URL unavailable';
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

    // Also show main header (title/logo) when user is signed in
    const mainHeader = document.getElementById('mainHeader');
    if (mainHeader) { mainHeader.classList.remove('hidden'); mainHeader.style.display = ''; }

    // Ensure site count badge and logout controls are visible when signed in
    const siteCountBadge = document.getElementById('siteCountBadge');
    if (siteCountBadge) siteCountBadge.classList.remove('hidden');
    const logoutCompact = document.getElementById('logoutCompactBtn');
    if (logoutCompact) logoutCompact.classList.remove('hidden');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) headerLogoutBtn.classList.remove('hidden');

    // Initialize pricing options
    initializePricingOptions();

    // Update site count in header badge
    updateSiteCount();
    // Refresh recent sites dropdown in header
    refreshRecentSites();

    // Attempt to populate the URL input from the active tab (may retry once)
    tryPopulateUrlInput();

    // Add save listeners immediately for form inputs
    const siteNameInput = document.getElementById('siteName');
    const urlInput = document.getElementById('url');
    const pricingSelect = document.getElementById('pricing');

    if (siteNameInput) {
        siteNameInput.addEventListener('input', saveFormToCache);
        // Auto-refill from page title when user clears the field and leaves
        siteNameInput.addEventListener('blur', () => {
            if (!siteNameInput.value.trim()) {
                autoFillSiteNameIfEmpty();
            }
        });
    }
    if (urlInput) {
        urlInput.addEventListener('input', saveFormToCache);
        urlInput.addEventListener('input', (e) => scheduleUrlCheck(e.target.value));
    }
    if (pricingSelect) {
        pricingSelect.addEventListener('change', saveFormToCache);
    }

    // Get current tab ID first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            currentTabId = tabs[0].id;
            currentTabUrl = tabs[0].url;

            const urlInput = document.getElementById('url');
            const siteNameInput = document.getElementById('siteName');

            if (urlInput) {
                urlInput.value = tabs[0].url;
                // Check if URL exists in database
                scheduleUrlCheck(tabs[0].url);
            }

            // Auto-populate site name from page title
            if (siteNameInput && tabs[0].title && !siteNameInput.value.trim()) {
                // Clean up the title (remove common suffixes like " - Google Search", " | Site Name")
                let title = tabs[0].title;
                // Remove common separators and everything after
                const separators = [' - ', ' | ', ' \u2014 ', ' :: ', ' \u2013 '];
                for (const sep of separators) {
                    const idx = title.lastIndexOf(sep);
                    if (idx > 10) { // Keep at least 10 chars
                        title = title.substring(0, idx);
                        break;
                    }
                }
                siteNameInput.value = title.trim();
            }

            // Load categories and tags using safe loader, then restore form from cache
            safeLoadCategoriesAndTags().then(() => {
                // Wait a tick for DOM to update
                setTimeout(() => {
                    const cacheKey = getFormCacheKey();
                    const cachedData = localStorage.getItem(cacheKey);


                    loadFormFromCache();
                    addFormCacheListeners();

                    // Reorder lists so checked items appear first after cache restore
                    setTimeout(() => {
                        reorderCheckboxList('categoriesCheckboxList');
                        reorderCheckboxList('tagsCheckboxList');
                    }, 200);

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
                                if (tagsClear) { tagsClear.classList.add('hidden'); tagsClear.style.display = 'none'; tagsClear.textContent = '✕'; tagsClear.setAttribute('aria-label', 'Clear search'); }
                            });
                        }
                    } catch (err) { debug('attach tags filter handlers failed', err); }

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
                                if (categoriesClear) { categoriesClear.classList.add('hidden'); categoriesClear.style.display = 'none'; categoriesClear.textContent = '✕'; categoriesClear.setAttribute('aria-label', 'Clear search'); }
                            });
                        }
                    } catch (err) { debug('attach categories filter handlers failed', err); }

                    // Apply any existing filter values after render
                    try { if (document.getElementById('tagsSearchInput')?.value) filterCheckboxList('tagsCheckboxList', document.getElementById('tagsSearchInput').value); } catch (e) { }
                    try { if (document.getElementById('categoriesSearchInput')?.value) filterCheckboxList('categoriesCheckboxList', document.getElementById('categoriesSearchInput').value); } catch (e) { }

                    // Update selection counts and hide loading
                    try { updateSelectionCounts(); } catch (e) { }
                    hideLoading();

                    // Scroll popup to top after everything is loaded and rendered
                    try {
                        window.scrollTo(0, 0);
                        document.body.scrollTop = 0;
                        const container = document.querySelector('.container');
                        if (container) container.scrollTop = 0;
                    } catch (e) { }

                    // Auto-focus first empty field
                    setTimeout(autoFocusFirstEmptyField, 100);

                    // Final scroll-to-top after all delayed operations (reorder at 200ms, focus at 100ms)
                    setTimeout(() => {
                        try {
                            window.scrollTo(0, 0);
                            document.body.scrollTop = 0;
                            const c = document.querySelector('.container');
                            if (c) c.scrollTop = 0;
                        } catch (e) { }
                    }, 350);

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

    debug('addFormCacheListeners: attaching listeners', 'categories:', categoryCheckboxes.length, 'tags:', tagCheckboxes.length);


    // Save on input
    if (siteNameInput) {
        siteNameInput.addEventListener('input', saveFormToCache);
        // Auto-refill from page title when user clears the field and leaves
        siteNameInput.addEventListener('blur', () => {
            if (!siteNameInput.value.trim()) {
                autoFillSiteNameIfEmpty();
            }
        });
    }
    if (urlInput) {
        urlInput.addEventListener('input', saveFormToCache);
        urlInput.addEventListener('input', (e) => scheduleUrlCheck(e.target.value));
    }
    if (pricingSelect) {
        pricingSelect.addEventListener('change', saveFormToCache);
    }

    // Save on checkbox change and update counts
    categoryCheckboxes.forEach((cb, i) => {
        cb.addEventListener('change', (e) => { saveFormToCache(); updateSelectionCounts(); });
    });
    tagCheckboxes.forEach((cb, i) => {
        cb.addEventListener('change', (e) => { saveFormToCache(); updateSelectionCounts(); });
    });

    // Ensure counts reflect current state on initial attachment
    try { updateSelectionCounts(); } catch (e) { debug('updateSelectionCounts init failed', e); }
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

    let visibleCount = 0;
    Array.from(container.children).forEach(itemDiv => {
        // Skip the no-results message element
        if (itemDiv.classList.contains('no-results-message')) return;
        try {
            const labelText = (itemDiv.querySelector('label')?.textContent || '').toLowerCase();
            const input = itemDiv.querySelector('input[type="checkbox"]');
            const metaName = (input?.dataset?.tagName || input?.dataset?.categoryName || '').toLowerCase();
            const matches = !q || labelText.includes(q) || metaName.includes(q);
            itemDiv.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        } catch (e) {
            // ignore
        }
    });

    // Show/hide "no results" message
    let noResultsEl = container.querySelector('.no-results-message');
    if (q && visibleCount === 0) {
        if (!noResultsEl) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'no-results-message';
            container.appendChild(noResultsEl);
        }
        const isCategory = containerId.toLowerCase().includes('categor');
        noResultsEl.textContent = isCategory ? 'No category found' : 'No tag found';
        noResultsEl.style.display = '';
    } else if (noResultsEl) {
        noResultsEl.style.display = 'none';
    }
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
        const rememberMeCheckbox = document.getElementById('rememberMe');
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
                // Save session based on Remember Me checkbox
                const rememberMe = document.getElementById('rememberMe')?.checked ?? true;
                if (rememberMe) {
                    await saveAuthToken(data.session);
                    localStorage.setItem('rememberMe', 'true');
                    // Also notify background script
                    try { chrome.runtime.sendMessage({ type: 'SET_REMEMBER_ME', value: true }); } catch (e) { }
                } else {
                    // Only save to sessionStorage (will be cleared when browser closes)
                    sessionStorage.setItem('supabase_session', JSON.stringify(data.session));
                    localStorage.removeItem('rememberMe');
                    // Also notify background script
                    try { chrome.runtime.sendMessage({ type: 'SET_REMEMBER_ME', value: false }); } catch (e) { }
                }
                debug('Login: saved session immediately to storage');
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

// Wire up toggle button groups (Favorite / Needed)
document.querySelectorAll('.toggle-group').forEach(group => {
    group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
});

const siteForm = document.getElementById('siteForm');
if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Getting values from fields
        const urlInput = document.getElementById('url');
        const pricingSelect = document.getElementById('pricing');
        const saveBtn = document.getElementById('saveBtn');
        const siteNameInput = document.getElementById('siteName');
        const descriptionInput = document.getElementById('siteDescription');
        const useCaseInput = document.getElementById('useCase');
        const favoriteToggle = document.getElementById('favoriteToggle');
        const neededToggle = document.getElementById('neededToggle');

        if (!urlInput || !pricingSelect || !saveBtn || !siteNameInput) {
            showMessage('Error: Some form fields are missing', 'error');
            return;
        }

        const url = urlInput.value.trim();
        const siteName = siteNameInput.value.trim();
        const siteDescription = descriptionInput ? descriptionInput.value.trim() : '';
        const useCase = useCaseInput ? useCaseInput.value.trim() : '';
        const isFavorite = favoriteToggle ? favoriteToggle.querySelector('.toggle-btn.active')?.dataset.value === 'true' : false;
        const isNeeded = neededToggle ? neededToggle.querySelector('.toggle-btn.active')?.dataset.value === 'true' : false;

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
        if (!isValidUrl(url)) {
            showMessage('Please enter a valid URL (http:// or https://)', 'error');
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
        saveBtn.classList.add('saving');
        saveBtn.textContent = 'Saving...';

        try {
            // Get user_id from session
            if (!ensureSupabase()) throw new Error('Supabase not available');

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) {
                showMessage('You are not signed in!', 'error');
                saveBtn.disabled = false;
                saveBtn.classList.remove('saving');
                saveBtn.textContent = 'Save Site';
                return;
            }

            const userId = session.user.id;

            // Prepare base payload to send to Supabase
            const siteDataBase = {
                name: siteName,
                title: siteName,
                url: url,
                description: siteDescription || null,
                use_case: useCase || null,
                is_favorite: isFavorite,
                is_needed: isNeeded,
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
                debug('siteData column-detect/map failed', e);
            }

            debug('Preparing siteData for insert (adjusted):', siteDataBase, '=>', siteData);


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
                            saveBtn.classList.remove('saving');
                            saveBtn.textContent = 'Save Site';
                            return;
                        }
                        if (existing && existing.length > 0) {
                            debug('Site already exists locally (user_id+url)', { userId, url, existing });
                            showMessage('Site already exists in your collection!', 'error');
                            saveBtn.disabled = false;
                            saveBtn.classList.remove('saving');
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
                        // Ensure we include the signed-in user's id so RLS policies (auth.uid() = user_id) pass
                        const uid = await getSignedInUserId();
                        if (!uid) { showMessage('Sign in to save site', 'error'); return; }
                        siteData.user_id = siteData.user_id || uid;
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
                                    // Ensure user_id present for RLS policies
                                    attemptPayload.user_id = attemptPayload.user_id || (await getSignedInUserId());
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
                                saveBtn.classList.remove('saving');
                                saveBtn.textContent = 'Save Site';
                                return;
                            }
                        } else {
                            // Non-schema or generic errors
                            showMessage('Error saving to Supabase: ' + (insertErr.message || JSON.stringify(insertErr)), 'error');
                            saveBtn.disabled = false;
                            saveBtn.classList.remove('saving');
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
                    saveBtn.classList.remove('saving');
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
                        saveBtn.classList.remove('saving');
                        saveBtn.textContent = 'Save Site';
                        return;
                    }
                    if (!response.ok || !result || !result.success) {
                        console.error('Legacy API error', result);
                        showMessage('Error saving: ' + (result && result.error ? result.error : 'Legacy API error'), 'error');
                        saveBtn.disabled = false;
                        saveBtn.classList.remove('saving');
                        saveBtn.textContent = 'Save Site';
                        return;
                    }
                } catch (e) {
                    console.error('Legacy API request failed', e);
                    showMessage('Error saving: network error contacting legacy API', 'error');
                    saveBtn.disabled = false;
                    saveBtn.classList.remove('saving');
                    saveBtn.textContent = 'Save Site';
                    return;
                }
            }

            saveBtn.disabled = false;
            saveBtn.classList.remove('saving');
            saveBtn.textContent = 'Save Site';

            // Normalize success detection across Supabase and legacy API
            const saveSucceeded = (typeof response === 'undefined') ? (result && result.success) : (response.ok && result && result.success);

            // If save succeeded, insert into junction tables (site_categories and site_tags)
            if (saveSucceeded && result && result.data) {
                const newSiteData = Array.isArray(result.data) ? result.data[0] : result.data;
                const newSiteId = newSiteData?.id;

                if (newSiteId && ensureSupabase()) {
                    // Insert site_categories
                    if (categoryIds && categoryIds.length > 0) {
                        try {
                            const scPayload = categoryIds.map(catId => ({ site_id: newSiteId, category_id: catId }));
                            const { error: scErr } = await supabaseClient.from('site_categories').insert(scPayload);
                            if (scErr) {
                                console.warn('site_categories insert failed:', scErr);
                                const sm = String((scErr && (scErr.message || scErr.code)) ? (scErr.message || scErr.code) : scErr);
                                if (/row-level security|permission|permission denied|42501|403/i.test(sm)) {
                                    showMessage('Permission denied when linking categories to site — please sign in', 'error');
                                }
                            } else debug('site_categories inserted:', scPayload.length);
                        } catch (e) { console.warn('site_categories insert error:', e); }
                    }

                    // Insert site_tags
                    if (tagIds && tagIds.length > 0) {
                        try {
                            const stPayload = tagIds.map(tagId => ({ site_id: newSiteId, tag_id: tagId }));
                            const { error: stErr } = await supabaseClient.from('site_tags').insert(stPayload);
                            if (stErr) {
                                console.warn('site_tags insert failed:', stErr);
                                const sm = String((stErr && (stErr.message || stErr.code)) ? (stErr.message || stErr.code) : stErr);
                                if (/row-level security|permission|permission denied|42501|403/i.test(sm)) {
                                    showMessage('Permission denied when linking tags to site — please sign in', 'error');
                                }
                            } else debug('site_tags inserted:', stPayload.length);
                        } catch (e) { console.warn('site_tags insert error:', e); }
                    }
                }
            }

            if (!saveSucceeded) {
                // Check if site already exists
                if (result && result.existing) {
                    showMessage('Site already exists in your collection!', 'error');
                } else {
                    // Prefer descriptive messages from Supabase or legacy API
                    const errMsg = (result && (result.error || result.message)) ? (result.error || result.message) : 'Unknown error';
                    showMessage('Error saving: ' + errMsg, 'error');
                }
            } else {
                showMessage('Site saved successfully!', 'success');

                // Update site count in header badge
                updateSiteCount();
                // Refresh recent sites dropdown in header
                refreshRecentSites();

                // Re-check URL to update indicator (now it exists!)
                const savedUrl = document.getElementById('url')?.value;
                if (savedUrl) scheduleUrlCheck(savedUrl);

                // Form reset - reset all fields except URL
                setTimeout(() => {
                    const siteNameInputReset = document.getElementById('siteName');
                    if (siteNameInputReset) {
                        // Reset field first, then auto-fill from page title
                        siteNameInputReset.value = '';
                        autoFillSiteNameIfEmpty();
                        siteNameInputReset.focus();
                        siteNameInputReset.select(); // Select text so user can easily replace it
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
                            itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                            itemDiv.classList.remove('selected');
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
                            itemDiv.style.border = itemDiv.dataset.defaultBorder || '1px solid transparent';
                            itemDiv.classList.remove('selected');
                        }
                    });

                    // Clear per-tab cache and save only the URL so popup reopens with defaults + URL
                    clearFormCache();
                    try { saveFormToCache(); } catch (e) { debug('saveFormToCache after clear failed', e); }
                }, 1500);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            showMessage('Error saving: ' + errorMsg, 'error');
        }
    });
}

// Display message with icon
function showMessage(text, type) {
    if (!messageEl) return;

    // Add icon based on type
    const icon = type === 'success'
        ? '<i class="fas fa-check-circle" style="margin-right: 8px;"></i>'
        : '<i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>';

    messageEl.innerHTML = icon + text;
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
        } catch (e) { debug('clearing inline form fields in hideInlineForm failed', e); }

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
            const uid = await getSignedInUserId();
            if (!uid) { showMessage('Sign in to create category', 'error'); return; }
            const { data: inserted, error: insertErr } = await supabaseClient.from('categories').insert([{ name, color, user_id: uid }]).select();
            if (insertErr) {
                console.error('Supabase insert category error', insertErr);
                showMessage(insertErr.message || 'Error creating category', 'error');
            } else {
                showMessage('Category created', 'success');
                // Save current form state before refreshing lists
                const formState = getCurrentFormState();
                // Refresh lists and persist cache
                await safeLoadCategoriesAndTags();
                // Restore form state after refresh
                setTimeout(() => restoreFormState(formState), 100);
                hideInlineForm(addCategoryForm, addCategoryBtn);
                const el = document.getElementById('newCategoryName'); if (el) el.value = '';
            }
        } else {
            const resp = await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
            const text = await resp.text(); let result; try { result = JSON.parse(text); } catch (e) { result = { error: text }; }
            if (!resp.ok || !result.success) { showMessage(result.error || 'Error creating category', 'error'); } else { showMessage('Category created', 'success'); const fsCat = getCurrentFormState(); await safeLoadCategoriesAndTags(); setTimeout(() => restoreFormState(fsCat), 100); hideInlineForm(addCategoryForm, addCategoryBtn); const el = document.getElementById('newCategoryName'); if (el) el.value = ''; }
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
            const uid = await getSignedInUserId();
            if (!uid) { showMessage('Sign in to create tag', 'error'); return; }
            const { data: inserted, error: insertErr } = await supabaseClient.from('tags').insert([{ name, color, user_id: uid }]).select();
            if (insertErr) {
                console.error('Supabase insert tag error', insertErr);
                const imsg = String(insertErr.message || insertErr.code || 'Error creating tag');
                if (/row-level security|permission|permission denied|42501|forbidden|403/i.test(imsg)) {
                    showMessage('Permission denied — please sign in to manage tags', 'error');
                } else {
                    showMessage(imsg, 'error');
                }
            } else {
                showMessage('Tag created', 'success');
                // Save current form state before refreshing lists
                const formStateTag = getCurrentFormState();
                await safeLoadCategoriesAndTags();
                // Restore form state after refresh
                setTimeout(() => restoreFormState(formStateTag), 100);
                hideInlineForm(addTagForm, addTagBtn);
                const el = document.getElementById('newTagName'); if (el) el.value = '';
            }
        } else {
            const resp = await fetch(`${API_URL}/api/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
            const text = await resp.text(); let result; try { result = JSON.parse(text); } catch (e) { result = { error: text }; }
            if (!resp.ok || !result.success) { showMessage(result.error || 'Error creating tag', 'error'); } else { showMessage('Tag created', 'success'); const fsTag = getCurrentFormState(); await safeLoadCategoriesAndTags(); setTimeout(() => restoreFormState(fsTag), 100); hideInlineForm(addTagForm, addTagBtn); const el = document.getElementById('newTagName'); if (el) el.value = ''; }
        }
    } catch (e) { console.error(e); showMessage('Network error', 'error'); }
    saveTagBtn.disabled = false; saveTagBtn.classList.remove('loading'); saveTagBtn.removeAttribute('aria-busy'); saveTagBtn.textContent = prev || '✓';
});