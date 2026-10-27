// ── TRAVEL SHEETS ────────────────────────────────────────────────────────────
// Une feuille de voyage par personne (à envoyer en PDF), remplie
// automatiquement à partir d'une réservation collée. Elles vivent dans
// l'onglet SUIVI PRODUCTION (projets.js) : chacune peut être rattachée à un
// projet (projetId). Tout est gardé dans la base partagée, sous db.prod.

// Onglets du haut : 'bible' | 'projets' (suivi production, avec les travel sheets).
// L'ancien onglet « production interne » ('prod') ouvre maintenant le suivi production.
let espace = (() => { try { const e = localStorage.getItem('espace'); return e === 'prod' || e === 'projets' ? 'projets' : 'bible'; } catch { return 'bible'; } })();
let tsId = null;             // travel sheet ouverte

const TS_CONTACTS_DEFAUT = [
  { id: 'widen-felicie', groupe: 'WIDEN', nom: 'Félicie Corby', role: 'Executive Producer', tel: '+33 6 19 39 78 92' },
  { id: 'widen-tom', groupe: 'WIDEN', nom: 'Tom Grandjean', role: 'Production Coordinator', tel: '+33 7 83 27 96 37' },
  { id: 'widen-theo', groupe: 'WIDEN', nom: 'Théo Ledru', role: 'Co-Founder', tel: '+33 6 95 20 47 38' },
];

function prodData() {
  if (!db.prod || typeof db.prod !== 'object') db.prod = {};
  const p = db.prod;
  if (!Array.isArray(p.travelSheets)) p.travelSheets = [];
  if (!Array.isArray(p.contacts)) p.contacts = TS_CONTACTS_DEFAUT.map(c => ({ ...c }));
  if (!p.logos || typeof p.logos !== 'object') p.logos = {};
  return p;
}
function tsList() { return prodData().travelSheets; }
function tsById(id) { return tsList().find(s => s.id === id); }

// ── Onglets BIBLE / SUIVI PRODUCTION ─────────────────────────────────────────
function renderEspaces() {
  const nav = document.getElementById('espaces-nav');
  if (nav) nav.innerHTML = `<button type="button" class="${espace === 'bible' ? 'on' : ''}" onclick="setEspace('bible')">BIBLE</button>
    <button type="button" class="${espace === 'projets' ? 'on' : ''}" onclick="setEspace('projets')">SUIVI PRODUCTION</button>`;
  document.body.classList.toggle('espace-prod', espace === 'projets');
  const brand = document.querySelector('.hdr-brand');
  if (brand) brand.textContent = espace === 'projets' ? 'SUIVI PRODUCTION' : 'CASTING BIBLE';
}

function setEspace(e) {
  espace = e === 'projets' || e === 'prod' ? 'projets' : 'bible';
  try { localStorage.setItem('espace', espace); } catch {}
  renderEspaces();
  if (espace === 'projets') pjGo(pjVue === 'ts' && tsById(tsId) ? 'ts' : pjVue === 'projet' && pjCur() ? 'projet' : 'liste');
  else { buildTabs(); render(); window.scrollTo(0, 0); }
}

// Ouvre une travel sheet ('sheet') ou revient d'où on l'avait ouverte (projet ou liste)
function prodGo(vue, id) {
  if (vue !== 'sheet' || (id !== undefined && id !== tsId)) tsMsgTexte = '';
  if (id !== undefined) tsId = id;
  if (vue === 'sheet' && tsById(tsId)) pjGo('ts');
  else pjRetourTs();
}

// ── Liste des travel sheets ──────────────────────────────────────────────────
function tsPremiereDate(s) {
  return (s.trajets || []).map(t => t.date).filter(Boolean).sort()[0] || (s.sejours || []).map(x => x.du).filter(Boolean).sort()[0] || '';
}

// projetId : la nouvelle feuille est rattachée à ce projet (client et projet pré-remplis)
function tsNouvelle(modele, projetId) {
  const pj = projetId != null && typeof pjById === 'function' ? pjById(projetId) : null;
  const s = modele ? JSON.parse(JSON.stringify(modele)) : {
    client: pj ? pj.client || '' : '', projet: pj ? pj.nom || '' : '', voyageur: '', langue: 'en', references: '',
    trajets: [], bagages: '', sejours: [],
    contacts: prodData().contacts.map(c => ({ ...c, ref: c.id })),
  };
  if (pj) s.projetId = pj.id;
  s.id = uid();
  s.maj = Date.now();
  if (modele) s.voyageur = '';
  tsList().push(s);
  saveDb();
  prodGo('sheet', s.id);
}

// ── Éditeur ──────────────────────────────────────────────────────────────────
let tsSaveTimer = null, tsApercuTimer = null;
let tsMsgTexte = '';          // dernier message du remplissage auto (gardé quand l'éditeur se redessine)

function tsMsg(t) {
  tsMsgTexte = t || '';
  const m = document.getElementById('ts-auto-msg');
  if (m) m.textContent = tsMsgTexte;
}

function tsCur() { return tsById(tsId); }

// Après une synchro pendant l'édition : la feuille ouverte reste celle de l'écran
function tsReprendre(s) {
  const list = tsList();
  const i = list.findIndex(x => x.id === s.id);
  if (i >= 0) list[i] = s; else list.push(s);
}

function tsChange() {
  const s = tsCur();
  if (!s) return;
  s.maj = Date.now();
  clearTimeout(tsSaveTimer);
  tsSaveTimer = setTimeout(saveDb, 900);
  clearTimeout(tsApercuTimer);
  tsApercuTimer = setTimeout(tsMajApercu, 250);
}

// Champ simple de la feuille : data-k="client" ; d'une ligne : data-l="trajets" data-i="0" data-k="numero"
function tsInput(el) {
  const s = tsCur();
  if (!s) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.l) {
    const row = (s[el.dataset.l] || [])[Number(el.dataset.i)];
    if (row) row[el.dataset.k] = v;
  } else s[el.dataset.k] = v;
  if (el.dataset.k === 'client') tsLogoDuClient(s);
  if (el.dataset.k === 'voyageur') buildTabs();
  tsChange();
}

