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

// ── CODE DE L'ÉQUIPE ─────────────────────────────────────────────────────────
// Le serveur ne répond qu'avec le code de l'équipe (secret TEAM_CODE du serveur).
// Il est demandé une fois, puis gardé sur l'appareil.
const TEAM_CODE_KEY = 'teamCode';
function teamCode() { try { return localStorage.getItem(TEAM_CODE_KEY) || ''; } catch (e) { return ''; } }

// ── COMPTES ──────────────────────────────────────────────────────────────────
// Dès que l'équipe a des comptes (nom + mot de passe, gardés par le serveur),
// il faut se connecter : le serveur donne un jeton, gardé sur l'appareil.
const SESSION_KEY = 'session';
function sessionJeton() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } }
function sessionCompte() {
  try { return sessionJeton() ? JSON.parse(localStorage.getItem('compte') || 'null') : null; } catch (e) { return null; }
}
function sessionGarder(jeton, compte) {
  try {
    localStorage.setItem(SESSION_KEY, jeton);
    if (compte) localStorage.setItem('compte', JSON.stringify({ id: compte.id, nom: compte.nom }));
    if (compte) localStorage.setItem('moi', compte.nom);
  } catch (e) {}
}
function sessionOublier() {
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem('compte'); localStorage.removeItem('moi'); } catch (e) {}
}

// Les comptes de l'équipe (null tant qu'on ne sait pas ; [] = pas encore de comptes)
let comptesEquipe = null;
try { comptesEquipe = JSON.parse(localStorage.getItem('comptesEquipe') || 'null'); } catch (e) {}
function comptesActifs() { return Array.isArray(comptesEquipe) && comptesEquipe.length > 0; }
function comptesRetenir(liste) {
  comptesEquipe = Array.isArray(liste) ? liste : [];
  try { localStorage.setItem('comptesEquipe', JSON.stringify(comptesEquipe)); } catch (e) {}
}
async function chargerComptes() {
  try {
    const res = await fetch(SERVER_URL + '/auth/comptes');
    if (res.status === 404) { comptesRetenir([]); return; } // serveur pas encore à jour
    if (res.ok) comptesRetenir((await res.json()).comptes);
  } catch (e) { /* hors ligne : on garde la liste connue */ }
}

// Demande au serveur des comptes (connexion, création…), avec le jeton et le code
async function authFetch(path, options = {}) {
  const res = await fetch(SERVER_URL + '/auth' + path, { ...options, headers: { ...enTetesAcces(), 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const corps = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(corps.error || ('Serveur ' + res.status)); e.status = res.status; throw e; }
  return corps;
}

function enTetesAcces() {
  const h = {};
  const code = teamCode(), jeton = sessionJeton();
  if (code) h['X-Team-Code'] = code;
  if (jeton) h['X-Session'] = jeton;
  return h;
}

// Toutes les demandes au serveur Cloudflare passent par ici
async function serverFetch(url, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}), ...enTetesAcces() } };
  const res = await fetch(url, opts);
  if (res.status === 401) {
    const corps = await res.clone().json().catch(() => ({}));
    if (corps.login) { if (sessionJeton()) sessionOublier(); demanderConnexion(); }
    else demanderCodeEquipe(!!teamCode());
  }
  return res;
}

// Les images s'affichent dans des <img> : le code et le jeton vont dans l'adresse
function avecCodeImage(url) {
  const code = teamCode(), jeton = sessionJeton();
  const q = [code && 'k=' + encodeURIComponent(code), jeton && 's=' + encodeURIComponent(jeton)].filter(Boolean);
  return q.length ? url + (url.includes('?') ? '&' : '?') + q.join('&') : url;
}

