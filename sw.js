/* ────────────────────────────────────────────────────────────────────────
   Service Worker — Escola de Surf (site de reservas)
   Estratégia: NETWORK-FIRST. Online = sempre conteúdo fresco (evita o
   problema de cache "stale" que obrigava a Ctrl+Shift+R). A cache só é
   usada como fallback quando o utilizador está OFFLINE.
   ──────────────────────────────────────────────────────────────────────── */
const CACHE = 'surf-school-v1';

self.addEventListener('install', (e) => {
  // Ativar a nova versão imediatamente (sem esperar por fecho de tabs)
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Limpar caches antigas de versões anteriores
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Só tratamos pedidos GET. POST (Supabase insert, FormSubmit) passam direto.
  if (req.method !== 'GET') return;

  // NUNCA interceptar chamadas a APIs em tempo real (Supabase, meteo, fontes).
  // Estes precisam sempre de dados frescos / não devem ir para a cache.
  const url = new URL(req.url);
  const liveHosts = [
    'supabase.co', 'supabase.in', 'open-meteo.com',
    'formsubmit.co', 'fonts.googleapis.com',
  ];
  if (liveHosts.some(h => url.hostname.includes(h))) return;

  e.respondWith((async () => {
    try {
      // Network-first: tenta sempre a rede primeiro
      const fresh = await fetch(req);
      // Guarda cópia na cache (só para fallback offline)
      if (fresh && fresh.status === 200 && url.origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      // Offline → tenta servir da cache
      const cached = await caches.match(req);
      if (cached) return cached;
      // Última hipótese: a página principal em cache
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
      throw _;
    }
  })());
});