function tsField(label, k, v, opts = {}) {
  const attrs = `data-k="${k}"${opts.l ? ` data-l="${opts.l}" data-i="${opts.i}"` : ''} oninput="tsInput(this)"`;
  const input = opts.textarea
    ? `<textarea rows="${opts.rows || 3}" ${attrs} placeholder="${esc(opts.ph || '')}">${esc(v || '')}</textarea>`
    : opts.select
      ? `<select ${attrs} onchange="tsInput(this)">${opts.select.map(([val, lab]) => `<option value="${val}"${v === val ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`
      : `<input type="${opts.type || 'text'}" ${attrs} value="${esc(v || '')}" placeholder="${esc(opts.ph || '')}">`;
  return `<div class="field${opts.full ? ' full' : ''}${opts.cls ? ' ' + opts.cls : ''}"><label>${esc(label)}</label>${input}</div>`;
}

function renderTsEditor(main) {
  const s = tsCur();
  const scroll = window.scrollY;
  main.innerHTML = `<div class="ts-editor">
    <div class="ts-form">
      <section class="ts-bloc ts-auto">
        <h3>REMPLISSAGE AUTOMATIQUE</h3>
        <p class="field-hint">Colle la confirmation de réservation (e-mail, texte) ou ajoute le PDF / la capture. Tu peux aussi écrire simplement : « vol IB1566 le 28/09, retour LX2092 le 02/10, hôtel Novotel Annecy du 28/09 au 02/10 ». Les horaires et adresses qui manquent sont cherchés sur internet.</p>
        <textarea id="ts-colle" rows="4" placeholder="Colle ici la réservation…"></textarea>
        <div class="ts-auto-actions">
          <label class="btn-upload ts-fichiers-btn">AJOUTER PDF / CAPTURES<input type="file" id="ts-fichiers" accept="application/pdf,image/*" multiple hidden onchange="tsFichiersChoisis(this)"></label>
          <span id="ts-fichiers-noms" class="field-hint"></span>
          <div class="spacer"></div>
          <button type="button" class="btn-save" id="ts-remplir" onclick="tsRemplir()">REMPLIR</button>
        </div>
        <div id="ts-auto-msg" class="field-hint">${esc(tsMsgTexte)}</div>
      </section>

      <section class="ts-bloc">
        <h3>EN-TÊTE</h3>
        <div class="ts-grid">
          ${tsField('VOYAGEUR', 'voyageur', s.voyageur, { ph: 'ex : Sébastien Zanella' })}
          ${tsField('CLIENT', 'client', s.client, { ph: 'ex : IKKS' })}
          ${tsField('PROJET', 'projet', s.projet, { ph: 'ex : FW26' })}
          ${tsField('RÉFÉRENCES DE RÉSERVATION', 'references', s.references, { ph: 'ex : JS2Q5 & YNTVGD' })}
          ${tsField('LANGUE DU DOCUMENT', 'langue', s.langue || 'en', { select: [['en', 'Anglais'], ['fr', 'Français']] })}
          <div class="field"><label>PROJET (SUIVI PRODUCTION)</label><select onchange="tsLierProjet(this.value)">
            <option value="">Aucun</option>
            ${pjList().slice().sort((a, b) => pjTitre(a).localeCompare(pjTitre(b), 'fr')).map(p => `<option value="${p.id}"${s.projetId === p.id ? ' selected' : ''}>${esc((p.code ? p.code + ' · ' : '') + pjTitre(p))}</option>`).join('')}
          </select></div>
          <div class="field full ts-logo" id="ts-logo-zone" ondragover="event.preventDefault()" ondrop="tsLogoDepose(event)">${tsLogoZoneHtml(s)}</div>
        </div>
      </section>

      <section class="ts-bloc">
        <h3>VOLS ET TRAINS</h3>
        <div id="ts-trajets">${(s.trajets || []).map(tsTrajetHtml).join('') || '<p class="field-hint">Aucun trajet. Utilise le remplissage automatique ou ajoute-les à la main.</p>'}</div>
        <div class="ts-add-row">
          <button type="button" class="btn-upload" onclick="tsAjouter('trajets', 'avion')">+ VOL</button>
          <button type="button" class="btn-upload" onclick="tsAjouter('trajets', 'train')">+ TRAIN</button>
        </div>
      </section>

      <section class="ts-bloc">
        <h3>BAGAGES</h3>
        ${tsField('UNE LIGNE PAR BAGAGE', 'bagages', s.bagages, { textarea: true, rows: 3, full: true, ph: 'Underseat bag x 1\nCarry-on bag x 1\n23kg checked bag x 1' })}
      </section>

      <section class="ts-bloc">
        <h3>HÉBERGEMENT</h3>
        <div id="ts-sejours">${(s.sejours || []).map(tsSejourHtml).join('') || '<p class="field-hint">Aucun hébergement.</p>'}</div>
        <div class="ts-add-row"><button type="button" class="btn-upload" onclick="tsAjouter('sejours')">+ HÉBERGEMENT</button></div>
      </section>

      <section class="ts-bloc">
        <h3>CONTACTS</h3>
        <div class="ts-habituels">${prodData().contacts.map(c => `<label class="cat-check"><input type="checkbox" ${(s.contacts || []).some(x => x.ref === c.id) ? 'checked' : ''} onchange="tsContactHabituel('${esc(c.id)}', this.checked)"><span>${esc(c.nom)} <small>${esc([c.groupe, c.role].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div>
        <div id="ts-contacts">${(s.contacts || []).map((c, i) => c.ref ? '' : tsContactHtml(c, i)).join('')}</div>
        <div class="ts-add-row"><button type="button" class="btn-upload" onclick="tsAjouter('contacts')">+ AUTRE CONTACT (chauffeur, hôtel…)</button></div>
      </section>

      <div class="ts-actions">
        <button type="button" class="btn-del" onclick="tsSupprimer()">✕ SUPPRIMER</button>
        <div class="spacer"></div>
        <button type="button" class="btn-cancel" onclick="tsNouvelle(tsCur())">DUPLIQUER POUR UN AUTRE VOYAGEUR</button>
        <button type="button" class="btn-save" onclick="tsPdf()">CRÉER LE PDF</button>
      </div>
    </div>
    <div class="ts-apercu-col">
      <div class="ts-apercu-lbl">APERÇU</div>
      <div class="ts-apercu-cadre"><iframe id="ts-apercu" title="Aperçu de la travel sheet"></iframe></div>
    </div>
  </div>`;
  window.scrollTo(0, scroll);
  const champClient = main.querySelector('[data-k="client"]');
  if (champClient) champClient.addEventListener('change', tsLogoAuto);
  tsMajApercu();
}

const TS_TYPES = [['avion', 'Avion'], ['train', 'Train'], ['autre', 'Autre']];

function tsTrajetHtml(t, i) {
  const o = { l: 'trajets', i };
  const vol = t.type !== 'train';
  return `<div class="ts-ligne ts-trajet">
    <div class="ts-ligne-hdr">
      <b>${t.type === 'train' ? 'TRAIN' : t.type === 'autre' ? 'TRAJET' : 'VOL'} ${i + 1}</b>
      ${t.aVerifier ? '<span class="ts-verif">trouvé sur internet, à vérifier</span>' : ''}
      <div class="spacer"></div>
      <button type="button" class="export-lien" onclick="tsCompleter(${i})" title="Cherche les aéroports / gares et les horaires à partir du numéro et de la date">compléter avec le numéro</button>
      <button type="button" class="ts-x" onclick="tsRetirer('trajets', ${i})" title="Retirer">✕</button>
    </div>
    <div class="ts-grid ts-grid-trajet">
      ${tsField('TYPE', 'type', t.type || 'avion', { ...o, select: TS_TYPES })}
      ${tsField('DATE', 'date', t.date, { ...o, type: 'date' })}
      ${tsField(vol ? 'N° DE VOL' : 'N° DE TRAIN', 'numero', t.numero, { ...o, ph: vol ? 'IB 1566' : 'TGV 6201' })}
      ${tsField('DÉPART', 'de', t.de, { ...o, ph: vol ? 'TENERIFE NORTH' : 'PARIS GARE DE LYON', cls: 'ts-lieu' })}
      ${tsField(vol ? 'TERMINAL' : 'VOIE / HALL', 'deDetail', t.deDetail, { ...o })}
      ${tsField('HEURE', 'depart', t.depart, { ...o, type: 'time' })}
      ${tsField('ARRIVÉE', 'a', t.a, { ...o, ph: vol ? 'BARAJAS MADRID' : 'ANNECY', cls: 'ts-lieu' })}
      ${tsField(vol ? 'TERMINAL' : 'VOIE / HALL', 'aDetail', t.aDetail, { ...o })}
      ${tsField('HEURE', 'arrivee', t.arrivee, { ...o, type: 'time' })}
      ${tsField('NOTE SOUS CE TRAJET', 'note', t.note, { ...o, full: true, ph: 'ex : A driver will be waiting at the exit holding a sign with your name on it.' })}
    </div>
  </div>`;
}

function tsSejourHtml(x, i) {
  const o = { l: 'sejours', i };
  const c = parseGps(x.gps);
  return `<div class="ts-ligne ts-sejour">
    <div class="ts-ligne-hdr"><b>HÉBERGEMENT ${i + 1}</b><div class="spacer"></div>
      <button type="button" class="export-lien" onclick="tsTrouverHotel(${i})">trouver l'adresse et la carte</button>
      <button type="button" class="ts-x" onclick="tsRetirer('sejours', ${i})" title="Retirer">✕</button></div>
    <div class="ts-sejour-corps">
      <div class="ts-grid">
        ${tsField('NOM', 'nom', x.nom, { ...o, ph: 'NOVOTEL CENTRE' })}
        ${tsField('VILLE', 'ville', x.ville, { ...o, ph: 'Annecy' })}
        ${tsField('DU', 'du', x.du, { ...o, type: 'date' })}
        ${tsField('AU', 'au', x.au, { ...o, type: 'date' })}
        ${tsField('ADRESSE', 'adresse', x.adresse, { ...o, full: true, ph: '1 Place Marie Curie, 74000 Annecy' })}
        ${tsField('TÉLÉPHONE', 'tel', x.tel, { ...o })}
        ${tsField('POINT GPS (pour la carte)', 'gps', x.gps, { ...o, ph: '45.9010, 6.1227' })}
      </div>
      ${c ? `<div class="ts-carte-bloc">
        <div class="ts-mini-carte" data-i="${i}" onpointerdown="tsCarteGlisse(event, ${i})" title="Glisse pour déplacer le cadre">${tsCarteSejour(x, c)}</div>
        <div class="ts-carte-ctrl">
          <button type="button" class="ts-x" onclick="tsCarteZoom(${i}, -1)" title="Dézoomer">−</button>
          <button type="button" class="ts-x" onclick="tsCarteZoom(${i}, 1)" title="Zoomer">+</button>
          <button type="button" class="export-lien" onclick="tsCarteRecentrer(${i})">recentrer</button>
        </div>
        <div class="field-hint">Glisse la carte et zoome pour choisir le cadre du PDF.</div>
      </div>` : ''}
    </div>
  </div>`;
}

function tsContactHtml(c, i) {
  const o = { l: 'contacts', i };
  return `<div class="ts-ligne ts-contact">
    <div class="ts-grid ts-grid-contact">
      ${tsField('GROUPE', 'groupe', c.groupe, { ...o, ph: 'ex : HOTEL, DRIVER, IKKS' })}
      ${tsField('NOM', 'nom', c.nom, { ...o })}
      ${tsField('RÔLE', 'role', c.role, { ...o })}
      ${tsField('TÉLÉPHONE', 'tel', c.tel, { ...o })}
    </div>
    <div class="ts-contact-actions">
      <button type="button" class="export-lien" onclick="tsGarderContact(${i})">garder dans les contacts habituels</button>
      <button type="button" class="ts-x" onclick="tsRetirer('contacts', ${i})" title="Retirer">✕</button>
    </div>
  </div>`;
}

function tsAjouter(liste, type) {
  const s = tsCur();
  if (!s) return;
  if (!Array.isArray(s[liste])) s[liste] = [];
  const der = liste === 'trajets' ? s.trajets[s.trajets.length - 1] : null;
  s[liste].push(liste === 'trajets' ? { type: type || 'avion', date: der ? der.date : '' }
    : liste === 'sejours' ? { nom: '', ville: '', du: (s.trajets[0] || {}).date || '', au: '', adresse: '', gps: '' }
      : { groupe: '', nom: '', role: '', tel: '' });
  tsChange();
  renderTsEditor(document.getElementById('main-content'));
}

function tsRetirer(liste, i) {
  const s = tsCur();
  if (!s || !s[liste]) return;
  s[liste].splice(i, 1);
  tsChange();
  renderTsEditor(document.getElementById('main-content'));
}

function tsContactHabituel(id, on) {
  const s = tsCur();
  const c = prodData().contacts.find(x => x.id === id);
  if (!s || !c) return;
  s.contacts = (s.contacts || []).filter(x => x.ref !== id);
  if (on) {
    // On garde l'ordre des contacts habituels
    const ordre = prodData().contacts.map(x => x.id);
    s.contacts.push({ ...c, ref: id });
    s.contacts.sort((a, b) => (a.ref ? ordre.indexOf(a.ref) : 999) - (b.ref ? ordre.indexOf(b.ref) : 999));
  }
  tsChange();
  renderTsEditor(document.getElementById('main-content'));
}

function tsGarderContact(i) {
  const s = tsCur();
  const c = s && s.contacts[i];
  if (!c || !c.nom) { alert('Remplis au moins le nom du contact.'); return; }
  const id = 'c' + uid();
  prodData().contacts.push({ id, groupe: c.groupe, nom: c.nom, role: c.role, tel: c.tel });
  c.ref = id;
  tsChange();
  renderTsEditor(document.getElementById('main-content'));
}

// Rattache la feuille ouverte à un projet du suivi production (ou la détache)
function tsLierProjet(v) {
  const s = tsCur();
  if (!s) return;
  if (v) s.projetId = Number(v); else delete s.projetId;
  buildTabs();
  tsChange();
}

function tsSupprimer() {
  const s = tsCur();
  if (!s || !confirm('Supprimer cette travel sheet ?')) return;
  prodData().travelSheets = tsList().filter(x => x.id !== s.id);
  saveDb();
  prodGo('travel');
}

// ── Logo du client ───────────────────────────────────────────────────────────
// Trouvé tout seul (serveur : Claude + Wikipédia), ajouté depuis un fichier, glissé,
// ou collé (image ou lien). Gardé pour les prochaines feuilles du même client.
let tsLogosTrouves = [];      // propositions de la dernière recherche { src, png }
let tsLogoClient = '';        // client de ces propositions
let tsLogoEnCours = false;
const tsLogoDejaCherche = new Set();
const tsCleClient = c => String(c || '').trim().toUpperCase();

function tsLogoZoneHtml(s) {
  const choix = tsLogoClient === tsCleClient(s.client) ? tsLogosTrouves : [];
  return `<label>LOGO DU CLIENT</label>
    <div class="ts-logo-row">
      ${s.logo ? `<img class="ts-logo-actuel" src="${esc(s.logo)}" alt="">` : '<span class="field-hint">Sans logo, le nom du client est écrit à la place.</span>'}
      <button type="button" class="btn-upload" onclick="tsLogoChercher()" ${tsLogoEnCours ? 'disabled' : ''}>${tsLogoEnCours ? 'RECHERCHE…' : 'TROUVER LE LOGO'}</button>
      <label class="btn-upload">FICHIER<input type="file" accept="image/*,.svg" hidden onchange="tsLogoFichier(this.files[0])"></label>
      ${s.logo ? '<button type="button" class="btn-upload" onclick="tsLogoRetirer()">RETIRER</button>' : ''}
    </div>
    <input class="ts-logo-colle" placeholder="ou colle ici l'image du logo, ou le lien de l'image" onpaste="tsLogoColle(event)" onkeydown="if(event.key==='Enter'){event.preventDefault();tsLogoLien(this.value)}">
    ${choix.length ? `<div class="ts-logo-choix">${choix.map((l, i) => `<button type="button" class="${s.logo === l.png ? 'on' : ''}" onclick="tsLogoChoisir(${i})" title="Prendre ce logo"><img src="${esc(l.png)}" alt=""></button>`).join('')}</div>` : ''}
    <div class="field-hint" id="ts-logo-msg"></div>`;
}

function tsLogoMajZone(msg) {
  const z = document.getElementById('ts-logo-zone'), s = tsCur();
  if (z && s) z.innerHTML = tsLogoZoneHtml(s);
  const m = document.getElementById('ts-logo-msg');
  if (m && msg) m.textContent = msg;
}

// Image (fichier, collée ou trouvée) → PNG d'au plus 800 px, marges vides coupées
function tsLogoPng(src) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const svg = /^data:image\/svg/.test(src);
      let w = img.naturalWidth || 600, h = img.naturalHeight || 200;
      const k = svg ? 800 / Math.max(w, h) : Math.min(1, 800 / Math.max(w, h));
      w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const d = ctx.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const vide = d[i + 3] < 16 || (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245);
          if (!vide) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 >= x0 && y1 >= y0 && (x1 - x0 + 1 < w || y1 - y0 + 1 < h)) {
          const t = document.createElement('canvas');
          t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
          t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
          ok(t.toDataURL('image/png'));
        } else ok(c.toDataURL('image/png'));
      } catch { ok(src); } // navigateur qui refuse de lire un SVG dessiné : on garde l'image telle quelle
    };
    img.onerror = () => ko(new Error('image illisible'));
    img.src = src;
  });
}

