// ── STORAGE ───────────────────────────────────────────────────────────────────
// La base est gardée par le serveur Cloudflare (partagée avec toute l'équipe).
// localStorage sert de cache pour afficher quelque chose instantanément
// avant que la synchronisation soit terminée.
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
  // Puis on l'envoie au serveur pour que toute l'équipe voie le changement
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
// Les photos importées depuis un appareil sont envoyées au serveur (voir
// sync.js) pour être visibles par toute l'équipe. Le stockage local
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
let fLieuCat   = '';
let fLieuSport = '';
let fAgence    = '';
let fTri       = '';    // '' (ordre habituel), 'age-asc' ou 'age-desc'
let fSubCat    = '';    // sous-catégorie dans un groupe (ex: DOP chez les techniciens)
let detailType = null;
let detailId   = null;
let detailChap = null;  // chapitre de l'élément affiché (chapitres libres)
let formCtx    = null;  // { type: 'talent'|'club'|'agence'|'marque'|'lieu'|'item'|'chapitre', id, chap }
let formSexe   = 'f';

// ── CHAPITRES ─────────────────────────────────────────────────────────────────
// Un chapitre = une entrée de la page d'accueil. Les chapitres "liste" créés
// depuis l'app (comme Clubs) sont stockés dans db.chapitres et synchronisés
// avec le serveur comme le reste de la base.
const TALENT_FAMILIES = [
  { key:'modele',  label:'Modèles',     color:'#b5654a' },
  { key:'athlete', label:'Athlètes',    color:'#3f6e8c' },
  { key:'tech',    label:'Techniciens', color:'#c49a2c' },
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
  list.push({ key:'clubs', label:'Clubs', color:'#5e7d4f', count: db.clubs.length, add: () => openForm('club') });
  list.push({ key:'lieux', label:'Lieux', color:'#8a6fa8', count: lieuxList().length, add: () => openForm('lieu') });
  list.push({ key:'marques', label:'Marques · Agences', color:'#2b2b2b', count: db.marques.length + db.agences.length,
    add: () => openChooser('AJOUTER DANS MARQUES · AGENCES', [
      { label:'Marque', color:'#2b2b2b', run: () => openForm('marque') },
      { label:'Agence', color:'#2b2b2b', run: () => openForm('agence') },
    ]) });
  chapitresList().forEach(ch => {
    list.push({ key: 'ch:' + ch.id, label: ch.nom, color: ch.color || '#111111', count: (ch.items || []).length, custom: 'liste',
      add: () => openForm('item', undefined, { chap: ch.id }) });
  });
  return list;
}
function chapterByKey(key) {
  if (key === null) return { key: null, label: 'Tous les talents', color: '#9a9a96', count: db.talents.length };
  if (key === 'settings') return { key, label: 'Paramètres', color: '#666666' };
  return chaptersList().find(c => c.key === key);
}
function chapterAdd(key) { const c = chapterByKey(key); if (c && c.add) c.add(); }

// ── NAVIGATION ────────────────────────────────────────────────────────────────
// Sur l'accueil : rien. Dans un chapitre : un fil d'Ariane pour revenir.
function buildTabs() {
  const nav = document.getElementById('tabs-nav');
  if (enProd()) { buildProdTabs(nav); return; }
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
  searchQ = ''; fSport = ''; fSexe = ''; fPays = ''; fAgence = ''; fSubCat = ''; fLieuCat = ''; fLieuSport = '';
  buildTabs();
  render();
  window.scrollTo(0, 0);
}
function goHome() { if (enProd()) { prodGo('home'); return; } homeQ = ''; switchCat('home'); }
// Onglet « Production interne » (prod.js, chargé après ce fichier)
function enProd() { return typeof espace !== 'undefined' && espace === 'prod'; }

// ── RENDER ────────────────────────────────────────────────────────────────────
// Les ids de talents sont des nombres (ils sont écrits tels quels dans les
// onclick). Une fiche avec un id en texte ne s'ouvrirait pas : on la répare.
function fixTalentIds() {
  (db.talents || []).forEach(t => {
    if (typeof t.id === 'number') return;
    t.id = isNaN(Number(t.id)) || t.id === '' ? uid() : Number(t.id);
  });
}

function render() {
  fixTalentIds();
  updateCounts();
  const main = document.getElementById('main-content');
  if (enProd()) { renderProd(main); return; }

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
      color: cats[0]?.color || '#9a9a96', open: `openDetail('talent',${p.id})` });
  });
  db.clubs.forEach(c => { if (hit(c.nom, c.ville, c.pays, c.notes, c.lien)) rows.push({ name: c.nom, where: 'Club · ' + (c.ville || ''), color: '#5e7d4f', open: `openDetail('club',${c.id})` }); });
  lieuxList().forEach(l => { if (hit(l.nom, l.type, l.adresse, l.ville, l.pays, l.notes)) rows.push({ name: l.nom, where: 'Lieu · ' + (l.ville || l.type || ''), color: '#8a6fa8', open: `openDetail('lieu',${l.id})` }); });
  db.agences.forEach(a => { if (hit(a.nom, a.ville, a.pays)) rows.push({ name: a.nom, where: 'Agence · ' + (a.ville || ''), color: '#2b2b2b', open: `openForm('agence',${a.id})` }); });
  db.marques.forEach((m, i) => { const nom = typeof m === 'string' ? m : m.nom; if (hit(nom)) rows.push({ name: nom, where: 'Marque', color: '#2b2b2b', open: `openForm('marque',${i})` }); });
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
  if (quickAddEnabled()) items.unshift({ label: 'Ajout rapide (lien, capture, texte)', color: '#111111', run: () => openQuickAdd() });
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

// Âge en nombre, ou null s'il n'est pas renseigné
function talentAge(p) {
  const n = parseInt(p.age, 10);
  return Number.isFinite(n) ? n : null;
}

