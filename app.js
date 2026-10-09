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
    lieux:      [],
    chapitres:  [],
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
// Les bases créées avant l'ajout des lieux n'ont pas encore de liste "lieux"
function lieuxList() { if (!Array.isArray(db.lieux)) db.lieux = []; return db.lieux; }

// ── PHOTOS ────────────────────────────────────────────────────────────────────
// Les photos importées depuis un appareil sont envoyées sur Airtable (voir
// airtable-sync.js) pour être visibles par toute l'équipe. Le stockage local
// ci-dessous ne sert plus que de secours si l'envoi échoue.
const LOCAL_PHOTOS_KEY = 'casting_bible_local_photos';
let pendingLocalPhoto = null; // base64 en attente d'envoi lors du submit

function getLocalPhotos() {
  try { return JSON.parse(localStorage.getItem(LOCAL_PHOTOS_KEY) || '{}'); }
  catch(e) { return {}; }
}
function setLocalPhoto(talentId, base64) {
  const store = getLocalPhotos();
  store[talentId] = base64;
  try { localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(store)); } catch(e) {}
}
function removeLocalPhoto(talentId) {
  const store = getLocalPhotos();
  delete store[talentId];
  try { localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(store)); } catch(e) {}
}
function getLocalPhotoFor(talentId) {
  return getLocalPhotos()[talentId] || null;
}
function photoFor(talent) {
  return normalizePhotoUrl(talent.photo) || getSharedPhotoFor(talent.id) || getLocalPhotoFor(talent.id) || '';
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
let curCatId   = 'home'; // 'home' = accueil, null = tous les talents, sinon un chapitre
let searchQ    = '';
let homeQ      = '';
let fSport     = '';
let fSexe      = '';
let fPays      = '';
let fAgence    = '';
let fSubCat    = '';    // sous-catégorie dans un groupe (ex: DOP chez les techniciens)
let detailType = null;
let detailId   = null;
let detailChap = null;  // chapitre de l'élément affiché (chapitres libres)
let formCtx    = null;  // { type: 'talent'|'club'|'agence'|'marque'|'lieu'|'item'|'chapitre', id, chap }
let formSexe   = 'f';

// ── CHAPITRES ─────────────────────────────────────────────────────────────────
// Un chapitre = une entrée de la page d'accueil. Les chapitres "liste" créés
// depuis l'app (comme Clubs) sont stockés dans db.chapitres et synchronisés
// avec Airtable comme le reste de la base.
const TALENT_FAMILIES = [
  { key:'modele',  label:'Modèles',     color:'#c8f059' },
  { key:'athlete', label:'Athlètes',    color:'#59d4f0' },
  { key:'tech',    label:'Techniciens', color:'#f0a059' },
];
function isFamilyCat(c) { return TALENT_FAMILIES.some(f => c.id.startsWith(f.key + '-')); }
function chapitresList() { if (!Array.isArray(db.chapitres)) db.chapitres = []; return db.chapitres; }
function chapById(id) { return chapitresList().find(c => String(c.id) === String(id)); }
function countInCat(catId) { return db.talents.filter(t => t.cats && t.cats.includes(catId)).length; }

function chaptersList() {
  const list = [];
  TALENT_FAMILIES.forEach(fam => {
    const cats = db.categories.filter(c => c.id.startsWith(fam.key + '-'));
    if (!cats.length) return;
    const count = db.talents.filter(t => t.cats && t.cats.some(c => c.startsWith(fam.key + '-'))).length;
    list.push({ key: fam.key + '-group', label: fam.label, color: fam.color, count, add: () => openForm('talent', undefined, { cats: [] }) });
  });
  db.categories.filter(c => !isFamilyCat(c)).forEach(cat => {
    list.push({ key: cat.id, label: cat.label, color: cat.color, count: countInCat(cat.id), custom: 'profils',
      add: () => openForm('talent', undefined, { cats: [cat.id] }) });
  });
  list.push({ key:'clubs', label:'Clubs', color:'#f0a059', count: db.clubs.length, add: () => openForm('club') });
  list.push({ key:'lieux', label:'Lieux', color:'#59d4f0', count: lieuxList().length, add: () => openForm('lieu') });
  list.push({ key:'marques', label:'Marques · Agences', color:'#d066e0', count: db.marques.length + db.agences.length,
    add: () => openChooser('AJOUTER DANS MARQUES · AGENCES', [
      { label:'Marque', color:'#d066e0', run: () => openForm('marque') },
      { label:'Agence', color:'#d066e0', run: () => openForm('agence') },
    ]) });
  chapitresList().forEach(ch => {
    list.push({ key: 'ch:' + ch.id, label: ch.nom, color: ch.color || '#111111', count: (ch.items || []).length, custom: 'liste',
      add: () => openForm('item', undefined, { chap: ch.id }) });
  });
  return list;
}
function chapterByKey(key) {
  if (key === null) return { key: null, label: 'Tous les talents', color: '#c8f059', count: db.talents.length };
  if (key === 'settings') return { key, label: 'Paramètres', color: '#666666' };
  return chaptersList().find(c => c.key === key);
}
function chapterAdd(key) { const c = chapterByKey(key); if (c && c.add) c.add(); }

// ── NAVIGATION ────────────────────────────────────────────────────────────────
// Sur l'accueil : rien. Dans un chapitre : un fil d'Ariane pour revenir.
function buildTabs() {
  const nav = document.getElementById('tabs-nav');
  if (curCatId === 'home') { nav.innerHTML = ''; nav.style.display = 'none'; return; }
  const ch = chapterByKey(curCatId);
  if (!ch) { curCatId = 'home'; buildTabs(); return; }
  nav.style.display = '';
  nav.innerHTML = `<button class="crumb-back" onclick="goHome()">← CHAPITRES</button>
    <span class="crumb-sep">/</span>
    <span class="crumb-title"><span class="ch-dot" style="background:${esc(ch.color)}"></span>${esc(ch.label.toUpperCase())}</span>
    ${ch.count !== undefined ? `<span class="crumb-count">${ch.count}</span>` : ''}
    ${ch.custom ? `<button class="crumb-edit" onclick="openForm('chapitre','${esc(String(ch.key).replace(/^ch:/,''))}',{kind:'${ch.custom}'})">MODIFIER LE CHAPITRE</button>` : ''}`;
}

function switchCat(catId) {
  curCatId = catId;
  searchQ = ''; fSport = ''; fSexe = ''; fPays = ''; fAgence = ''; fSubCat = '';
  buildTabs();
  render();
  window.scrollTo(0, 0);
}
function goHome() { homeQ = ''; switchCat('home'); }

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  updateCounts();
  const main = document.getElementById('main-content');

  if (curCatId === 'home')     { renderHome(main); return; }
  if (curCatId === 'clubs')    { renderClubs(main); return; }
  if (curCatId === 'lieux')    { renderLieux(main); return; }
  if (curCatId === 'marques')  { renderMarques(main); return; }
  if (curCatId === 'settings') { renderSettings(main); return; }
  if (String(curCatId).startsWith('ch:')) { renderChapitre(main); return; }

  // Talents (all, group, or single category)
  renderTalents(main);
}