function tsLogoMettre(png) {
  const s = tsCur();
  if (!s) return;
  s.logo = png;
  if (s.client) prodData().logos[tsCleClient(s.client)] = png;
  tsChange();
  tsLogoMajZone();
}

function tsLogoDataUrl(f) {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(f); });
}

async function tsLogoFichier(f) {
  if (!f) return;
  try { tsLogoMettre(await tsLogoPng(await tsLogoDataUrl(f))); }
  catch (e) { tsLogoMajZone('Logo : ' + e.message); }
}

function tsLogoDepose(e) {
  e.preventDefault();
  const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type));
  if (f) return tsLogoFichier(f);
  const t = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (t) tsLogoLien(t);
}

function tsLogoColle(e) {
  const f = [...(e.clipboardData.files || [])].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); tsLogoFichier(f); return; }
  const t = e.clipboardData.getData('text').trim();
  if (/^https?:\/\//i.test(t)) { e.preventDefault(); tsLogoLien(t); }
}

async function tsLogoServeur(corps) {
  const res = await serverFetch(SERVER_URL + '/logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Le serveur ne répond pas.');
  return (data.logos || []).map(l => `data:${l.media_type};base64,${l.data}`);
}

async function tsLogoLien(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) { tsLogoMajZone('Colle un lien qui commence par https://'); return; }
  tsLogoMajZone('Récupération de l\'image…');
  try { tsLogoMettre(await tsLogoPng((await tsLogoServeur({ url }))[0])); }
  catch (e) { tsLogoMajZone('Logo : ' + e.message); }
}

