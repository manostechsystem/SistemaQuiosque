// Service Worker do Rota do Forte — Push Notifications & Tela Bloqueada
const CACHE_NAME = 'rota-forte-sw-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Recebe ordens da aplicação para disparar notificações no sistema operacional / tela de bloqueio
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NOTIFICAR') {
    const { titulo, corpo, tag, icone, dados } = e.data;
    const opcoes = {
      body: corpo,
      icon: icone || '/assets/logo-topo.png',
      badge: '/assets/logo-topo.png',
      tag: tag || 'alerta-' + Date.now(),
      renotify: true,
      vibrate: [250, 100, 250, 100, 250],
      requireInteraction: false,
      data: dados || {}
    };

    e.waitUntil(
      self.registration.showNotification(titulo, opcoes)
    );
  }
});

// Clique na notificação abre ou foca no app mobile
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/mobile.html');
      }
    })
  );
});
