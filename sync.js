// ── SYNCHRONISATION ──────────────────────────────────────────────────────────
// Toute la base (talents, clubs, agences, marques, catégories, sports, lieux)
// est un seul JSON gardé par le serveur Cloudflare (dossier worker/, STORE_URL).
// Ce fichier gère sa lecture et son écriture, et les photos importées.

let remoteReady = false;       // la base distante est chargée (ou vient d'être créée)
let lastRemoteJson = null;     // pour détecter les changements des autres

function setSyncStatus(state) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    ok:      { text: '● SYNCHRONISÉ',     color: 'var(--accent)' },
    syncing: { text: '↻ SYNCHRONISATION...', color: 'var(--muted)' },
    error:   { text: '⚠ HORS LIGNE',      color: 'var(--red)' },
  };
  const s = map[state] || map.error;
  el.textContent = s.text;
  el.style.color = s.color;
}

async function storeFetch(path, options = {}) {
  const res = await fetch(STORE_URL + path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Serveur ' + res.status + ' ' + (err?.error || ''));
  }
  return res.json();
}

// Récupère la base (null si le serveur n'a encore rien)
async function fetchRemoteDb() {
  return storeFetch('/db');
}

// Écrit la base complète
async function pushRemoteDb(dbObj) {
  if (!remoteReady) throw new Error('La base partagée n\'est pas encore chargée.');
  const json = JSON.stringify(dbObj);
  await storeFetch('/db', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json });
  lastRemoteJson = json;
}

function hasLocalCache() {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
}

// ── INITIALISATION AU CHARGEMENT ─────────────────────────────────────────────
async function initRemoteSync() {
  setSyncStatus('syncing');
  try {
    const remote = await fetchRemoteDb();
    if (remote) {
      db = remote;
      lastRemoteJson = JSON.stringify(remote);
      try { localStorage.setItem(STORAGE_KEY, lastRemoteJson); } catch (e) {}
      remoteReady = true;
    } else if (hasLocalCache()) {
      // Base distante vide (premier passage après le départ d'Airtable) :
      // on y met la copie gardée sur cet appareil.
      remoteReady = true;
      await pushRemoteDb(db);
    } else {
      throw new Error('La base partagée est vide et cet appareil n\'en a pas de copie.');
    }
    setSyncStatus('ok');
    initSharedPhotos(); // photos importées, partagées avec l'équipe
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    alert("Impossible de se connecter à la base partagée. Vérifie ta connexion internet.\n\n" + e.message);
  }
  buildTabs();
  render();
  startPolling();
}

// ── POLLING (récupère les changements des autres membres) ───────────────────
async function pullRemoteDb() {
  // Ne pas écraser les données si un formulaire est ouvert (édition en cours)
  const formOpen   = document.getElementById('form-modal').style.display === 'flex';
  const detailOpen = document.getElementById('detail-modal').style.display === 'flex';
  if (formOpen || detailOpen) return;
  try {
    const remote = await fetchRemoteDb();
    if (!remote) return;
    if (!remoteReady) { remoteReady = true; initSharedPhotos(); }
    const remoteJson = JSON.stringify(remote);
    if (remoteJson !== lastRemoteJson) {
      // Travel sheet ouverte : on prend les changements des autres sans toucher
      // à la feuille en cours ni redessiner l'écran
      const tsOuverte = document.querySelector('.ts-editor') ? tsCur() : null;
      db = remote;
      lastRemoteJson = remoteJson;
      try { localStorage.setItem(STORAGE_KEY, remoteJson); } catch (e) {}
      if (tsOuverte) tsReprendre(tsOuverte);
      else { buildTabs(); render(); }
    }
    setSyncStatus('ok');
  } catch (e) {
    setSyncStatus('error');
  }
}

function startPolling() {
  setInterval(() => {
    if (document.visibilityState === 'visible') pullRemoteDb();
  }, SYNC_POLL_INTERVAL);
  // Resynchronise aussi quand on revient sur l'onglet
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pullRemoteDb();
  });
}

// ── SAUVEGARDE (appelée à chaque ajout/édition/suppression) ──────────────────
async function saveDbRemote() {
  setSyncStatus('syncing');
  try {
    await pushRemoteDb(db);
    setSyncStatus('ok');
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    alert("La sauvegarde en ligne a échoué. Tes changements restent sur cet appareil mais ne sont pas encore partagés avec l'équipe.\n\n" + e.message);
  }
}

// ── PHOTOS IMPORTÉES ─────────────────────────────────────────────────────────
// Le serveur garde une photo par talent et plusieurs par lieu, avec un index
// commun (GET /photos) qu'on relit de temps en temps.

const PHOTO_REFRESH_INTERVAL = 5 * 60 * 1000;

let sharedPhotos = {};   // talentId -> url de l'image
let lieuPhotos = {};     // lieuId -> [{ id, url, full, kind, date }]
let photoDates = {};     // photoId -> date de prise de vue (AAAA-MM-JJ)
let photosInitDone = false;

function talentPhotoUrl(talentId, v) {
  return `${STORE_URL}/img/t/${encodeURIComponent(talentId)}?v=${v}`;
}