async function tsLogoChercher(auto) {
  const s = tsCur();
  if (!s) return;
  const cle = tsCleClient(s.client);
  if (!cle) { tsLogoMajZone('Écris d\'abord le nom du client.'); return; }
  tsLogoDejaCherche.add(cle);
  tsLogoEnCours = true;
  tsLogoMajZone(`Recherche du logo ${s.client}…`);
  try {
    const srcs = await tsLogoServeur({ client: s.client.trim() });
    const trouves = [];
    for (const src of srcs) { try { const png = await tsLogoPng(src); if (!trouves.some(t => t.png === png)) trouves.push({ src, png }); } catch {} }
    if (!trouves.length) throw new Error('aucune image lisible.');
    tsLogosTrouves = trouves; tsLogoClient = cle;
    tsLogoEnCours = false;
    // Recherche lancée toute seule : on prend la première proposition, les autres restent à côté
    if (tsCur() === s && tsCleClient(s.client) === cle && (!auto || !s.logo)) {
      if (auto) tsLogoMettre(trouves[0].png);
      tsLogoMajZone(auto ? 'Logo trouvé. Si ce n\'est pas le bon, clique sur une autre proposition.' : 'Clique sur le bon logo.');
    } else tsLogoMajZone();
  } catch (e) {
    tsLogoEnCours = false;
    tsLogoMajZone('Logo : ' + e.message);
  }
}