function updateCounts() {
  document.getElementById('total-count').textContent =
    db.talents.length + ' TALENTS · ' + db.clubs.length + ' CLUBS · ' + lieuxList().length + ' LIEUX';
}

// ── ACCUEIL ───────────────────────────────────────────────────────────────────
function renderHome(main) {
  const chapters = chaptersList();
  main.innerHTML = `<div class="home">
    <div class="home-search">
      <input id="home-search" placeholder="Rechercher dans toute la bible..." value="${esc(homeQ)}"
             oninput="homeQ=this.value;renderHomeBody()">
    </div>
    <div id="home-body"></div>
  </div>`;
  renderHomeBody();
}

function renderHomeBody() {
  const box = document.getElementById('home-body');
  if (!box) return;
  if (homeQ.trim()) { box.innerHTML = homeResultsHtml(homeQ.trim().toLowerCase()); return; }
  const chapters = chaptersList();
  box.innerHTML = `
    <div class="home-head">
      <span>CHAPITRES</span>
      <span>${chapters.length}</span>
    </div>
    <ol class="chapters">
      ${chapters.map((c, i) => `<li class="chapter" onclick="switchCat('${esc(c.key)}')">
        <span class="ch-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="ch-dot" style="background:${esc(c.color)}"></span>
        <span class="ch-name">${esc(c.label)}</span>
        <span class="ch-count">${c.count}</span>
        <button class="ch-add" title="Ajouter dans ${esc(c.label)}" onclick="event.stopPropagation();chapterAdd('${esc(c.key)}')">+</button>
      </li>`).join('')}
    </ol>
    <button class="ch-new" onclick="openForm('chapitre')">+ NOUVEAU CHAPITRE</button>
    <div class="home-foot">
      <button onclick="switchCat(null)">TOUS LES TALENTS (${db.talents.length})</button>
      <button onclick="switchCat('settings')">PARAMÈTRES</button>
    </div>`;
}

// Recherche sur tous les chapitres depuis l'accueil
function homeResultsHtml(q) {
  const hit = (...vals) => vals.flat().some(v => String(v || '').toLowerCase().includes(q));
  const rows = [];
  db.talents.forEach(p => {
    if (!hit(p.nom, p.prenom, talentSports(p), talentAgences(p), talentPays(p), talentVilles(p), p.insta, p.notes,
      (p.cats || []).map(c => catById(c)?.label))) return;
    const cats = (p.cats || []).map(c => catById(c)).filter(Boolean);
    rows.push({ name: [p.nom, p.prenom].filter(Boolean).join(' '), where: cats.map(c => c.label).join(', ') || 'Talent',
      color: cats[0]?.color || '#c8f059', open: `openDetail('talent',${p.id})` });
  });
  db.clubs.forEach(c => { if (hit(c.nom, c.ville, c.pays, c.notes, c.lien)) rows.push({ name: c.nom, where: 'Club · ' + (c.ville || ''), color: '#f0a059', open: `openDetail('club',${c.id})` }); });
  lieuxList().forEach(l => { if (hit(l.nom, l.type, l.adresse, l.ville, l.pays, l.notes)) rows.push({ name: l.nom, where: 'Lieu · ' + (l.ville || l.type || ''), color: '#59d4f0', open: `openDetail('lieu',${l.id})` }); });
  db.agences.forEach(a => { if (hit(a.nom, a.ville, a.pays)) rows.push({ name: a.nom, where: 'Agence · ' + (a.ville || ''), color: '#d066e0', open: `openForm('agence',${a.id})` }); });
  db.marques.forEach((m, i) => { const nom = typeof m === 'string' ? m : m.nom; if (hit(nom)) rows.push({ name: nom, where: 'Marque', color: '#d066e0', open: `openForm('marque',${i})` }); });
  chapitresList().forEach(ch => (ch.items || []).forEach(it => {
    if (hit(it.nom, it.type, it.ville, it.pays, it.contact, it.notes)) rows.push({ name: it.nom, where: ch.nom + (it.ville ? ' · ' + it.ville : ''), color: ch.color || '#111111', open: `openDetail('item',${it.id},'${esc(String(ch.id))}')` });
  }));
  if (!rows.length) return `<div class="empty">AUCUN RÉSULTAT</div>`;
  return `<div class="home-head"><span>RÉSULTATS</span><span>${rows.length}</span></div>
    <ol class="chapters results">${rows.slice(0, 200).map(r => `<li class="chapter" onclick="${r.open}">
      <span class="ch-dot" style="background:${esc(r.color)}"></span>
      <span class="ch-name">${esc(r.name)}</span>
      <span class="ch-where">${esc(r.where)}</span>
    </li>`).join('')}</ol>`;
}

