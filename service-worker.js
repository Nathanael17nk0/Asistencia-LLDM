// =====================================================
// SERVICE WORKER - Asistencia LLDM (v4.0)
// Handles background push notifications
// =====================================================

const CACHE_NAME = 'lldm-cache-v1';

// Install event — cache basic assets
self.addEventListener('install', event => {
    console.log('[SW] Installed');
    self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activated');
    event.waitUntil(clients.claim());
});

// =====================================================
// PUSH EVENT — Llegó una notificación del servidor
// Este evento se dispara AUNQUE la App esté cerrada
// =====================================================
self.addEventListener('push', event => {
    console.log('[SW] Push recibido:', event.data?.text());

    let data = {
        title: '📌 Recordatorio de Asistencia',
        body: 'La Paz de Dios sea con usted. Recuerde registrar su asistencia.',
        icon: '/img/icon-blue-192.png',
        badge: '/img/icon-blue-192.png',
        vibrate: [200, 100, 200]
    };

    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch (e) {
        console.warn('[SW] Could not parse push data:', e);
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            vibrate: data.vibrate,
            tag: 'lldm-reminder',       // Replaces same tag (no spam)
            renotify: true,
            data: { url: self.location.origin }
        })
    );
});

// =====================================================
// NOTIFICATION CLICK — Abrir App al tocar la notif
// =====================================================
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) return client.focus();
            }
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