// Nom du client rempli : logo déjà connu, sinon on le cherche tout seul
function tsLogoAuto() {
  const s = tsCur();
  if (!s || s.logo || !tsCleClient(s.client)) return;
  tsLogoDuClient(s);
  if (!s.logo && !tsLogoDejaCherche.has(tsCleClient(s.client))) tsLogoChercher(true);
}

function tsLogoChoisir(i) { const l = tsLogosTrouves[i]; if (l) tsLogoMettre(l.png); }
function tsLogoRetirer() {
  const s = tsCur(), logos = prodData().logos, cle = tsCleClient(s.client);
  if (logos[cle] === s.logo) delete logos[cle]; // mauvais logo : on ne le reprend plus pour ce client
  s.logo = '';
  tsChange();
  tsLogoMajZone();
}
function tsLogoDuClient(s) {
  const l = prodData().logos[tsCleClient(s.client)];
  if (l && !s.logo) { s.logo = l; tsLogoMajZone(); }
}

// ── Remplissage automatique (serveur : Claude + recherche web) ────────────────
let tsFichiers = [];

function tsFichiersChoisis(input) {
  tsFichiers = [...(input.files || [])].slice(0, 5);
  document.getElementById('ts-fichiers-noms').textContent = tsFichiers.map(f => f.name).join(', ');
}

function tsLireFichier(f) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok({ media_type: f.type || 'application/pdf', data: String(r.result).split(',')[1] || '' });
    r.onerror = ko;
    r.readAsDataURL(f);
  });
}

async function tsAppelServeur(text, files) {
  const res = await serverFetch(SERVER_URL + '/travel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Le serveur ne répond pas.');
  return data;
}

const tsHeure = h => /^\d{1,2}[:h.]\d{2}$/.test(String(h || '').trim()) ? String(h).trim().replace(/[h.]/, ':').padStart(5, '0') : '';

function tsTrajetDepuisIA(t) {
  return {
    type: ['avion', 'train', 'autre'].includes(t.type) ? t.type : 'avion',
    date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? t.date : '',
    numero: t.numero || '', de: t.depart_lieu || '', deDetail: t.depart_detail || '', depart: tsHeure(t.depart_heure),
    a: t.arrivee_lieu || '', aDetail: t.arrivee_detail || '', arrivee: tsHeure(t.arrivee_heure),
    aVerifier: t.source && t.source !== 'document',
  };
}

const tsNorm = v => String(v || '').replace(/\s+/g, '').toUpperCase();

async function tsRemplir() {
  const s = tsCur();
  const texte = document.getElementById('ts-colle').value.trim();
  if (!texte && !tsFichiers.length) { alert('Colle une réservation, ajoute un fichier, ou écris au moins un numéro de vol ou de train.'); return; }
  const btn = document.getElementById('ts-remplir');
  btn.disabled = true; btn.textContent = 'LECTURE…';
  tsMsg('Lecture de la réservation et recherche des horaires… (jusqu\'à une minute)');
  try {
    const files = await Promise.all(tsFichiers.map(tsLireFichier));
    const r = await tsAppelServeur(texte, files);
    const ajouts = tsFusionner(s, r);
    tsFichiers = [];
    tsMsgTexte = [ajouts, r.remarque].filter(Boolean).join(' ');
    tsChange();
    buildTabs();
    renderTsEditor(document.getElementById('main-content'));
    await tsGeocoderSejours(s);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'REMPLIR';
    tsMsg('Impossible de remplir : ' + e.message);
  }
}

// Ajoute ce que le serveur a trouvé sans écraser ce qui est déjà rempli
function tsFusionner(s, r) {
  let nT = 0, nS = 0;
  if (!s.voyageur && (r.voyageurs || [])[0]) s.voyageur = r.voyageurs[0];
  const refs = new Set(String(s.references || '').split(/\s*[&,]\s*/).filter(Boolean));
  (r.references || []).forEach(x => x && refs.add(x.trim()));
  s.references = [...refs].join(' & ');
  if (!Array.isArray(s.trajets)) s.trajets = [];
  (r.trajets || []).map(tsTrajetDepuisIA).forEach(t => {
    const meme = s.trajets.find(x => x.numero && tsNorm(x.numero) === tsNorm(t.numero) && (!x.date || !t.date || x.date === t.date));
    if (meme) { Object.keys(t).forEach(k => { if (!meme[k] && t[k]) meme[k] = t[k]; }); return; }
    s.trajets.push(t); nT++;
  });
  s.trajets.sort((a, b) => ((a.date || '9') + (a.depart || '')).localeCompare((b.date || '9') + (b.depart || '')));
  if (!String(s.bagages || '').trim() && (r.bagages || []).length) s.bagages = r.bagages.join('\n');
  if (!Array.isArray(s.sejours)) s.sejours = [];
  (r.sejours || []).forEach(x => {
    const meme = s.sejours.find(y => y.nom && tsNorm(y.nom) === tsNorm(x.nom));
    const n = { nom: x.nom || '', ville: x.ville || '', du: x.du || '', au: x.au || '', adresse: x.adresse || '', tel: x.telephone || '', gps: '' };
    if (meme) { Object.keys(n).forEach(k => { if (!meme[k] && n[k]) meme[k] = n[k]; }); return; }
    s.sejours.push(n); nS++;
  });
  return [nT && `${nT} trajet${nT > 1 ? 's' : ''} ajouté${nT > 1 ? 's' : ''}.`, nS && `${nS} hébergement${nS > 1 ? 's' : ''} ajouté${nS > 1 ? 's' : ''}.`].filter(Boolean).join(' ') || 'Rien de nouveau trouvé.';
}

// « Compléter » un seul trajet : on envoie juste son numéro et sa date
async function tsCompleter(i) {
  const s = tsCur();
  const t = s && s.trajets[i];
  if (!t || !t.numero) { alert('Écris d\'abord le numéro du vol ou du train (et la date).'); return; }
  tsMsg(`Recherche de ${t.numero}…`);
  try {
    const r = await tsAppelServeur(`${t.type === 'train' ? 'Train' : 'Vol'} ${t.numero}${t.date ? ' le ' + t.date : ''}${t.de ? ', départ ' + t.de : ''}${t.a ? ', arrivée ' + t.a : ''}. Trouve les ${t.type === 'train' ? 'gares' : 'aéroports (et terminaux)'} et les horaires.`, []);
    const n = (r.trajets || [])[0];
    if (!n) throw new Error(r.remarque || 'rien trouvé pour ce numéro.');
    const f = tsTrajetDepuisIA(n);
    Object.keys(f).forEach(k => { if (!t[k] && f[k]) t[k] = f[k]; });
    // Une correspondance renvoyée en plus est ajoutée à la suite
    (r.trajets || []).slice(1).map(tsTrajetDepuisIA).forEach(x => { if (!s.trajets.some(y => tsNorm(y.numero) === tsNorm(x.numero) && y.date === x.date)) s.trajets.splice(++i, 0, x); });
    tsMsgTexte = r.remarque || `${t.numero} complété.`;
    tsChange();
    renderTsEditor(document.getElementById('main-content'));
  } catch (e) { tsMsg('Impossible de compléter : ' + e.message); }
}