function lieuPhoto(lieuId, photoId) {
  const url = `${STORE_URL}/img/l/${encodeURIComponent(lieuId)}/${encodeURIComponent(photoId)}`;
  // Les photos iPhone ont un identifiant qui commence par « ip » (voir worker/src/store.js)
  return { id: photoId, url, full: url, kind: String(photoId).startsWith('ip') ? 'iphone' : 'campagne', date: photoDates[photoId] || '' };
}

function getSharedPhotoFor(talentId) {
  return sharedPhotos[talentId] || null;
}

function getLieuPhotos(lieuId) {
  return lieuPhotos[lieuId] || [];
}

function applyPhotoIndex(idx) {
  const nextTalents = {};
  for (const [id, info] of Object.entries(idx.talents || {})) nextTalents[id] = talentPhotoUrl(id, info.v);
  photoDates = idx.dates || {};
  const nextLieux = {};
  for (const [id, ids] of Object.entries(idx.lieux || {})) nextLieux[id] = ids.map(p => lieuPhoto(id, p));
  sharedPhotos = nextTalents;
  lieuPhotos = nextLieux;
}

function photosSignature() {
  return JSON.stringify([sharedPhotos, Object.keys(lieuPhotos).sort().map(k => [k, lieuPhotos[k].map(p => p.id + p.date)])]);
}

async function refreshPhotos() {
  try {
    const before = photosSignature();
    applyPhotoIndex(await storeFetch('/photos'));
    // On ne redessine que si une photo a changé, pour ne pas fermer un
    // formulaire en cours ni faire clignoter les images.
    const formOpen = document.getElementById('form-modal').style.display === 'flex';
    if (before !== photosSignature() && !formOpen) render();
  } catch (e) { console.error(e); }
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const contentType = (meta.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

// Envoie une photo (dataURL base64 JPEG) et l'associe au talent.
// Remplace la photo précédente s'il y en avait une.
async function uploadSharedPhoto(talentId, dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const res = await storeFetch(`/photo/talent/${encodeURIComponent(talentId)}`, {
    method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob
  });
  sharedPhotos[talentId] = talentPhotoUrl(talentId, res.v);
}

async function deleteSharedPhoto(talentId) {
  if (!sharedPhotos[talentId]) return;
  delete sharedPhotos[talentId];
  try {
    await storeFetch(`/photo/talent/${encodeURIComponent(talentId)}`, { method: 'DELETE' });
  } catch (e) { console.error(e); }
}

// Les photos importées avant le partage étaient restées sur l'appareil.
// On les envoie automatiquement pour que l'équipe les voie aussi.
async function migrateLocalPhotos() {
  const local = getLocalPhotos();
  let changed = false;
  for (const talentId of Object.keys(local)) {
    const talent = db.talents.find(t => String(t.id) === talentId);
    if (!talent) { removeLocalPhoto(talentId); continue; }
    if (sharedPhotos[talentId] || talent.photo) { removeLocalPhoto(talentId); continue; }
    try {
      await uploadSharedPhoto(talentId, local[talentId]);
      removeLocalPhoto(talentId);
      changed = true;
    } catch (e) { console.error('Migration photo échouée pour', talentId, e); }
  }
  if (changed) render();
}

async function initSharedPhotos() {
  if (photosInitDone) return;
  photosInitDone = true;
  await refreshPhotos();
  await migrateLocalPhotos();
  setInterval(() => { if (document.visibilityState === 'visible') refreshPhotos(); }, PHOTO_REFRESH_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshPhotos();
  });
}

// ── PHOTOS DES LIEUX (scouting) ─────────────────────────────────────────────

// Ajoute une photo (dataURL base64 JPEG) aux photos du lieu
async function addLieuPhoto(lieuId, dataUrl, kind, date) {
  const blob = dataUrlToBlob(dataUrl);
  const qs = new URLSearchParams();
  if (kind === 'iphone') qs.set('kind', 'iphone');
  if (date) qs.set('date', date);
  const res = await storeFetch(`/photo/lieu/${encodeURIComponent(lieuId)}${qs.toString() ? '?' + qs : ''}`, {
    method: 'POST', headers: { 'Content-Type': blob.type }, body: blob
  });
  if (res.dates) photoDates = res.dates;
  lieuPhotos[lieuId] = res.photos.map(p => lieuPhoto(lieuId, p));
  return res.photos[res.photos.length - 1]; // id de la photo ajoutée (le serveur l'ajoute à la fin)
}

// Retire certaines photos du lieu
async function removeLieuPhotos(lieuId, photoIds) {
  let rest = getLieuPhotos(lieuId);
  for (const photoId of photoIds) {
    const res = await storeFetch(`/photo/lieu/${encodeURIComponent(lieuId)}/${encodeURIComponent(photoId)}`, { method: 'DELETE' });
    rest = res.photos.map(p => lieuPhoto(lieuId, p));
  }
  lieuPhotos[lieuId] = rest;
}

async function deleteAllLieuPhotos(lieuId) {
  if (!lieuPhotos[lieuId]) return;
  delete lieuPhotos[lieuId];
  try {
    await storeFetch(`/photo/lieu/${encodeURIComponent(lieuId)}`, { method: 'DELETE' });
  } catch (e) { console.error(e); }
}