// ── CHOIX (bouton + AJOUTER de l'en-tête) ─────────────────────────────────────
let chooserItems = [];
function openChooser(title, items) {
  chooserItems = items;
  formCtx = { type: 'chooser', id: null };
  document.getElementById('form-title').textContent = title;
  document.getElementById('form-btn-del').style.display = 'none';
  document.getElementById('btn-save').style.display = 'none';
  document.getElementById('form-body').innerHTML = `<div class="field full"><div class="chooser">
    ${items.map((it, i) => `<button class="chooser-item" onclick="chooserItems[${i}].run()">
      <span class="ch-dot" style="background:${esc(it.color)}"></span>${esc(it.label)}</button>`).join('')}
  </div></div>`;
  document.getElementById('form-modal').style.display = 'flex';
}
function openAddChooser() {
  // Dans un chapitre : on ajoute directement dedans
  if (curCatId !== 'home' && curCatId !== 'settings') {
    if (curCatId === null || String(curCatId).endsWith('-group')) { openForm('talent', undefined, { cats: fSubCat ? [fSubCat] : [] }); return; }
    const ch = chapterByKey(curCatId);
    if (ch && ch.add) { ch.add(); return; }
  }
  const items = [];
  chaptersList().forEach(c => {
    if (c.key === 'marques') {
      items.push({ label: 'Marque', color: c.color, run: () => openForm('marque') });
      items.push({ label: 'Agence', color: c.color, run: () => openForm('agence') });
    } else if (c.key.endsWith('-group')) {
      items.push({ label: c.label, color: c.color, run: () => openForm('talent', undefined, { cats: [] }) });
    } else {
      items.push({ label: c.label, color: c.color, run: c.add });
    }
  });
  items.push({ label: '+ Nouveau chapitre', color: '#666666', run: () => openForm('chapitre') });
  openChooser('QUE VEUX-TU AJOUTER ?', items);
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
        if (fSubCat && !p.cats.includes(fSubCat)) return false;
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

  let html = '';
  if (curCatId && curCatId.endsWith('-group')) {
    const prefix = curCatId.replace('-group','') + '-';
    const subs = db.categories.filter(c => c.id.startsWith(prefix));
    if (subs.length > 1) {
      html += `<div class="subcats">
        <button class="subcat${fSubCat===''?' active':''}" onclick="fSubCat='';renderTalents(document.getElementById('main-content'))">TOUS</button>
        ${subs.map(c => `<button class="subcat${fSubCat===c.id?' active':''}" onclick="fSubCat='${esc(c.id)}';renderTalents(document.getElementById('main-content'))">${esc(c.label.toUpperCase())} <span>${countInCat(c.id)}</span></button>`).join('')}
      </div>`;
    }
  }
  html += `<div class="toolbar">
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
    <button class="btn-add" onclick="openAddChooser()">+ AJOUTER</button>
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
      else if (p.site) html += `<div class="card-ig-hover">SITE ↗</div>`;

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

// ── LIEUX (scouting) ──────────────────────────────────────────────────────────
function lieuPhotoUrls(l) {
  // Photos importées (Airtable) puis liens collés à la main
  const imported = getLieuPhotos(l.id).map(p => ({ url: p.url, full: p.full }));
  const links = (l.photos || []).map(normalizePhotoUrl).filter(Boolean).map(u => ({ url: u, full: u }));
  return [...imported, ...links];
}
function lieuMapQuery(l) {
  if (l.gps) return l.gps;
  return [l.adresse, l.ville, l.pays].filter(Boolean).join(', ');
}
function lieuMapsLink(l) {
  if (l.maps) return l.maps;
  const q = lieuMapQuery(l);
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
}
function formatCout(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('fr-FR') + ' €';
}

function renderLieux(main) {
  const q = searchQ.toLowerCase();
  const list = lieuxList().filter(l => {
    if (q && ![l.nom,l.type,l.adresse,l.ville,l.pays,l.contact,l.notes,l.coutDetail]
      .some(v => String(v||'').toLowerCase().includes(q))) return false;
    if (fPays && l.pays !== fPays) return false;
    return true;
  });
  const pays = [...new Set(lieuxList().map(l => l.pays).filter(Boolean))].sort();

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville, type..." value="${esc(searchQ)}"
             oninput="searchQ=this.value;renderLieux(document.getElementById('main-content'))">
    </div>
    <select class="filter-sel" onchange="fPays=this.value;renderLieux(document.getElementById('main-content'))">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fPays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add" style="background:var(--accent2)" onclick="openForm('lieu')">+ AJOUTER</button>
  </div>`;

  if (!list.length) {
    html += `<div class="empty">AUCUN LIEU${lieuxList().length ? ' TROUVÉ' : ' POUR LE MOMENT'}</div>`;
  } else {
    html += `<div class="grid lieux-grid">`;
    list.forEach(l => {
      const photos = lieuPhotoUrls(l);
      const cover = photos[0]?.url;
      html += `<div class="card" onclick="openDetail('lieu',${l.id})">`;
      if (cover) {
        html += `<img class="card-img lieu" src="${esc(cover)}" alt="${esc(l.nom)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="card-ph lieu" style="display:none">${initials(l.nom,'')}</div>`;
      } else {
        html += `<div class="card-ph lieu">${initials(l.nom,'')}</div>`;
      }
      if (photos.length > 1) html += `<span class="card-age">${photos.length} PHOTOS</span>`;
      if (l.cout !== '' && l.cout !== undefined) html += `<div class="card-ig-hover" style="color:var(--accent2)">≈ ${esc(formatCout(l.cout))}</div>`;
      html += `<div class="card-body">
        <div class="card-name">${esc(l.nom)}</div>
        <div class="card-meta">
          ${l.type ? `<span class="tag agence">${esc(l.type)}</span>` : ''}
          ${l.ville ? `<span class="tag">${esc(l.ville)}</span>` : ''}
          ${l.pays ? `<span class="tag">${FLAGS[l.pays]||''} ${esc(l.pays)}</span>` : ''}
        </div>
      </div></div>`;
    });
    html += `</div>`;
  }
  main.innerHTML = html;
}

