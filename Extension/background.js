// Background service worker for Site Organizer
// Handles periodic token refresh to keep session alive

const SUPABASE_CONFIG = {
    url: 'https://skacyhzljreaitrbgbte.supabase.co',
    // NOTE: keep this in sync with config.js — this key is used by the background token refresh
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWN5aHpsanJlYWl0cmJnYnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTg2NjksImV4cCI6MjA4MzIzNDY2OX0.KcBnl6l_zg9lTcVgFs2yDq4-F-1TKsyiWGNOoxQ_bdc'
};

// Debug: warn if config.js and background.js differ at runtime (non-visual; useful for future debugging)
if (typeof console !== 'undefined' && console.warn) {
    try {
        // Try reading config.js if it's available in the same context
        if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.anonKey) {
            // no-op; value set above
        }
    } catch (e) { console.warn('[background] Could not compare SUPABASE_CONFIG sources', e); }
}

// Alarm name for token refresh
const TOKEN_REFRESH_ALARM = 'tokenRefreshAlarm';

// Set up alarm when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('[background] Extension installed/updated, setting up token refresh alarm');
    setupTokenRefreshAlarm();
});

// Also set up alarm when service worker starts
setupTokenRefreshAlarm();

function setupTokenRefreshAlarm() {
    // Create an alarm that fires every 30 minutes
    chrome.alarms.create(TOKEN_REFRESH_ALARM, {
        periodInMinutes: 30
    });
    console.log('[background] Token refresh alarm created (every 30 minutes)');
}

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TOKEN_REFRESH_ALARM) {
        console.log('[background] Token refresh alarm triggered');
        await refreshTokenIfNeeded();
    }
});

async function refreshTokenIfNeeded() {
    try {
        // Check if Remember Me is enabled
        const { rememberMe } = await chrome.storage.local.get('rememberMe');
        if (!rememberMe && rememberMe !== 'true') {
            console.log('[background] Remember Me not enabled, skipping token refresh');
            return;
        }

        // Get stored auth data
        const result = await chrome.storage.local.get(['supabaseAuthToken', 'supabaseSession']);
        const storedAuth = result.supabaseAuthToken;

        if (!storedAuth || !storedAuth.refreshToken) {
            console.log('[background] No stored auth token found');
            return;
        }

        // Check if token is expiring soon (within 1 hour)
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = storedAuth.expiresAt || 0;
        const expiresInSeconds = expiresAt - now;

        if (expiresInSeconds > 3600) {
            console.log('[background] Token still valid for', Math.floor(expiresInSeconds / 60), 'minutes, skipping refresh');
            return;
        }

        console.log('[background] Token expires in', Math.floor(expiresInSeconds / 60), 'minutes, refreshing...');

        // Refresh the token using Supabase REST API directly
        const response = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_CONFIG.anonKey
            },
            body: JSON.stringify({
                refresh_token: storedAuth.refreshToken
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error body');
            console.error('[background] Token refresh failed:', response.status, response.statusText, errorText);

            // If token is invalid/expired, clear stored auth to force re-login
            if (response.status === 400 || response.status === 401) {
                console.warn('[background] Refresh token invalid, clearing stored auth');
                await chrome.storage.local.remove(['supabaseAuthToken', 'supabaseSession']);
            }
            return;
        }

        const data = await response.json();

        if (data.access_token && data.refresh_token) {
            // Update stored auth data
            const newAuthData = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
                user: data.user || storedAuth.user
            };

            await chrome.storage.local.set({
                supabaseAuthToken: newAuthData,
                supabaseSession: {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_at: newAuthData.expiresAt,
                    user: newAuthData.user
                }
            });

            // Also update localStorage via message to popup (if open)
            // Notify popup if it's open; handle lack of receiver gracefully via callback
            try {
                chrome.runtime.sendMessage({ type: 'TOKEN_REFRESHED', authData: newAuthData }, () => {
                    if (chrome.runtime.lastError) {
                        // No receiver (popup not open) — this is fine
                        console.log('[background] TOKEN_REFRESHED: no receiver (popup likely closed)');
                    }
                });
            } catch (e) {
                // Safety fallback — still ok if message fails
                console.warn('[background] TOKEN_REFRESHED sendMessage threw', e);
            }

            console.log('[background] Token refreshed successfully, new expiry:', new Date(newAuthData.expiresAt * 1000).toLocaleString());
        } else {
            console.error('[background] Token refresh response missing tokens:', data);
        }
    } catch (error) {
        console.error('[background] Error refreshing token:', error);
    }
}

// Also save rememberMe preference to chrome.storage.local when set in popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_REMEMBER_ME') {
        chrome.storage.local.set({ rememberMe: message.value ? 'true' : 'false' });
        console.log('[background] Remember Me preference saved:', message.value);
    }
    return true;
});

// Immediately try to refresh on service worker start (if needed)
refreshTokenIfNeeded();
