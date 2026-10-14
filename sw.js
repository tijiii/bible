// Service worker de l'app téléphone. Il ne garde que les fichiers du site
// (pas la base ni les photos, qui viennent du serveur Cloudflare) :
// on prend toujours la version en ligne, et la copie sert seulement hors réseau.
const CACHE = 'bible-app-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // « no-cache » : on redemande toujours au serveur s'il y a du nouveau (réponse
  // courte s'il n'y a rien), sinon le navigateur garde l'ancienne version ~10 min.
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