// Écran de connexion : choisir son nom, taper son mot de passe
async function demanderConnexion() {
  if (document.getElementById('connexion-bg')) return;
  setSyncStatus('error');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'connexion-bg';
  bg.style.display = 'flex';
  document.body.appendChild(bg);
  await chargerComptes();
  const noms = (comptesEquipe || []).map(c => c.nom);
  let dernier = '';
  try { dernier = localStorage.getItem('dernierCompte') || ''; } catch (e) {}
  bg.innerHTML = `<div class="modal team-code-modal">
    <div class="modal-hdr"><span class="modal-title">CONNEXION</span></div>
    <div class="modal-body">
      <p class="field-hint">La bible est réservée à l'équipe Widen. Connecte-toi une fois : tu restes connecté sur cet appareil.</p>
      <div class="field full"><label>Qui es-tu ?</label>
        <select id="cx-nom">${noms.length ? '' : '<option value="">(aucun compte)</option>'}${noms.map(n => `<option${n === dernier ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="field full"><label>Mot de passe</label><input id="cx-mdp" type="password" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')validerConnexion()"></div>
      <p class="field-hint td-mdp-msg" id="cx-msg"></p>
      <p class="field-hint">Pas encore de compte, ou mot de passe oublié : demande à quelqu'un de l'équipe (menu sous son nom → COMPTES DE L'ÉQUIPE).</p>
    </div>
    <div class="modal-footer"><div class="spacer"></div><button class="btn-save" id="cx-ok" onclick="validerConnexion()">SE CONNECTER</button></div>
  </div>`;
  setTimeout(() => { const i = document.getElementById('cx-mdp'); if (i) i.focus(); }, 0);
}

async function validerConnexion() {
  const nom = (document.getElementById('cx-nom') || {}).value || '';
  const mdp = (document.getElementById('cx-mdp') || {}).value || '';
  const msg = document.getElementById('cx-msg');
  const b = document.getElementById('cx-ok');
  if (!nom || !mdp) { if (msg) msg.textContent = 'Choisis ton nom et tape ton mot de passe.'; return; }
  if (b) b.disabled = true;
  try {
    const r = await authFetch('/connexion', { method: 'POST', body: JSON.stringify({ nom, mdp }) });
    sessionGarder(r.jeton, r);
    try { localStorage.setItem('dernierCompte', r.nom); } catch (e) {}
    location.reload();
  } catch (e) {
    if (msg) msg.textContent = e.message;
    const i = document.getElementById('cx-mdp');
    if (i) { i.value = ''; i.focus(); }
    if (b) b.disabled = false;
  }
}

function seDeconnecter() {
  sessionOublier();
  location.reload();
}

function demanderCodeEquipe(refuse) {
  if (document.getElementById('team-code-bg')) return;
  setSyncStatus('error');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'team-code-bg';
  bg.style.display = 'flex';
  bg.innerHTML = `<div class="modal team-code-modal">
    <div class="modal-hdr"><span class="modal-title">CODE DE L'ÉQUIPE</span></div>
    <div class="modal-body">
      <p class="field-hint">${refuse ? 'Ce code n\'est pas le bon. ' : ''}La bible est réservée à l'équipe Widen. Entre le code une fois : il reste gardé sur cet appareil.</p>
      <div class="field full"><input id="team-code-input" type="password" autocomplete="current-password" placeholder="Code de l'équipe"
        onkeydown="if(event.key==='Enter')validerCodeEquipe()"></div>
    </div>
    <div class="modal-footer"><div class="spacer"></div><button class="btn-save" onclick="validerCodeEquipe()">ENTRER</button></div>
  </div>`;
  document.body.appendChild(bg);
  setTimeout(() => { const i = document.getElementById('team-code-input'); if (i) i.focus(); }, 0);
}

function validerCodeEquipe() {
  const v = (document.getElementById('team-code-input') || {}).value?.trim();
  if (!v) return;
  try { localStorage.setItem(TEAM_CODE_KEY, v); } catch (e) {}
  location.reload();
}

async function storeFetch(path, options = {}) {
  const res = await serverFetch(STORE_URL + path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error('Serveur ' + res.status + ' ' + (err?.error || ''));
    if (res.status === 401) { if (err && err.login) e.login = true; else e.team = true; }
    throw e;
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
  await chargerComptes();
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
    if (!e.team && !e.login) alert("Impossible de se connecter à la base partagée. Vérifie ta connexion internet.\n\n" + e.message);
  }
  buildTabs();
  render();
  startPolling();
  if (typeof tdAccueil === 'function') tdAccueil();   // qui est sur cet appareil, et ses rappels
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
      const pdtOuvert = document.querySelector('.pdt-editor') ? pdtCur() : null;
      const tsOuverte = !pdtOuvert && document.querySelector('.ts-editor') ? tsCur() : null;
      // Pareil pour un projet en cours de modification (onglet Suivi production)
      const pjGarde = !tsOuverte && !pdtOuvert && typeof pjEnEdition === 'function' && pjEnEdition();
      const pjOuvert = pjGarde ? pjAGarder() : null;
      db = remote;
      lastRemoteJson = remoteJson;
      try { localStorage.setItem(STORAGE_KEY, remoteJson); } catch (e) {}
      if (pdtOuvert) pdtReprendre(pdtOuvert);
      else if (tsOuverte) tsReprendre(tsOuverte);
      else if (pjGarde) { if (pjOuvert) pjReprendre(pjOuvert); }
      else { buildTabs(); render(); }
    }
    setSyncStatus('ok');
    if (typeof pdtSemer === 'function') pdtSemer();
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
    if (!e.team && !e.login) alert("La sauvegarde en ligne a échoué. Tes changements restent sur cet appareil mais ne sont pas encore partagés avec l'équipe.\n\n" + e.message);
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
  return avecCodeImage(`${STORE_URL}/img/t/${encodeURIComponent(talentId)}?v=${v}`);
}

function lieuPhoto(lieuId, photoId) {
  const url = avecCodeImage(`${STORE_URL}/img/l/${encodeURIComponent(lieuId)}/${encodeURIComponent(photoId)}`);
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
