// ===== SERVICE WORKER =====
// Версия — увеличивай при каждом обновлении, чтобы сбросить кеш
const CACHE_VERSION = 'v17';
const CACHE_NAME = `english-trainer-${CACHE_VERSION}`;

// Что кешируем сразу при установке
const PRECACHE_URLS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './data/vocabulary.json',
    './data/phrases.json',
    './data/temporary.json',
    './data/sentences.json',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png'
];

// Установка — кешируем основные файлы
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 SW: precache', PRECACHE_URLS.length, 'файлов');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.warn('⚠️ SW precache error:', err))
    );
});

// Активация — удаляем старые кеши
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🗑 SW: удаляю старый кеш', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — стратегия:
// - Firebase / gstatic → network only (не кешируем)
// - Всё остальное → cache first, потом network
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Пропускаем Firebase и Google APIs
    if (url.includes('firestore.googleapis.com') ||
        url.includes('firebase') ||
        url.includes('gstatic.com') ||
        url.includes('googleapis.com')) {
        return;
    }

    // Только GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // В фоне обновим кеш
                fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, response.clone());
                        });
                    }
                }).catch(() => { });
                return cached;
            }

            // Нет в кеше — тянем с сети и кешируем
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(() => {
                // Оффлайн — вернём index.html для навигации
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});