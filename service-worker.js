// ===== Service Worker для English Useful =====
const CACHE_VERSION = 'v17';
const CACHE_NAME = `english-useful-${CACHE_VERSION}`;

// Файлы для кеширования при установке
const CACHE_FILES = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './data/vocabulary.json',
    './data/phrases.json',
    './data/sentences.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png'
];

// Установка — кешируем всё
self.addEventListener('install', (event) => {
    console.log('📦 SW: установка', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CACHE_FILES).catch((err) => {
                console.warn('⚠️ SW: не все файлы закешированы', err);
            });
        })
    );
    self.skipWaiting();
});

// Активация — удаляем старые кеши
self.addEventListener('activate', (event) => {
    console.log('✅ SW: активация', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🗑️ SW: удаляем старый кеш', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache first, network fallback
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы к Firebase и другим внешним API
    if (event.request.url.includes('firebase') ||
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic') ||
        event.request.url.includes('unpkg.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then((response) => {
                // Кешируем только успешные GET-запросы
                if (!response || response.status !== 200 || event.request.method !== 'GET') {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(() => {
                // Если сети нет и файла нет в кеше — отдаём index.html для SPA
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

console.log('🚀 SW: загружен, версия', CACHE_VERSION);
