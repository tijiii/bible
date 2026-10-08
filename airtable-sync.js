// ── SYNCHRONISATION AIRTABLE ──────────────────────────────────────────────────
// Toute la base (talents, clubs, agences, marques, catégories, sports) est
// stockée dans UN SEUL enregistrement Airtable, colonne "value", sous forme
// de texte JSON. Ce fichier gère la lecture et l'écriture de cet enregistrement.

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

let airtableRecordId = null;   // id de la ligne "db" une fois trouvée
let isSyncing = false;
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

// Récupère l'enregistrement "db" depuis Airtable
async function fetchRemoteDb() {
  const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent("{key}='db'")}`;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN }
  });
  if (!res.ok) throw new Error('Airtable fetch failed: ' + res.status);
  const data = await res.json();
  if (!data.records || data.records.length === 0) {
    throw new Error('Aucune ligne avec key="db" trouvée dans la table Airtable.');
  }
  const record = data.records[0];
  airtableRecordId = record.id;
  const raw = record.fields.value;
  return raw ? JSON.parse(raw) : null;
}

// Écrit la base complète dans Airtable
async function pushRemoteDb(dbObj) {
  if (!airtableRecordId) {
    // Sécurité : si on n'a pas encore l'id, on tente de le récupérer
    await fetchRemoteDb().catch(() => {});
    if (!airtableRecordId) throw new Error('Impossible de localiser la ligne Airtable.');
  }
  const json = JSON.stringify(dbObj);
  const res = await fetch(`${AIRTABLE_API_URL}/${airtableRecordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + AIRTABLE_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: { value: json } })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Airtable write failed: ' + res.status + ' ' + (err?.error?.message || ''));
  }
  lastRemoteJson = json;
}

// ── INITIALISATION AU CHARGEMENT ─────────────────────────────────────────────
async function initRemoteSync() {
  setSyncStatus('syncing');
  try {
    const remote = await fetchRemoteDb();
    if (remote) {
      db = remote;
      lastRemoteJson = JSON.stringify(remote);
    } else {
      // Première utilisation : la ligne existe mais est vide -> on y met les données initiales
      await pushRemoteDb(db);
    }
    setSyncStatus('ok');
    initSharedPhotos(); // photos importées, partagées avec l'équipe
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    alert("Impossible de se connecter à la base partagée. Vérifie ta connexion internet ou la configuration Airtable.\n\n" + e.message);
  }
  buildTabs();
  render();
  startPolling();
}

// ── POLLING (récupère les changements des autres membres) ───────────────────
function startPolling() {
  setInterval(async () => {
    // Ne pas écraser les données si un formulaire est ouvert (édition en cours)
    const formOpen   = document.getElementById('form-modal').style.display === 'flex';
    const detailOpen = document.getElementById('detail-modal').style.display === 'flex';
    if (formOpen || detailOpen) return;

    try {
      const remote = await fetchRemoteDb();
      const remoteJson = JSON.stringify(remote);
      if (remote && remoteJson !== lastRemoteJson) {
        db = remote;
        lastRemoteJson = remoteJson;
        buildTabs();
        render();
      }
      setSyncStatus('ok');
    } catch (e) {
      setSyncStatus('error');
    }
  }, SYNC_POLL_INTERVAL);

  // Resynchronise aussi quand on revient sur l'onglet
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      try {
        const remote = await fetchRemoteDb();
        const remoteJson = JSON.stringify(remote);
        if (remote && remoteJson !== lastRemoteJson) {
          db = remote;
          lastRemoteJson = remoteJson;
          buildTabs();
          render();
        }
        setSyncStatus('ok');
      } catch (e) { setSyncStatus('error'); }
    }
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

// ── PHOTOS PARTAGÉES (importées depuis un appareil) ─────────────────────────
// Chaque photo importée depuis un ordinateur/téléphone est envoyée dans la
// même table Airtable : une ligne par talent, key = "photo:<id du talent>",
// le fichier est stocké dans la colonne "Attachments". Comme ça, tout le monde
// la voit. Les liens Airtable expirent au bout de ~2h : on les rafraîchit
// régulièrement.

const AIRTABLE_CONTENT_URL  = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const PHOTO_ATTACHMENT_FIELD = 'Attachments';
const PHOTO_REFRESH_INTERVAL = 20 * 60 * 1000;

let sharedPhotos = {};      // talentId -> url de l'image
let photoRecordIds = {};    // talentId -> id de la ligne Airtable "photo:..."