// Trie par âge ; les profils sans âge restent à la fin
function sortTalents(list) {
  if (!fTri) return list;
  const dir = fTri === 'age-desc' ? -1 : 1;
  return list.slice().sort((a, b) => {
    const x = talentAge(a), y = talentAge(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir;
  });
}

function renderTalents(main) {
  const list = sortTalents(filterTalents());

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
    <select class="filter-sel" onchange="fTri=this.value;renderTalents(document.getElementById('main-content'))">
      <option value="">TRIER</option>
      <option value="age-asc"${fTri==='age-asc'?' selected':''}>ÂGE ↑ (plus jeunes)</option>
      <option value="age-desc"${fTri==='age-desc'?' selected':''}>ÂGE ↓ (plus âgés)</option>
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
// Catégories de lieux, pour trier la carte et la liste. L'équipe peut en ajouter
// depuis le site (gardées dans db.lieuCategories, partagées avec la base).
const LIEU_CATEGORIES = ['Rue', 'Ville', 'Urbain', 'Nature', 'Forêt', 'Montagne', 'Mer', 'Océan', 'Lac', 'Rivière',
  'Plage', 'Désert', 'Campagne', 'Neige', 'Stade', 'Infrastructure', 'Bâtiment', 'Maison', 'Atypique', 'Architecture', 'Industriel'];

// Anciennes catégories (première version) → nouvelles
const LIEU_CATEGORIES_RENOMMEES = {
  'Rue / Urbain': ['Rue', 'Urbain'], 'Mer / Plage': ['Mer', 'Plage'], 'Lac / Rivière': ['Lac', 'Rivière'],
  'Stade / Sport': ['Stade'], 'Intérieur': ['Bâtiment'], 'Autre': [],
};

const sansAccent = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function uniqCats(list) {
  const seen = new Set();
  return list.map(c => String(c || '').trim()).filter(c => c && !seen.has(sansAccent(c)) && seen.add(sansAccent(c)));
}

function lieuCategoryList() {
  const used = lieuxList().flatMap(l => Array.isArray(l.categories) ? lieuCats(l) : []);
  return uniqCats([...LIEU_CATEGORIES, ...(db.lieuCategories || []), ...used]);
}

// Les lieux créés avant les catégories n'ont qu'un « type » libre : on le rattache à une catégorie si possible
function lieuCats(l) {
  if (Array.isArray(l.categories)) return uniqCats(l.categories.flatMap(c => LIEU_CATEGORIES_RENOMMEES[c] || [c]));
  const t = sansAccent(l.type);
  if (!t) return [];
  return uniqCats([...LIEU_CATEGORIES, ...(db.lieuCategories || [])]).filter(c => t.includes(sansAccent(c)));
}

function lieuCatsGridHtml(checked) {
  return lieuCategoryList().map(c => `<label class="cat-check">
        <input type="checkbox" name="lieu-cat" value="${esc(c)}" ${checked.includes(c) ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('');
}

function addLieuCategory() {
  const input = document.getElementById('f-new-cat');
  const nom = (input && input.value || '').trim();
  if (!nom) { if (input) input.focus(); return; }
  const checked = [...document.querySelectorAll('input[name="lieu-cat"]:checked')].map(el => el.value);
  const existing = lieuCategoryList().find(c => sansAccent(c) === sansAccent(nom));
  if (!existing) {
    db.lieuCategories = uniqCats([...(db.lieuCategories || []), nom]);
    saveDb();
  }
  document.getElementById('lieu-cats-grid').innerHTML = lieuCatsGridHtml(uniqCats([...checked, existing || nom]));
  input.value = '';
}

// Sports / disciplines shootés sur un lieu (même liste que les talents, plus ceux ajoutés ici)
function lieuSports(l) { return uniqCats(Array.isArray(l.sports) ? l.sports : []); }

function lieuSportList() {
  return uniqCats([...db.sports, ...lieuxList().flatMap(lieuSports)]);
}

function lieuSportsGridHtml(checked) {
  return lieuSportList().map(s => `<label class="cat-check">
        <input type="checkbox" name="lieu-sport" value="${esc(s)}" ${checked.includes(s) ? 'checked' : ''}><span>${esc(s)}</span></label>`).join('');
}

function addLieuSport() {
  const input = document.getElementById('f-new-sport');
  const nom = (input && input.value || '').trim();
  if (!nom) { if (input) input.focus(); return; }
  const checked = [...document.querySelectorAll('input[name="lieu-sport"]:checked')].map(el => el.value);
  const existing = lieuSportList().find(x => sansAccent(x) === sansAccent(nom));
  if (!existing) { db.sports.push(nom); saveDb(); }
  document.getElementById('lieu-sports-grid').innerHTML = lieuSportsGridHtml(uniqCats([...checked, existing || nom]));
  input.value = '';
}

const LIEU_PHOTOS_MAX = 3; // par type : 3 photos de campagne, 3 photos iPhone
const LIEU_PHOTO_KINDS = [['campagne', 'PHOTOS DE CAMPAGNE'], ['iphone', 'PHOTOS IPHONE']];

function lieuPhotoUrls(l) {
  // Photos importées (serveur) puis liens collés à la main
  const imported = getLieuPhotos(l.id).map(p => ({ id: p.id, url: p.url, full: p.full, kind: p.kind, date: p.date }));
  const links = (l.photos || []).map(normalizePhotoUrl).filter(Boolean).map(u => ({ id: u, url: u, full: u, kind: 'campagne' }));
  return [...imported, ...links];
}

// Photo de couverture choisie par l'équipe (l.cover = id de la photo), sinon la première
function lieuCoverPhoto(l, photos) {
  photos = photos || lieuPhotoUrls(l);
  return photos.find(p => l.cover && p.id === l.cover) || photos[0] || null;
}

function setLieuCover(lieuId, photoId) {
  const l = lieuxList().find(x => x.id === lieuId);
  if (!l) return;
  l.cover = photoId;
  saveDb();
  render();
  openDetail('lieu', lieuId);
}
// « 47.8389, -4.3519 » → { lat, lng }
function parseGps(v) {
  const m = String(v || '').match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.')), lng = Number(m[2].replace(',', '.'));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function formatGps(c) { return c.lat.toFixed(6) + ', ' + c.lng.toFixed(6); }
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

// Lien Google Maps → coordonnées. Les liens longs se lisent directement ; les
// liens courts (maps.app.goo.gl) passent par le serveur qui suit la redirection.
async function resolveMapsLink(link) {
  link = String(link || '').trim();
  if (!link) throw new Error('Colle un lien Google Maps.');
  const direct = parseGps(link);
  if (direct && !/^https?:/i.test(link)) return { ...direct, nom: '', url: '' };
  let decoded = link; try { decoded = decodeURIComponent(link); } catch {}
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const trouve = (re, dernier) => {
    const all = [...decoded.matchAll(new RegExp(re, 'g'))];
    return all.length ? all[dernier ? all.length - 1 : 0] : null;
  };
  // Le dernier « !3d…!4d… » est la position du lieu (les précédents peuvent être un point déposé à côté)
  const m = trouve(`!3d${num}!4d${num}`, true)
    || trouve(`[?&](?:q|query|ll|destination|center)=${num},\\s*\\+?${num}`)
    || trouve(`/search/${num},\\s*\\+?${num}`)
    || trouve(`@${num},${num}`);
  if (m) {
    const place = decoded.match(/\/maps\/place\/([^/@?]+)/);
    return { lat: Number(m[1]), lng: Number(m[2]), nom: place ? place[1].replace(/\+/g, ' ') : '', url: link };
  }
  const res = await fetch(SERVER_URL + '/maps?url=' + encodeURIComponent(link));
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.error || typeof out.lat !== 'number') throw new Error(out.error || 'Lien illisible.');
  return { lat: out.lat, lng: out.lng, nom: out.nom || '', url: link };
}

async function addLieuFromMapsLink() {
  const input = document.getElementById('lieu-maps-link');
  const btn = document.getElementById('lieu-maps-go');
  const link = input.value.trim();
  if (!link) { input.focus(); return; }
  btn.disabled = true; btn.textContent = 'LECTURE…';
  try {
    const r = await resolveMapsLink(link);
    openForm('lieu', undefined, { prefill: { nom: r.nom, gps: formatGps(r), maps: /^https?:/i.test(link) ? link : '' } });
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'AJOUTER';
  }
}

// ── Grande carte des lieux : globe 3D (MapLibre), comme dans Plans d'Apple
let lieuxMap = null;
let lieuxMapView = null;  // { center, zoom, bearing, pitch } gardé entre deux affichages
let lieuxPopup = null;    // cadre « ajouter un lieu ici » ouvert sur la carte
let lieuxHoverPopup = null;

// Fonds gratuits et sans clé : plan OpenFreeMap (données OpenStreetMap) et satellite Esri
const LIEUX_FONDS = {
  plan: 'https://tiles.openfreemap.org/styles/liberty',
  satellite: {
    version: 8,
    sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
  },
};
let lieuxFond = (() => { try { return localStorage.getItem('lieuxFond') === 'satellite' ? 'satellite' : 'plan'; } catch { return 'plan'; } })();

function closeLieuxPopup() {
  if (lieuxPopup) { lieuxPopup.remove(); lieuxPopup = null; }
}

function openLieuxPopup(lngLat, box) {
  closeLieuxPopup();
  lieuxPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px' })
    .setLngLat(lngLat).setDOMContent(box).addTo(lieuxMap);
}

function setLieuxFond(fond) {
  lieuxFond = fond;
  try { localStorage.setItem('lieuxFond', fond); } catch {}
  document.querySelectorAll('.globe-fonds button').forEach(b => b.classList.toggle('on', b.dataset.fond === fond));
  if (lieuxMap) lieuxMap.setStyle(LIEUX_FONDS[fond]);
  if (lieuFicheMap) lieuFicheMap.setStyle(LIEUX_FONDS[fond]);
}

// Pins regroupés : les lieux trop proches pour être distingués à ce zoom forment un seul pin
// avec leur nombre ; un clic ouvre un cadre qu'on fait défiler avec des flèches.
let lieuxMarkers = [];
const LIEUX_GROUPE_PX = 26; // écart minimal (en pixels) entre deux pins

function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function groupLieux(list, zoom) {
  const seuil = LIEUX_GROUPE_PX * 40075 / (512 * Math.pow(2, zoom)); // km couverts par ces pixels
  const groupes = [];
  list.forEach(l => {
    const c = parseGps(l.gps);
    if (!c) return;
    const g = groupes.find(g => distKm(g.c, c) < seuil);
    if (g) { g.lieux.push(l); g.pts.push(c); g.c = { lat: g.pts.reduce((s, p) => s + p.lat, 0) / g.pts.length, lng: g.pts.reduce((s, p) => s + p.lng, 0) / g.pts.length }; }
    else groupes.push({ c, lieux: [l], pts: [c] });
  });
  return groupes;
}

function hideLieuxHover() { if (lieuxHoverPopup) { lieuxHoverPopup.remove(); lieuxHoverPopup = null; } }

function renderLieuxPins(map, list) {
  lieuxMarkers.forEach(m => m.remove());
  lieuxMarkers = [];
  hideLieuxHover();
  groupLieux(list, map.getZoom()).forEach(g => {
    const n = g.lieux.length;
    const pin = document.createElement('div');
    pin.className = 'lieu-pin' + (g.lieux.some(l => lieuProjets(l).length) ? ' tourne' : '') + (n > 1 ? ' groupe' : '');
    pin.innerHTML = n > 1 ? `<span>${n}</span>` : '<span></span>';
    pin.setAttribute('aria-label', n > 1 ? `${n} lieux` : g.lieux[0].nom);
    pin.addEventListener('click', e => {
      e.stopPropagation(); hideLieuxHover();
      if (n === 1) { closeLieuxPopup(); openDetail('lieu', g.lieux[0].id); }
      else openLieuxGroupe(g, 0);
    });
    pin.addEventListener('mouseenter', () => {
      hideLieuxHover();
      lieuxHoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'lieu-hover' })
        .setLngLat([g.c.lng, g.c.lat]).setText(n > 1 ? `${n} lieux : ${g.lieux.map(l => l.nom).join(', ')}` : g.lieux[0].nom).addTo(map);
    });
    pin.addEventListener('mouseleave', hideLieuxHover);
    lieuxMarkers.push(new maplibregl.Marker({ element: pin }).setLngLat([g.c.lng, g.c.lat]).addTo(map));
  });
}

function openLieuxGroupe(g, i) {
  const n = g.lieux.length;
  i = (i + n) % n;
  const l = g.lieux[i];
  const cover = lieuCoverPhoto(l);
  const ou = [l.ville, l.pays && ((FLAGS[l.pays] || '') + ' ' + l.pays).trim()].filter(Boolean).join(' · ');
  const box = document.createElement('div');
  box.className = 'lieu-popup lieu-groupe';
  box.innerHTML = `
    <div class="lieu-groupe-nav">
      <button type="button" class="lieu-groupe-fleche" data-pas="-1" aria-label="Lieu précédent">‹</button>
      <span class="lieu-groupe-compte">${i + 1} / ${n}</span>
      <button type="button" class="lieu-groupe-fleche" data-pas="1" aria-label="Lieu suivant">›</button>
    </div>
    ${cover ? `<img class="lieu-groupe-img" src="${esc(cover.url)}" alt="">` : ''}
    <div class="lieu-popup-nom">${esc(l.nom)}</div>
    ${ou ? `<div class="lieu-popup-gps">${esc(ou)}</div>` : ''}
    <div class="lieu-groupe-actions">
      <button type="button" class="btn-add" data-action="ouvrir">OUVRIR LA FICHE</button>
      <button type="button" class="btn-ig" data-action="zoomer">ZOOMER</button>
    </div>`;
  box.addEventListener('click', e => e.stopPropagation());
  box.querySelectorAll('.lieu-groupe-fleche').forEach(b => b.onclick = () => openLieuxGroupe(g, i + Number(b.dataset.pas)));
  box.querySelector('[data-action="ouvrir"]').onclick = () => { closeLieuxPopup(); openDetail('lieu', l.id); };
  box.querySelector('[data-action="zoomer"]').onclick = () => {
    closeLieuxPopup();
    const lngs = g.pts.map(p => p.lng), lats = g.pts.map(p => p.lat);
    lieuxMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, maxZoom: 17, duration: 2000 });
  };
  openLieuxPopup([g.c.lng, g.c.lat], box);
}

function initLieuxMap(list) {
  const el = document.getElementById('lieux-map');
  closeLieuxPopup();
  if (lieuxMap) {
    lieuxMapView = { center: lieuxMap.getCenter(), zoom: lieuxMap.getZoom(), bearing: lieuxMap.getBearing(), pitch: lieuxMap.getPitch() };
    lieuxMap.remove(); lieuxMap = null;
  }
  if (!el) return;
  const indispo = () => { el.innerHTML = '<div class="empty">CARTE INDISPONIBLE</div>'; };
  if (typeof maplibregl === 'undefined') return indispo();

  const pts = list.map(l => parseGps(l.gps)).filter(Boolean);
  // Au départ on voit le globe entier (à la taille de l'écran), tourné vers les lieux
  const zoomGlobe = 1.6 + Math.log2(Math.max(200, 0.85 * Math.min(el.clientWidth, el.clientHeight)) / 510);
  const depart = pts.length
    ? { center: [pts.reduce((s, c) => s + c.lng, 0) / pts.length, pts.reduce((s, c) => s + c.lat, 0) / pts.length], zoom: zoomGlobe }
    : { center: [5, 30], zoom: zoomGlobe };

  let map;
  try {
    map = new maplibregl.Map({
      container: el, style: LIEUX_FONDS[lieuxFond], ...(lieuxMapView || depart),
      attributionControl: { compact: true }, maxPitch: 75,
    });
  } catch (e) { console.error(e); return indispo(); }
  lieuxMap = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

  // Globe et halo d'atmosphère (à remettre à chaque changement de fond)
  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
    try { map.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] }); } catch {}
  });

  const fonds = document.createElement('div');
  fonds.className = 'globe-fonds';
  fonds.innerHTML = `<button type="button" data-fond="plan">PLAN</button><button type="button" data-fond="satellite">SATELLITE</button>`;
  fonds.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.fond === lieuxFond);
    b.onclick = e => { e.stopPropagation(); setLieuxFond(b.dataset.fond); };
  });
  el.appendChild(fonds);

  // Les pins se regroupent selon le zoom
  renderLieuxPins(map, list);
  map.on('zoomend', () => renderLieuxPins(map, list));

  // Clic sur la carte : proposer d'ajouter un lieu à cet endroit
  // (un clic quand le cadre est ouvert ne fait que le fermer)
  map.on('click', e => {
    if (e.originalEvent && e.originalEvent.target.closest('.lieu-pin, .globe-fonds, .maplibregl-popup')) return;
    if (lieuxPopup) { closeLieuxPopup(); return; }
    const c = { lat: e.lngLat.lat, lng: ((e.lngLat.lng + 540) % 360) - 180 };
    const box = document.createElement('div');
    box.className = 'lieu-popup';
    box.innerHTML = `<div class="lieu-popup-gps">${formatGps(c)}</div><button type="button" class="btn-add">+ AJOUTER UN LIEU ICI</button>`;
    box.querySelector('button').onclick = () => {
      closeLieuxPopup();
      openForm('lieu', undefined, { prefill: { gps: formatGps(c), maps: 'https://www.google.com/maps/search/?api=1&query=' + c.lat.toFixed(6) + ',' + c.lng.toFixed(6) } });
    };
    openLieuxPopup(e.lngLat, box);
  });
}

// Clic en dehors de la carte ou touche Échap : on ferme le cadre « ajouter un lieu ici »
document.addEventListener('click', e => {
  if (lieuxPopup && !e.target.closest('#lieux-map')) closeLieuxPopup();
  const wr = document.getElementById('world-results');
  if (wr && !e.target.closest('.lieux-search')) wr.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLieuxPopup();
});

function lieuxFiltered(withSearch) {
  const q = searchQ.toLowerCase();
  return lieuxList().filter(l => {
    if (withSearch && q && ![l.nom,l.type,lieuCats(l).join(' '),l.adresse,l.ville,l.pays,l.contact,l.description,l.notes,l.coutDetail,
        lieuProjets(l).map(p => p.nom + ' ' + p.annee).join(' '), lieuSports(l).join(' ')]
      .some(v => String(v||'').toLowerCase().includes(q))) return false;
    if (fPays && l.pays !== fPays) return false;
    if (fLieuSport && !lieuSports(l).includes(fLieuSport)) return false;
    if (fLieuCat === LIEU_DEJA_TOURNE) { if (!lieuProjets(l).length) return false; }
    else if (fLieuCat && !lieuCats(l).includes(fLieuCat)) return false;
    return true;
  });
}

function renderLieux(main) {
  // pays déjà utilisés d'abord (avec leur nombre de lieux), puis tous les autres
  const paysCount = {};
  lieuxList().forEach(l => { if (l.pays) paysCount[l.pays] = (paysCount[l.pays] || 0) + 1; });
  const paysUtil = Object.keys(paysCount).sort((a, b) => a.localeCompare(b, 'fr'));
  const paysAutres = ALL_COUNTRIES.filter(p => !paysCount[p]);
  const sportsUtil = uniqCats(lieuxList().flatMap(lieuSports)).sort((a, b) => a.localeCompare(b, 'fr'));
  const onMap = lieuxFiltered(false); // la carte montre tous les lieux, la recherche ne trie que la liste
  const sansGps = onMap.filter(l => !parseGps(l.gps));

  main.innerHTML = `<div class="toolbar">
    <div class="search-wrap lieux-search">
      <input id="lieux-q" placeholder="Chercher un lieu, une ville, n'importe où…" value="${esc(searchQ)}" autocomplete="off"
             oninput="lieuxSearchInput(this.value)" onkeydown="lieuxSearchKey(event)">
      <div class="world-results" id="world-results"></div>
    </div>
    <select class="filter-sel" onchange="fLieuCat=this.value;renderLieux(document.getElementById('main-content'))">
      <option value="">CATÉGORIE</option>
      <option value="${LIEU_DEJA_TOURNE}"${fLieuCat===LIEU_DEJA_TOURNE?' selected':''}>★ Déjà tourné ici (${lieuxList().filter(l=>lieuProjets(l).length).length})</option>
      ${lieuCategoryList().map(c=>`<option value="${esc(c)}"${fLieuCat===c?' selected':''}>${esc(c)} (${lieuxList().filter(l=>lieuCats(l).includes(c)).length})</option>`).join('')}
    </select>
    ${sportsUtil.length || fLieuSport ? `<select class="filter-sel" onchange="fLieuSport=this.value;renderLieux(document.getElementById('main-content'))">
      <option value="">SPORT</option>
      ${sportsUtil.map(x=>`<option value="${esc(x)}"${fLieuSport===x?' selected':''}>${esc(x)} (${lieuxList().filter(l=>lieuSports(l).includes(x)).length})</option>`).join('')}
    </select>` : ''}
    <select class="filter-sel" onchange="fPays=this.value;renderLieux(document.getElementById('main-content'))">
      <option value="">PAYS</option>
      ${paysUtil.length ? `<optgroup label="Avec des lieux">${paysUtil.map(p=>`<option value="${esc(p)}"${fPays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)} (${paysCount[p]})</option>`).join('')}</optgroup>` : ''}
      <optgroup label="Tous les pays">${paysAutres.map(p=>`<option value="${esc(p)}"${fPays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}</optgroup>
    </select>
    <button class="btn-ig lieux-export-btn" onclick="openLieuxExport()">EXPORTER EN PDF</button>
    <div class="spacer"></div>
    <div class="lieu-maps-add">
      <input id="lieu-maps-link" placeholder="Colle un lien Google Maps" onkeydown="if(event.key==='Enter')addLieuFromMapsLink()">
      <button class="btn-add" id="lieu-maps-go" style="background:var(--accent2)" onclick="addLieuFromMapsLink()">AJOUTER</button>
    </div>
  </div>
  <div id="lieux-map" class="lieux-map"></div>
  <div class="lieux-map-hint">Fais tourner le globe et zoome pour t'approcher. Clique sur un pin pour ouvrir le lieu, ou n'importe où sur la carte pour en ajouter un. La recherche trouve tes lieux et n'importe quel endroit du monde.${sansGps.length ? ` ${sansGps.length} lieu${sansGps.length > 1 ? 'x' : ''} sans coordonnées GPS ne ${sansGps.length > 1 ? 'sont' : 'est'} pas sur la carte.` : ''}</div>
  <div id="lieux-list"></div>`;
  renderLieuxList();
  initLieuxMap(onMap);
  if (searchQ.trim().length >= 3) scheduleWorldSearch();
}

// Seule la liste est redessinée pendant la frappe : le champ garde le focus et la carte ne bouge pas
function renderLieuxList() {
  const box = document.getElementById('lieux-list');
  if (!box) return;
  const list = lieuxFiltered(true);
  let html = '';
  if (!list.length) {
    html += `<div class="empty">${lieuxList().length ? (searchQ ? 'AUCUN DE TES LIEUX NE CORRESPOND' : 'AUCUN LIEU TROUVÉ') : 'AUCUN LIEU POUR LE MOMENT'}</div>`;
  } else {
    html += `<div class="grid lieux-grid">`;
    list.forEach(l => {
      const photos = lieuPhotoUrls(l);
      const cover = lieuCoverPhoto(l, photos)?.url;
      html += `<div class="card" onclick="openDetail('lieu',${l.id})">`;
      if (cover) {
        html += `<img class="card-img lieu" src="${esc(cover)}" alt="${esc(l.nom)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="card-ph lieu" style="display:none">${initials(l.nom,'')}</div>`;
      } else {
        html += `<div class="card-ph lieu">${initials(l.nom,'')}</div>`;
      }
      if (photos.length > 1) html += `<span class="card-age">${photos.length} PHOTOS</span>`;
      if (lieuProjets(l).length) html += `<span class="card-tourne">★ DÉJÀ TOURNÉ</span>`;
      if (l.cout !== '' && l.cout !== undefined) html += `<div class="card-ig-hover" style="color:var(--accent2)">≈ ${esc(formatCout(l.cout))}</div>`;
      html += `<div class="card-body">
        <div class="card-name">${esc(l.nom)}</div>
        <div class="card-meta">
          ${lieuSports(l).map(x => `<span class="tag sport">${esc(x)}</span>`).join('')}
          ${lieuCats(l).map(c => `<span class="tag agence">${esc(c)}</span>`).join('')}
          ${!lieuCats(l).length && l.type ? `<span class="tag agence">${esc(l.type)}</span>` : ''}
          ${l.ville ? `<span class="tag">${esc(l.ville)}</span>` : ''}
          ${l.pays ? `<span class="tag">${FLAGS[l.pays]||''} ${esc(l.pays)}</span>` : ''}
        </div>
      </div></div>`;
    });
    html += `</div>`;
  }
  box.innerHTML = html;
}

// ── Recherche dans le monde entier (OpenStreetMap / Nominatim, gratuit, sans clé)
let worldSearchTimer = null;
let worldSearchSeq = 0;
let worldResults = [];

function lieuxSearchInput(v) {
  searchQ = v;
  renderLieuxList();
  scheduleWorldSearch();
}

function scheduleWorldSearch() {
  clearTimeout(worldSearchTimer);
  const q = searchQ.trim();
  if (q.length < 3) { showWorldResults([], ''); return; }
  worldSearchTimer = setTimeout(() => runWorldSearch(q), 500); // au plus une requête par pause de frappe
}

async function runWorldSearch(q) {
  const seq = ++worldSearchSeq;
  showWorldResults(null, q);
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=fr&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = res.ok ? await res.json() : [];
    if (seq !== worldSearchSeq) return; // une recherche plus récente est partie entre-temps
    showWorldResults(data.map(r => ({
      nom: r.name || String(r.display_name || '').split(',')[0],
      detail: r.display_name || '',
      lat: Number(r.lat), lng: Number(r.lon),
      bbox: (r.boundingbox || []).map(Number),
      pays: (r.address && r.address.country) || '',
      ville: (r.address && (r.address.city || r.address.town || r.address.village || r.address.municipality)) || '',
    })).filter(r => !isNaN(r.lat) && !isNaN(r.lng)), q);
  } catch (e) {
    if (seq === worldSearchSeq) showWorldResults([], q, true);
  }
}

function showWorldResults(results, q, failed) {
  const box = document.getElementById('world-results');
  if (!box) return;
  if (results === null) { box.innerHTML = `<div class="world-results-msg">Recherche de « ${esc(q)} » dans le monde…</div>`; box.style.display = 'block'; return; }
  worldResults = results;
  if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.innerHTML = `<div class="world-results-lbl">DANS LE MONDE</div>` + (results.length
    ? results.map((r, i) => `<button type="button" class="world-result" onclick="goToWorldResult(${i})">
        <span class="world-result-nom">${esc(r.nom)}</span><span class="world-result-detail">${esc(r.detail)}</span></button>`).join('')
    : `<div class="world-results-msg">${failed ? 'La recherche dans le monde ne répond pas.' : 'Aucun endroit trouvé.'}</div>`);
  box.style.display = 'block';
}

function lieuxSearchKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (worldResults.length) goToWorldResult(0);
    else { clearTimeout(worldSearchTimer); if (searchQ.trim().length >= 2) runWorldSearch(searchQ.trim()); }
  } else if (e.key === 'Escape') {
    showWorldResults([], '');
  }
}

function goToWorldResult(i) {
  const r = worldResults[i];
  if (!r || !lieuxMap) return;
  showWorldResults([], '');
  document.getElementById('lieux-q')?.blur();
  closeLieuxPopup();
  // On vole jusqu'à l'endroit, comme dans Plans
  const [s, n, w, e] = r.bbox;
  if (r.bbox.length === 4 && !r.bbox.some(isNaN) && (n - s > 0.002 || e - w > 0.002)) lieuxMap.fitBounds([[w, s], [e, n]], { maxZoom: 15, padding: 40, duration: 2500 });
  else lieuxMap.flyTo({ center: [r.lng, r.lat], zoom: 15, duration: 2500 });
  document.getElementById('lieux-map').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const c = { lat: r.lat, lng: r.lng };
  const box = document.createElement('div');
  box.className = 'lieu-popup';
  box.innerHTML = `<div class="lieu-popup-nom">${esc(r.nom)}</div><div class="lieu-popup-gps">${formatGps(c)}</div><button type="button" class="btn-add">+ AJOUTER CE LIEU</button>`;
  box.querySelector('button').onclick = () => {
    closeLieuxPopup();
    openForm('lieu', undefined, { prefill: {
      nom: r.nom, gps: formatGps(c), ville: r.ville,
      pays: ALL_COUNTRIES.includes(r.pays) ? r.pays : '',
      maps: 'https://www.google.com/maps/search/?api=1&query=' + c.lat.toFixed(6) + ',' + c.lng.toFixed(6),
    } });
  };
  // Ouvert juste après, pour que le clic qui l'a demandé ne le referme pas
  setTimeout(() => openLieuxPopup([r.lng, r.lat], box), 0);
}

// Les dates ne s'affichent que sur les photos iPhone (les photos de campagne sont des captures)
function lieuGalleryHtml(photos, label, kind, l) {
  if (!photos.length) return '';
  const withDate = kind === 'iphone';
  const items = photos.map(p => ({ src: p.full || p.url, caption: withDate ? formatPhotoDate(p.date) : '' }));
  const data = esc(JSON.stringify(items));
  return `<div class="lieu-gallery-lbl">${label}</div>
    <div class="lieu-gallery n-${Math.min(photos.length, 4)}" data-photos="${data}">
      ${photos.map((p, i) => {
        const isCover = l && p.id && lieuCoverPhoto(l)?.id === p.id;
        const star = l && p.id ? `<button type="button" class="lieu-cover-btn${isCover ? ' on' : ''}" title="${isCover ? 'Photo de couverture' : 'Choisir comme photo de couverture'}"
          onclick="event.stopPropagation();setLieuCover(${l.id}, ${esc(JSON.stringify(p.id))})">${isCover ? '★ COUVERTURE' : '☆'}</button>` : '';
        return `<div class="lieu-gallery-item" role="button" tabindex="0" onclick="openLightboxFrom(this.parentElement, ${i})"><img src="${esc(p.url)}" alt="" onerror="this.parentElement.style.display='none'">${items[i].caption ? `<span class="lieu-photo-date">${esc(items[i].caption)}</span>` : ''}${star}</div>`;
      }).join('')}
    </div>`;
}

// « 2025-06-14 » → « 14 juin 2025 » ; « 2025-06-14T18:42 » → « 14 juin 2025 à 18h42 »
function formatPhotoDate(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return '';
  const jour = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return m[4] ? `${jour} à ${m[4]}h${m[5]}` : jour;
}

// ── Agrandir une photo sans quitter le site (flèches et Échap au clavier, glisser au doigt)
let lightbox = null;

function openLightboxFrom(gallery, i) {
  let items = [];
  try { items = JSON.parse(gallery.dataset.photos || '[]'); } catch {}
  if (items.length) openLightbox(items, i);
}

function openLightbox(items, i) {
  if (!lightbox) {
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.innerHTML = `<button type="button" class="lightbox-close" title="Fermer">✕</button>
      <button type="button" class="lightbox-nav prev" title="Précédente">‹</button>
      <figure><img alt=""><figcaption></figcaption></figure>
      <button type="button" class="lightbox-nav next" title="Suivante">›</button>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.lightbox-nav')) { stepLightbox(e.target.closest('.next') ? 1 : -1); return; }
      if (!e.target.closest('img')) closeLightbox();
    });
    let x0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    });
    document.body.appendChild(el);
    lightbox = { el, items: [], i: 0 };
  }
  lightbox.items = items;
  lightbox.i = i;
  lightbox.el.classList.add('open');
  lightbox.el.classList.toggle('single', items.length < 2);
  showLightbox();
}

function showLightbox() {
  const { el, items, i } = lightbox;
  el.querySelector('img').src = items[i].src;
  el.querySelector('figcaption').textContent = items[i].caption || '';
}

function stepLightbox(d) {
  if (!lightbox || lightbox.items.length < 2) return;
  lightbox.i = (lightbox.i + d + lightbox.items.length) % lightbox.items.length;
  showLightbox();
}

function closeLightbox() {
  if (lightbox) lightbox.el.classList.remove('open');
}

function lightboxOpen() { return !!(lightbox && lightbox.el.classList.contains('open')); }

document.addEventListener('keydown', e => {
  if (!lightboxOpen()) return;
  if (e.key === 'Escape') { closeLightbox(); e.stopImmediatePropagation(); }
  else if (e.key === 'ArrowRight') stepLightbox(1);
  else if (e.key === 'ArrowLeft') stepLightbox(-1);
}, true);

// ── Vidéos des lieux : des liens (YouTube, Vimeo, Google Drive, Dropbox, fichier vidéo)
function lieuVideoEmbed(link) {
  let u; try { u = new URL(link); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let m;
  if (host === 'youtu.be') return { iframe: 'https://www.youtube-nocookie.com/embed/' + u.pathname.slice(1).split('/')[0] };
  if (host.endsWith('youtube.com')) {
    const id = u.searchParams.get('v') || ((m = u.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)) && m[1]);
    if (id) return { iframe: 'https://www.youtube-nocookie.com/embed/' + id, portrait: u.pathname.startsWith('/shorts') };
  }
  if (host === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return { iframe: 'https://player.vimeo.com/video/' + m[1] };
  if (host === 'drive.google.com' && (m = u.pathname.match(/\/file\/d\/([^/]+)/))) return { iframe: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
  if (host.endsWith('dropbox.com')) { u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); return { video: u.toString() }; }
  if (/\.(mp4|mov|webm|m4v)$/i.test(u.pathname)) return { video: link };
  return null;
}

function lieuVideosHtml(l) {
  const links = (l.videos || []).filter(Boolean);
  if (!links.length) return '';
  return `<div class="lieu-gallery-lbl">VIDÉOS</div><div class="lieu-videos">` + links.map(link => {
    const e = lieuVideoEmbed(link);
    if (e && e.iframe) return `<div class="lieu-video${e.portrait ? ' portrait' : ''}"><iframe src="${esc(e.iframe)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    if (e && e.video) return `<div class="lieu-video"><video src="${esc(e.video)}" controls playsinline preload="metadata"></video></div>`;
    return `<a class="btn-ig lieu-video-link" href="${esc(link)}" target="_blank">VOIR LA VIDÉO ↗</a>`;
  }).join('') + `</div>`;
}

