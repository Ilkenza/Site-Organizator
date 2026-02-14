/**
 * Service Worker for Site Organizer PWA
 * Handles caching, offline support, background sync, and push notifications
 */

// ── Configuration ───────────────────────────────────────────────────────────

const CACHE_NAME = 'site-organizer-v2';
const API_CACHE = 'site-organizer-api-v2';
const FAVICON_CACHE = 'site-organizer-favicons-v1';

// ── Precache: pages & static assets loaded on install ───────────────────────

const PRECACHE_URLS = [
    '/',
    '/login',
    '/dashboard/sites',
    '/dashboard/categories',
    '/dashboard/tags',
    '/dashboard/favorites',
    '/dashboard/settings',
    '/share',
    '/manifest.json',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/icons/logo.svg',
];

// ── Offline HTML shell (inline) ─────────────────────────────────────────────

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Site Organizer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050a30;color:#e0e8f7;font-family:system-ui,-apple-system,sans-serif}
.c{text-align:center;padding:2rem}
.icon{font-size:3rem;margin-bottom:1rem}
h1{font-size:1.5rem;margin-bottom:.5rem}
p{color:#9ca3af;font-size:.875rem;margin-bottom:1.5rem;max-width:24rem}
button{background:rgba(108,187,251,.15);color:#6CBBFB;border:1px solid rgba(108,187,251,.3);padding:.625rem 1.5rem;border-radius:.5rem;cursor:pointer;font-size:.875rem;transition:background .2s}
button:hover{background:rgba(108,187,251,.25)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:.5rem;vertical-align:middle}
</style>
</head>
<body>
<div class="c">
<div class="icon">📡</div>
<h1>You're offline</h1>
<p><span class="dot"></span>No internet connection. Your changes will sync automatically when you reconnect.</p>
<button onclick="location.reload()">Try again</button>
</div>
</body>
</html>`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Domains to never cache */
const SKIP_DOMAINS = ['supabase.co', 'supabase.in'];

/** Check if URL is an API route */
const isAPI = (url) => new URL(url).pathname.startsWith('/api/');

/** Check if URL is a favicon fetch */
const isFavicon = (url) => url.includes('favicon') || url.includes('s2/favicons');

/** Check if URL is a Next.js data/build asset */
const isNextAsset = (url) => {
    const p = new URL(url).pathname;
    return p.startsWith('/_next/');
};

/** Should this request be cached at all? */
const shouldCache = (request) => {
    if (request.method !== 'GET') return false;
    const url = request.url;
    if (SKIP_DOMAINS.some(d => url.includes(d))) return false;
    if (url.startsWith('chrome-extension://')) return false;
    return true;
};

/** Should this non-GET request be queued for background sync? */
const isOfflineMutation = (request) => {
    if (request.method === 'GET' || request.method === 'HEAD') return false;
    return isAPI(request.url);
};

// ── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache each URL individually so one failure doesn't break everything
            await Promise.allSettled(
                PRECACHE_URLS.map(url =>
                    cache.add(url).catch(err =>
                        console.warn('[SW] Precache failed for', url, err?.message)
                    )
                )
            );
            return self.skipWaiting();
        })
    );
});

// ── Activate: clean old caches ──────────────────────────────────────────────

self.addEventListener('activate', (event) => {
    const KEEP = [CACHE_NAME, API_CACHE, FAVICON_CACHE];
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(n => !KEEP.includes(n)).map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// ── Fetch strategies ────────────────────────────────────────────────────────

/**
 * Network-first for pages (HTML navigations).
 * Cache the response; fall back to cache, then offline shell.
 */
async function networkFirstPage(request) {
    try {
        const res = await fetch(request);
        if (res.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, res.clone());
        }
        return res;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Try root shell as fallback for navigations
        const root = await caches.match('/');
        if (root) return root;
        return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html' } });
    }
}

/**
 * Stale-while-revalidate for Next.js build assets (_next/static).
 * Return cached immediately, refresh cache in background.
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
    }).catch(() => null);

    return cached || (await fetchPromise) || new Response('', { status: 503 });
}

/**
 * Cache-first for favicons (rarely change, save bandwidth).
 * TTL: 7 days.
 */
async function cacheFirstFavicon(request) {
    const cache = await caches.open(FAVICON_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
    } catch {
        return new Response('', { status: 503 });
    }
}

/**
 * Network-first for GET API calls (data freshness matters).
 * Short-lived cache for offline reads.
 */
async function networkFirstAPI(request) {
    try {
        const res = await fetch(request);
        if (res.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, res.clone());
        }
        return res;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ success: false, error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ── Main fetch handler ──────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Non-GET API requests: try network, queue for sync if offline
    if (isOfflineMutation(request)) {
        event.respondWith(
            fetch(request).catch(async () => {
                await queueForSync(request);
                return new Response(
                    JSON.stringify({ success: true, offline: true, queued: true }),
                    { status: 202, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    if (!shouldCache(request)) return;

    const url = request.url;

    // Navigation requests → network-first page
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstPage(request));
        return;
    }

    // Favicon images → cache-first
    if (isFavicon(url)) {
        event.respondWith(cacheFirstFavicon(request));
        return;
    }

    // Next.js build assets → stale-while-revalidate
    if (isNextAsset(url)) {
        event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
        return;
    }

    // API GET requests → network-first with API cache
    if (isAPI(url)) {
        event.respondWith(networkFirstAPI(request));
        return;
    }

    // Everything else → stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// ── Background Sync: queue failed mutations for retry ───────────────────────

const SYNC_TAG = 'site-organizer-sync';
const SYNC_STORE = 'pendingRequests';

/**
 * Store a failed mutation for retry when back online.
 * Uses IndexedDB via a simple key-value approach.
 */
async function queueForSync(request) {
    try {
        const body = await request.clone().text();
        const entry = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body,
            timestamp: Date.now()
        };

        // Use IDB
        const db = await openSyncDB();
        const tx = db.transaction(SYNC_STORE, 'readwrite');
        tx.objectStore(SYNC_STORE).add(entry);
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });

        // Register sync
        if (self.registration.sync) {
            await self.registration.sync.register(SYNC_TAG);
        }
    } catch (e) {
        // Silently fail — data isn't critical enough to crash
    }
}

function openSyncDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('site-organizer-sync', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SYNC_STORE)) {
                db.createObjectStore(SYNC_STORE, { autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Sync event: replay queued mutations
self.addEventListener('sync', (event) => {
    if (event.tag !== SYNC_TAG) return;

    event.waitUntil((async () => {
        try {
            const db = await openSyncDB();
            const tx = db.transaction(SYNC_STORE, 'readonly');
            const store = tx.objectStore(SYNC_STORE);

            const entries = await new Promise((resolve) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });

            const succeeded = [];
            for (const entry of entries) {
                try {
                    const res = await fetch(entry.url, {
                        method: entry.method,
                        headers: entry.headers,
                        body: entry.method !== 'GET' ? entry.body : undefined,
                    });
                    if (res.ok) succeeded.push(entry);
                } catch {
                    // Will retry on next sync
                }
            }

            // Clear synced entries
            if (succeeded.length > 0) {
                const clearTx = db.transaction(SYNC_STORE, 'readwrite');
                clearTx.objectStore(SYNC_STORE).clear();
                await new Promise((r) => { clearTx.oncomplete = r; });

                // Notify all clients to refresh
                const clients = await self.clients.matchAll({ type: 'window' });
                clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE', count: succeeded.length }));
            }
        } catch {
            // Will retry on next sync
        }
    })());
});

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title || 'Site Organizer', {
                body: data.body || '',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                data: data.url ? { url: data.url } : undefined,
                actions: data.actions || [],
            })
        );
    } catch {
        // Ignore malformed push data
    }
});

// Open URL on notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/dashboard/sites';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            // Focus existing tab if open
            const existing = clients.find(c => c.url.includes('/dashboard'));
            if (existing) { existing.focus(); return; }
            return self.clients.openWindow(url);
        })
    );
});

// ── Periodic cache cleanup ──────────────────────────────────────────────────

// Clean API cache on activate (data gets stale quickly)
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.delete(API_CACHE));
});