function lieuDetailHtml(l) {
  const photos = lieuPhotoUrls(l);
  const mapQ = lieuMapQuery(l);
  const mapsLink = lieuMapsLink(l);
  return `<div class="lieu-detail">
    ${photos.length ? `<div class="lieu-gallery">
      ${photos.map(p => `<a href="${esc(p.full)}" target="_blank"><img src="${esc(p.url)}" alt="" onerror="this.parentElement.style.display='none'"></a>`).join('')}
    </div>` : ''}
    <div class="detail-info">
      <div class="detail-name">${esc(l.nom)}</div>
      <div class="detail-tags">
        ${l.type ? `<span class="tag agence">${esc(l.type)}</span>` : ''}
        ${l.pays ? `<span class="tag">${FLAGS[l.pays]||''} ${esc(l.pays)}</span>` : ''}
        ${l.ville ? `<span class="tag">${esc(l.ville)}</span>` : ''}
      </div>
      <div class="detail-row"><span class="detail-lbl">ADRESSE</span><span class="detail-val">${esc(l.adresse||'—')}</span></div>
      ${l.gps ? `<div class="detail-row"><span class="detail-lbl">GPS</span><span class="detail-val">${esc(l.gps)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-lbl">COÛT ESTIMÉ</span><span class="detail-val" style="color:var(--accent2)">${esc(formatCout(l.cout) || '—')}</span></div>
      ${l.coutDetail ? `<div class="detail-row"><span class="detail-lbl">DÉTAIL COÛTS</span><span class="detail-val pre">${esc(l.coutDetail)}</span></div>` : ''}
      ${l.contact ? `<div class="detail-row"><span class="detail-lbl">CONTACT</span><span class="detail-val">${esc(l.contact)}</span></div>` : ''}
      ${l.tel ? `<div class="detail-row"><span class="detail-lbl">TEL</span><span class="detail-val"><a href="tel:${esc(l.tel)}">${esc(l.tel)}</a></span></div>` : ''}
      ${l.mail ? `<div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val"><a href="mailto:${esc(l.mail)}">${esc(l.mail)}</a></span></div>` : ''}
      ${l.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val pre">${esc(l.notes)}</span></div>` : ''}
      ${mapsLink ? `<a class="btn-ig" style="border-color:var(--accent2);color:var(--accent2)" href="${esc(mapsLink)}" target="_blank">OUVRIR DANS GOOGLE MAPS ↗</a>` : ''}
    </div>
    ${mapQ ? `<iframe class="lieu-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
      src="https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed"></iframe>` : ''}
  </div>`;
}

// ── CHAPITRES LIBRES (créés depuis l'app) ─────────────────────────────────────
function curChap() { return chapById(String(curCatId).slice(3)); }

function renderChapitre(main) {
  const ch = curChap();
  if (!ch) { goHome(); return; }
  const items = ch.items || [];
  const q = searchQ.toLowerCase();
  const list = items.filter(it => {
    if (q && ![it.nom,it.type,it.ville,it.pays,it.contact,it.notes,it.insta]
      .some(v => String(v||'').toLowerCase().includes(q))) return false;
    if (fPays && it.pays !== fPays) return false;
    return true;
  });
  const pays = [...new Set(items.map(it => it.pays).filter(Boolean))].sort();
  const color = ch.color || 'var(--text)';

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville, type..." value="${esc(searchQ)}"
             oninput="searchQ=this.value;renderChapitre(document.getElementById('main-content'))">
    </div>
    <select class="filter-sel" onchange="fPays=this.value;renderChapitre(document.getElementById('main-content'))">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fPays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add" style="background:${esc(color)}" onclick="openForm('item',undefined,{chap:'${esc(String(ch.id))}'})">+ AJOUTER</button>
  </div>`;

  if (!list.length) {
    html += `<div class="empty">${items.length ? 'AUCUN RÉSULTAT' : 'CE CHAPITRE EST VIDE'}</div>`;
  } else {
    html += `<div class="clubs-grid">`;
    list.forEach(it => {
      html += `<div class="club-card" onclick="openDetail('item',${it.id},'${esc(String(ch.id))}')">
        <div class="club-dot" style="background:${esc(color)}"></div>
        <div class="club-name">${esc(it.nom)}</div>
        ${it.type ? `<div class="club-ville" style="color:var(--text)">${esc(it.type)}</div>` : ''}
        <div class="club-ville">${FLAGS[it.pays]||''} ${esc([it.ville, it.pays].filter(Boolean).join(', '))}</div>
        ${it.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:5px">${esc(it.notes)}</div>` : ''}
      </div>`;
    });
    html += `</div>`;
  }
  main.innerHTML = html;
}

function itemDetailHtml(it) {
  const row = (lbl, val) => val ? `<div class="detail-row"><span class="detail-lbl">${lbl}</span><span class="detail-val">${val}</span></div>` : '';
  const photo = normalizePhotoUrl(it.photo);
  return `${photo ? `<img class="item-photo" src="${esc(photo)}" alt="" onerror="this.style.display='none'">` : ''}
  <div style="padding:20px">
    <div class="detail-name">${esc(it.nom)}</div>
    <div class="detail-tags">
      ${it.type ? `<span class="tag agence">${esc(it.type)}</span>` : ''}
      ${it.pays ? `<span class="tag">${FLAGS[it.pays]||''} ${esc(it.pays)}</span>` : ''}
      ${it.ville ? `<span class="tag">${esc(it.ville)}</span>` : ''}
    </div>
    ${row('CONTACT', esc(it.contact))}
    ${row('TEL', it.tel ? `<a href="tel:${esc(it.tel)}">${esc(it.tel)}</a>` : '')}
    ${row('MAIL', it.mail ? `<a href="mailto:${esc(it.mail)}">${esc(it.mail)}</a>` : '')}
    ${row('INSTAGRAM', it.insta ? `<a href="https://instagram.com/${esc(it.insta)}" target="_blank">@${esc(it.insta)}</a>` : '')}
    ${row('SITE', it.site ? `<a href="${esc(it.site)}" target="_blank">${esc(it.site)}</a>` : '')}
    ${it.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val pre">${esc(it.notes)}</span></div>` : ''}
  </div>`;
}

function renderItemForm(v) {
  const paysl = `<option value="">—</option>` + COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  document.getElementById('form-body').innerHTML = `
    <div class="field"><label>NOM *</label><input id="f-nom" value="${esc(v.nom||'')}"></div>
    <div class="field"><label>TYPE / DESCRIPTION</label><input id="f-type" value="${esc(v.type||'')}"></div>
    <div class="field"><label>PAYS</label><select id="fi-pays">${paysl}</select></div>
    <div class="field"><label>VILLE</label><input id="f-ville" value="${esc(v.ville||'')}"></div>
    <div class="field"><label>CONTACT</label><input id="f-contact" value="${esc(v.contact||'')}"></div>
    <div class="field"><label>TEL</label><input id="f-tel" value="${esc(v.tel||'')}" placeholder="+33 6..."></div>
    <div class="field"><label>MAIL</label><input id="f-mail" type="email" value="${esc(v.mail||'')}"></div>
    <div class="field"><label>INSTAGRAM (handle sans @)</label><input id="f-insta" value="${esc(v.insta||'')}"></div>
    <div class="field full"><label>SITE (URL)</label><input id="f-site" value="${esc(v.site||'')}" placeholder="https://..."></div>
    <div class="field full"><label>PHOTO (lien, optionnel)</label><input id="f-photo" value="${esc(v.photo||'')}" placeholder="https://... (Google Drive, Imgur, lien image direct)"></div>
    <div class="field full"><label>NOTES</label><textarea id="f-notes" rows="3">${esc(v.notes||'')}</textarea></div>`;
}

const CHAPTER_COLORS = ['#c8f059','#59d4f0','#f0a059','#d066e0','#e24b4a','#f0e059','#111111'];

function renderChapitreForm(v, isEdit, kind) {
  const color = v.color || CHAPTER_COLORS[chapitresList().length % CHAPTER_COLORS.length];
  document.getElementById('form-body').innerHTML = `
    <div class="field full"><label>NOM DU CHAPITRE *</label>
      <input id="f-nom" value="${esc(v.nom||'')}" placeholder="ex: Loueurs de matériel, Cascadeurs, Restaurants...">
    </div>
    <div class="field full"><label>COULEUR</label>
      <div class="swatches">
        ${CHAPTER_COLORS.map(c => `<button type="button" class="swatch${c===color?' sel':''}" style="background:${c}" onclick="pickSwatch(this,'${c}')"></button>`).join('')}
        <input type="color" id="f-color" value="${esc(color)}" title="Autre couleur" oninput="pickSwatch(null,this.value)">
      </div>
    </div>
    ${isEdit ? '' : `<div class="field full"><label>CONTENU</label>
      <div class="kind-group">
        <div class="kind-btn${kind!=='profils'?' sel':''}" id="kind-liste" onclick="selectKind('liste')">
          <strong>FICHES</strong><span>Comme Clubs : nom, type, ville, contact, notes.</span>
        </div>
        <div class="kind-btn${kind==='profils'?' sel':''}" id="kind-profils" onclick="selectKind('profils')">
          <strong>PROFILS</strong><span>Comme les talents : photo, âge, sport, agence, Instagram.</span>
        </div>
      </div>
    </div>`}`;
}
function pickSwatch(btn, c) {
  document.getElementById('f-color').value = c;
  document.querySelectorAll('.swatch').forEach(el => el.classList.toggle('sel', el === btn));
}
function selectKind(k) {
  formCtx.kind = k;
  ['liste','profils'].forEach(x => document.getElementById('kind-'+x).classList.toggle('sel', x === k));
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
      ${a.site ? `<a class="list-item-mail" href="${esc(a.site)}" target="_blank">SITE ↗</a>` : ''}
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
      <div class="settings-title">CHAPITRES (${chapitresList().length})</div>
      <div class="settings-list">${chapitresList().map(ch => `<div class="settings-item">
        <div class="dot" style="background:${esc(ch.color||'#111111')}"></div>
        <span>${esc(ch.nom)} (${(ch.items||[]).length})</span>
        <button onclick="openForm('chapitre','${esc(String(ch.id))}',{kind:'liste'})" title="Modifier">✎</button>
      </div>`).join('')}</div>
      <div class="settings-add">
        <button onclick="openForm('chapitre')">+ NOUVEAU CHAPITRE</button>
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
function openDetail(type, pid, chapId) {
  detailType = type;
  detailId   = pid;
  detailChap = chapId !== undefined ? chapId : null;
  const arr = type === 'talent' ? db.talents : type === 'lieu' ? lieuxList()
    : type === 'item' ? ((chapById(chapId) || {}).items || []) : db.clubs;
  const p   = arr.find(x => x.id === pid);
  if (!p) return;

  document.getElementById('detail-title').textContent = (p.nom||'') + (p.prenom ? ' ' + p.prenom : '');

  if (type === 'item') {
    document.getElementById('detail-body').innerHTML = itemDetailHtml(p);
    document.getElementById('detail-modal').style.display = 'flex';
    return;
  }

  if (type === 'lieu') {
    document.getElementById('detail-body').innerHTML = lieuDetailHtml(p);
    document.getElementById('detail-modal').style.display = 'flex';
    return;
  }

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
        ${p.site ? `<div class="detail-row"><span class="detail-lbl">LIEN / SITE</span><span class="detail-val"><a href="${esc(p.site)}" target="_blank">${esc(p.site)}</a></span></div>` : ''}
        ${p.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val">${esc(p.notes)}</span></div>` : ''}
        ${ig ? `<a class="btn-ig" href="https://instagram.com/${esc(p.insta)}" target="_blank">INSTAGRAM ↗</a>` : ''}
        ${p.site ? `<a class="btn-ig" href="${esc(p.site)}" target="_blank" style="margin-left:${ig?'8px':'0'}">SITE ↗</a>` : ''}
      </div>
    </div>`;
  } else {
    body = `<div style="padding:20px">
      <div style="font-family:var(--serif);font-size:26px;font-weight:500;color:var(--text);letter-spacing:0">${esc(p.nom)}</div>
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
  if (!confirm(detailType === 'lieu' ? 'Supprimer ce lieu ?' : detailType === 'item' ? 'Supprimer cette fiche ?' : 'Supprimer ce profil ?')) return;
  if (detailType === 'item') { const ch = chapById(detailChap); if (ch) ch.items = (ch.items || []).filter(it => it.id !== detailId); }
  else if (detailType === 'talent') { db.talents = db.talents.filter(p => p.id !== detailId); deleteSharedPhoto(detailId); removeLocalPhoto(detailId); }
  else if (detailType === 'lieu') { db.lieux = lieuxList().filter(l => l.id !== detailId); deleteAllLieuPhotos(detailId); }
  else                         db.clubs   = db.clubs.filter(c => c.id !== detailId);
  saveDb();
  closeDetail();
  buildTabs();
  render();
}

function editFromDetail() {
  closeDetail();
  openForm(detailType, detailId, { chap: detailChap });
}

// ── FORM MODAL ────────────────────────────────────────────────────────────────
function openForm(type, pid, opts) {
  opts = opts || {};
  formCtx = { type, id: pid !== undefined ? pid : null, chap: opts.chap, kind: opts.kind };
  const isEdit = pid !== undefined && pid !== null;

  // show/hide delete button
  document.getElementById('form-btn-del').style.display = isEdit ? 'block' : 'none';
  document.getElementById('btn-save').style.display = '';

  if (type === 'talent') {
    const p = isEdit ? db.talents.find(x => x.id === pid) : { cats: opts.cats || [] };
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
  } else if (type === 'lieu') {
    const l = isEdit ? lieuxList().find(x => x.id === pid) : {};
    pendingLieuPhotos = [];
    pendingLieuRemovals = [];
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER LIEU' : '+ NOUVEAU LIEU';
    document.getElementById('btn-save').style.background = 'var(--accent2)';
    renderLieuForm(l || {});
  } else if (type === 'agence') {
    const a = isEdit ? db.agences.find(x => x.id === pid) : {};
    document.getElementById('form-title').textContent = isEdit ? 'ÉDITER AGENCE' : '+ NOUVELLE AGENCE';
    document.getElementById('btn-save').style.background = 'var(--accent4)';
    renderAgenceForm(a || {});
  } else if (type === 'item') {
    const ch = chapById(opts.chap);
    if (!ch) return;
    const it = isEdit ? (ch.items || []).find(x => x.id === pid) : {};
    document.getElementById('form-title').textContent = (isEdit ? 'ÉDITER · ' : '+ NOUVEAU · ') + ch.nom.toUpperCase();
    document.getElementById('btn-save').style.background = ch.color || 'var(--accent)';
    renderItemForm(it || {});
  } else if (type === 'chapitre') {
    // Chapitre "fiches" (db.chapitres) ou "profils" (une catégorie de talents)
    let v = {};
    if (isEdit && opts.kind === 'profils') { const c = catById(pid); v = c ? { nom: c.label, color: c.color } : {}; }
    else if (isEdit) { const c = chapById(pid); v = c ? { nom: c.nom, color: c.color } : {}; }
    formCtx.kind = opts.kind || 'liste';
    document.getElementById('form-title').textContent = isEdit ? 'MODIFIER LE CHAPITRE' : '+ NOUVEAU CHAPITRE';
    document.getElementById('btn-save').style.background = 'var(--accent)';
    renderChapitreForm(v, isEdit, formCtx.kind);
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
      <div style="font-family:var(--serif);font-size:13px;letter-spacing:.01em;text-transform:lowercase;color:var(--muted);margin-bottom:6px">${fam.label.toUpperCase()}</div>
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
    <div class="field"><label>LIEN / SITE (book, page agence...)</label><input id="f-site" value="${esc(v.site||'')}" placeholder="https://..."></div>
    <div class="field full">
      <label>PHOTO — LIEN URL OU IMPORT (visible par toute l'équipe)</label>
      <input id="f-photo" value="${esc(v.photo||'')}" placeholder="https://... (Google Drive, Imgur, lien image direct)" oninput="previewPhoto(this.value)">
      <div class="photo-upload-row" style="margin-top:8px">
        <label class="btn-upload" for="f-photo-file">OU IMPORTER DEPUIS CET APPAREIL</label>
        <input type="file" id="f-photo-file" accept="image/*" style="display:none" onchange="handlePhotoUpload(this)">
        <span id="photo-filename" class="photo-filename">${v.id && !v.photo && getSharedPhotoFor(v.id) ? 'Photo importée' : (v.id && !v.photo && getLocalPhotoFor(v.id) ? 'Photo locale (pas encore partagée)' : '')}</span>
      </div>
      <div class="field-hint">Colle directement un lien de partage Google Drive classique (celui du bouton "Partager") — il sera converti automatiquement. Vérifie juste que l'accès est sur "Tous les utilisateurs disposant du lien". Tu peux aussi importer une photo depuis ton ordinateur ou ton téléphone : elle est envoyée en ligne et visible par toute l'équipe.</div>
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

// ── FORMULAIRE LIEU ──────────────────────────────────────────────────────────
let pendingLieuPhotos   = []; // dataURLs importées, envoyées au SAUVEGARDER
let pendingLieuRemovals = []; // ids des photos Airtable à retirer au SAUVEGARDER

function renderLieuForm(v) {
  const paysl = `<option value="">—</option>` + COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');

  document.getElementById('form-body').innerHTML = `
    <div class="field"><label>NOM DU LIEU *</label><input id="f-nom" value="${esc(v.nom||'')}" placeholder="ex: Plage de la Torche"></div>
    <div class="field"><label>TYPE</label><input id="f-type" value="${esc(v.type||'')}" placeholder="ex: Plage, forêt, rooftop, stade..."></div>
    <div class="field full"><label>ADRESSE</label><input id="f-adresse" value="${esc(v.adresse||'')}" placeholder="ex: 29120 Plomeur"></div>
    <div class="field"><label>PAYS</label><select id="fl-pays">${paysl}</select></div>
    <div class="field"><label>VILLE</label><input id="f-ville" value="${esc(v.ville||'')}"></div>
    <div class="field full">
      <label>COORDONNÉES GPS (optionnel)</label>
      <div class="photo-upload-row">
        <input id="f-gps" value="${esc(v.gps||'')}" placeholder="ex: 47.8389, -4.3519" style="flex:1">
        <button type="button" class="btn-upload" onclick="fillGpsFromDevice()">MA POSITION</button>
      </div>
      <div class="field-hint">Sur place, appuie sur « MA POSITION » pour enregistrer l'endroit exact. Sinon l'adresse suffit pour la carte.</div>
    </div>
    <div class="field full"><label>LIEN GOOGLE MAPS (optionnel)</label><input id="f-maps" value="${esc(v.maps||'')}" placeholder="https://maps.app.goo.gl/..."></div>
    <div class="field"><label>COÛT ESTIMÉ (€)</label><input id="f-cout" type="number" min="0" step="any" value="${esc(String(v.cout ?? ''))}" placeholder="ex: 1500"></div>
    <div class="field"><label>CONTACT (propriétaire, mairie...)</label><input id="f-contact" value="${esc(v.contact||'')}"></div>
    <div class="field full"><label>DÉTAIL DES COÛTS</label><textarea id="f-cout-detail" rows="3" placeholder="ex: Location 1000 €/jour, autorisation mairie 300 €, parking régie 200 €">${esc(v.coutDetail||'')}</textarea></div>
    <div class="field"><label>TEL</label><input id="f-tel" value="${esc(v.tel||'')}" placeholder="+33 6..."></div>
    <div class="field"><label>MAIL</label><input id="f-mail" type="email" value="${esc(v.mail||'')}"></div>
    <div class="field full">
      <label>PHOTOS DU LIEU (visibles par toute l'équipe)</label>
      <div class="photo-upload-row">
        <label class="btn-upload" for="f-lieu-files">IMPORTER DES PHOTOS</label>
        <input type="file" id="f-lieu-files" accept="image/*" multiple style="display:none" onchange="handleLieuPhotos(this)">
      </div>
      <div class="lieu-thumbs" id="lieu-thumbs"></div>
      <textarea id="f-photo-links" rows="2" style="margin-top:8px" placeholder="Ou colle des liens d'images (Google Drive, Imgur...), un par ligne">${esc((v.photos||[]).join('\n'))}</textarea>
    </div>
    <div class="field full"><label>NOTES (accès, lumière, horaires, autorisations...)</label><textarea id="f-notes" rows="3">${esc(v.notes||'')}</textarea></div>`;
  renderLieuThumbs();
}

function renderLieuThumbs() {
  const box = document.getElementById('lieu-thumbs');
  if (!box) return;
  const lieuId = formCtx && formCtx.id;
  const existing = lieuId ? getLieuPhotos(lieuId).filter(p => !pendingLieuRemovals.includes(p.id)) : [];
  box.innerHTML =
    existing.map(p => `<div class="lieu-thumb"><img src="${esc(p.url)}" alt="">
      <button type="button" title="Retirer" onclick="pendingLieuRemovals.push('${esc(p.id)}');renderLieuThumbs()">✕</button></div>`).join('') +
    pendingLieuPhotos.map((d, i) => `<div class="lieu-thumb new"><img src="${d}" alt="">
      <button type="button" title="Retirer" onclick="pendingLieuPhotos.splice(${i},1);renderLieuThumbs()">✕</button></div>`).join('');
}

async function handleLieuPhotos(input) {
  const files = [...(input.files || [])].filter(f => f.type.startsWith('image/'));
  for (const file of files) {
    try { pendingLieuPhotos.push(await compressImage(file, 1400)); }
    catch (e) { alert('Impossible de lire ' + file.name); }
  }
  input.value = '';
  renderLieuThumbs();
}

function fillGpsFromDevice() {
  if (!navigator.geolocation) { alert("La localisation n'est pas disponible sur cet appareil."); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      document.getElementById('f-gps').value =
        pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
    },
    err => alert('Impossible de récupérer ta position : ' + err.message),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

async function saveLieuPhotos(lieuId, toAdd, toRemove) {
  if (!toAdd.length && !toRemove.length) return;
  setSyncStatus('syncing');
  try {
    if (toRemove.length) await removeLieuPhotos(lieuId, toRemove);
    for (const dataUrl of toAdd) await addLieuPhoto(lieuId, dataUrl);
    setSyncStatus('ok');
    render();
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    alert("L'envoi des photos du lieu a échoué. Réessaie depuis ÉDITER.\n\n" + e.message);
    render();
  }
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

// ── PHOTO UPLOAD (envoyée sur Airtable au SAUVEGARDER) + COMPRESSION ────────────────────────
function handlePhotoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Merci de choisir un fichier image (jpg, png, webp...).');
    return;
  }

  compressImage(file, 700).then(dataUrl => {
    // Stocké en attente : sera envoyé en ligne au moment du SAUVEGARDER
    pendingLocalPhoto = dataUrl;
    // L'import remplace un éventuel lien collé
    const urlInput = document.getElementById('f-photo');
    if (urlInput) urlInput.value = '';
    previewPhoto(dataUrl);

    const nameLabel = document.getElementById('photo-filename');
    if (nameLabel) nameLabel.textContent = file.name;
  }).catch(() => alert('Impossible de lire cette image.'));
}

// Réduit une image à maxW pixels de large et la renvoie en dataURL JPEG
function compressImage(file, maxW) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

async function saveImportedPhoto(talentId, dataUrl) {
  // Affichage immédiat sur cet appareil pendant l'envoi
  setLocalPhoto(talentId, dataUrl);
  setSyncStatus('syncing');
  try {
    await uploadSharedPhoto(talentId, dataUrl);
    removeLocalPhoto(talentId);
    setSyncStatus('ok');
    render();
  } catch (e) {
    console.error(e);
    setSyncStatus('error');
    alert("L'envoi de la photo a échoué. Elle reste visible sur cet appareil et sera renvoyée au prochain chargement de la page.\n\n" + e.message);
  }
}

function closeForm() { document.getElementById('form-modal').style.display = 'none'; }

function deleteChapitre() {
  const { id: pid, kind } = formCtx;
  if (kind === 'profils') {
    const used = countInCat(pid);
    if (!confirm(used ? `Supprimer ce chapitre ? Les ${used} profil(s) restent dans la base, ils perdent juste cette catégorie.` : 'Supprimer ce chapitre ?')) return;
    db.categories = db.categories.filter(c => c.id !== pid);
    db.talents.forEach(t => { if (t.cats) t.cats = t.cats.filter(c => c !== pid); });
  } else {
    const ch = chapById(pid);
    const n = ch ? (ch.items || []).length : 0;
    if (!confirm(n ? `Supprimer ce chapitre et ses ${n} fiche(s) ? C'est définitif, pour toute l'équipe.` : 'Supprimer ce chapitre ?')) return;
    db.chapitres = chapitresList().filter(c => String(c.id) !== String(pid));
  }
  saveDb();
  closeForm();
  if (curCatId !== 'settings') curCatId = 'home';
  buildTabs();
  render();
}

function deleteFromForm() {
  const { type, id: pid } = formCtx;
  if (pid === null || pid === undefined) return;
  if (type === 'chapitre') { deleteChapitre(); return; }
  if (!confirm('Supprimer définitivement ?')) return;
  if (type === 'item') { const ch = chapById(formCtx.chap); if (ch) ch.items = (ch.items || []).filter(it => it.id !== pid); }
  else if (type === 'talent') { db.talents = db.talents.filter(p => p.id !== pid); deleteSharedPhoto(pid); removeLocalPhoto(pid); }
  else if (type === 'club') db.clubs = db.clubs.filter(c => c.id !== pid);
  else if (type === 'lieu') { db.lieux = lieuxList().filter(l => l.id !== pid); deleteAllLieuPhotos(pid); }
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
      insta: g('f-insta'), site: g('f-site'), sports,
      photo: normalizePhotoUrl(g('f-photo')), notes: g('f-notes')
    };
    let finalId;
    if (isEdit) { db.talents = db.talents.map(p => p.id === pid ? { ...obj, id: p.id } : p); finalId = pid; }
    else        { finalId = uid(); db.talents.push({ ...obj, id: finalId }); }

    // Envoie la photo importée depuis l'appareil pour que toute l'équipe la voie
    if (pendingLocalPhoto) saveImportedPhoto(finalId, pendingLocalPhoto);

  } else if (type === 'club') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom:g('f-nom'), pays:g('fc-pays')||'', ville:g('fc-ville')||'', mail:g('f-mail'), lien:g('f-lien'), notes:g('f-notes') };
    if (isEdit) db.clubs = db.clubs.map(c => c.id === pid ? { ...obj, id: c.id } : c);
    else        db.clubs.push({ ...obj, id: uid() });

  } else if (type === 'lieu') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = {
      nom: g('f-nom'), type: g('f-type'), adresse: g('f-adresse'),
      pays: g('fl-pays'), ville: g('f-ville'), gps: g('f-gps'), maps: g('f-maps'),
      cout: g('f-cout'), coutDetail: g('f-cout-detail'),
      contact: g('f-contact'), tel: g('f-tel'), mail: g('f-mail'),
      photos: g('f-photo-links').split('\n').map(s => s.trim()).filter(Boolean),
      notes: g('f-notes')
    };
    let finalId;
    if (isEdit) { db.lieux = lieuxList().map(l => l.id === pid ? { ...obj, id: l.id } : l); finalId = pid; }
    else        { finalId = uid(); lieuxList().push({ ...obj, id: finalId }); }
    saveLieuPhotos(finalId, pendingLieuPhotos.slice(), pendingLieuRemovals.slice());

  } else if (type === 'agence') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom:g('f-nom'), pays:g('fa-pays')||'', ville:g('fa-ville')||'', mail:g('f-mail'), site:g('f-site'), notes:g('f-notes') };
    if (isEdit) db.agences = db.agences.map(a => a.id === pid ? { ...obj, id: a.id } : a);
    else        db.agences.push({ ...obj, id: uid() });

  } else if (type === 'item') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const ch = chapById(formCtx.chap);
    if (!ch) return;
    if (!Array.isArray(ch.items)) ch.items = [];
    const obj = {
      nom: g('f-nom'), type: g('f-type'), pays: g('fi-pays'), ville: g('f-ville'),
      contact: g('f-contact'), tel: g('f-tel'), mail: g('f-mail'), insta: g('f-insta').replace(/^@/, ''),
      site: g('f-site'), photo: normalizePhotoUrl(g('f-photo')), notes: g('f-notes')
    };
    if (isEdit) ch.items = ch.items.map(it => it.id === pid ? { ...obj, id: it.id } : it);
    else        ch.items.push({ ...obj, id: uid() });

  } else if (type === 'chapitre') {
    const nom = g('f-nom');
    if (!nom) { alert('Le nom est requis.'); return; }
    const color = document.getElementById('f-color').value;
    let goTo = null;
    if (formCtx.kind === 'profils') {
      if (isEdit) { const c = catById(pid); if (c) { c.label = nom; c.color = color; } }
      else {
        const id = 'custom-' + nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now();
        db.categories.push({ id, label: nom, color });
        goTo = id;
      }
    } else {
      if (isEdit) { const c = chapById(pid); if (c) { c.nom = nom; c.color = color; } }
      else { const id = uid(); chapitresList().push({ id, nom, color, items: [] }); goTo = 'ch:' + id; }
    }
    saveDb();
    closeForm();
    if (goTo) switchCat(goTo); else { buildTabs(); render(); }
    return;

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