// ── Projets déjà tournés sur un lieu : nom, année et lien Dropbox vers la vidéo finale
const LIEU_DEJA_TOURNE = '__tourne';

function lieuProjets(l) {
  return (Array.isArray(l.projets) ? l.projets : []).filter(p => p && (p.nom || p.lien));
}

function lieuProjetsHtml(l) {
  const projets = lieuProjets(l);
  if (!projets.length) return '';
  return `<div class="lieu-projets"><div class="lieu-projets-lbl">PROJETS TOURNÉS ICI</div>` + projets.map((p, i) => {
    const titre = `<span class="lieu-projet-nom">${esc(p.nom || 'Projet')}</span>${p.annee ? `<span class="lieu-projet-annee">${esc(p.annee)}</span>` : ''}`;
    const dossier = p.dossier && p.dossier !== p.lien ? `<a class="lieu-projet-dossier" href="${esc(p.dossier)}" target="_blank" rel="noopener">DOSSIER DU PROJET ↗</a>` : '';
    const del = `<button type="button" class="lieu-projet-del" title="Retirer ce projet" onclick="removeLieuProjet(${l.id},${i})">✕</button>`;
    return p.lien
      ? `<div class="lieu-projet-wrap"><a class="lieu-projet" href="${esc(p.lien)}" target="_blank" rel="noopener">${titre}<span class="lieu-projet-go">▶ VOIR LA VIDÉO FINALE ↗</span></a>${del}</div>${dossier}`
      : `<div class="lieu-projet-wrap"><div class="lieu-projet">${titre}</div>${del}</div>`;
  }).join('') + `</div>`;
}

