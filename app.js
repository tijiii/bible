// ── STORAGE ───────────────────────────────────────────────────────────────────
// La base est stockée sur Airtable (partagée avec toute l'équipe).
// localStorage sert uniquement de cache pour afficher quelque chose instantanément
// avant que la synchronisation avec Airtable soit terminée.
const STORAGE_KEY = 'casting_bible_v2_cache';

function loadDb() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  return {
    talents:    JSON.parse(JSON.stringify(INITIAL_DATA.talents)),
    clubs:      JSON.parse(JSON.stringify(INITIAL_DATA.clubs)),
    marques:    JSON.parse(JSON.stringify(INITIAL_DATA.marques)),
    agences:    JSON.parse(JSON.stringify(INITIAL_DATA.agences)),
    sports:     JSON.parse(JSON.stringify(INITIAL_DATA.sports)),
    categories: JSON.parse(JSON.stringify(INITIAL_DATA.categories)),
  };
}

function saveDb() {
  // Cache local instantané
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch(e) {}
  // Puis on pousse vers Airtable pour que toute l'équipe voie le changement
  saveDbRemote();
}

let db = loadDb();

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function uid() { return Date.now() + Math.floor(Math.random()*9999); }
function initials(p, n) { return ((p||'')[0]||'').toUpperCase() + ((n||'')[0]||'').toUpperCase(); }
function g(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function catById(id) { return db.categories.find(c => c.id === id); }
function agenceNames() { return db.agences.map(a => a.nom).sort(); }

// ── PHOTOS LOCALES (non synchronisées, propres à cet appareil) ──────────────
const LOCAL_PHOTOS_KEY = 'casting_bible_local_photos';
let pendingLocalPhoto = null; // base64 en attente de sauvegarde lors du submit

function getLocalPhotos() {
  try { return JSON.parse(localStorage.getItem(LOCAL_PHOTOS_KEY) || '{}'); }
  catch(e) { return {}; }
}
function setLocalPhoto(talentId, base64) {
  const store = getLocalPhotos();
  store[talentId] = base64;
  try { localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(store)); } catch(e) {}
}
function getLocalPhotoFor(talentId) {
  return getLocalPhotos()[talentId] || null;
}
function photoFor(talent) {
  return normalizePhotoUrl(talent.photo) || getLocalPhotoFor(talent.id) || '';
}
function talentSports(t) {
  if (Array.isArray(t.sports)) return t.sports;
  if (t.sport) return [t.sport];
  return [];
}
function talentPays(t) {
  if (Array.isArray(t.pays)) return t.pays;
  return t.pays ? [t.pays] : [];
}
function talentVilles(t) {
  if (Array.isArray(t.ville)) return t.ville;
  return t.ville ? [t.ville] : [];
}
function talentAgences(t) {
  if (Array.isArray(t.agence)) return t.agence;
  return t.agence ? [t.agence] : [];
}