function photoKey(talentId) { return 'photo:' + talentId; }

function getSharedPhotoFor(talentId) {
  return sharedPhotos[talentId] || null;
}

// Récupère toutes les lignes "photo:..." (avec pagination)
async function fetchSharedPhotos() {
  const nextPhotos = {};
  const nextIds = {};
  let offset = null;
  do {
    const params = new URLSearchParams();
    params.set('filterByFormula', "LEFT({key},6)='photo:'");
    params.append('fields[]', 'key');
    params.append('fields[]', PHOTO_ATTACHMENT_FIELD);
    if (offset) params.set('offset', offset);
    const res = await fetch(`${AIRTABLE_API_URL}?${params}`, {
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN }
    });
    if (!res.ok) throw new Error('Airtable photos fetch failed: ' + res.status);
    const data = await res.json();
    for (const rec of data.records || []) {
      const talentId = String(rec.fields.key || '').slice(6);
      if (!talentId) continue;
      nextIds[talentId] = rec.id;
      const files = rec.fields[PHOTO_ATTACHMENT_FIELD] || [];
      const last = files[files.length - 1];
      if (last) nextPhotos[talentId] = last.thumbnails?.large?.url || last.url;
    }
    offset = data.offset;
  } while (offset);
  sharedPhotos = nextPhotos;
  photoRecordIds = nextIds;
}

async function refreshSharedPhotos() {
  try {
    const before = JSON.stringify(Object.keys(sharedPhotos).sort());
    await fetchSharedPhotos();
    const after = JSON.stringify(Object.keys(sharedPhotos).sort());
    // On ne redessine que si une photo est apparue/disparue, pour ne pas
    // fermer un formulaire en cours ni faire clignoter les images.
    const formOpen = document.getElementById('form-modal').style.display === 'flex';
    if (before !== after && !formOpen) render();
  } catch (e) { console.error(e); }
}

async function airtableJson(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + AIRTABLE_TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Airtable ' + res.status + ' ' + (err?.error?.message || ''));
  }
  return res.json();
}