function lieuById(id) { return lieuxList().find(l => l.id === id); }

function removeLieuProjet(lieuId, i) {
  const l = lieuById(lieuId);
  if (!l || !confirm('Retirer ce projet du lieu ?')) return;
  const list = lieuProjets(l);
  list.splice(i, 1);
  l.projets = list;
  saveDb();
  render();
  openDetail('lieu', lieuId);
}

function projetRowHtml(p) {
  p = p || {};
  return `<div class="projet-row" data-dossier="${esc(p.dossier||'')}">
    <input class="proj-nom" value="${esc(p.nom||'')}" placeholder="Nom du projet">
    <input class="proj-annee" value="${esc(p.annee||'')}" placeholder="Année" inputmode="numeric">
    <input class="proj-lien" value="${esc(p.lien||'')}" placeholder="Lien Dropbox (vidéo finale ou dossier)">
    <button type="button" class="projet-del" title="Retirer" onclick="this.parentElement.remove()">✕</button>
  </div>`;
}

function addProjetRow() {
  const box = document.getElementById('projets-rows');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', projetRowHtml());
  box.lastElementChild.querySelector('.proj-nom').focus();
}

function readProjetRows() {
  return [...document.querySelectorAll('#projets-rows .projet-row')].map(r => ({
    nom: r.querySelector('.proj-nom').value.trim(),
    annee: r.querySelector('.proj-annee').value.trim(),
    lien: r.querySelector('.proj-lien').value.trim(),
    ...(r.dataset.dossier ? { dossier: r.dataset.dossier } : {})
  })).filter(p => p.nom || p.lien);
}