// Hôtel → adresse et point GPS (OpenStreetMap), pour la carte
async function tsGeocoder(q) {
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=fr&q=' + encodeURIComponent(q));
  const r = (await res.json())[0];
  if (!r) return null;
  const a = r.address || {};
  const rue = [a.house_number, a.road].filter(Boolean).join(' ');
  const ville = a.city || a.town || a.village || a.municipality || '';
  return { lat: Number(r.lat), lng: Number(r.lon), adresse: [rue, [a.postcode, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), ville };
}

async function tsTrouverHotel(i) {
  const s = tsCur();
  const x = s && s.sejours[i];
  if (!x || !(x.nom || x.adresse)) { alert('Écris d\'abord le nom de l\'hôtel (et la ville).'); return; }
  tsMsg('Recherche de l\'adresse…');
  try {
    let g = x.adresse ? await tsGeocoder(x.adresse) : null;
    if (!g) g = await tsGeocoder([x.nom, x.ville].filter(Boolean).join(', '));
    if (!g) {
      // Pas trouvé sur la carte : on demande l'adresse au serveur (recherche web), puis on la place
      const r = await tsAppelServeur(`Hôtel ${x.nom}${x.ville ? ', ' + x.ville : ''}${x.du ? ' du ' + x.du + ' au ' + (x.au || '?') : ''}. Trouve son adresse.`, []);
      const h = (r.sejours || [])[0];
      if (h && h.adresse) { x.adresse = x.adresse || h.adresse; g = await tsGeocoder(h.adresse); }
    }
    if (!g) throw new Error('adresse introuvable, écris-la à la main.');
    if (!x.adresse) x.adresse = g.adresse;
    if (!x.ville) x.ville = g.ville;
    x.gps = `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
    x.centre = '';
    tsMsgTexte = 'Adresse et carte ajoutées.';
    tsChange();
    renderTsEditor(document.getElementById('main-content'));
  } catch (e) { tsMsg('Hébergement : ' + e.message); }
}

async function tsGeocoderSejours(s) {
  let change = false;
  for (const x of s.sejours || []) {
    if (x.gps || !(x.adresse || x.nom)) continue;
    try {
      const g = (x.adresse && await tsGeocoder(x.adresse)) || await tsGeocoder([x.nom, x.ville].filter(Boolean).join(', '));
      if (g) { x.gps = `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`; if (!x.adresse) x.adresse = g.adresse; change = true; }
    } catch {}
  }
  if (change && tsCur() === s) { tsChange(); renderTsEditor(document.getElementById('main-content')); }
}

// ── Le document (aperçu et PDF) ──────────────────────────────────────────────
const TS_TXT = {
  en: {
    titre: 'TRAVEL SHEET', ref: 'Booking Reference', vols: 'FLIGHTS INFORMATIONS', trains: 'TRAIN INFORMATIONS', trajets: 'TRAVEL INFORMATIONS',
    bagages: 'LUGGAGES INFORMATIONS', sejour: 'STAY INFORMATIONS', contacts: 'CONTACTS', heure: 'Time', vol: 'Plane#', train: 'Train#',
    depart: 'Departure :', transit: 'Transit :', arrivee: 'Arrival :', de: (a, b) => `From ${a} to ${b}`,
    jour: d => { const x = tsD(d); const n = x.getUTCDate(); return `${x.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }).toUpperCase()} ${n}${tsOrdinal(n)} of ${x.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }).toUpperCase()}`; },
    periode: (a, b) => `From ${tsJourMoisEn(a)}${b ? ` to ${tsJourMoisEn(b)}` : ''}`,
    voirCarte: 'Open in Google Maps',
  },
  fr: {
    titre: 'TRAVEL SHEET', ref: 'Référence de réservation', vols: 'VOLS', trains: 'TRAINS', trajets: 'TRAJETS',
    bagages: 'BAGAGES', sejour: 'HÉBERGEMENT', contacts: 'CONTACTS', heure: 'Heure', vol: 'Vol n°', train: 'Train n°',
    depart: 'Départ :', transit: 'Correspondance :', arrivee: 'Arrivée :', de: (a, b) => `De ${a} à ${b}`,
    jour: d => tsD(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase(),
    periode: (a, b) => `Du ${tsJourMoisFr(a)}${b ? ` au ${tsJourMoisFr(b)}` : ''}`,
    voirCarte: 'Ouvrir dans Google Maps',
  },
};
const tsD = iso => new Date(iso + 'T12:00:00Z');
const tsOrdinal = n => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
const tsJourMoisEn = iso => { const x = tsD(iso); const n = x.getUTCDate(); return `${n}${tsOrdinal(n)} ${x.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}`; };
const tsJourMoisFr = iso => tsD(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const tsDateCourte = iso => tsD(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const tsTitre = v => String(v || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const tsH = h => (h || '').replace(':', '.');

// Une journée = les trajets qui partent le même jour (vol + correspondance)
function tsJournees(trajets) {
  const tri = [...trajets].filter(t => t.de || t.a || t.numero)
    .sort((a, b) => ((a.date || '9') + (a.depart || '')).localeCompare((b.date || '9') + (b.depart || '')));
  const jours = [];
  tri.forEach(t => {
    const j = jours[jours.length - 1];
    if (j && j.date === (t.date || '')) j.legs.push(t);
    else jours.push({ date: t.date || '', legs: [t] });
  });
  return jours;
}

// Petite carte : tuiles OpenStreetMap assemblées autour du cadre choisi, avec un
// repère sur le lieu. Le cadre (zoom et centre) se règle dans l'éditeur.
const TS_CARTE_W = 216, TS_CARTE_H = 180, TS_ZOOM_DEFAUT = 15;
const tsMonde = z => 256 * Math.pow(2, z);
function tsVersPixels(c, z) {
  const rad = c.lat * Math.PI / 180;
  return { x: (c.lng + 180) / 360 * tsMonde(z), y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * tsMonde(z) };
}
function tsDepuisPixels(p, z) {
  const n = Math.PI * (1 - 2 * p.y / tsMonde(z));
  return { lat: Math.atan(Math.sinh(n)) * 180 / Math.PI, lng: p.x / tsMonde(z) * 360 - 180 };
}
const tsZoom = x => Math.min(18, Math.max(3, Number(x.zoom) || TS_ZOOM_DEFAUT));

function tsCarteHtml(c, W, H, z = TS_ZOOM_DEFAUT, centre = c) {
  const n = Math.pow(2, z);
  const m = tsVersPixels(centre, z), pin = tsVersPixels(c, z);
  const px = m.x - W / 2, py = m.y - H / 2;
  const tiles = [];
  for (let tx = Math.floor(px / 256); tx <= Math.floor((px + W) / 256); tx++)
    for (let ty = Math.max(0, Math.floor(py / 256)); ty <= Math.min(n - 1, Math.floor((py + H) / 256)); ty++)
      tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png" style="position:absolute;width:256px;height:256px;left:${Math.round(tx * 256 - px)}px;top:${Math.round(ty * 256 - py)}px" alt="" draggable="false">`);
  return `<div class="ts-carte" style="position:relative;overflow:hidden;width:${W}px;height:${H}px;background:#eee">${tiles.join('')}
    <span class="ts-pin" style="position:absolute;left:${Math.round(pin.x - px)}px;top:${Math.round(pin.y - py)}px;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#c5221f;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>
    <span style="position:absolute;right:0;bottom:0;font:9px sans-serif;background:rgba(255,255,255,.8);padding:1px 3px">© OpenStreetMap</span></div>`;
}

