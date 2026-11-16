// Service Worker do ManosTech System — Offline PWA Engine & Push Notifications
const CACHE_NAME = 'manostech-pwa-v2.4.9';
const ASSETS_STATICOS = [
  './',
  'mobile.html',
  'index.html',
  'browser-mock.js',
  'db.js',
  'manifest.webmanifest',
  'assets/manostech-icon.png',
  'assets/manostech-logo.png',
  'assets/fonts/baloo2.woff2',
  'assets/fonts/dmsans.woff2',
  'assets/som-venda-caixa.mp3',
  'assets/som-estoque-critico.mp3',
  'assets/som-venda-personalizado.mp3',
  'assets/som-venda-voz.mp3',
  'assets/jsQR.js'
];

// Instalação: Pré-armazena em cache o núcleo da aplicação
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_STATICOS).catch(err => {
        console.warn('[SW] Alguns assets secundários não foram pré-cacheados:', err);
      });
    })
  );
});

// Ativação: Limpa versões de cache antigas e assume controle imediato
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (chave !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', chave);
            return caches.delete(chave);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de Rede (Fetch): Suporte total para rodar com PC desligado ou sem internet
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Ignora requisições não-GET e esquemas não suportados
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 1. Requisições de Navegação (Abrir o App / Recarregar a página)
  // Se o computador estiver desligado ou sem internet, entrega o HTML do cache imediatamente!
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('mobile.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req).then(respostaRede => {
        if (respostaRede && respostaRede.status === 200) {
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return respostaRede;
      }).catch(async () => {
        // Fallback offline: busca no cache local
        const cache = await caches.open(CACHE_NAME);
        const respostaCache = await cache.match(req) || 
                              await cache.match('mobile.html') || 
                              await cache.match('index.html') || 
                              await cache.match('./');
        if (respostaCache) return respostaCache;
        return new Response('<h1>ManosTech System Offline</h1><p>Abra o aplicativo enquanto conectado para inicializar o cache.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })
    );
    return;
  }

  // 2. Requisições de APIs (/api/...)
  // Tenta rede com timeout. Se falhar, deixa falhar para que o browser-mock use a Nuvem Cloudflare ou localStorage
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Assets estáticos (Scripts, Estilos, Fontes, Imagens, Sons)
  // Estratégia Stale-While-Revalidate: Responde imediatamente do cache e atualiza em segundo plano
  e.respondWith(
    caches.match(req).then(respostaCache => {
      const buscaRede = fetch(req).then(respostaRede => {
        if (respostaRede && respostaRede.status === 200) {
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return respostaRede;
      }).catch(() => null);

      return respostaCache || buscaRede;
    })
  );
});

// Recebe ordens da aplicação para disparar notificações no sistema operacional / tela de bloqueio
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NOTIFICAR') {
    const { titulo, corpo, tag, icone, dados } = e.data;
    const opcoes = {
      body: corpo,
      icon: icone || 'assets/manostech-icon.png',
      badge: 'assets/manostech-icon.png',
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
        return clients.openWindow('mobile.html');
      }
    })
  );
});