// Fiche d'un lieu en largeur : infos et carte à gauche, photos et vidéos à droite
function lieuDetailHtml(l) {
  const photos = lieuPhotoUrls(l);
  const mapQ = lieuMapQuery(l);
  const mapsLink = lieuMapsLink(l);
  const gps = parseGps(l.gps);
  const media = LIEU_PHOTO_KINDS.map(([k, label]) => lieuGalleryHtml(photos.filter(p => p.kind === k), label, k, l)).join('') + lieuVideosHtml(l);
  const lieuTxt = [l.ville, l.pays && ((FLAGS[l.pays] || '') + ' ' + l.pays).trim()].filter(Boolean).join(' · ');
  return `<div class="lieu-detail${media ? '' : ' sans-media'}">
    <div class="lieu-col-info">
      <div class="lieu-titre">${esc(l.nom)}</div>
      ${lieuTxt ? `<div class="lieu-ou">${esc(lieuTxt)}</div>` : ''}
      ${lieuCats(l).length || l.type ? `<div class="detail-tags">
        ${lieuCats(l).map(c => `<span class="tag agence">${esc(c)}</span>`).join('')}
        ${l.type ? `<span class="tag">${esc(l.type)}</span>` : ''}
      </div>` : ''}
      ${lieuSports(l).length ? `<div class="lieu-sports"><span class="lieu-sports-lbl">SPORTS SHOOTÉS ICI</span>
        ${lieuSports(l).map(x => `<span class="tag sport">${esc(x)}</span>`).join('')}</div>` : ''}
      ${l.description ? `<div class="lieu-description">${esc(l.description)}</div>` : ''}
      ${l.descClient ? `<div class="detail-row"><span class="detail-lbl">POUR LE CLIENT</span><span class="detail-val pre">${esc(l.descClient)}</span></div>` : ''}
      ${lieuProjetsHtml(l)}
      ${l.adresse ? `<div class="detail-row"><span class="detail-lbl">ADRESSE</span><span class="detail-val">${esc(l.adresse)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-lbl">GPS</span><span class="detail-val">${gps ? esc(formatGps(gps)) : esc(l.gps || '—')}</span></div>
      ${l.cout !== '' && l.cout !== undefined ? `<div class="detail-row"><span class="detail-lbl">COÛT ESTIMÉ</span><span class="detail-val" style="color:var(--accent2)">${esc(formatCout(l.cout))}</span></div>` : ''}
      ${l.coutDetail ? `<div class="detail-row"><span class="detail-lbl">DÉTAIL COÛTS</span><span class="detail-val pre">${esc(l.coutDetail)}</span></div>` : ''}
      ${l.contact ? `<div class="detail-row"><span class="detail-lbl">CONTACT</span><span class="detail-val">${esc(l.contact)}</span></div>` : ''}
      ${l.tel ? `<div class="detail-row"><span class="detail-lbl">TEL</span><span class="detail-val"><a href="tel:${esc(l.tel)}">${esc(l.tel)}</a></span></div>` : ''}
      ${l.mail ? `<div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val"><a href="mailto:${esc(l.mail)}">${esc(l.mail)}</a></span></div>` : ''}
      ${l.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val pre">${esc(l.notes)}</span></div>` : ''}
      ${gps ? '<div class="lieu-map lieu-fiche-map" id="lieu-fiche-map"></div>'
        : mapQ ? lieuGoogleMapHtml(mapQ) : ''}
      ${mapsLink ? `<a class="btn-ig lieu-maps-btn" href="${esc(mapsLink)}" target="_blank">OUVRIR DANS GOOGLE MAPS ↗</a>` : ''}
    </div>
    ${media ? `<div class="lieu-col-media">${media}</div>` : ''}
  </div>`;
}

function lieuGoogleMapHtml(q) {
  return `<iframe class="lieu-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
    src="https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed"></iframe>`;
}

// Carte de la fiche d'un lieu : on zoome, dézoome (jusqu'au globe) et se déplace
// directement sur le site, à la souris comme au doigt. Les autres lieux y sont
// aussi : un clic dessus ouvre leur fiche.
let lieuFicheMap = null;

function closeLieuFicheMap() {
  if (lieuFicheMap) { lieuFicheMap.remove(); lieuFicheMap = null; }
}

function initLieuFicheMap(l) {
  closeLieuFicheMap();
  const el = document.getElementById('lieu-fiche-map');
  const c = parseGps(l.gps);
  if (!el || !c) return;
  if (typeof maplibregl === 'undefined') { el.outerHTML = lieuGoogleMapHtml(`${c.lat},${c.lng}`); return; }
  let map;
  try {
    map = new maplibregl.Map({
      container: el, style: LIEUX_FONDS[lieuxFond], center: [c.lng, c.lat], zoom: 13,
      attributionControl: { compact: true }, maxPitch: 75,
    });
  } catch (e) { console.error(e); el.outerHTML = lieuGoogleMapHtml(`${c.lat},${c.lng}`); return; }
  lieuFicheMap = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
    try { map.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] }); } catch {}
  });

  const barre = document.createElement('div');
  barre.className = 'globe-fonds';
  barre.innerHTML = `<button type="button" data-fond="plan">PLAN</button><button type="button" data-fond="satellite">SATELLITE</button><button type="button" class="recentrer" title="Revenir sur le lieu">RECENTRER</button>`;
  barre.querySelectorAll('[data-fond]').forEach(b => {
    b.classList.toggle('on', b.dataset.fond === lieuxFond);
    b.onclick = e => { e.stopPropagation(); setLieuxFond(b.dataset.fond); };
  });
  barre.querySelector('.recentrer').onclick = e => { e.stopPropagation(); map.flyTo({ center: [c.lng, c.lat], zoom: 13, bearing: 0, pitch: 0, duration: 1200 }); };
  el.appendChild(barre);

  // Les autres lieux, en plus petit
  lieuxList().forEach(o => {
    const oc = o.id !== l.id && parseGps(o.gps);
    if (!oc) return;
    const pin = document.createElement('div');
    pin.className = 'lieu-pin autre';
    pin.title = o.nom;
    pin.innerHTML = '<span></span>';
    pin.onclick = e => { e.stopPropagation(); openDetail('lieu', o.id); };
    new maplibregl.Marker({ element: pin }).setLngLat([oc.lng, oc.lat]).addTo(map);
  });
  const ici = document.createElement('div');
  ici.className = 'lieu-pin ici';
  ici.title = l.nom;
  ici.innerHTML = '<span></span>';
  new maplibregl.Marker({ element: ici }).setLngLat([c.lng, c.lat]).addTo(map);
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
  const paysl = `<option value="">—</option>` + ALL_COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
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

const CHAPTER_COLORS = ['#b5654a','#3f6e8c','#c49a2c','#5e7d4f','#8a6fa8','#b3261e','#111111'];

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
// Réponses au formulaire de check-in (remplies par integrations/checkin-google-sheet.gs).
const MENSURATIONS = [
  ['taille', 'TAILLE', 'cm'], ['poids', 'POIDS', 'kg'], ['poitrine', 'POITRINE', 'cm'],
  ['tourTaille', 'TOUR DE TAILLE', 'cm'], ['hanches', 'HANCHES', 'cm'], ['pointure', 'POINTURE', ''],
  ['tete', 'TOUR DE TÊTE', 'cm'], ['haut', 'TAILLE HAUT', ''], ['bas', 'TAILLE BAS', ''],
];
function mensurationsHtml(m) {
  if (!m) return '';
  const rows = MENSURATIONS.filter(([k]) => m[k]).map(([k, lbl, unit]) => {
    const v = String(m[k]);
    const withUnit = unit && /^[\d.,\s-]+$/.test(v) ? `${v} ${unit}` : v;
    return `<div class="mens-item"><span class="detail-lbl">${lbl}</span><span class="detail-val">${esc(withUnit)}</span></div>`;
  }).join('');
  return rows ? `<div class="checkin-block"><div class="checkin-title">MENSURATIONS</div><div class="mens-grid">${rows}</div></div>` : '';
}
function mensurationsFields(m) {
  m = m || {};
  return `<div class="field full"><label>MENSURATIONS</label><div class="mens-form">` +
    MENSURATIONS.map(([k, lbl, unit]) => `<div><span class="mens-lbl">${lbl}${unit ? ' (' + unit + ')' : ''}</span><input id="f-m-${k}" value="${esc(m[k]||'')}"></div>`).join('') +
    `</div></div>`;
}

const CHECKIN_LABELS = [
  ['papiers', 'PIÈCE D\'IDENTITÉ'], ['permis', 'PERMIS'],
  ['voyage', 'VOYAGE'], ['allergies', 'ALLERGIES'], ['intolerances', 'INTOLÉRANCES'],
  ['plat', 'PLAT PRÉFÉRÉ'], ['snack', 'SNACK'], ['boisson', 'BOISSON'],
  ['boissonChaude', 'BOISSON CHAUDE'], ['logistique', 'LOGISTIQUE'], ['equipement', 'MATÉRIEL'],
];
function checkinHtml(c) {
  if (!c) return '';
  const rows = CHECKIN_LABELS.filter(([k]) => c[k]).map(([k, lbl]) =>
    `<div class="detail-row"><span class="detail-lbl">${lbl}</span><span class="detail-val pre">${esc(c[k])}</span></div>`).join('');
  const date = c.date ? new Date(c.date).toLocaleDateString('fr-FR') : '';
  return `<div class="checkin-block">
    <div class="checkin-title">CHECK-IN${date ? ` <span>${esc(date)}</span>` : ''}</div>
    ${rows || '<div class="detail-row"><span class="detail-val">Rien de particulier à signaler.</span></div>'}
  </div>`;
}

function openDetail(type, pid, chapId) {
  detailType = type;
  detailId   = pid;
  detailChap = chapId !== undefined ? chapId : null;
  document.querySelector('#detail-modal .modal').classList.toggle('lieu-mode', type === 'lieu');
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
    document.getElementById('detail-title').textContent = '';
    document.getElementById('detail-body').innerHTML = lieuDetailHtml(p);
    document.getElementById('detail-modal').style.display = 'flex';
    initLieuFicheMap(p);
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
        ${mensurationsHtml(p.mensurations)}
        ${checkinHtml(p.checkin)}
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

function closeDetail() { document.getElementById('detail-modal').style.display = 'none'; closeLieuFicheMap(); }

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
    const p = isEdit ? db.talents.find(x => x.id === pid) : { cats: opts.cats || [], ...(opts.prefill || {}) };
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
    const l = isEdit ? lieuxList().find(x => x.id === pid) : { ...(opts.prefill || {}) };
    pendingLieuPhotos = [];
    pendingLieuRemovals = [];
    pendingLieuCover = (l && l.cover) || '';
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
    ${mensurationsFields(v.mensurations)}
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
let pendingLieuPhotos   = []; // { data, kind } importées, envoyées au SAUVEGARDER
let pendingLieuRemovals = []; // ids des photos du serveur à retirer au SAUVEGARDER
let pendingLieuCover    = ''; // id de la photo de couverture choisie dans le formulaire

function renderLieuForm(v) {
  const paysl = `<option value="">—</option>` + ALL_COUNTRIES.map(p => `<option value="${esc(p)}"${(v.pays||'')===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  const photoField = ([kind, label]) => `
    <div class="field full">
      <label>${label} (${LIEU_PHOTOS_MAX} max) · ★ = photo de couverture</label>
      <div class="photo-upload-row">
        <label class="btn-upload" for="f-lieu-files-${kind}">IMPORTER</label>
        <input type="file" id="f-lieu-files-${kind}" accept="image/*" multiple style="display:none" onchange="handleLieuPhotos(this,'${kind}')">
      </div>
      <div class="lieu-thumbs" id="lieu-thumbs-${kind}"></div>
    </div>`;

  document.getElementById('form-body').innerHTML = `
    <div class="field full"><label>NOM DU LIEU *</label><input id="f-nom" value="${esc(v.nom||'')}" placeholder="ex: Plage de la Torche"></div>
    <div class="field full">
      <label>LIEN GOOGLE MAPS</label>
      <div class="photo-upload-row">
        <input id="f-maps" value="${esc(v.maps||'')}" placeholder="https://maps.app.goo.gl/..." style="flex:1" oninput="clearTimeout(mapsLinkTimer);mapsLinkTimer=setTimeout(()=>fillGpsFromMapsLink(true),400)" onchange="fillGpsFromMapsLink(true)">
        <button type="button" class="btn-upload" id="f-maps-go" onclick="fillGpsFromMapsLink()">LIRE LE LIEN</button>
      </div>
    </div>
    <div class="field full">
      <label>COORDONNÉES GPS</label>
      <div class="photo-upload-row">
        <input id="f-gps" value="${esc(v.gps||'')}" placeholder="ex: 47.8389, -4.3519" style="flex:1" onchange="fillAddressFromGps()">
        <button type="button" class="btn-upload" onclick="fillGpsFromDevice()">MA POSITION</button>
      </div>
      <div class="field-hint">Remplies toutes seules depuis le lien Maps, avec l'adresse, la ville et le pays. Sur place, « MA POSITION » enregistre l'endroit exact. Le lieu n'apparaît sur la carte qu'avec des coordonnées.</div>
    </div>
    <div class="field full"><label>BRÈVE DESCRIPTION</label><textarea id="f-description" rows="2" placeholder="ex: Grande plage face à l'ouest, dunes, très ventée l'après-midi">${esc(v.description||'')}</textarea></div>
    <div class="field full"><label>DESCRIPTION POUR LE CLIENT</label><textarea id="f-desc-client" rows="3" placeholder="Le texte qui part dans le PDF client. Vide = pas de description dans le PDF.">${esc(v.descClient||'')}</textarea></div>
    ${LIEU_PHOTO_KINDS.map(photoField).join('')}
    <div class="field full">
      <label>CATÉGORIES</label>
      <div class="cats-grid" id="lieu-cats-grid">${lieuCatsGridHtml(lieuCats(v))}</div>
      <div class="new-cat">
        <input id="f-new-cat" placeholder="Autre catégorie (ex : Port, Falaise…)" onkeydown="if(event.key==='Enter'){event.preventDefault();addLieuCategory()}">
        <button type="button" class="btn-ig" onclick="addLieuCategory()">+ AJOUTER</button>
      </div>
    </div>
    <div class="field full">
      <label>SPORTS / DISCIPLINES SHOOTÉS ICI (optionnel)</label>
      <div class="cats-grid" id="lieu-sports-grid">${lieuSportsGridHtml(lieuSports(v))}</div>
      <div class="new-cat">
        <input id="f-new-sport" placeholder="Autre sport (ex : Trail, Kitesurf…)" onkeydown="if(event.key==='Enter'){event.preventDefault();addLieuSport()}">
        <button type="button" class="btn-ig" onclick="addLieuSport()">+ AJOUTER</button>
      </div>
    </div>
    <div class="field full">
      <label>PROJETS DÉJÀ TOURNÉS ICI (optionnel)</label>
      <div id="projets-rows">${lieuProjets(v).map(projetRowHtml).join('')}</div>
      <button type="button" class="btn-ig projet-add" onclick="addProjetRow()">+ AJOUTER UN PROJET</button>
      <div class="field-hint">Dans Dropbox, clic droit sur la vidéo finale (ou le dossier du projet), « Copier le lien », puis colle-le ici. Sans projet, rien ne s'affiche sur la fiche.</div>
    </div>
    <div class="field"><label>PRÉCISION (optionnel)</label><input id="f-type" value="${esc(v.type||'')}" placeholder="ex: crique, sentier, parking..."></div>
    <div class="field"><label>PAYS</label><select id="fl-pays">${paysl}</select></div>
    <div class="field"><label>VILLE</label><input id="f-ville" value="${esc(v.ville||'')}"></div>
    <div class="field"><label>ADRESSE</label><input id="f-adresse" value="${esc(v.adresse||'')}" placeholder="ex: 29120 Plomeur"></div>
    <div class="field"><label>COÛT ESTIMÉ (€)</label><input id="f-cout" type="number" min="0" step="any" value="${esc(String(v.cout ?? ''))}" placeholder="ex: 1500"></div>
    <div class="field"><label>CONTACT (propriétaire, mairie...)</label><input id="f-contact" value="${esc(v.contact||'')}"></div>
    <div class="field full"><label>DÉTAIL DES COÛTS</label><textarea id="f-cout-detail" rows="3" placeholder="ex: Location 1000 €/jour, autorisation mairie 300 €, parking régie 200 €">${esc(v.coutDetail||'')}</textarea></div>
    <div class="field"><label>TEL</label><input id="f-tel" value="${esc(v.tel||'')}" placeholder="+33 6..."></div>
    <div class="field"><label>MAIL</label><input id="f-mail" type="email" value="${esc(v.mail||'')}"></div>
    <div class="field full">
      <label>VIDÉOS (liens)</label>
      <textarea id="f-videos" rows="2" placeholder="Un lien par ligne : YouTube, Vimeo, Google Drive, Dropbox...">${esc((v.videos||[]).join('\n'))}</textarea>
      <div class="field-hint">Mets la vidéo sur Google Drive ou YouTube (en non répertoriée), puis colle le lien de partage ici.</div>
    </div>
    <div class="field full"><label>LIENS D'IMAGES (optionnel)</label><textarea id="f-photo-links" rows="2" placeholder="Liens d'images (Google Drive, Imgur...), un par ligne">${esc((v.photos||[]).join('\n'))}</textarea></div>
    <div class="field full"><label>NOTES (accès, lumière, horaires, autorisations...)</label><textarea id="f-notes" rows="3">${esc(v.notes||'')}</textarea></div>`;
  renderLieuThumbs();
  if (v.gps && !(v.adresse && v.ville && v.pays)) fillAddressFromGps();
}

// ── Adresse, ville et pays déduits des coordonnées (OpenStreetMap / Nominatim, gratuit)
// On ne remplit que les champs vides : ce que l'équipe a tapé n'est jamais écrasé.
async function reverseGeocode(c) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=fr&lat=${c.lat}&lon=${c.lng}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Adresse introuvable');
  const r = await res.json();
  const a = r.address || {};
  const ville = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || '';
  const rue = [a.house_number, a.road || a.pedestrian || a.footway || a.path].filter(Boolean).join(' ');
  const adresse = [rue || a.tourism || a.leisure || a.natural || '', [a.postcode, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  let pays = '';
  try { if (a.country_code) pays = new Intl.DisplayNames(['fr'], { type: 'region' }).of(a.country_code.toUpperCase()); } catch {}
  const match = n => ALL_COUNTRIES.find(x => sansAccent(x) === sansAccent(n));
  return { adresse, ville, pays: match(pays) || match(a.country) || '' };
}

let addressSeq = 0;
async function fillAddressFromGps() {
  const c = parseGps((document.getElementById('f-gps') || {}).value);
  if (!c) return;
  const seq = ++addressSeq;
  let r;
  try { r = await reverseGeocode(c); } catch { return; }
  if (seq !== addressSeq) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value.trim()) el.value = val; };
  set('f-adresse', r.adresse);
  set('f-ville', r.ville);
  set('fl-pays', r.pays);
}

function lieuFormPhotos(kind) {
  const lieuId = formCtx && formCtx.id;
  const existing = lieuId ? getLieuPhotos(lieuId).filter(p => p.kind === kind && !pendingLieuRemovals.includes(p.id)) : [];
  const pending = pendingLieuPhotos.map((p, i) => ({ ...p, i })).filter(p => p.kind === kind);
  return { existing, pending };
}

// La couverture est la photo choisie, sinon la première photo encore présente
function formCoverIs(id) {
  const lieuId = formCtx && formCtx.id;
  const ids = [...(lieuId ? getLieuPhotos(lieuId).map(p => p.id).filter(x => !pendingLieuRemovals.includes(x)) : []),
               ...pendingLieuPhotos.map(p => 'new:' + p.uid)];
  const cur = ids.includes(pendingLieuCover) ? pendingLieuCover : ids[0];
  return cur === id;
}

function renderLieuThumbs() {
  LIEU_PHOTO_KINDS.forEach(([kind]) => {
    const box = document.getElementById('lieu-thumbs-' + kind);
    if (!box) return;
    const { existing, pending } = lieuFormPhotos(kind);
    box.innerHTML =
      existing.map(p => `<div class="lieu-thumb-wrap"><div class="lieu-thumb${formCoverIs(p.id) ? ' cover' : ''}"><img src="${esc(p.url)}" alt="">
        <button type="button" title="Retirer" onclick="pendingLieuRemovals.push('${esc(p.id)}');renderLieuThumbs()">✕</button>
        <button type="button" class="thumb-cover" title="Photo de couverture" onclick="pendingLieuCover='${esc(p.id)}';renderLieuThumbs()">${formCoverIs(p.id) ? '★' : '☆'}</button></div>
        ${kind === 'iphone' ? `<div class="lieu-thumb-date">${esc(formatPhotoDate(p.date) || 'date inconnue')}</div>` : ''}</div>`).join('') +
      pending.map(p => `<div class="lieu-thumb-wrap"><div class="lieu-thumb new${formCoverIs('new:' + p.uid) ? ' cover' : ''}"><img src="${p.data}" alt="">
        <button type="button" title="Retirer" onclick="pendingLieuPhotos.splice(${p.i},1);renderLieuThumbs()">✕</button>
        <button type="button" class="thumb-cover" title="Photo de couverture" onclick="pendingLieuCover='new:${p.uid}';renderLieuThumbs()">${formCoverIs('new:' + p.uid) ? '★' : '☆'}</button></div>
        ${kind === 'iphone' ? `<input type="datetime-local" class="lieu-thumb-date-in" value="${esc(p.date || '')}" title="Date et heure de la photo" onchange="pendingLieuPhotos[${p.i}].date=this.value">` : ''}</div>`).join('');
  });
}

// Date de prise de vue lue dans les infos EXIF de la photo (perdues à la compression,
// donc lues avant). Sans EXIF, on prend la date du fichier si elle n'est pas d'aujourd'hui.
async function photoTakenDate(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) === 0xFFD8) {
      let off = 2;
      while (off + 4 < v.byteLength) {
        const marker = v.getUint16(off), size = v.getUint16(off + 2);
        if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // « Exif »
          const d = exifDate(v, off + 10);
          if (d) return d;
          break;
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        off += 2 + size;
      }
    }
  } catch (e) { /* pas d'EXIF lisible */ }
  const lm = file.lastModified ? new Date(file.lastModified) : null;
  if (lm && lm.toDateString() !== new Date().toDateString()) {
    const z = n => String(n).padStart(2, '0');
    return `${lm.getFullYear()}-${z(lm.getMonth() + 1)}-${z(lm.getDate())}T${z(lm.getHours())}:${z(lm.getMinutes())}`;
  }
  return '';
}