const tsCarteSejour = (x, c) => tsCarteHtml(c, TS_CARTE_W, TS_CARTE_H, tsZoom(x), parseGps(x.centre) || c);

function tsCarteMaj(i) {
  const s = tsCur(), x = s && s.sejours[i], c = x && parseGps(x.gps);
  const el = document.querySelector(`.ts-mini-carte[data-i="${i}"]`);
  if (!c || !el) return;
  el.innerHTML = tsCarteSejour(x, c);
  tsChange();
}

function tsCarteZoom(i, d) {
  const x = tsCur().sejours[i];
  x.zoom = Math.min(18, Math.max(3, tsZoom(x) + d));
  tsCarteMaj(i);
}

function tsCarteRecentrer(i) {
  const x = tsCur().sejours[i];
  x.centre = ''; x.zoom = TS_ZOOM_DEFAUT;
  tsCarteMaj(i);
}

// Glisser la carte (souris ou doigt) déplace le cadre ; le repère reste sur le lieu
function tsCarteGlisse(e, i) {
  const x = tsCur().sejours[i], c = parseGps(x.gps);
  const el = e.currentTarget;
  if (!c || e.button > 0) return;
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  const z = tsZoom(x), depart = tsVersPixels(parseGps(x.centre) || c, z);
  const x0 = e.clientX, y0 = e.clientY;
  let dx = 0, dy = 0;
  const bouge = ev => {
    dx = ev.clientX - x0; dy = ev.clientY - y0;
    el.querySelectorAll('img, .ts-pin').forEach(n => { n.style.transform = `translate(${dx}px, ${dy}px)`; });
  };
  const fin = () => {
    el.removeEventListener('pointermove', bouge);
    el.removeEventListener('pointerup', fin);
    el.removeEventListener('pointercancel', fin);
    if (!dx && !dy) return;
    const m = tsDepuisPixels({ x: depart.x - dx, y: depart.y - dy }, z);
    x.centre = `${m.lat.toFixed(6)}, ${m.lng.toFixed(6)}`;
    tsCarteMaj(i);
  };
  el.addEventListener('pointermove', bouge);
  el.addEventListener('pointerup', fin);
  el.addEventListener('pointercancel', fin);
}

// Lien Google Maps de l'hébergement (nom + adresse, sinon le point GPS)
function tsLienMaps(x) {
  const q = x.adresse ? [x.nom, x.adresse].filter(Boolean).join(', ') : (x.gps || x.nom);
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
}

