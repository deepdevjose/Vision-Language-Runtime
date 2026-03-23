/**
 * Model Cache Service Worker
 * CacheFirst strategy for .onnx model files from HuggingFace CDNs.
 * Prevents mobile browsers from evicting large model files under memory pressure.
 *
 * Fix 10 — Persistent model caching via Service Worker
 */

const CACHE_NAME = 'vlm-model-cache-v1';

/**
 * Origins and path patterns that should be intercepted.
 * Covers both the HuggingFace Hub and their large-file CDN.
 */
const CACHEABLE_ORIGINS = [
    'https://huggingface.co',
    'https://cdn-lfs.hf.co',
    'https://cdn-lfs-us-1.hf.co',
    'https://cdn-lfs-us-1.huggingface.co',
];

/**
 * File extensions worth caching (model weights + WASM runtime).
 * JSON config files are tiny and change often — let the browser handle those.
 */
const CACHEABLE_EXTENSIONS = ['.onnx', '.onnx_data', '.wasm'];

/**
 * Check whether a request URL should be served from cache.
 * @param {URL} url
 * @returns {boolean}
 */
function isCacheableRequest(url) {
    const matchesOrigin = CACHEABLE_ORIGINS.some((origin) => url.origin === origin);
    if (!matchesOrigin) return false;

    const matchesExtension = CACHEABLE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
    return matchesExtension;
}

// ── Lifecycle ────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    // Activate immediately — no waiting for old tabs to close.
    self.skipWaiting();
    console.log(`[SW] ${CACHE_NAME} installed`);
});

self.addEventListener('activate', (event) => {
    // Claim all open tabs so the SW starts intercepting right away.
    event.waitUntil(
        (async () => {
            await self.clients.claim();

            // Evict old cache versions
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key.startsWith('vlm-model-cache-') && key !== CACHE_NAME)
                    .map((key) => {
                        console.log(`[SW] Evicting old cache: ${key}`);
                        return caches.delete(key);
                    })
            );
        })()
    );
    console.log(`[SW] ${CACHE_NAME} activated`);
});

// ── Fetch handler — CacheFirst for model files ──────────────────

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (!isCacheableRequest(url)) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // 1. Try cache first
            const cached = await cache.match(event.request);
            if (cached) {
                console.log(`[SW] Cache hit: ${url.pathname.split('/').pop()}`);
                return cached;
            }

            // 2. Network fallback — fetch and store
            console.log(`[SW] Cache miss, fetching: ${url.pathname.split('/').pop()}`);
            try {
                const response = await fetch(event.request);

                // Only cache successful, complete responses
                if (response.ok && response.status === 200) {
                    // Clone before consuming — response body is a stream
                    cache.put(event.request, response.clone());
                }

                return response;
            } catch (networkError) {
                console.error(`[SW] Network error for ${url.pathname}:`, networkError);
                throw networkError;
            }
        })()
    );
});