function exifDate(v, tiff) {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
  const readIfd = (ifd, wanted) => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === wanted) return e;
    }
    return null;
  };
  const ascii = e => { let s = ''; const o = tiff + u32(e + 8); for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };
  const ifd0 = tiff + u32(tiff + 4);
  const exifPtr = readIfd(ifd0, 0x8769);
  let e = exifPtr ? readIfd(tiff + u32(exifPtr + 8), 0x9003) : null; // DateTimeOriginal
  if (!e) e = readIfd(ifd0, 0x0132);                                   // DateTime
  const m = e && ascii(e).match(/^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}))?/);
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` + (m[4] ? `T${m[4]}:${m[5]}` : '') : '';
}

async function handleLieuPhotos(input, kind) {
  const files = [...(input.files || [])].filter(f => f.type.startsWith('image/'));
  const { existing, pending } = lieuFormPhotos(kind);
  const room = LIEU_PHOTOS_MAX - existing.length - pending.length;
  if (files.length > room) alert(`${LIEU_PHOTOS_MAX} photos maximum par type.` + (room > 0 ? ` Seules les ${room} premières sont ajoutées.` : ' Retire une photo avant d\'en ajouter.'));
  for (const file of files.slice(0, Math.max(0, room))) {
    try { pendingLieuPhotos.push({ uid: uid(), data: await compressImage(file, 1400), kind, date: kind === 'iphone' ? await photoTakenDate(file) : '' }); }
    catch (e) { alert('Impossible de lire ' + file.name); }
  }
  input.value = '';
  renderLieuThumbs();
}

// Le lien est lu dès qu'il est collé (et encore au SAUVEGARDER si le GPS est vide)
let mapsLinkTimer = null;
let mapsLinkLu = '';
async function fillGpsFromMapsLink(quiet) {
  const link = document.getElementById('f-maps').value.trim();
  if (!link || (quiet && link === mapsLinkLu && document.getElementById('f-gps').value.trim())) return;
  const btn = document.getElementById('f-maps-go');
  btn.disabled = true; btn.textContent = 'LECTURE…';
  try {
    const r = await resolveMapsLink(link);
    mapsLinkLu = link;
    document.getElementById('f-gps').value = formatGps(r);
    const nom = document.getElementById('f-nom');
    if (r.nom && !nom.value.trim()) nom.value = r.nom;
    await fillAddressFromGps();
  } catch (e) {
    if (!quiet) alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'LIRE LE LIEN';
  }
}

function fillGpsFromDevice() {
  if (!navigator.geolocation) { alert("La localisation n'est pas disponible sur cet appareil."); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      document.getElementById('f-gps').value =
        pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
      fillAddressFromGps();
    },
    err => alert('Impossible de récupérer ta position : ' + err.message),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

async function saveLieuPhotos(lieuId, toAdd, toRemove, cover) {
  if (!toAdd.length && !toRemove.length) return;
  setSyncStatus('syncing');
  try {
    if (toRemove.length) await removeLieuPhotos(lieuId, toRemove);
    for (const p of toAdd) {
      const newId = await addLieuPhoto(lieuId, p.data, p.kind, p.date);
      // Couverture choisie parmi les nouvelles photos : on retient son id une fois envoyée
      if (cover === 'new:' + p.uid && newId) {
        const l = lieuxList().find(x => x.id === lieuId);
        if (l) { l.cover = newId; saveDb(); }
      }
    }
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

// ── PHOTO UPLOAD (envoyée au serveur au SAUVEGARDER) + COMPRESSION ────────────────────────
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
      photo: normalizePhotoUrl(g('f-photo')), notes: g('f-notes'),
      mensurations: Object.fromEntries(MENSURATIONS.map(([k]) => [k, g('f-m-' + k)]).filter(([, val]) => val)),
    };
    let finalId;
    if (isEdit) { db.talents = db.talents.map(p => p.id === pid ? { ...p, ...obj, id: p.id } : p); finalId = pid; }
    else        { finalId = uid(); db.talents.push({ ...obj, id: finalId }); }

    // Envoie la photo importée depuis l'appareil pour que toute l'équipe la voie
    if (pendingLocalPhoto) saveImportedPhoto(finalId, pendingLocalPhoto);

  } else if (type === 'club') {
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = { nom:g('f-nom'), pays:g('fc-pays')||'', ville:g('fc-ville')||'', mail:g('f-mail'), lien:g('f-lien'), notes:g('f-notes') };
    if (isEdit) db.clubs = db.clubs.map(c => c.id === pid ? { ...obj, id: c.id } : c);
    else        db.clubs.push({ ...obj, id: uid() });

  } else if (type === 'lieu') {
    // Lien Google Maps collé mais pas encore lu : on le lit avant d'enregistrer
    if (!g('f-gps') && g('f-maps') && !submitForm.lienLu) {
      const btn = document.getElementById('btn-save');
      btn.disabled = true; btn.textContent = 'LECTURE DU LIEN…';
      fillGpsFromMapsLink(true).finally(() => {
        btn.disabled = false; btn.textContent = 'SAUVEGARDER';
        submitForm.lienLu = true;
        try { submitForm(); } finally { submitForm.lienLu = false; }
      });
      return;
    }
    if (!g('f-nom')) { alert('Le nom est requis.'); return; }
    const obj = {
      nom: g('f-nom'), type: g('f-type'), adresse: g('f-adresse'),
      categories: [...document.querySelectorAll('input[name="lieu-cat"]:checked')].map(el => el.value),
      sports: [...document.querySelectorAll('input[name="lieu-sport"]:checked')].map(el => el.value),
      pays: g('fl-pays'), ville: g('f-ville'), gps: g('f-gps'), maps: g('f-maps'), description: g('f-description'), descClient: g('f-desc-client'),
      cout: g('f-cout'), coutDetail: g('f-cout-detail'),
      contact: g('f-contact'), tel: g('f-tel'), mail: g('f-mail'),
      photos: g('f-photo-links').split('\n').map(s => s.trim()).filter(Boolean),
      videos: g('f-videos').split('\n').map(s => s.trim()).filter(Boolean),
      projets: readProjetRows(),
      cover: String(pendingLieuCover).startsWith('new:') ? '' : pendingLieuCover,
      notes: g('f-notes')
    };
    let finalId;
    if (isEdit) { db.lieux = lieuxList().map(l => l.id === pid ? { ...obj, id: l.id } : l); finalId = pid; }
    else        { finalId = uid(); lieuxList().push({ ...obj, id: finalId }); }
    saveLieuPhotos(finalId, pendingLieuPhotos.slice(), pendingLieuRemovals.slice(), pendingLieuCover);

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
// Affiche immédiatement le cache local, puis synchronise avec le serveur
buildTabs();
render();
initRemoteSync();


// ── AJOUT RAPIDE ─────────────────────────────────────────────────────────────
// On colle un lien Instagram, une capture d'écran ou un texte libre : le petit
// serveur « ajout rapide » (dossier worker/) demande à Claude d'en tirer une fiche,
// puis on ouvre le formulaire talent ou lieu pré-rempli, à vérifier avant d'enregistrer.
let quickImage = null; // data URL JPEG compressée

function quickAddEnabled() { return typeof QUICK_ADD_URL === 'string' && QUICK_ADD_URL.trim() !== ''; }

function openQuickAdd() {
  quickImage = null;
  formCtx = { type: 'quick', id: null };
  document.getElementById('form-title').textContent = 'AJOUT RAPIDE';
  document.getElementById('form-btn-del').style.display = 'none';
  document.getElementById('btn-save').style.display = 'none';
  document.getElementById('form-body').innerHTML = `
    <div class="field full">
      <label>LIEN, TEXTE OU CAPTURE</label>
      <textarea id="qa-text" rows="4" placeholder="Colle un lien Instagram, une description (« athlète trail, Annecy »), ou une capture d'écran (Ctrl+V / ⌘V)" onpaste="quickPaste(event)"></textarea>
      <div class="field-hint">Avec un lien seul, Instagram ne donne souvent que le pseudo : une capture du profil donne plus d'infos.</div>
    </div>
    <div class="field full">
      <div class="photo-upload-row">
        <button type="button" class="btn-upload" onclick="document.getElementById('qa-file').click()">Choisir une image</button>
        <input type="file" id="qa-file" accept="image/*" style="display:none" onchange="quickPick(this.files[0]); this.value=''">
        <button type="button" class="btn-clear-photo" id="qa-clear" style="display:none" onclick="quickSetImage(null)">Retirer l'image</button>
      </div>
      <img id="qa-preview" class="photo-preview-img" alt="">
    </div>
    <div class="field full">
      <button type="button" class="btn-save" id="qa-go" onclick="runQuickAdd()">Analyser</button>
      <div class="field-hint" id="qa-status"></div>
    </div>`;
  document.getElementById('form-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('qa-text')?.focus(), 50);
}

function quickSetImage(dataUrl) {
  quickImage = dataUrl;
  const img = document.getElementById('qa-preview');
  img.src = dataUrl || '';
  img.classList.toggle('show', !!dataUrl);
  document.getElementById('qa-clear').style.display = dataUrl ? '' : 'none';
}
async function quickPick(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try { quickSetImage(await compressImage(file, 1600)); }
  catch (e) { alert('Impossible de lire cette image.'); }
}
function quickPaste(e) {
  const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); quickPick(file); }
}

async function runQuickAdd() {
  const text = document.getElementById('qa-text').value.trim();
  if (!text && !quickImage) { alert('Colle un lien, un texte ou une image.'); return; }
  const btn = document.getElementById('qa-go');
  const status = document.getElementById('qa-status');
  btn.disabled = true; btn.textContent = 'Analyse en cours…'; status.textContent = '';
  const body = {
    text,
    image: quickImage ? { media_type: 'image/jpeg', data: quickImage.split(',')[1] } : null,
    vocab: {
      categories: db.categories.map(c => ({ id: c.id, label: c.label })),
      sports: db.sports,
      pays: ALL_COUNTRIES,
      agences: agenceNames(),
    },
  };
  try {
    const res = await fetch(QUICK_ADD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Erreur ' + res.status);
    openQuickResult(out);
  } catch (e) {
    status.textContent = e.message || 'Le service ne répond pas.';
    btn.disabled = false; btn.textContent = 'Analyser';
  }
}

function openQuickResult(out) {
  // On ne garde que les valeurs connues du site (en ignorant la casse)
  const keep = (vals, allowed) => [...new Set((vals || [])
    .map(v => allowed.find(a => a.toLowerCase() === String(v).trim().toLowerCase()))
    .filter(Boolean))];
  const image = quickImage;
  if (out.type === 'talent' && out.talent) {
    const t = out.talent;
    const prefill = {
      nom: t.nom, prenom: t.prenom, sexe: t.sexe || undefined, age: t.age || '',
      sports: keep(t.sports, db.sports), pays: keep(t.pays, COUNTRIES),
      ville: t.ville || [], agence: keep(t.agence, agenceNames()),
      tel: t.tel, mail: t.mail, insta: (t.insta || '').replace(/^@/, ''), site: t.site, notes: t.notes,
    };
    openForm('talent', undefined, { cats: keep(t.cats, db.categories.map(c => c.id)), prefill });
  } else if (out.type === 'lieu' && out.lieu) {
    const l = out.lieu;
    openForm('lieu', undefined, { prefill: { ...l, pays: keep([l.pays], ALL_COUNTRIES)[0] || '' } });
    if (image) { pendingLieuPhotos.push({ uid: uid(), data: image, kind: 'campagne', date: '' }); renderLieuThumbs(); }
  } else {
    document.getElementById('qa-status').textContent = out.remarque || "Je n'ai pas reconnu un talent ou un lieu. Ajoute un mot d'explication.";
    const btn = document.getElementById('qa-go'); btn.disabled = false; btn.textContent = 'Analyser';
    return;
  }
  const note = document.createElement('div');
  note.className = 'field full quick-note';
  note.textContent = 'Fiche pré-remplie automatiquement : vérifie avant d\'enregistrer.' + (out.remarque ? ' ' + out.remarque : '');
  document.getElementById('form-body').prepend(note);
}
if (quickAddEnabled()) document.getElementById('btn-quick').style.display = '';


// ── APP TÉLÉPHONE ────────────────────────────────────────────────────────────
// Le site s'installe comme une app (manifest.json + sw.js). Sur Android/Chrome,
// le navigateur propose l'installation : on l'affiche dans un bouton. Sur iPhone,
// ça passe par Partager → « Sur l'écran d'accueil ».
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker :', e));
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  document.getElementById('btn-install').style.display = '';
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.getElementById('btn-install').style.display = 'none';
});
async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.getElementById('btn-install').style.display = 'none';
}