// talent section groups for tabs
function groupLabel(catId) {
  if (catId.startsWith('modele-f'))  return 'Modèles Femmes';
  if (catId.startsWith('modele-h'))  return 'Modèles Hommes';
  if (catId.startsWith('athlete-f')) return 'Athlètes Femmes';
  if (catId.startsWith('athlete-h')) return 'Athlètes Hommes';
  if (catId.startsWith('tech-'))     return 'Techniciens';
  return 'Autre';
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let curCatId   = null;  // current category tab (null = "Tous")
let searchQ    = '';
let fSport     = '';
let fSexe      = '';
let fPays      = '';
let fAgence    = '';
let detailType = null;
let detailId   = null;
let formCtx    = null;  // { type: 'talent'|'club'|'agence'|'marque', id }
let formSexe   = 'f';

// ── TABS BUILD ────────────────────────────────────────────────────────────────
function buildTabs() {
  const nav = document.getElementById('tabs-nav');

  // Group categories by "family"
  const families = [
    { key:'modele',  label:'MODÈLES',    cats: db.categories.filter(c => c.id.startsWith('modele-')) },
    { key:'athlete', label:'ATHLÈTES',   cats: db.categories.filter(c => c.id.startsWith('athlete-')) },
    { key:'tech',    label:'TECHNICIENS',cats: db.categories.filter(c => c.id.startsWith('tech-')) },
  ];
  // Custom categories (not in any family)
  const known = db.categories.filter(c => c.id.startsWith('modele-')||c.id.startsWith('athlete-')||c.id.startsWith('tech-'));
  const custom = db.categories.filter(c => !known.includes(c));

  let html = `<button class="tab${curCatId===null?' active':''}" data-group="talents" onclick="switchCat(null)">TOUS (${db.talents.length})</button>`;

  families.forEach(fam => {
    if (fam.cats.length === 0) return;
    const total = db.talents.filter(t => t.cats && t.cats.some(c => fam.cats.find(fc => fc.id===c))).length;
    html += `<button class="tab${curCatId===fam.key+'-group'?' active':''}" data-group="talents" onclick="switchCat('${fam.key}-group')">${fam.label} (${total})</button>`;
  });

  custom.forEach(cat => {
    const cnt = db.talents.filter(t => t.cats && t.cats.includes(cat.id)).length;
    html += `<button class="tab${curCatId===cat.id?' active':''}" data-group="talents" onclick="switchCat('${cat.id}')">${cat.label.toUpperCase()} (${cnt})</button>`;
  });

  html += `<button class="tab${curCatId==='clubs'?' active':''}" data-group="clubs" onclick="switchCat('clubs')">CLUBS (${db.clubs.length})</button>`;
  html += `<button class="tab${curCatId==='marques'?' active':''}" data-group="marques" onclick="switchCat('marques')">MARQUES · AGENCES</button>`;
  html += `<button class="tab${curCatId==='settings'?' active':''}" data-group="settings" onclick="switchCat('settings')">⚙ PARAMÈTRES</button>`;

  nav.innerHTML = html;
}

function switchCat(catId) {
  curCatId = catId;
  searchQ = ''; fSport = ''; fSexe = ''; fPays = ''; fAgence = '';
  buildTabs();
  render();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  updateCounts();
  const main = document.getElementById('main-content');

  if (curCatId === 'clubs')    { renderClubs(main); return; }
  if (curCatId === 'marques')  { renderMarques(main); return; }
  if (curCatId === 'settings') { renderSettings(main); return; }

  // Talents (all, group, or single category)
  renderTalents(main);
}

function updateCounts() {
  document.getElementById('total-count').textContent =
    db.talents.length + ' TALENTS · ' + db.clubs.length + ' CLUBS';
}

// ── TALENTS ───────────────────────────────────────────────────────────────────
function filterTalents() {
  return db.talents.filter(p => {
    // category filter
    if (curCatId && curCatId !== null) {
      if (!p.cats || p.cats.length === 0) return false;
      if (curCatId.endsWith('-group')) {
        const prefix = curCatId.replace('-group','');
        if (!p.cats.some(c => c.startsWith(prefix))) return false;
      } else {
        if (!p.cats.includes(curCatId)) return false;
      }
    }
    // search
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const match = [p.nom,p.prenom,talentSports(p).join(' '),talentAgences(p).join(' '),talentPays(p).join(' '),talentVilles(p).join(' '),p.insta,p.notes,
        (p.cats||[]).map(c => catById(c)?.label||'').join(' ')
      ].some(v => String(v||'').toLowerCase().includes(q));
      if (!match) return false;
    }
    if (fSport  && !talentSports(p).includes(fSport))  return false;
    if (fSexe   && p.sexe   !== fSexe)   return false;
    if (fPays   && !talentPays(p).includes(fPays))   return false;
    if (fAgence && !talentAgences(p).includes(fAgence)) return false;
    return true;
  });
}

