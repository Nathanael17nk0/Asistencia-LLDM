// =====================================================
// SERVICE WORKER — Asistencia LLDM (v4.0 Push)
// =====================================================
const CACHE_VERSION = 'v4.0';
const CACHE_NAME = `lldm-attendance-${CACHE_VERSION}`;

// ─── INSTALL ──────────────────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Installed:', CACHE_VERSION);
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Activated:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ─── FETCH (simple cache-first for assets) ────────────
self.addEventListener('fetch', event => {
    // Pass through — no aggressive caching needed
    return;
});

// ─── PUSH NOTIFICATION RECEIVED ───────────────────────
// This fires when a push arrives from the server, even if the app is closed.
self.addEventListener('push', event => {
    let data = { title: 'Recordatorio de Asistencia', body: '¡No olvides registrar tu asistencia de hoy!' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    console.log('[SW] Push received:', data);

    const options = {
        body: data.body || data.message || '¡Recuerda registrar tu asistencia!',
        icon: '/img/icon-blue-192.png',
        badge: '/img/icon-blue-192.png',
        vibrate: [200, 100, 200],
        tag: 'attendance-reminder', // Replaces previous same-tag notification
        requireInteraction: false,
        data: { url: data.url || '/' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Asistencia LLDM', options)
    );
});

// ─── NOTIFICATION CLICKED ─────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // If app is already open, focus it
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
