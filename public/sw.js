/**
 * Service Worker for Site Organizer PWA
 * Handles caching, offline support, and push notifications
 */

// Configuration
const SW_CONFIG = {
    CACHE_NAME: 'site-organizer-v1',
    CACHE_VERSION: 1,
    OFFLINE_STATUS_CODE: 503,
    SUCCESS_STATUS_CODE: 200
};

// Routes and assets
const ROUTES = {
    ROOT: '/',
    DASHBOARD: '/dashboard/sites',
    LOGIN: '/login',
    MANIFEST: '/manifest.json'
};

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    ROUTES.ROOT,
    ROUTES.DASHBOARD,
    ROUTES.LOGIN,
    ROUTES.MANIFEST
];

// External domains to skip caching
const SKIP_CACHE_DOMAINS = ['supabase.co'];

// URL patterns to skip
const SKIP_CACHE_PATTERNS = ['chrome-extension://'];

/**
 * Check if request should be cached
 * @param {Request} request - Fetch request
 * @returns {boolean} True if should cache
 */
const shouldCache = (request) => {
    // Skip non-GET requests
    if (request.method !== 'GET') return false;

    // Skip external API calls
    if (SKIP_CACHE_DOMAINS.some(domain => request.url.includes(domain))) {
        return false;
    }

    // Skip specific URL patterns
    if (SKIP_CACHE_PATTERNS.some(pattern => request.url.startsWith(pattern))) {
        return false;
    }

    return true;
};

/**
 * Cache response if successful
 * @param {Request} request - Original request
 * @param {Response} response - Response to cache
 * @returns {void}
 */
const cacheResponse = (request, response) => {
    if (response.status === SW_CONFIG.SUCCESS_STATUS_CODE) {
        const responseClone = response.clone();
        caches.open(SW_CONFIG.CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
        });
    }
};

/**
 * Get fallback response when offline
 * @param {Request} request - Original request
 * @returns {Promise<Response>} Cached or fallback response
 */
const getFallbackResponse = async (request) => {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
        const rootCache = await caches.match(ROUTES.ROOT);
        if (rootCache) return rootCache;
    }

    return new Response('Offline', {
        status: SW_CONFIG.OFFLINE_STATUS_CODE,
        statusText: 'Service Unavailable'
    });
};

/**
 * Install event - cache essential assets
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SW_CONFIG.CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== SW_CONFIG.CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

/**
 * Fetch event - network first, fallback to cache
 */
self.addEventListener('fetch', (event) => {
    if (!shouldCache(event.request)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                cacheResponse(event.request, response);
                return response;
            })
            .catch(() => getFallbackResponse(event.request))
    );
});

/**
 * Handle push notifications
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png'
        })
    );
});