function renderTalents(main) {
  const list = filterTalents();

  // Build filter options from current scope
  const scope = curCatId ? db.talents.filter(p => {
    if (!p.cats || p.cats.length === 0) return false;
    if (curCatId.endsWith('-group')) { const prefix = curCatId.replace('-group',''); return p.cats.some(c => c.startsWith(prefix)); }
    return p.cats.includes(curCatId);
  }) : db.talents;

  const sports  = [...new Set(scope.flatMap(p=>talentSports(p)).filter(Boolean))].sort();
  const pays    = [...new Set(scope.flatMap(p=>talentPays(p)).filter(Boolean))].sort();
  const agences = [...new Set(scope.flatMap(p=>talentAgences(p)).filter(a=>a&&a!=='—'&&a!==''))].sort();

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville, catégorie..." value="${esc(searchQ)}"
             oninput="searchQ=this.value;renderTalents(document.getElementById('main-content'))">
    </div>
    <select class="filter-sel" onchange="fSexe=this.value;renderTalents(document.getElementById('main-content'))">
      <option value="">SEXE</option>
      <option value="f"${fSexe==='f'?' selected':''}>FEMME</option>
      <option value="h"${fSexe==='h'?' selected':''}>HOMME</option>
    </select>
    <select class="filter-sel" onchange="fSport=this.value;renderTalents(document.getElementById('main-content'))">
      <option value="">SPORT</option>
      ${sports.map(s=>`<option value="${esc(s)}"${fSport===s?' selected':''}>${esc(s)}</option>`).join('')}
    </select>
    <select class="filter-sel" onchange="fPays=this.value;renderTalents(document.getElementById('main-content'))">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fPays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <select class="filter-sel" onchange="fAgence=this.value;renderTalents(document.getElementById('main-content'))">
      <option value="">AGENCE</option>
      ${agences.map(a=>`<option value="${esc(a)}"${fAgence===a?' selected':''}>${esc(a)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add" onclick="openForm('talent')">+ AJOUTER</button>
  </div>`;

  if (!list.length) {
    html += `<div class="empty">AUCUN PROFIL TROUVÉ</div>`;
  } else {
    html += `<div class="grid">`;
    list.forEach(p => {
      const ig = p.insta && p.insta.trim() !== '';
      const cats = (p.cats||[]).map(c => catById(c)).filter(Boolean);
      const displayPhoto = photoFor(p);
      const bgStyle = displayPhoto ? '' : `background:${getCatBg(p.cats||[])};`;

      html += `<div class="card" onclick="openDetail('talent',${p.id})">`;

      if (displayPhoto) {
        html += `<img class="card-img" src="${esc(displayPhoto)}" alt="${esc(p.nom)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="card-ph" style="${bgStyle}display:none">${initials(p.prenom,p.nom)}</div>`;
      } else {
        html += `<div class="card-ph" style="${bgStyle}">${initials(p.prenom,p.nom)}</div>`;
      }

      if (p.age) html += `<span class="card-age">${esc(String(p.age))} ans</span>`;

      if (cats.length) {
        html += `<div class="card-cats">`;
        cats.slice(0,3).forEach(c => {
          html += `<div class="cat-dot" style="background:${esc(c.color)}" title="${esc(c.label)}"></div>`;
        });
        html += `</div>`;
      }

      if (ig) html += `<div class="card-ig-hover">@${esc(p.insta)}</div>`;

      html += `<div class="card-body">
        <div class="card-name">${esc(p.nom)} <span class="card-prenom">${esc(p.prenom)}</span></div>
        <div class="card-meta">
          ${talentSports(p).map(s => `<span class="tag sport">${esc(s)}</span>`).join('')}
          ${talentAgences(p).map(a => `<span class="tag agence">${esc(a)}</span>`).join('')}
          ${talentPays(p).map(c => `<span class="tag">${FLAGS[c]||''} ${esc(c)}</span>`).join('')}
        </div>
      </div></div>`;
    });
    html += `</div>`;
  }
  main.innerHTML = html;
}

function getCatBg(cats) {
  // Pick a subtle bg tint based on first category
  const first = (cats||[]).map(c => catById(c)).find(Boolean);
  if (!first) return 'var(--bg3)';
  return first.color + '18';
}

// ── CLUBS ─────────────────────────────────────────────────────────────────────
function renderClubs(main) {
  const q  = searchQ;
  const fp = fPays;
  const list = db.clubs.filter(c => {
    if (q && !Object.values(c).some(v => String(v||'').toLowerCase().includes(q.toLowerCase()))) return false;
    if (fp && c.pays !== fp) return false;
    return true;
  });
  const pays = [...new Set(db.clubs.map(c=>c.pays).filter(Boolean))].sort();

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville..." value="${esc(q)}"
             oninput="searchQ=this.value;renderClubs(document.getElementById('main-content'))">
    </div>
    <select class="filter-sel" onchange="fPays=this.value;renderClubs(document.getElementById('main-content'))">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fp===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add" style="background:var(--accent3)" onclick="openForm('club')">+ AJOUTER</button>
  </div>
  <div class="clubs-grid">`;

  list.forEach(c => {
    html += `<div class="club-card" onclick="openDetail('club',${c.id})">
      <div class="club-dot"></div>
      <div class="club-name">${esc(c.nom)}</div>
      <div class="club-ville">${FLAGS[c.pays]||''} ${esc(c.ville)}</div>
      ${c.notes ? `<div style="font-size:11px;color:var(--accent3);margin-top:5px">${esc(c.notes)}</div>` : ''}
    </div>`;
  });
  html += `</div>`;
  main.innerHTML = html;
}

// ── MARQUES & AGENCES ────────────────────────────────────────────────────────
function renderMarques(main) {
  let html = `<div class="marques-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="sec-lbl" style="margin-bottom:0">MARQUES RUNNING (${db.marques.length})</div>
      <button class="btn-add" style="background:var(--accent4);font-size:10px;padding:5px 12px" onclick="openForm('marque')">+ AJOUTER</button>
    </div>
    <div class="tag-cloud">`;

  db.marques.forEach((m, i) => {
    const nom = typeof m === 'string' ? m : m.nom;
    const site = typeof m === 'string' ? '' : (m.site || '');
    html += `<span class="marque-tag" title="Cliquer pour éditer" onclick="editMarque(${i})">
      ${esc(nom)}${site ? ` <a href="${esc(site)}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent4);text-decoration:none">↗</a>` : ''}
    </span>`;
  });

  html += `</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="sec-lbl" style="margin-bottom:0">AGENCES (${db.agences.length})</div>
      <button class="btn-add" style="background:var(--accent4);font-size:10px;padding:5px 12px" onclick="openForm('agence')">+ AJOUTER</button>
    </div>`;

  db.agences.forEach(a => {
    html += `<div class="list-item">
      <span class="list-item-name">${esc(a.nom)}</span>
      <span class="list-item-sub">${FLAGS[a.pays]||''} ${esc(a.pays)} · ${esc(a.ville)}</span>
      ${a.mail ? `<a class="list-item-mail" href="mailto:${esc(a.mail)}">${esc(a.mail)}</a>` : ''}
      ${a.site ? `<a class="list-item-mail" href="${esc(a.site)}" target="_blank">🔗 Site</a>` : ''}
      <button class="btn-edit-inline" onclick="openForm('agence',${a.id})">ÉDITER</button>
      <button class="btn-del-inline" onclick="delAgence(${a.id})">✕</button>
    </div>`;
  });

  html += `</div>`;
  main.innerHTML = html;
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function renderSettings(main) {
  const techCats  = db.categories.filter(c => c.id.startsWith('tech-'));
  const modelCats = db.categories.filter(c => c.id.startsWith('modele-') || c.id.startsWith('athlete-'));
  const customCats = db.categories.filter(c =>
    !c.id.startsWith('tech-') && !c.id.startsWith('modele-') && !c.id.startsWith('athlete-')
  );

  function catList(cats) {
    return cats.map(c => `<div class="settings-item">
      <div class="dot" style="background:${esc(c.color)}"></div>
      <span>${esc(c.label)}</span>
      <button onclick="deleteCat('${esc(c.id)}')" title="Supprimer">✕</button>
    </div>`).join('');
  }

  let html = `<div class="settings-body">

    <div class="settings-section">
      <div class="settings-title">SPORTS / SPÉCIALITÉS (${db.sports.length})</div>
      <div class="settings-list">
        ${db.sports.map(s => `<div class="settings-item">
          <span>${esc(s)}</span>
          <button onclick="delSport('${esc(s)}')" title="Supprimer">✕</button>
        </div>`).join('')}
      </div>
      <div class="settings-add">
        <input id="new-sport" placeholder="Ex: Parkour..." onkeydown="if(event.key==='Enter')addSport()">
        <button onclick="addSport()">+ AJOUTER</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">CATÉGORIES MODÈLES / ATHLÈTES</div>
      <div class="settings-list">${catList(modelCats)}</div>
      <div class="settings-add">
        <input id="new-cat-model" placeholder="Ex: Athlète Non-Binaire...">
        <input type="color" id="new-cat-model-color" value="#c8f059" title="Couleur">
        <button onclick="addCat('model')">+ AJOUTER</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">CATÉGORIES TECHNICIENS</div>
      <div class="settings-list">${catList(techCats)}</div>
      <div class="settings-add">
        <input id="new-cat-tech" placeholder="Ex: Coloriste...">
        <input type="color" id="new-cat-tech-color" value="#f0a059" title="Couleur">
        <button onclick="addCat('tech')">+ AJOUTER</button>
      </div>
    </div>

    ${customCats.length ? `<div class="settings-section">
      <div class="settings-title">CATÉGORIES PERSONNALISÉES</div>
      <div class="settings-list">${catList(customCats)}</div>
    </div>` : ''}

    <div class="settings-section">
      <div class="settings-title">CATÉGORIE LIBRE (autre groupe)</div>
      <div class="settings-add">
        <input id="new-cat-custom" placeholder="Ex: Danseurs, Comédiens...">
        <input type="color" id="new-cat-custom-color" value="#59d4f0" title="Couleur">
        <button onclick="addCat('custom')">+ AJOUTER</button>
      </div>
    </div>

    <div class="settings-section" style="border-top:1px solid var(--border);padding-top:20px;margin-top:8px">
      <div class="settings-title" style="color:var(--red)">RÉINITIALISER</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Efface toutes les données et revient aux données initiales.</p>
      <button class="btn-del" onclick="resetAll()">RÉINITIALISER LA BASE</button>
    </div>
  </div>`;

  main.innerHTML = html;
}

// ── CATEGORIES CRUD ───────────────────────────────────────────────────────────
function addCat(type) {
  const inputMap = { model:'new-cat-model', tech:'new-cat-tech', custom:'new-cat-custom' };
  const colorMap = { model:'new-cat-model-color', tech:'new-cat-tech-color', custom:'new-cat-custom-color' };
  const prefixMap = { model:'modele-', tech:'tech-', custom:'custom-' };

  const label = document.getElementById(inputMap[type]).value.trim();
  if (!label) return;
  const color = document.getElementById(colorMap[type]).value;
  const prefix = prefixMap[type];
  const id = prefix + label.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now();

  db.categories.push({ id, label, color });
  saveDb();
  buildTabs();
  renderSettings(document.getElementById('main-content'));
}

function deleteCat(catId) {
  const cat = catById(catId);
  if (!cat) return;
  const used = db.talents.filter(t => t.cats && t.cats.includes(catId)).length;
  if (used && !confirm(`Cette catégorie est utilisée par ${used} profil(s). Supprimer quand même ?`)) return;
  db.categories = db.categories.filter(c => c.id !== catId);
  db.talents.forEach(t => { if (t.cats) t.cats = t.cats.filter(c => c !== catId); });
  saveDb();
  buildTabs();
  renderSettings(document.getElementById('main-content'));
}

function addSport() {
  const val = document.getElementById('new-sport').value.trim();
  if (!val || db.sports.includes(val)) return;
  db.sports.push(val);
  saveDb();
  renderSettings(document.getElementById('main-content'));
}

function delSport(val) {
  if (!confirm(`Supprimer le sport "${val}" ?`)) return;
  db.sports = db.sports.filter(s => s !== val);
  saveDb();
  renderSettings(document.getElementById('main-content'));
}

function resetAll() {
  if (!confirm('Effacer TOUTES les données (pour toute l\'équipe) et repartir des données initiales ?')) return;
  localStorage.removeItem(STORAGE_KEY);
  db = loadDb();
  saveDb();
  buildTabs();
  render();
}

// ── MARQUE INLINE EDIT ────────────────────────────────────────────────────────
function editMarque(idx) {
  openForm('marque', idx);
}

function delAgence(id) {
  if (!confirm('Supprimer cette agence ?')) return;
  db.agences = db.agences.filter(a => a.id !== id);
  saveDb();
  renderMarques(document.getElementById('main-content'));
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────────
function openDetail(type, pid) {
  detailType = type;
  detailId   = pid;
  const arr = type === 'talent' ? db.talents : db.clubs;
  const p   = arr.find(x => x.id === pid);
  if (!p) return;

  document.getElementById('detail-title').textContent = (p.nom||'') + (p.prenom ? ' ' + p.prenom : '');

  const ig = type === 'talent' && p.insta && p.insta.trim() !== '';
  const cats = type === 'talent' ? (p.cats||[]).map(c => catById(c)).filter(Boolean) : [];

  let body = '';
  if (type === 'talent') {
    const displayPhoto = photoFor(p);
    body = `<div class="detail-layout">
      <div class="detail-img">
        ${displayPhoto
          ? `<img src="${esc(displayPhoto)}" alt="${esc(p.nom)}"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="detail-ph" style="display:none">${initials(p.prenom,p.nom)}</div>`
          : `<div class="detail-ph">${initials(p.prenom,p.nom)}</div>`
        }
      </div>
      <div class="detail-info">
        <div class="detail-name">${esc(p.nom)}<br><span class="detail-prenom">${esc(p.prenom||'')}</span></div>
        <div class="detail-tags">
          ${p.age ? `<span class="tag">${esc(String(p.age))} ans</span>` : ''}
          ${p.sexe ? `<span class="tag" style="color:${p.sexe==='f'?'var(--accent)':'var(--accent2)'}">${p.sexe==='f'?'FEMME':'HOMME'}</span>` : ''}
          ${cats.map(c => `<span class="tag cat" style="color:${esc(c.color)};border-color:${esc(c.color)}44">${esc(c.label)}</span>`).join('')}
          ${talentSports(p).map(s => `<span class="tag sport">${esc(s)}</span>`).join('')}
        </div>
        ${talentAgences(p).length ? `<div class="detail-row"><span class="detail-lbl">AGENCE</span><span class="detail-val">${talentAgences(p).map(esc).join(', ')}</span></div>` : ''}
        <div class="detail-row"><span class="detail-lbl">PAYS</span><span class="detail-val">${talentPays(p).map(c => (FLAGS[c]||'')+' '+esc(c)).join(', ') || '—'}</span></div>
        <div class="detail-row"><span class="detail-lbl">VILLE</span><span class="detail-val">${talentVilles(p).map(esc).join(', ') || '—'}</span></div>
        <div class="detail-row"><span class="detail-lbl">TEL</span><span class="detail-val">${esc(p.tel||'—')}</span></div>
        <div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val">
          ${p.mail ? `<a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : '—'}
        </span></div>
        <div class="detail-row"><span class="detail-lbl">INSTAGRAM</span><span class="detail-val">
          ${ig ? `<a href="https://instagram.com/${esc(p.insta)}" target="_blank">@${esc(p.insta)}</a>` : '—'}
        </span></div>
        ${p.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val">${esc(p.notes)}</span></div>` : ''}
        ${ig ? `<a class="btn-ig" href="https://instagram.com/${esc(p.insta)}" target="_blank">INSTAGRAM ↗</a>` : ''}
      </div>
    </div>`;
  } else {
    body = `<div style="padding:20px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#fff;letter-spacing:.04em">${esc(p.nom)}</div>
      <div class="detail-tags" style="margin-top:8px">
        <span class="tag">${FLAGS[p.pays]||''} ${esc(p.pays||'')}</span>
        <span class="tag">${esc(p.ville||'')}</span>
      </div>
      ${p.mail ? `<div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val"><a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a></span></div>` : ''}
      ${p.lien ? `<div class="detail-row"><span class="detail-lbl">INSTAGRAM</span><span class="detail-val"><a href="https://instagram.com/${esc(p.lien)}" target="_blank" style="color:var(--accent2)">@${esc(p.lien)}</a></span></div>` : ''}
      ${p.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val">${esc(p.notes)}</span></div>` : ''}
    </div>`;
  }

  document.getElementById('detail-body').innerHTML = body;
  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetail() { document.getElementById('detail-modal').style.display = 'none'; }

function delFromDetail() {
  if (!confirm('Supprimer ce profil ?')) return;
  if (detailType === 'talent') db.talents = db.talents.filter(p => p.id !== detailId);
  else                         db.clubs   = db.clubs.filter(c => c.id !== detailId);
  saveDb();
  closeDetail();
  buildTabs();
  render();
}

function editFromDetail() {
  closeDetail();
  openForm(detailType, detailId);
}

// ── FORM MODAL ────────────────────────────────────────────────────────────────
function openForm(type, pid) {
  formCtx = { type, id: pid !== undefined ? pid : null };
  const isEdit = pid !== undefined && pid !== null;

  // show/hide delete button
  document.getElementById('form-btn-del').style.display = isEdit ? 'block' : 'none';

  if (type === 'talent') {
    const p = isEdit ? db.talents.find(x => x.id === pid) : {};
    formSexe = p?.sexe || 'f';
    pendingLocalPhoto = null; // reset à chaque ouverture
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER PROFIL' : '+ NOUVEAU TALENT';
    document.getElementById('btn-save').style.background = formSexe === 'f' ? 'var(--accent)' : 'var(--accent2)';
    renderTalentForm(p || {});
  } else if (type === 'club') {
    const c = isEdit ? db.clubs.find(x => x.id === pid) : {};
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER CLUB' : '+ NOUVEAU CLUB';
    document.getElementById('btn-save').style.background = 'var(--accent3)';
    renderClubForm(c || {});
  } else if (type === 'agence') {
    const a = isEdit ? db.agences.find(x => x.id === pid) : {};
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER AGENCE' : '+ NOUVELLE AGENCE';
    document.getElementById('btn-save').style.background = 'var(--accent4)';
    renderAgenceForm(a || {});
  } else if (type === 'marque') {
    // pid here is the array index
    const raw = isEdit ? db.marques[pid] : { nom:'', site:'' };
    const val = typeof raw === 'string' ? { nom: raw, site: '' } : raw;
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER MARQUE' : '+ NOUVELLE MARQUE';
    document.getElementById('btn-save').style.background = 'var(--accent4)';
    document.getElementById('form-body').innerHTML = `
      <div class="field full"><label>NOM DE LA MARQUE *</label>
        <input id="f-nom" value="${esc(val.nom||'')}">
      </div>
      <div class="field full"><label>SITE (URL)</label>
        <input id="f-site" value="${esc(val.site||'')}" placeholder="https://...">
      </div>`;
  }

  document.getElementById('form-modal').style.display = 'flex';
}

function selectSexe(s) {
  formSexe = s;
  ['f','h'].forEach(x => {
    document.getElementById('rb-'+x).className = 'radio-btn' + (x===s ? ' sel-'+x : '');
  });
  document.getElementById('btn-save').style.background = s==='f' ? 'var(--accent)' : 'var(--accent2)';
}

function renderTalentForm(v) {
  const selectedCats = v.cats || [];
  const selectedSports = talentSports(v);
  const selectedPays = talentPays(v);
  const selectedAgences = talentAgences(v);
  const villesText = talentVilles(v).join(', ');

  const sportsHtml = `<div class="cats-grid">` + db.sports.map(s => {
    const checked = selectedSports.includes(s) ? 'checked' : '';
    return `<label class="cat-check">
      <input type="checkbox" name="sport-check" value="${esc(s)}" ${checked}>
      <span>${esc(s)}</span>
    </label>`;
  }).join('') + `</div>`;

  const paysHtml = `<div class="cats-grid">` + COUNTRIES.map(c => {
    const checked = selectedPays.includes(c) ? 'checked' : '';
    return `<label class="cat-check">
      <input type="checkbox" name="pays-check" value="${esc(c)}" ${checked}>
      <span>${FLAGS[c]||''} ${esc(c)}</span>
    </label>`;
  }).join('') + `</div>`;

  const agencesHtml = `<div class="cats-grid">` + agenceNames().map(a => {
    const checked = selectedAgences.includes(a) ? 'checked' : '';
    return `<label class="cat-check">
      <input type="checkbox" name="agence-check" value="${esc(a)}" ${checked}>
      <span>${esc(a)}</span>
    </label>`;
  }).join('') + `</div>`;

  // Build multi-select checkboxes grouped
  const families = [
    { label: 'Modèles',    cats: db.categories.filter(c => c.id.startsWith('modele-')) },
    { label: 'Athlètes',   cats: db.categories.filter(c => c.id.startsWith('athlete-')) },
    { label: 'Techniciens',cats: db.categories.filter(c => c.id.startsWith('tech-')) },
    { label: 'Autres',     cats: db.categories.filter(c => !c.id.startsWith('modele-')&&!c.id.startsWith('athlete-')&&!c.id.startsWith('tech-')) },
  ].filter(f => f.cats.length > 0);

  let catsHtml = '';
  families.forEach(fam => {
    catsHtml += `<div style="margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:.12em;color:var(--muted);margin-bottom:6px">${fam.label.toUpperCase()}</div>
      <div class="cats-grid">`;
    fam.cats.forEach(cat => {
      const checked = selectedCats.includes(cat.id) ? 'checked' : '';
      catsHtml += `<label class="cat-check">
        <input type="checkbox" name="cat" value="${esc(cat.id)}" ${checked}>
        <span style="color:${esc(cat.color)}">${esc(cat.label)}</span>
      </label>`;
    });
    catsHtml += `</div></div>`;
  });

  document.getElementById('form-body').innerHTML = `
    <div class="field full">
      <label>SEXE</label>
      <div class="radio-group">
        <div class="radio-btn ${formSexe==='f'?'sel-f':''}" id="rb-f" onclick="selectSexe('f')">FEMME</div>
        <div class="radio-btn ${formSexe==='h'?'sel-h':''}" id="rb-h" onclick="selectSexe('h')">HOMME</div>
      </div>
    </div>
    <div class="field full">
      <label>CATÉGORIES (plusieurs possibles)</label>
      <div style="background:var(--bg3);border:1px solid var(--border);padding:12px;max-height:180px;overflow-y:auto">
        ${catsHtml}
      </div>
    </div>
    <div class="field"><label>NOM *</label><input id="f-nom" value="${esc(v.nom||'')}"></div>
    <div class="field"><label>PRÉNOM</label><input id="f-prenom" value="${esc(v.prenom||'')}"></div>
    <div class="field"><label>ÂGE</label><input id="f-age" type="number" min="16" max="80" value="${esc(String(v.age||''))}"></div>
    <div class="field full">
      <label>SPORT / SPÉCIALITÉ (plusieurs possibles)</label>
      <div style="background:var(--bg3);border:1px solid var(--border);padding:12px;max-height:160px;overflow-y:auto">
        ${sportsHtml}
      </div>
    </div>
    <div class="field full">
      <label>PAYS (plusieurs possibles)</label>
      <div style="background:var(--bg3);border:1px solid var(--border);padding:12px;max-height:160px;overflow-y:auto">
        ${paysHtml}
      </div>
    </div>
    <div class="field full">
      <label>VILLE(S) — séparées par une virgule</label>
      <input id="f-ville" value="${esc(villesText)}" placeholder="ex: Paris, Lyon">
    </div>
    <div class="field full">
      <label>AGENCE(S) (plusieurs possibles)</label>
      <div style="background:var(--bg3);border:1px solid var(--border);padding:12px;max-height:160px;overflow-y:auto">
        ${agencesHtml}
      </div>
    </div>
    <div class="field"><label>TEL</label><input id="f-tel" value="${esc(v.tel||'')}" placeholder="+33 6..."></div>
    <div class="field"><label>MAIL</label><input id="f-mail" type="email" value="${esc(v.mail||'')}"></div>
    <div class="field"><label>INSTAGRAM (handle sans @)</label><input id="f-insta" value="${esc(v.insta||'')}" placeholder="ex: monpseudo"></div>
    <div class="field full">
      <label>PHOTO — LIEN URL (recommandé, visible par toute l'équipe)</label>
      <input id="f-photo" value="${esc(v.photo||'')}" placeholder="https://... (Google Drive, Imgur, lien image direct)" oninput="previewPhoto(this.value)">
      <div class="photo-upload-row" style="margin-top:8px">
        <label class="btn-upload" for="f-photo-file">📷 OU importer depuis cet appareil</label>
        <input type="file" id="f-photo-file" accept="image/*" style="display:none" onchange="handlePhotoUpload(this)">
        <span id="photo-filename" class="photo-filename">${v.id && getLocalPhotoFor(v.id) && !v.photo ? '📎 photo locale déjà enregistrée' : ''}</span>
      </div>
      <div class="field-hint">💡 Colle directement un lien de partage Google Drive classique (celui du bouton "Partager") — il sera converti automatiquement. Vérifie juste que l'accès est sur "Tous les utilisateurs disposant du lien". ⚠ Une photo importée depuis l'appareil reste locale : elle ne sera pas visible par le reste de l'équipe.</div>
      <img id="photo-preview" class="photo-preview-img ${photoFor(v)?'show':''}" src="${esc(photoFor(v))}" alt="">
    </div>
    <div class="field full"><label>NOTES</label><input id="f-notes" value="${esc(v.notes||'')}"></div>`;
}

function renderClubForm(v) {
  const paysl   = COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  const curPays = v.pays || COUNTRIES[0];
  const villesl = (GEO[curPays]||['—']).map(x => `<option value="${esc(x)}"${(v.ville||'')===x?' selected':''}>${esc(x)}</option>`).join('');

  document.getElementById('form-body').innerHTML = `
    <div class="field"><label>NOM DU CLUB *</label><input id="f-nom" value="${esc(v.nom||'')}"></div>
    <div class="field"><label>MAIL</label><input id="f-mail" value="${esc(v.mail||'')}"></div>
    <div class="field"><label>PAYS</label>
      <select id="fc-pays" onchange="syncVillesClub()">${paysl}</select>
    </div>
    <div class="field"><label>VILLE</label><select id="fc-ville">${villesl}</select></div>
    <div class="field"><label>INSTAGRAM (handle sans @)</label><input id="f-lien" value="${esc(v.lien||'')}"></div>
    <div class="field full"><label>NOTES</label><input id="f-notes" value="${esc(v.notes||'')}"></div>`;
}

function renderAgenceForm(v) {
  const paysl   = COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  const curPays = v.pays || COUNTRIES[0];
  const villesl = (GEO[curPays]||['—']).map(x => `<option value="${esc(x)}"${(v.ville||'')===x?' selected':''}>${esc(x)}</option>`).join('');

  document.getElementById('form-body').innerHTML = `
    <div class="field"><label>NOM DE L'AGENCE *</label><input id="f-nom" value="${esc(v.nom||'')}"></div>
    <div class="field"><label>MAIL</label><input id="f-mail" type="email" value="${esc(v.mail||'')}"></div>
    <div class="field"><label>PAYS</label>
      <select id="fa-pays" onchange="syncVillesAgence()">${paysl}</select>
    </div>
    <div class="field"><label>VILLE</label><select id="fa-ville">${villesl}</select></div>
    <div class="field full"><label>SITE (URL)</label><input id="f-site" value="${esc(v.site||'')}" placeholder="https://..."></div>
    <div class="field full"><label>NOTES</label><input id="f-notes" value="${esc(v.notes||'')}"></div>`;
}

function syncVilles() {
  const pays = document.getElementById('f-pays')?.value;
  if (!pays) return;
  const villes = GEO[pays] || ['—'];
  document.getElementById('f-ville').innerHTML = villes.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
function syncVillesClub() {
  const pays = document.getElementById('fc-pays')?.value;
  if (!pays) return;
  document.getElementById('fc-ville').innerHTML = (GEO[pays]||['—']).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
function syncVillesAgence() {
  const pays = document.getElementById('fa-pays')?.value;
  if (!pays) return;
  document.getElementById('fa-ville').innerHTML = (GEO[pays]||['—']).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

// Convertit automatiquement un lien de partage Google Drive classique
// (drive.google.com/file/d/ID/view... ou open?id=ID) en lien d'image direct.
// Les autres URLs (Imgur, lien direct, etc.) sont laissées telles quelles.
function normalizePhotoUrl(url) {
  if (!url) return url;
  url = url.trim();
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  m = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  m = url.match(/drive\.google\.com\/uc\?.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  return url;
}

function previewPhoto(url) {
  const img = document.getElementById('photo-preview');
  if (!img) return;
  const clean = normalizePhotoUrl(url);
  if (clean) { img.src = clean; img.classList.add('show'); }
  else img.classList.remove('show');
}

// ── PHOTO UPLOAD LOCAL (non synchronisé) + COMPRESSION ────────────────────────
function handlePhotoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Merci de choisir un fichier image (jpg, png, webp...).');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const maxW = 700;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

      // Stocké en attente : sera sauvegardé localement (pas synchronisé) au moment du SAUVEGARDER
      pendingLocalPhoto = dataUrl;
      previewPhoto(dataUrl);

      const nameLabel = document.getElementById('photo-filename');
      if (nameLabel) nameLabel.textContent = '📎 ' + file.name + ' (local uniquement)';
    };
    img.onerror = function() { alert('Impossible de lire cette image.'); };
    img.src = e.target.result;
  };
  reader.onerror = function() { alert('Erreur de lecture du fichier.'); };
  reader.readAsDataURL(file);
}

function clearPhoto() {
  pendingLocalPhoto = null;
  const urlInput = document.getElementById('f-photo');
  if (urlInput) urlInput.value = '';
  const fileInput = document.getElementById('f-photo-file');
  if (fileInput) fileInput.value = '';
  const nameLabel = document.getElementById('photo-filename');
  if (nameLabel) nameLabel.textContent = '';
  previewPhoto('');
}

function closeForm() { document.getElementById('form-modal').style.display = 'none'; }

function deleteFromForm() {
  const { type, id: pid } = formCtx;
  if (pid === null || pid === undefined) return;
  if (!confirm('Supprimer définitivement ?')) return;
  if (type === 'talent') db.talents = db.talents.filter(p => p.id !== pid);
  else if (type === 'club') db.clubs = db.clubs.filter(c => c.id !== pid);
  else if (type === 'agence') db.agences = db.agences.filter(a => a.id !== pid);
  else if (type === 'marque') db.marques.splice(pid, 1);
  saveDb();
  closeForm();
  buildTabs();
  render();
}

function submitForm() {
  const { type, id: pid } = formCtx;
  const isEdit = pid !== null && pid !== undefined;

  if (type === 'talent') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const cats = [...document.querySelectorAll('input[name="cat"]:checked')].map(el => el.value);
    const sports = [...document.querySelectorAll('input[name="sport-check"]:checked')].map(el => el.value);
    const pays = [...document.querySelectorAll('input[name="pays-check"]:checked')].map(el => el.value);
    const agence = [...document.querySelectorAll('input[name="agence-check"]:checked')].map(el => el.value);
    const ville = g('f-ville').split(',').map(s => s.trim()).filter(Boolean);
    const obj = {
      nom: g('f-nom'), prenom: g('f-prenom'), sexe: formSexe,
      age: g('f-age') || '', cats,
      tel: g('f-tel') || '', mail: g('f-mail') || '',
      agence, pays, ville,
      insta: g('f-insta'), sports,
      photo: normalizePhotoUrl(g('f-photo')), notes: g('f-notes')
    };
    let finalId;
    if (isEdit) { db.talents = db.talents.map(p => p.id === pid ? { ...obj, id: p.id } : p); finalId = pid; }
    else        { finalId = uid(); db.talents.push({ ...obj, id: finalId }); }

    // Sauvegarde la photo locale (si une a été importée depuis l'appareil)
    if (pendingLocalPhoto) setLocalPhoto(finalId, pendingLocalPhoto);

  } else if (type === 'club') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom:g('f-nom'), pays:g('fc-pays')||'', ville:g('fc-ville')||'', mail:g('f-mail'), lien:g('f-lien'), notes:g('f-notes') };
    if (isEdit) db.clubs = db.clubs.map(c => c.id === pid ? { ...obj, id: c.id } : c);
    else        db.clubs.push({ ...obj, id: uid() });

  } else if (type === 'agence') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom:g('f-nom'), pays:g('fa-pays')||'', ville:g('fa-ville')||'', mail:g('f-mail'), site:g('f-site'), notes:g('f-notes') };
    if (isEdit) db.agences = db.agences.map(a => a.id === pid ? { ...obj, id: a.id } : a);
    else        db.agences.push({ ...obj, id: uid() });

  } else if (type === 'marque') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom: g('f-nom'), site: g('f-site') };
    if (isEdit) db.marques[pid] = obj;
    else        db.marques.push(obj);
  }

  saveDb();
  closeForm();
  buildTabs();
  render();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
// Affiche immédiatement le cache local, puis synchronise avec Airtable
buildTabs();
render();
initRemoteSync();