// Envoie une photo (dataURL base64 JPEG) et l'associe au talent.
// Remplace la photo précédente s'il y en avait une.
async function uploadSharedPhoto(talentId, dataUrl) {
  const key = photoKey(talentId);
  let recordId = photoRecordIds[talentId];
  if (recordId) {
    // Vide l'ancienne photo
    await airtableJson(`${AIRTABLE_API_URL}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { [PHOTO_ATTACHMENT_FIELD]: [] } })
    });
  } else {
    const created = await airtableJson(AIRTABLE_API_URL, {
      method: 'POST',
      body: JSON.stringify({ fields: { key } })
    });
    recordId = created.id;
    photoRecordIds[talentId] = recordId;
  }

  const [meta, base64] = dataUrl.split(',');
  const contentType = (meta.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
  const ext = contentType.split('/')[1] || 'jpg';
  const uploaded = await airtableJson(
    `${AIRTABLE_CONTENT_URL}/${recordId}/${encodeURIComponent(PHOTO_ATTACHMENT_FIELD)}/uploadAttachment`,
    {
      method: 'POST',
      body: JSON.stringify({ contentType, file: base64, filename: `talent-${talentId}.${ext}` })
    }
  );
  const files = uploaded?.fields?.[PHOTO_ATTACHMENT_FIELD] || [];
  const last = files[files.length - 1];
  // En attendant que l'URL Airtable soit prête, on affiche la version locale
  sharedPhotos[talentId] = (last && (last.thumbnails?.large?.url || last.url)) || dataUrl;
}

async function deleteSharedPhoto(talentId) {
  const recordId = photoRecordIds[talentId];
  delete sharedPhotos[talentId];
  delete photoRecordIds[talentId];
  if (!recordId) return;
  try {
    await airtableJson(`${AIRTABLE_API_URL}/${recordId}`, { method: 'DELETE' });
  } catch (e) { console.error(e); }
}

// Les photos importées AVANT cette mise à jour étaient restées sur l'appareil.
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
  await Promise.all([refreshSharedPhotos(), refreshLieuPhotos()]);
  await migrateLocalPhotos();
  setInterval(() => { refreshSharedPhotos(); refreshLieuPhotos(); }, PHOTO_REFRESH_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refreshSharedPhotos(); refreshLieuPhotos(); }
  });
}

// ── PHOTOS DES LIEUX (scouting) ─────────────────────────────────────────────
// Même principe que pour les talents, mais plusieurs photos par lieu : une
// ligne par lieu, key = "lieu:<id du lieu>", toutes ses photos dans la
// colonne "Attachments".

let lieuPhotos = {};      // lieuId -> [{ id, url, full }]
let lieuRecordIds = {};   // lieuId -> id de la ligne Airtable "lieu:..."

function lieuKey(lieuId) { return 'lieu:' + lieuId; }

function getLieuPhotos(lieuId) {
  return lieuPhotos[lieuId] || [];
}

function toLieuPhoto(file) {
  return { id: file.id, url: file.thumbnails?.large?.url || file.url, full: file.url };
}

// Récupère toutes les lignes "lieu:..." (avec pagination)
async function fetchLieuPhotos() {
  const nextPhotos = {};
  const nextIds = {};
  let offset = null;
  do {
    const params = new URLSearchParams();
    params.set('filterByFormula', "LEFT({key},5)='lieu:'");
    params.append('fields[]', 'key');
    params.append('fields[]', PHOTO_ATTACHMENT_FIELD);
    if (offset) params.set('offset', offset);
    const res = await fetch(`${AIRTABLE_API_URL}?${params}`, {
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN }
    });
    if (!res.ok) throw new Error('Airtable lieux fetch failed: ' + res.status);
    const data = await res.json();
    for (const rec of data.records || []) {
      const lieuId = String(rec.fields.key || '').slice(5);
      if (!lieuId) continue;
      nextIds[lieuId] = rec.id;
      nextPhotos[lieuId] = (rec.fields[PHOTO_ATTACHMENT_FIELD] || []).map(toLieuPhoto);
    }
    offset = data.offset;
  } while (offset);
  lieuPhotos = nextPhotos;
  lieuRecordIds = nextIds;
}

function lieuPhotosSignature() {
  return JSON.stringify(Object.keys(lieuPhotos).sort().map(k => [k, lieuPhotos[k].map(p => p.id)]));
}

async function refreshLieuPhotos() {
  try {
    const before = lieuPhotosSignature();
    await fetchLieuPhotos();
    const formOpen = document.getElementById('form-modal').style.display === 'flex';
    if (before !== lieuPhotosSignature() && !formOpen) render();
  } catch (e) { console.error(e); }
}

async function ensureLieuRecord(lieuId) {
  if (lieuRecordIds[lieuId]) return lieuRecordIds[lieuId];
  const created = await airtableJson(AIRTABLE_API_URL, {
    method: 'POST',
    body: JSON.stringify({ fields: { key: lieuKey(lieuId) } })
  });
  lieuRecordIds[lieuId] = created.id;
  return created.id;
}

// Ajoute une photo (dataURL base64 JPEG) aux photos du lieu
async function addLieuPhoto(lieuId, dataUrl) {
  const recordId = await ensureLieuRecord(lieuId);
  const [meta, base64] = dataUrl.split(',');
  const contentType = (meta.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
  const ext = contentType.split('/')[1] || 'jpg';
  const uploaded = await airtableJson(
    `${AIRTABLE_CONTENT_URL}/${recordId}/${encodeURIComponent(PHOTO_ATTACHMENT_FIELD)}/uploadAttachment`,
    {
      method: 'POST',
      body: JSON.stringify({ contentType, file: base64, filename: `lieu-${lieuId}-${Date.now()}.${ext}` })
    }
  );
  const files = uploaded?.fields?.[PHOTO_ATTACHMENT_FIELD];
  if (files) lieuPhotos[lieuId] = files.map(toLieuPhoto);
}

// Retire certaines photos du lieu (ids des pièces jointes Airtable)
async function removeLieuPhotos(lieuId, attachmentIds) {
  const recordId = lieuRecordIds[lieuId];
  if (!recordId || !attachmentIds.length) return;
  const remaining = getLieuPhotos(lieuId).filter(p => !attachmentIds.includes(p.id));
  await airtableJson(`${AIRTABLE_API_URL}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { [PHOTO_ATTACHMENT_FIELD]: remaining.map(p => ({ id: p.id })) } })
  });
  lieuPhotos[lieuId] = remaining;
}

async function deleteAllLieuPhotos(lieuId) {
  const recordId = lieuRecordIds[lieuId];
  delete lieuPhotos[lieuId];
  delete lieuRecordIds[lieuId];
  if (!recordId) return;
  try {
    await airtableJson(`${AIRTABLE_API_URL}/${recordId}`, { method: 'DELETE' });
  } catch (e) { console.error(e); }
}