function tsDocHtml(s, ecran) {
  const T = TS_TXT[s.langue === 'fr' ? 'fr' : 'en'];
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const jours = tsJournees(s.trajets || []);
  const types = new Set((s.trajets || []).map(t => t.type === 'train' ? 'train' : t.type === 'autre' ? 'autre' : 'avion'));
  const titreTrajets = types.size === 1 && types.has('train') ? T.trains : types.size === 1 && types.has('avion') ? T.vols : T.trajets;
  const bagages = String(s.bagages || '').split('\n').map(x => x.trim()).filter(Boolean);
  const sejours = (s.sejours || []).filter(x => x.nom || x.adresse);
  const contacts = (s.contacts || []).filter(c => c.nom || c.tel);
  const groupes = [];
  contacts.forEach(c => {
    const g = (c.groupe || '').trim().toUpperCase();
    const ex = groupes.find(x => x.nom === g);
    if (ex) ex.liste.push(c); else groupes.push({ nom: g, liste: [c] });
  });

  const journeeHtml = j => {
    const de = j.legs[0].de, a = j.legs[j.legs.length - 1].a;
    const notes = j.legs.map(t => t.note).filter(Boolean);
    return `<div class="j">
      <div class="j-hdr">${j.date ? `<b>${esc(T.jour(j.date))}</b>` : ''}${de && a ? `<b>${esc(T.de(tsTitre(de), tsTitre(a)))}</b>` : ''}</div>
      <table>${j.legs.map((t, i) => `
        <tr class="tete"><td></td><td></td><td class="c">${i === 0 ? T.heure : ''}</td><td></td><td class="r">${t.numero ? (t.type === 'train' ? T.train : T.vol) : ''}</td></tr>
        <tr><th>${i === 0 ? T.depart : T.transit}</th><td>${esc(t.de)}${t.deDetail ? `<small>${esc(t.deDetail.toUpperCase())}</small>` : ''}</td>
          <td class="c"><span class="hl">${esc(tsH(t.depart))}</span></td><td></td><td class="r">${t.numero ? `<span class="hl">${esc(t.numero.toUpperCase())}</span>` : ''}</td></tr>
        <tr><th>${T.arrivee}</th><td>${esc(t.a)}${t.aDetail ? `<small>${esc(t.aDetail.toUpperCase())}</small>` : ''}</td><td class="c"><b>${esc(tsH(t.arrivee))}</b></td><td></td><td></td></tr>`).join('')}
      </table>
      ${notes.map(n => `<p class="note">${esc(n)}</p>`).join('')}
    </div>`;
  };

  return `<!DOCTYPE html><html lang="${s.langue === 'fr' ? 'fr' : 'en'}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRAVEL SHEET ${esc([s.client, s.voyageur].filter(Boolean).join('_').toUpperCase())}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Work Sans', Arial, sans-serif; color: #111; background: ${ecran ? '#fff' : '#e9e9e7'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 13px; }
  .barre { position: sticky; top: 0; z-index: 5; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 12px; background: #111; color: #fff; font-size: 14px; }
  .barre button { font: inherit; padding: 6px 14px; border: 1px solid #fff; background: #fff; color: #111; cursor: pointer; }
  .page { width: 210mm; min-height: 297mm; margin: ${ecran ? '0' : '10mm'} auto; background: #fff; padding: 14mm 19mm 12mm; }
  .entete { border: 1px solid #111; display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: start; padding: 12px 10px 14px; min-height: 28mm; }
  .entete .client { font-weight: 700; font-size: 25px; letter-spacing: .04em; line-height: 1; }
  .entete .client img { max-width: 34mm; max-height: 18mm; display: block; }
  .entete .milieu { text-align: center; font-size: 14px; line-height: 1.3; padding-top: 12px; }
  .entete .milieu b { display: block; font-weight: 700; }
  .entete .widen { justify-self: end; height: 17px; }
  .refs { text-align: center; font-size: 14.5px; margin: 16px 0 14px; }
  .sec { margin-bottom: 14px; }
  .sec-t { background: #ececec; text-align: center; font-size: 14.5px; padding: 1px 0; letter-spacing: .02em; }
  .sec-b { border: 1px solid #111; }
  .j { padding: 0 0 10px; }
  .j + .j { border-top: 1px solid #111; }
  .j-hdr { width: 55%; margin: 0 auto 10px; background: #c4c4c4; text-align: center; padding: 3px 4px; font-size: 14px; line-height: 1.35; }
  .j-hdr b { display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th { padding: 2px 0; vertical-align: top; text-align: left; }
  th { padding-left: 3px; }
  td.r { padding-right: 3px; }
  th { font-weight: 700; width: 21%; }
  td small { display: block; font-size: 10.5px; margin-top: 1px; }
  .c { text-align: center; width: 20%; }
  .r { text-align: right; width: 24%; }
  tr.tete td { padding-top: 10px; }
  .hl { display: inline-block; min-width: 100%; background: #ececec; color: #990000; font-weight: 700; padding: 0 4px; }
  .r .hl { min-width: 100%; text-align: right; }
  .note { text-align: center; font-size: 12.5px; margin-top: 12px; }
  .centre { text-align: center; font-size: 14.5px; line-height: 1.35; padding: 14px 0; }
  .sejour { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0 8px 2px; min-height: 40mm; }
  .sejour + .sejour { border-top: 1px solid #111; }
  .sejour .txt { font-size: 14.5px; line-height: 1.35; }
  .sejour .txt b { display: block; font-weight: 700; }
  .sejour .carte-lien, .sejour > .ts-carte { flex: none; margin-right: 26px; display: block; }
  .sejour a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  @media screen and (max-width: 820px) { .page { zoom: .46; margin: 8px auto; } }
  .contacts { display: grid; grid-template-columns: 21% 1fr 1fr 1fr; padding: 10px 0 12px; row-gap: 12px; font-size: 13.5px; }
  .contacts .g { background: #c4c4c4; font-weight: 700; padding: 2px 3px; align-self: start; }
  .contacts .p { line-height: 1.55; padding-left: 4px; }
  .contacts .p b { display: block; }
  .contacts .p i { display: block; }
  @media print { body { background: #fff; } .barre { display: none; } .page { margin: 0; } }
</style></head><body>
${ecran ? '' : '<div class="barre">Vérifie la travel sheet puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>'}
<div class="page">
  <div class="entete">
    <div class="client">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.client)}">` : esc(String(s.client || '').toUpperCase())}</div>
    <div class="milieu">${T.titre}<b>${esc(String(s.voyageur || '').toUpperCase())}</b>${esc([String(s.client || '').toUpperCase(), String(s.projet || '').toUpperCase()].filter(Boolean).join(' '))}</div>
    <img class="widen" src="${base}widen-logo.png" alt="WIDEN">
  </div>
  ${s.references ? `<div class="refs">${T.ref} : ${esc(s.references)}</div>` : '<div class="refs"></div>'}
  ${jours.length ? `<div class="sec"><div class="sec-t">${titreTrajets}</div><div class="sec-b">${jours.map(journeeHtml).join('')}</div></div>` : ''}
  ${bagages.length ? `<div class="sec"><div class="sec-t">${T.bagages}</div><div class="sec-b centre">${bagages.map(esc).join('<br>')}</div></div>` : ''}
  ${sejours.length ? `<div class="sec"><div class="sec-t">${T.sejour}</div><div class="sec-b">${sejours.map(x => {
    const c = parseGps(x.gps), lien = tsLienMaps(x);
    return `<div class="sejour"><div class="txt"><b>${esc(String(x.nom || '').toUpperCase())}</b>${x.du ? `<b>${esc(T.periode(x.du, x.au))}</b>` : ''}${x.adresse ? (lien ? `<a href="${esc(lien)}">${esc(x.adresse)}</a>` : esc(x.adresse)) : lien ? `<a href="${esc(lien)}">${T.voirCarte}</a>` : ''}${x.tel ? `<br>${esc(x.tel)}` : ''}</div>
      ${c ? (lien ? `<a class="carte-lien" href="${esc(lien)}">${tsCarteSejour(x, c)}</a>` : tsCarteSejour(x, c)) : ''}</div>`;
  }).join('')}</div></div>` : ''}
  ${groupes.length ? `<div class="sec"><div class="sec-t">${T.contacts}</div><div class="sec-b contacts">${groupes.map(g => {
    const lignes = [];
    for (let i = 0; i < g.liste.length; i += 3) lignes.push(g.liste.slice(i, i + 3));
    return lignes.map((l, li) => `<div class="g"${li ? ' style="visibility:hidden"' : ''}>${esc(g.nom || ' ')}</div>${l.map(c => `<div class="p"><b>${esc(c.nom)}</b>${c.role ? `<i>${esc(c.role)}</i>` : ''}${esc(c.tel || '')}</div>`).join('')}${'<div></div>'.repeat(3 - l.length)}`).join('');
  }).join('')}</div></div>` : ''}
</div>
</body></html>`;
}

function tsMajApercu() {
  const f = document.getElementById('ts-apercu');
  const s = tsCur();
  if (f && s) f.srcdoc = tsDocHtml(s, true);
}

async function tsPdf() {
  const s = tsCur();
  if (!s) return;
  clearTimeout(tsSaveTimer); saveDb();
  // Affiché à la place du site, avec RETOUR (l'appli sur téléphone ne sait pas fermer un nouvel onglet)
  ouvrirDocument(tsDocHtml(s, false));
  await imprimerDocument();
}

renderEspaces();
