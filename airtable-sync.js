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
