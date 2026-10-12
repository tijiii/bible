// ── CONFIGURATION ────────────────────────────────────────────────────────────
// Adresse du serveur Cloudflare (dossier worker/). Il fait l'ajout rapide et
// garde la base partagée de la bible et ses photos.
const SERVER_URL = 'https://bible-ajout-rapide.tom-9dd.workers.dev';
const STORE_URL = SERVER_URL + '/store';

// Bouton « ajout rapide ». Vide = bouton masqué.
const QUICK_ADD_URL = SERVER_URL;

// Intervalle de vérification des mises à jour des autres membres (ms).
// Seulement quand l'onglet est visible.
const SYNC_POLL_INTERVAL = 30000;
