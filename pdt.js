// ── PLANS DE TRAVAIL (PDT) ───────────────────────────────────────────────────
// Le plan de travail d'une journée de tournage (shooting schedule), rempli dans
// un formulaire et exporté en PDF. Chaque PDT appartient à un projet du suivi
// production (projets.js) : client, titre, date du tournage, lieu et cast sont
// repris du projet. Les horaires se calculent tout seuls à partir de l'heure du
// premier plan et de la durée de chaque ligne. Gardé sous db.prod.pdts.

let pdtId = null;             // PDT ouvert

const PDT_HORAIRES_DEFAUT = ['CALL ÉQUIPE', 'CALL AGENCE/CLIENTS', 'READY TO SHOOT', 'DÉJEUNER', 'WRAP'];
const PDT_PAUSES = ['BATTEMENT', 'DÉJEUNER', 'DÎNER', 'PAUSE', 'MARGE', 'WRAP'];
// Couleur de la case LIGHTING EFFECT : [fond, texte]
const PDT_LUMIERES = {
  jour: ['#f8cbad', '#111'],
  nuit: ['#2f5597', '#fff'],
  neutre: ['#e7e6e6', '#111'],
};
const PDT_LUMIERES_CHOIX = [['', 'Auto (selon le texte)'], ['jour', 'Jour (orange)'], ['nuit', 'Nuit (bleu)'], ['neutre', 'Gris'], ['aucune', 'Sans couleur']];

function pdtList() {
  const p = prodData();
  if (!Array.isArray(p.pdts)) p.pdts = [];
  return p.pdts;
}
function pdtById(id) { return pdtList().find(d => d.id === id); }
function pdtCur() { return pdtById(pdtId); }
function pdtDuProjet(pid) { return pdtList().filter(d => d.projetId === pid).sort((a, b) => (a.jour || 0) - (b.jour || 0) || (a.date || '9').localeCompare(b.date || '9')); }
const pdtLid = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Ce qu'on reprend du projet ───────────────────────────────────────────────
// Les jours de tournage du calendrier du projet
// (pour un PDT photo ou vidéo : les tournages de cette partie et ceux en commun)
function pdtJoursTournage(p, type) {
  const jours = new Set();
  (p.etapes || []).forEach(e => {
    const d = pjEtapeDates(e);
    if (!d || pjEtapeCat(e) !== 'tournage') return;
    if (type && pjPisteDe(e) && pjPisteDe(e) !== type) return;
    for (let x = d.du; x <= d.au; x = pjPlusJours(x, 1)) jours.add(x);
  });
  return [...jours].sort();
}

// Le cast : les gens de l'équipe dont le rôle (ou le chapitre de la bible) est modèle, athlète, figuration…
const PDT_RE_CAST = /modele|athl|talent|\bcast|figura|comedien|acteur|actrice|mannequin/;
function pdtEstCast(a) {
  const t = pjTalent(a.ref);
  const cats = t ? (t.cats || []).map(c => (catById(c) || {}).label || '').join(' ') : '';
  return PDT_RE_CAST.test(pjNorm(a.role + ' ' + cats));
}
function pdtCastDuProjet(p) {
  return (p.equipe || []).filter(a => pjNomPersonne(a) && pdtEstCast(a))
    .map(a => ({ nom: pjNomPersonne(a).toUpperCase(), role: String(a.role || '').toUpperCase(), call: '', pat: '' }));
}

function pdtLignesDepart(lieu) {
  return [
    { id: pdtLid(), type: 'partie', titre: lieu ? String(lieu).toUpperCase() : '' },
    { id: pdtLid(), type: 'install', texte: 'MISE EN PLACE', duree: 15 },
    { id: pdtLid(), type: 'plan', duree: 15, shot: '1' },
  ];
}

const PDT_TYPES = [['video', 'Vidéo'], ['photo', 'Photo']];
const pdtType = d => d && d.type === 'photo' ? 'photo' : 'video';
// Les mots qui changent entre un PDT vidéo et un PDT photo (formulaire et PDF)
const PDT_MOTS = {
  video: { plan: 'PLAN', num: 'SHOT #', scene: 'SCÈNE', sceneCol: 'SCENE', technique: 'DESCRIPTION TECHNIQUE', techniqueCol: 'DESCRIPTION<br>TECHNIQUE', optique: 'CAMÉRA / OPTIQUE', optiqueCol: 'CAMERA<br>-<br>LENS', phScene: 'Ce qu\'on voit dans le plan…', phTech: 'Plan large fixe' },
  photo: { plan: 'PHOTO', num: 'PHOTO #', scene: 'DESCRIPTION', sceneCol: 'DESCRIPTION', technique: 'CADRAGE / SET', techniqueCol: 'CADRAGE<br>/ SET', optique: 'OPTIQUE', optiqueCol: 'OPTIQUE', phScene: 'Ce qu\'on voit sur la photo…', phTech: 'Plein pied, fond studio' },
};
const pdtMots = d => PDT_MOTS[pdtType(d)];

// Nouveau PDT vidéo ou photo. S'il y en a déjà un du même type, il reprend son
// en-tête, ses horaires et son cast, et prend le jour de tournage suivant.
function pdtNouveau(pid, type) {
  const p = pjById(pid);
  if (!p) return;
  type = type === 'photo' ? 'photo' : 'video';
  const siens = pdtDuProjet(pid).filter(d => pdtType(d) === type);
  const jours = pdtJoursTournage(p, type);
  const n = siens.length + 1;
  const client = String(p.client || '').trim();
  const nom = String(p.nom || '').trim();
  const titre = client && nom && !pjNorm(nom).includes(pjNorm(client)) ? `${client} “${nom}”` : nom || client;
  const d = {
    id: uid(), projetId: p.id, maj: Date.now(), type,
    client, titre: titre.toUpperCase(), logo: prodData().logos[tsCleClient(client)] || '',
    date: jours[n - 1] || '', jour: n, jours: Math.max(jours.length, n), lieu: p.lieu || '',
    debut: '09:00',
    horaires: PDT_HORAIRES_DEFAUT.map(label => ({ heure: '', label })),
    cast: pdtCastDuProjet(p),
    prepaHeure: '', prepaTexte: type === 'photo' ? 'PRÉPA (LUMIÈRE, SET, HMC, CAST…)' : 'PRÉPA (LUMIÈRE, CAMÉRA, VIDÉO, CAST…)',
    lignes: pdtLignesDepart(p.lieu),
  };
  const avant = siens[siens.length - 1];
  if (avant) {
    ['client', 'titre', 'logo', 'lieu', 'debut', 'prepaHeure', 'prepaTexte'].forEach(k => { d[k] = avant[k]; });
    d.horaires = JSON.parse(JSON.stringify(avant.horaires || []));
    d.cast = JSON.parse(JSON.stringify(avant.cast || []));
    if (!d.date && avant.date) d.date = pjPlusJours(avant.date, 1);
    d.jours = Math.max(d.jours, avant.jours || 1);
    siens.forEach(x => { if ((x.jours || 1) < d.jours) x.jours = d.jours; });
  }
  pdtList().push(d);
  saveDb();
  pdtOuvrir(d.id);
}

// Importer un PDT tout prêt (fichier .json) dans ce projet. Les images de
// référence incluses dans le fichier sont envoyées au serveur une fois le PDT créé.
async function pdtImporter(f, pid) {
  const p = pjById(pid);
  if (!f || !p) return;
  let x;
  try { const o = JSON.parse(await f.text()); x = o && o.pdt ? o.pdt : o; } catch { x = null; }
  if (!x || !Array.isArray(x.lignes)) { alert('Ce fichier n\'est pas un plan de travail.'); return; }
  const d = JSON.parse(JSON.stringify(x));
  Object.assign(d, { id: uid(), projetId: p.id, maj: Date.now(), type: d.type === 'photo' ? 'photo' : 'video' });
  d.lignes = d.lignes.filter(l => l && PDT_TYPES_NOM[l.type]).map(l => ({ ...l, id: pdtLid() }));
  ['horaires', 'cast'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.client) d.client = String(p.client || '').trim();
  if (!d.logo) d.logo = prodData().logos[tsCleClient(d.client)] || '';
  pdtList().push(d);
  saveDb();
  pdtOuvrir(d.id);
  let n = 0;
  for (const l of d.lignes) {
    if (!/^data:image\//.test(l.img || '')) continue;
    try {
      const blob = dataUrlToBlob(l.img);
      const res = await storeFetch('/photo/ref', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      l.img = 'r:' + res.id;
      n++;
    } catch (e) { console.error(e); } // l'image reste dans le PDT
  }
  if (n) { d.maj = Date.now(); saveDb(); if (pdtCur() === d) pdtRedessiner(); }
}

function pdtOuvrir(id) {
  pdtId = id;
  pjGo('pdt');
}
function pdtRetour() {
  const d = pdtCur();
  if (d && pjById(d.projetId)) pjGo('projet', d.projetId);
  else pjGo('liste');
}

// Bloc PLANS DE TRAVAIL de la page d'un projet
function pjPdtHtml(p) {
  const siens = pdtDuProjet(p.id);
  return `<section class="ts-bloc">
    <h3>PLANS DE TRAVAIL (PDT)${siens.length ? ` <small class="pj-muted">· ${siens.length}</small>` : ''}</h3>
    ${siens.length ? `<div class="pj-ts-liste">${siens.map(d => {
      const n = (d.lignes || []).filter(l => l.type === 'plan').length;
      return `<div class="pj-ts-ligne" onclick="pdtOuvrir(${d.id})">
        <span class="pj-nom"><span class="ch-dot" style="background:${PJ_PISTES.find(x => x[0] === pdtType(d))[2]}"></span>PDT ${pdtType(d) === 'photo' ? 'PHOTO' : 'VIDÉO'} · JOUR ${d.jour || 1} / ${d.jours || 1}</span>
        <span class="pj-muted">${n} ${pdtType(d) === 'photo' ? 'photo' : 'plan'}${n > 1 ? 's' : ''}${d.lieu ? ' · ' + esc(d.lieu) : ''}</span>
        <span class="pj-muted">${d.date ? esc(tsDateCourte(d.date)) : 'date à compléter'}</span>
      </div>`;
    }).join('')}</div>` : '<p class="field-hint">Aucun plan de travail pour ce projet. Le PDT reprend les dates de tournage, le lieu et le cast du projet.</p>'}
    <div class="ts-add-row">
      <button type="button" class="btn-upload" onclick="pdtNouveau(${p.id}, 'video')">+ PDT VIDÉO</button>
      <button type="button" class="btn-upload" onclick="pdtNouveau(${p.id}, 'photo')">+ PDT PHOTO</button>
      <label class="btn-upload">IMPORTER UN PDT<input type="file" accept=".json,application/json" hidden onchange="pdtImporter(this.files[0], ${p.id}); this.value=''"></label>
    </div>
  </section>`;
}

// ── Horaires ─────────────────────────────────────────────────────────────────
const pdtMin = h => { const m = /^(\d{1,2})[:h.](\d{2})$/.exec(String(h || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const pdtHh = m => m == null ? '' : String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');

// Pour chaque ligne : { du, au } (en minutes), à la suite depuis l'heure de début.
// Une ligne avec un « début fixe » repart de cette heure. Après une partie
// « hors plateau », plus d'horaires. Les parties n'ont pas d'horaires.
function pdtHoraires(d) {
  const res = {};
  let t = pdtMin(d.debut), hors = false, n = 0;
  (d.lignes || []).forEach(l => {
    if (l.type === 'partie') {
      if (l.hors) { hors = true; t = null; } else n++;
      res[l.id] = { num: l.hors ? 0 : n, hors: l.hors };
      return;
    }
    if (hors) { res[l.id] = { hors: true }; return; }
    const fixe = pdtMin(l.heure);
    if (fixe != null) t = fixe;
    const duree = Math.max(0, Number(l.duree) || 0);
    const du = t;
    if (t != null) t += duree;
    res[l.id] = { du, au: du != null ? du + duree : null, duree };
  });
  res.fin = t;
  return res;
}
const pdtPlage = h => h && h.du != null ? (h.au !== h.du ? `${pdtHh(h.du)}-${pdtHh(h.au)}` : pdtHh(h.du)) : '';

// ── Éditeur ──────────────────────────────────────────────────────────────────
let pdtSaveTimer = null, pdtApercuTimer = null;

function pdtReprendre(d) {
  const list = pdtList();
  const i = list.findIndex(x => x.id === d.id);
  if (i >= 0) list[i] = d; else list.push(d);
}

function pdtChange() {
  const d = pdtCur();
  if (!d) return;
  d.maj = Date.now();
  clearTimeout(pdtSaveTimer);
  pdtSaveTimer = setTimeout(() => { pdtSaveTimer = null; saveDb(); }, 900);
  clearTimeout(pdtApercuTimer);
  pdtApercuTimer = setTimeout(pdtMajApercu, 250);
}

function pdtRedessiner() {
  const main = document.getElementById('main-content');
  if (main && document.querySelector('.pdt-editor')) renderPdtEditor(main);
}

// data-k="titre" : champ du PDT ; data-l="lignes" data-i="<id>" data-k="scene" : champ d'une ligne
// (horaires et cast : data-i est le numéro de la ligne)
function pdtInput(el) {
  const d = pdtCur();
  if (!d) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  const k = el.dataset.k;
  if (el.dataset.l) {
    const liste = d[el.dataset.l] || [];
    const row = el.dataset.l === 'lignes' ? liste.find(l => l.id === el.dataset.i) : liste[Number(el.dataset.i)];
    if (!row) return;
    row[k] = k === 'duree' ? (v === '' ? '' : Math.max(0, Number(v) || 0)) : v;
  } else d[k] = k === 'jour' || k === 'jours' ? Math.max(1, Number(v) || 1) : v;
  if (['debut', 'duree', 'heure', 'hors'].includes(k)) pdtMajHeures();
  if (k === 'jour' || k === 'jours' || k === 'type') buildTabs();
  if (k === 'client' && !d.logo) { const l = prodData().logos[tsCleClient(d.client)]; if (l) { d.logo = l; pdtLogoMaj(); } }
  pdtChange();
}

// Les horaires affichés dans l'éditeur, sans tout redessiner
function pdtMajHeures() {
  const d = pdtCur();
  if (!d) return;
  const h = pdtHoraires(d);
  document.querySelectorAll('.pdt-editor [data-h]').forEach(el => {
    const x = h[el.dataset.h];
    if (!x) return;
    el.textContent = x.num ? `PARTIE ${x.num}` : x.hors ? (el.dataset.t === 'partie' ? 'HORS PLATEAU' : '') : pdtPlage(x);
  });
  const fin = document.getElementById('pdt-fin');
  if (fin) fin.textContent = h.fin != null ? `Fin du dernier plan : ${pdtHh(h.fin)}` : '';
}

function pdtField(label, k, v, opts = {}) {
  const attrs = `data-k="${k}"${opts.l ? ` data-l="${opts.l}" data-i="${opts.i}"` : ''}`;
  let input;
  if (opts.textarea) input = `<textarea rows="${opts.rows || 2}" ${attrs} oninput="pdtInput(this)" placeholder="${esc(opts.ph || '')}">${esc(v == null ? '' : v)}</textarea>`;
  else if (opts.select) input = `<select ${attrs} onchange="pdtInput(this)${opts.redessiner ? ';pdtRedessiner()' : ''}">${opts.select.map(([val, lab]) => `<option value="${val}"${(v || '') === val ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  else input = `<input type="${opts.type || 'text'}" ${attrs} value="${esc(v == null ? '' : v)}" placeholder="${esc(opts.ph || '')}"${opts.list ? ` list="${opts.list}"` : ''}${opts.min != null ? ` min="${opts.min}" step="${opts.step || 1}"` : ''} oninput="pdtInput(this)">`;
  return `<div class="field${opts.full ? ' full' : ''}${opts.cls ? ' ' + opts.cls : ''}"><label>${esc(label)}</label>${input}</div>`;
}

function renderPdtEditor(main) {
  const d = pdtCur();
  const p = pjById(d.projetId);
  const h = pdtHoraires(d);
  const scroll = window.scrollY;
  const equipe = p ? (p.equipe || []).filter(a => pjNomPersonne(a)) : [];
  main.innerHTML = `<div class="ts-editor pdt-editor">
    <div class="ts-form">
      <section class="ts-bloc">
        <h3>EN-TÊTE</h3>
        <div class="ts-grid">
          ${pdtField('TYPE DE PDT', 'type', pdtType(d), { select: PDT_TYPES, redessiner: true })}
          ${pdtField('TITRE', 'titre', d.titre, { ph: 'ex : SIMOND “AVANTGARDE”' })}
          ${pdtField('CLIENT', 'client', d.client, { ph: 'ex : SIMOND' })}
          ${pdtField('DATE DU TOURNAGE', 'date', d.date, { type: 'date' })}
          ${pdtField('LIEU', 'lieu', d.lieu, { ph: 'ex : Simond HQ, Chamonix', list: 'pdt-lieux' })}
          ${pdtField('SHOOT DAY', 'jour', d.jour || 1, { type: 'number', min: 1 })}
          ${pdtField('SUR (NOMBRE DE JOURS)', 'jours', d.jours || 1, { type: 'number', min: 1 })}
          <div class="field full ts-logo" id="pdt-logo-zone">${pdtLogoZoneHtml(d)}</div>
        </div>
        <datalist id="pdt-lieux">${lieuxList().map(l => `<option value="${esc(l.nom || '')}">`).join('')}</datalist>
      </section>

      <section class="ts-bloc">
        <h3>HORAIRES DE LA JOURNÉE</h3>
        <p class="field-hint">Laisse l'heure vide pour écrire « TBC » en rouge. READY TO SHOOT et WRAP vides prennent l'heure du premier plan et de la fin.</p>
        <div class="pdt-mini-liste">${(d.horaires || []).map((x, i) => `<div class="pdt-mini">
          ${pdtField('HEURE', 'heure', x.heure, { l: 'horaires', i, ph: 'TBC' })}
          ${pdtField('QUOI', 'label', x.label, { l: 'horaires', i })}
          <button type="button" class="ts-x" onclick="pdtRetirer('horaires', ${i})" title="Retirer">✕</button>
        </div>`).join('')}</div>
        <div class="ts-add-row"><button type="button" class="btn-upload" onclick="pdtAjouterSimple('horaires')">+ HORAIRE</button></div>
      </section>

      <section class="ts-bloc">
        <h3>CAST</h3>
        <div class="pdt-mini-liste">${(d.cast || []).map((x, i) => `<div class="pdt-mini pdt-mini-cast">
          ${pdtField('NOM', 'nom', x.nom, { l: 'cast', i, ph: 'TBC' })}
          ${pdtField('RÔLE', 'role', x.role, { l: 'cast', i, ph: 'ATHLÈTE (HOMME)' })}
          ${pdtField('CALL', 'call', x.call, { l: 'cast', i, ph: 'TBC' })}
          ${pdtField('PAT', 'pat', x.pat, { l: 'cast', i, ph: '16:15' })}
          <button type="button" class="ts-x" onclick="pdtRetirer('cast', ${i})" title="Retirer">✕</button>
        </div>`).join('') || '<p class="field-hint">Personne dans le cast.</p>'}</div>
        <div class="ts-add-row">
          <button type="button" class="btn-upload" onclick="pdtAjouterSimple('cast')">+ CAST</button>
          ${equipe.length ? `<select class="filter-sel" onchange="pdtCastEquipe(this.value)">
            <option value="">Ajouter quelqu'un de l'équipe du projet…</option>
            ${equipe.map(a => `<option value="${a.id}">${esc(pjNomPersonne(a) + (a.role ? ' · ' + a.role : ''))}</option>`).join('')}
          </select>` : ''}
        </div>
      </section>

      <section class="ts-bloc">
        <h3>DÉROULÉ</h3>
        <div class="ts-grid pdt-grid-debut">
          ${pdtField('HEURE DU PREMIER PLAN', 'debut', d.debut, { type: 'time' })}
          ${pdtField('PRÉPA : HORAIRES', 'prepaHeure', d.prepaHeure, { ph: `TBC-${d.debut || '09:00'}` })}
          ${pdtField('PRÉPA : TEXTE', 'prepaTexte', d.prepaTexte, { full: true })}
        </div>
        <p class="field-hint">Les horaires se calculent tout seuls avec les durées. Mets un « début fixe » sur une ligne pour repartir d'une heure précise (après le déjeuner par exemple). <b id="pdt-fin">${h.fin != null ? `Fin du dernier plan : ${pdtHh(h.fin)}` : ''}</b></p>
        <div class="pdt-lignes">${(d.lignes || []).map((l, i) => pdtLigneHtml(l, i, h[l.id] || {}, d.lignes.length)).join('') || '<p class="field-hint">Aucune ligne.</p>'}</div>
        <div class="ts-add-row">
          <button type="button" class="btn-upload" onclick="pdtAjouter('partie')">+ PARTIE (DÉCOR)</button>
          <button type="button" class="btn-upload" onclick="pdtAjouter('install')">+ MISE EN PLACE</button>
          <button type="button" class="btn-upload" onclick="pdtAjouter('plan')">+ ${pdtMots(d).plan}</button>
          <button type="button" class="btn-upload" onclick="pdtAjouter('pause')">+ PAUSE / BATTEMENT</button>
        </div>
        ${pdtField('NOTE EN BAS DU PDF', 'piedPage', d.piedPage, { full: true, cls: 'pdt-pied', ph: 'ex : Rouge = à prévoir / à valider · TBC = à confirmer' })}
        <datalist id="pdt-pauses">${PDT_PAUSES.map(x => `<option value="${x}">`).join('')}</datalist>
      </section>

      <div class="ts-actions">
        <button type="button" class="btn-del" onclick="pdtSupprimer()">✕ SUPPRIMER</button>
        <div class="spacer"></div>
        <button type="button" class="btn-cancel" onclick="pdtDupliquer()">DUPLIQUER</button>
        <button type="button" class="btn-save" onclick="pdtPdf()">CRÉER LE PDF</button>
      </div>
    </div>
    <div class="ts-apercu-col">
      <div class="ts-apercu-lbl">APERÇU</div>
      <div class="ts-apercu-cadre"><iframe id="pdt-apercu" title="Aperçu du plan de travail"></iframe></div>
    </div>
  </div>`;
  window.scrollTo(0, scroll);
  pdtMajApercu();
}

const PDT_TYPES_NOM = { partie: 'PARTIE', install: 'MISE EN PLACE', plan: 'PLAN', pause: 'PAUSE' };

function pdtLigneHtml(l, i, h, n) {
  const M = pdtMots(pdtCur());
  const o = { l: 'lignes', i: l.id };
  const heure = h.num ? `PARTIE ${h.num}` : h.hors ? (l.type === 'partie' ? 'HORS PLATEAU' : '') : pdtPlage(h);
  const hdr = `<div class="ts-ligne-hdr">
      <b>${l.type === 'plan' ? `${pdtMots(pdtCur()).plan}${l.shot ? ' #' + esc(l.shot) : ''}` : l.type === 'partie' ? '' : PDT_TYPES_NOM[l.type]}</b>
      <span class="pdt-h" data-h="${l.id}" data-t="${l.type}">${esc(heure)}</span>
      <div class="spacer"></div>
      <select class="pdt-ajout" onchange="pdtAjouter(this.value, ${i}); this.value=''" title="Ajouter une ligne en dessous">
        <option value="">+ dessous</option><option value="plan">${M.plan === 'PHOTO' ? 'Photo' : 'Plan'}</option><option value="install">Mise en place</option><option value="pause">Pause / battement</option><option value="partie">Partie (décor)</option>
      </select>
      <button type="button" class="ts-x" onclick="pdtDeplacer(${i}, -1)" title="Monter"${i ? '' : ' disabled'}>↑</button>
      <button type="button" class="ts-x" onclick="pdtDeplacer(${i}, 1)" title="Descendre"${i < n - 1 ? '' : ' disabled'}>↓</button>
      <button type="button" class="ts-x" onclick="pdtCopierLigne(${i})" title="Dupliquer la ligne">⧉</button>
      <button type="button" class="ts-x" onclick="pdtRetirer('lignes', ${i})" title="Retirer">✕</button>
    </div>`;
  const temps = `${pdtField('DURÉE (MIN)', 'duree', l.duree, { ...o, type: 'number', min: 0, step: 5 })}
    ${pdtField('DÉBUT FIXE', 'heure', l.heure, { ...o, type: 'time' })}`;
  if (l.type === 'partie') return `<div class="ts-ligne pdt-ligne pdt-l-partie">${hdr}
    <div class="ts-grid">
      ${pdtField('DÉCOR / AMBIANCE', 'titre', l.titre, { ...o, full: true, ph: 'SIMOND HQ — AMBIANCE LEVER DU JOUR', list: 'pdt-lieux' })}
      <label class="cat-check full"><input type="checkbox" data-k="hors" data-l="lignes" data-i="${l.id}" ${l.hors ? 'checked' : ''} onchange="pdtInput(this); pdtRedessiner()"><span>Hors plateau (post-prod, stock… sans horaires)</span></label>
    </div></div>`;
  if (l.type === 'install') return `<div class="ts-ligne pdt-ligne pdt-l-install">${hdr}
    <div class="ts-grid pdt-grid-3">
      ${pdtField('QUOI', 'texte', l.texte, { ...o, ph: 'MISE EN PLACE LUMIÈRE « LEVER DU JOUR »', cls: 'pdt-large' })}
      ${temps}
    </div></div>`;
  if (l.type === 'pause') return `<div class="ts-ligne pdt-ligne pdt-l-pause">${hdr}
    <div class="ts-grid pdt-grid-4">
      ${pdtField('TYPE', 'nom', l.nom, { ...o, list: 'pdt-pauses', ph: 'BATTEMENT' })}
      ${pdtField('DÉTAIL', 'texte', l.texte, { ...o, ph: 'CHANGEMENT DE DÉCOR' })}
      ${temps}
    </div></div>`;
  return `<div class="ts-ligne pdt-ligne pdt-l-plan">${hdr}
    <div class="pdt-plan-corps">
      <div class="pdt-ref" ondragover="event.preventDefault()" ondrop="pdtImageDepose(event, '${l.id}')">
        ${l.img ? `<img src="${esc(pdtImgSrc(l.img))}" alt="">` : `<span>${l.imgEnvoi ? 'ENVOI…' : 'RÉFÉRENCE'}</span>`}
        <div class="pdt-ref-btns">
          <label class="export-lien">${l.img ? 'changer' : 'image'}<input type="file" accept="image/*" hidden onchange="pdtImageFichier(this.files[0], '${l.id}')"></label>
          ${l.img ? `<button type="button" class="export-lien" onclick="pdtImageRetirer('${l.id}')">retirer</button>` : ''}
        </div>
        <input class="pdt-ref-colle" placeholder="ou colle l'image ici" onpaste="pdtImageColle(event, '${l.id}')" onkeydown="if(event.key==='Enter'){event.preventDefault();pdtImageLien(this.value, '${l.id}')}">
      </div>
      <div class="ts-grid pdt-grid-plan">
        ${pdtField(M.num, 'shot', l.shot, { ...o, ph: '40' })}
        ${temps}
        ${pdtField(M.scene, 'scene', l.scene, { ...o, textarea: true, full: true, ph: M.phScene })}
        ${pdtField(M.technique, 'technique', l.technique, { ...o, ph: M.phTech })}
        ${pdtField(M.optique, 'optique', l.optique, { ...o, ph: '35MM' })}
        ${pdtField('EFFET LUMIÈRE', 'lumiere', l.lumiere, { ...o, textarea: true, rows: 2, ph: 'NUIT\n(2e ligne en petit)' })}
        ${pdtField('COULEUR DE LA CASE', 'lumCouleur', l.lumCouleur, { ...o, select: PDT_LUMIERES_CHOIX })}
        ${pdtField('NOTES / À PRÉVOIR', 'note', l.note, { ...o, textarea: true, rows: 2, ph: 'Prévoir accessoire…' })}
        <label class="cat-check pdt-rouge"><input type="checkbox" ${l.noteNoire ? '' : 'checked'} onchange="pdtNoteRouge('${l.id}', this.checked)"><span>note en rouge</span></label>
      </div>
    </div></div>`;
}

function pdtNoteRouge(id, rouge) {
  const l = pdtLigne(id);
  if (!l) return;
  if (rouge) delete l.noteNoire; else l.noteNoire = true;
  pdtChange();
}

function pdtAjouterSimple(liste) {
  const d = pdtCur();
  if (!d) return;
  if (!Array.isArray(d[liste])) d[liste] = [];
  d[liste].push(liste === 'cast' ? { nom: '', role: '', call: '', pat: '' } : { heure: '', label: '' });
  pdtChange();
  pdtRedessiner();
}

function pdtCastEquipe(aid) {
  const d = pdtCur(), p = d && pjById(d.projetId);
  const a = p && (p.equipe || []).find(x => String(x.id) === String(aid));
  if (!a) return;
  if (!Array.isArray(d.cast)) d.cast = [];
  d.cast.push({ nom: pjNomPersonne(a).toUpperCase(), role: String(a.role || '').toUpperCase(), call: '', pat: '' });
  pdtChange();
  pdtRedessiner();
}

// Nouvelle ligne à la fin, ou sous la ligne apres
function pdtAjouter(type, apres) {
  const d = pdtCur();
  if (!d || !PDT_TYPES_NOM[type]) return;
  if (!Array.isArray(d.lignes)) d.lignes = [];
  const plans = d.lignes.filter(l => l.type === 'plan').map(l => parseInt(l.shot, 10)).filter(n => !isNaN(n));
  const l = { id: pdtLid(), type };
  if (type === 'plan') Object.assign(l, { duree: 15, shot: plans.length ? String(Math.max(...plans) + 1) : '1' });
  if (type === 'install') Object.assign(l, { texte: 'MISE EN PLACE', duree: 15 });
  if (type === 'pause') Object.assign(l, { nom: 'BATTEMENT', texte: '', duree: 30 });
  if (type === 'partie') l.titre = '';
  if (apres != null && apres >= 0) d.lignes.splice(apres + 1, 0, l); else d.lignes.push(l);
  pdtChange();
  pdtRedessiner();
}

function pdtRetirer(liste, i) {
  const d = pdtCur();
  if (!d || !d[liste]) return;
  const l = d[liste][i];
  if (liste === 'lignes' && l && (l.scene || l.img) && !confirm('Retirer ce plan ?')) return;
  d[liste].splice(i, 1);
  if (l && l.img) pdtImageEffacer(l.img);
  pdtChange();
  pdtRedessiner();
}

function pdtDeplacer(i, sens) {
  const d = pdtCur();
  const j = i + sens;
  if (!d || j < 0 || j >= d.lignes.length) return;
  [d.lignes[i], d.lignes[j]] = [d.lignes[j], d.lignes[i]];
  pdtChange();
  pdtRedessiner();
}

function pdtCopierLigne(i) {
  const d = pdtCur();
  if (!d || !d.lignes[i]) return;
  const c = { ...JSON.parse(JSON.stringify(d.lignes[i])), id: pdtLid() };
  delete c.heure;
  d.lignes.splice(i + 1, 0, c);
  pdtChange();
  pdtRedessiner();
}

function pdtDupliquer() {
  const d = pdtCur();
  if (!d) return;
  const c = { ...JSON.parse(JSON.stringify(d)), id: uid(), maj: Date.now() };
  // Les images sont partagées avec le PDT d'origine (effacées seulement quand plus aucun PDT ne s'en sert)
  c.lignes.forEach(l => { l.id = pdtLid(); });
  pdtList().push(c);
  saveDb();
  pdtOuvrir(c.id);
}

function pdtSupprimer() {
  const d = pdtCur();
  if (!d || !confirm('Supprimer ce plan de travail ?')) return;
  prodData().pdts = pdtList().filter(x => x.id !== d.id);
  (d.lignes || []).forEach(l => { if (l.img) pdtImageEffacer(l.img); });
  clearTimeout(pdtSaveTimer); pdtSaveTimer = null;
  saveDb();
  pdtRetour();
}

// ── Logo du client (repris des travel sheets, gardé par client) ──────────────
function pdtLogoZoneHtml(d) {
  return `<label>LOGO DU CLIENT</label>
    <div class="ts-logo-row">
      ${d.logo ? `<img class="ts-logo-actuel" src="${esc(d.logo)}" alt="">` : '<span class="field-hint">Sans logo, le nom du client est écrit à la place.</span>'}
      <button type="button" class="btn-upload" onclick="pdtLogoChercher()">TROUVER LE LOGO</button>
      <label class="btn-upload">FICHIER<input type="file" accept="image/*,.svg" hidden onchange="pdtLogoFichier(this.files[0])"></label>
      ${d.logo ? '<button type="button" class="btn-upload" onclick="pdtLogoMettre(\'\')">RETIRER</button>' : ''}
    </div>
    <div class="field-hint" id="pdt-logo-msg"></div>`;
}
function pdtLogoMaj(msg) {
  const z = document.getElementById('pdt-logo-zone'), d = pdtCur();
  if (z && d) z.innerHTML = pdtLogoZoneHtml(d);
  const m = document.getElementById('pdt-logo-msg');
  if (m && msg) m.textContent = msg;
}
function pdtLogoMettre(png) {
  const d = pdtCur();
  if (!d) return;
  d.logo = png;
  if (png && d.client) prodData().logos[tsCleClient(d.client)] = png;
  pdtChange();
  pdtLogoMaj();
}
async function pdtLogoFichier(f) {
  if (!f) return;
  try { pdtLogoMettre(await tsLogoPng(await tsLogoDataUrl(f))); }
  catch (e) { pdtLogoMaj('Logo : ' + e.message); }
}
async function pdtLogoChercher() {
  const d = pdtCur();
  if (!d) return;
  if (!tsCleClient(d.client)) { pdtLogoMaj('Écris d\'abord le nom du client.'); return; }
  pdtLogoMaj(`Recherche du logo ${d.client}…`);
  try {
    for (const src of await tsLogoServeur({ client: d.client.trim() })) {
      try { pdtLogoMettre(await tsLogoPng(src)); pdtLogoMaj('Logo trouvé. Si ce n\'est pas le bon, ajoute le fichier.'); return; } catch {}
    }
    throw new Error('aucune image lisible.');
  } catch (e) { pdtLogoMaj('Logo : ' + e.message); }
}

// ── Images de référence ──────────────────────────────────────────────────────
// Envoyées au serveur (comme les photos de la bible) ; « r:<id> » dans le PDT.
// Si l'envoi échoue, une petite copie est gardée dans le PDT lui-même.
function pdtImgSrc(v) {
  return /^r:/.test(v || '') ? avecCodeImage(`${STORE_URL}/img/r/${encodeURIComponent(v.slice(2))}`) : v;
}

function pdtLigne(id) { const d = pdtCur(); return d && (d.lignes || []).find(l => l.id === id); }

async function pdtImageMettre(id, lire) {
  const d = pdtCur(), l = pdtLigne(id);
  if (!l) return;
  const avant = l.img;
  l.imgEnvoi = true;
  pdtRedessiner();
  try {
    const grande = await lire(1000);
    try {
      const blob = dataUrlToBlob(grande);
      const r = await storeFetch('/photo/ref', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      l.img = 'r:' + r.id;
    } catch (e) {
      console.error(e);
      l.img = await lire(420);
    }
    pdtImageEffacer(avant);
  } catch (e) { alert('Impossible de lire cette image.'); }
  delete l.imgEnvoi;
  if (pdtCur() === d) { pdtChange(); pdtRedessiner(); }
}

function pdtImageFichier(f, id) {
  if (!f || !/^image\//.test(f.type)) return;
  pdtImageMettre(id, w => compressImage(f, w));
}

function pdtImageDepose(e, id) {
  e.preventDefault();
  const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type));
  if (f) return pdtImageFichier(f, id);
  const t = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (t) pdtImageLien(t, id);
}

function pdtImageColle(e, id) {
  const f = [...(e.clipboardData.files || [])].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); pdtImageFichier(f, id); return; }
  const t = e.clipboardData.getData('text').trim();
  if (/^https?:\/\//i.test(t)) { e.preventDefault(); pdtImageLien(t, id); }
}

// Un lien d'image est gardé tel quel (Google Drive converti en lien direct)
function pdtImageLien(url, id) {
  url = String(url || '').trim();
  const l = pdtLigne(id);
  if (!l || !/^https?:\/\//i.test(url)) return;
  const avant = l.img;
  l.img = normalizePhotoUrl(url);
  pdtImageEffacer(avant);
  pdtChange();
  pdtRedessiner();
}

function pdtImageRetirer(id) {
  const l = pdtLigne(id);
  if (!l) return;
  const avant = l.img;
  delete l.img;
  pdtImageEffacer(avant);
  pdtChange();
  pdtRedessiner();
}

// Efface l'image du serveur si plus aucun PDT ne s'en sert
function pdtImageEffacer(v) {
  if (!/^r:/.test(v || '')) return;
  if (pdtList().some(d => (d.lignes || []).some(l => l.img === v))) return;
  storeFetch('/photo/ref/' + encodeURIComponent(v.slice(2)), { method: 'DELETE' }).catch(e => console.error(e));
}

// ── Le document (aperçu et PDF) ──────────────────────────────────────────────
function pdtLumiere(l) {
  if (l.lumCouleur === 'aucune') return null;
  if (l.lumCouleur && PDT_LUMIERES[l.lumCouleur]) return PDT_LUMIERES[l.lumCouleur];
  const t = pjNorm(l.lumiere);
  if (!t) return null;
  if (/nuit|night|soir|lune|moon/.test(t)) return PDT_LUMIERES.nuit;
  if (/jour|day|soleil|sun|lever|coucher|aube|golden/.test(t)) return PDT_LUMIERES.jour;
  return null;
}

const pdtTbc = v => { const t = String(v || '').trim(); return !t || /^tbc$/i.test(t) ? '<span class="tbc">TBC</span>' : esc(t); };
const pdtLignes = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

function pdtDateTexte(iso) {
  return iso ? tsD(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase() : '[DATE À COMPLÉTER]';
}

function pdtDocHtml(d, ecran) {
  const M = pdtMots(d);
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const h = pdtHoraires(d);
  const lignes = d.lignes || [];
  const premier = lignes.find(l => l.type !== 'partie' && h[l.id] && h[l.id].du != null);
  // READY TO SHOOT et WRAP vides : l'heure du premier plan et celle de la fin
  const auto = lab => /ready/i.test(lab) && premier ? pdtHh(h[premier.id].du) : /wrap/i.test(lab) && h.fin != null ? pdtHh(h.fin) : '';
  const horaires = (d.horaires || []).filter(x => x.label || x.heure);
  const cast = (d.cast || []).filter(x => x.nom || x.role);
  const nHaut = Math.max(horaires.length, cast.length + 1);
  const haut = [];
  for (let i = 0; i < nHaut; i++) {
    const x = horaires[i];
    const c = i === 0 ? null : cast[i - 1];
    haut.push(`<tr>
      <td class="hh">${x ? pdtTbc(x.heure || auto(x.label)) : ''}</td><td class="lab">${x ? esc(String(x.label || '').toUpperCase()) : ''}</td>
      ${i === 0 ? '<th>CAST</th><th>ROLE</th><th>CALL</th><th>PAT</th>'
        : c ? `<td class="c">${pdtTbc(c.nom)}</td><td class="c b">${esc(String(c.role || '').toUpperCase())}</td><td class="c">${pdtTbc(c.call)}</td><td class="c">${pdtTbc(c.pat)}</td>`
          : '<td></td><td></td><td></td><td></td>'}
    </tr>`);
  }

  const entete = `<tr class="th">
    <th>HORAIRES</th><th>DURATION</th><th>${M.num}</th><th>REFERENCE</th><th>${M.sceneCol}</th><th>${M.techniqueCol}</th><th>${M.optiqueCol}</th><th>LIGHTING<br>EFFECT</th><th>NOTES /<br>À PRÉVOIR</th>
  </tr>`;
  const corps = lignes.map(l => {
    const x = h[l.id] || {};
    if (l.type === 'partie') {
      const t = String(l.titre || '').toUpperCase();
      if (l.hors) return `<tr class="saut"><td colspan="9"></td></tr><tr class="noir"><td colspan="9"></td></tr><tr class="barre"><td colspan="9">${esc(/^HORS PLATEAU/.test(t) ? t : 'HORS PLATEAU' + (t ? ' — ' + t : ''))}</td></tr>`;
      return `<tr class="barre"><td colspan="9">${esc(/^PARTIE/.test(t) ? t : `PARTIE ${x.num}${t ? ' — ' + t : ''}`)}</td></tr>`;
    }
    if (l.type === 'pause') {
      const nom = String(l.nom || 'PAUSE').toUpperCase();
      return `<tr class="barre"><td colspan="9">${esc([nom, pdtPlage(x)].filter(Boolean).join(' ') + (l.texte ? ' — ' + String(l.texte).toUpperCase() : ''))}</td></tr>`;
    }
    const duree = x.hors || !x.duree ? '-' : `${x.duree} mins`;
    if (l.type === 'install') return `<tr class="install"><td class="hh">${esc(pdtPlage(x))}</td><td>${duree}</td><td class="c">-</td><td colspan="6" class="it">${esc(String(l.texte || '').toUpperCase())}</td></tr>`;
    const lum = pdtLumiere(l);
    const [lum1, ...lumS] = pdtLignes(l.lumiere);
    const opt = pdtLignes(l.optique);
    return `<tr class="plan${l.img ? ' avec-img' : ''}">
      <td class="hh">${esc(pdtPlage(x))}</td><td>${duree}</td><td class="shot">${esc(l.shot || '-')}</td>
      <td class="ref">${l.img ? `<img src="${esc(pdtImgSrc(l.img))}" alt="">` : ''}</td>
      <td class="txt">${esc(l.scene || '').replace(/\n/g, '<br>')}</td>
      <td class="txt">${esc(l.technique || '').replace(/\n/g, '<br>')}</td>
      <td class="opt">${opt.map((o, i) => i ? `<small>${esc(o.toUpperCase())}</small>` : esc(o.toUpperCase())).join('')}</td>
      <td class="lum"${lum ? ` style="background:${lum[0]};color:${lum[1]}"` : ''}>${lum1 ? esc(lum1.toUpperCase()) : ''}${lumS.map(s => `<small>${esc(s.toUpperCase())}</small>`).join('')}</td>
      <td class="note${l.noteNoire ? '' : ' rouge'}">${esc(l.note || '').replace(/\n/g, '<br>')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PDT ${esc([d.titre || d.client, 'J' + (d.jour || 1)].filter(Boolean).join(' ').replace(/[“”"]/g, ''))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400;0,700;1,400&display=swap">
<style>
  @page { size: A4 portrait; margin: 9mm 8mm; }
  body { margin: 0; background: ${ecran ? '#fff' : '#e9e9e7'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdt-doc, .pdt-doc * { box-sizing: border-box; }
  .pdt-doc { font-family: 'Karla', Arial, sans-serif; color: #111; width: 210mm; min-height: 297mm; margin: ${ecran ? '0' : '10mm'} auto; background: #fff; padding: 9mm 8mm; font-size: 8px; line-height: 1.25; }
  .pdt-doc .tete { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; margin-bottom: 5mm; }
  .pdt-doc .tete .widen { height: 15px; display: block; }
  .pdt-doc .tete .mil { text-align: center; }
  .pdt-doc .tete .mil h1 { font-size: 15px; font-weight: 700; margin: 0 0 9px; letter-spacing: .02em; }
  .pdt-doc .tete .mil .t { font-size: 10px; font-weight: 700; margin-bottom: 14px; }
  .pdt-doc .tete .mil .d { font-size: 8px; font-weight: 700; }
  .pdt-doc .tete .cl { justify-self: end; text-align: right; font-weight: 700; font-size: 17px; letter-spacing: .03em; }
  .pdt-doc .tete .cl img { max-width: 36mm; max-height: 14mm; display: block; }
  .pdt-doc table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .pdt-doc table.plan-t { margin-top: -1px; }
  .pdt-doc td, .pdt-doc th { border: .6pt solid #111; padding: 2px 3px; vertical-align: middle; text-align: center; }
  .pdt-doc th { font-weight: 700; }
  .pdt-doc .haut td, .pdt-doc .haut th { height: 15px; }
  .pdt-doc .haut .lab { text-align: left; font-weight: 400; }
  .pdt-doc .hh { font-weight: 700; white-space: nowrap; }
  .pdt-doc .b { font-weight: 700; }
  .pdt-doc .tbc { color: #c00000; font-weight: 700; }
  .pdt-doc tr.noir td { background: #111; height: 9px; padding: 0; }
  .pdt-doc tr.saut td { border-left: none; border-right: none; height: 14px; }
  .pdt-doc tr.prepa td { background: #d9d9d9; font-weight: 700; height: 15px; }
  .pdt-doc tr.th th { height: 30px; font-size: 7.5px; line-height: 1.15; }
  .pdt-doc tr.barre td { background: #d9d9d9; font-weight: 700; height: 14px; }
  .pdt-doc tr.install td { background: #f2f2f2; height: 14px; }
  .pdt-doc tr.install td.hh { background: #d9d9d9; }
  .pdt-doc tr.install td.it { font-style: italic; font-size: 7px; }
  .pdt-doc tr.plan td { height: 15mm; }
  .pdt-doc tr.plan.avec-img td { height: 25mm; }
  .pdt-doc tr.plan, .pdt-doc tr.install, .pdt-doc tr.barre { break-inside: avoid; page-break-inside: avoid; }
  .pdt-doc td.shot { font-weight: 700; font-size: 10px; }
  .pdt-doc td.ref { padding: 0; }
  .pdt-doc td.ref img { width: 100%; height: 25mm; object-fit: cover; display: block; }
  .pdt-doc td.txt { font-size: 7px; }
  .pdt-doc td.opt, .pdt-doc td.lum { font-size: 8px; }
  .pdt-doc td small { display: block; font-size: 5.5px; margin-top: 3px; }
  .pdt-doc td.note { font-size: 7px; }
  .pdt-doc td.note.rouge { color: #e00000; }
  .pdt-doc thead { display: table-header-group; }
  .pdt-doc .pied { margin: 6px 0 0; font-size: 7px; font-style: italic; }
  @media screen and (max-width: 760px) { .pdt-doc { zoom: .46; margin: 8px auto; } }
  @media print { body { background: #fff; } .barre-impr { display: none; } .pdt-doc { width: auto; min-height: 0; margin: 0; padding: 0; } }
</style></head><body>
${ecran ? '' : '<div class="barre barre-impr" style="position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:center;padding:12px;background:#111;color:#fff;font:14px Arial">Vérifie le plan de travail puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>'}
<div class="pdt-doc">
  <div class="tete">
    <img class="widen" src="${base}widen-logo.png" alt="WIDEN">
    <div class="mil">
      <h1>SHOOTING SCHEDULE</h1>
      <div class="t">${esc(String(d.titre || '').toUpperCase())}</div>
      <div class="d">${esc(pdtDateTexte(d.date))}${d.lieu ? ' · ' + esc(String(d.lieu).toUpperCase()) : ''}</div>
      <div class="d">${pdtType(d) === 'photo' ? 'PHOTO · ' : ''}SHOOT DAY ${Number(d.jour) || 1} / ${Math.max(Number(d.jours) || 1, Number(d.jour) || 1)}</div>
    </div>
    <div class="cl">${d.logo ? `<img src="${esc(d.logo)}" alt="${esc(d.client)}">` : esc(String(d.client || '').toUpperCase())}</div>
  </div>
  <table class="haut">
    <colgroup><col style="width:10%"><col style="width:30%"><col style="width:21%"><col style="width:17%"><col style="width:9%"><col style="width:13%"></colgroup>
    ${haut.join('')}
    <tr class="noir"><td colspan="6"></td></tr>
    <tr class="prepa"><td>${pdtTbc(d.prepaHeure || (d.debut ? 'TBC-' + d.debut : ''))}</td><td colspan="5">${esc(String(d.prepaTexte || '').toUpperCase())}</td></tr>
  </table>
  <table class="plan-t">
    <colgroup><col style="width:10%"><col style="width:7%"><col style="width:5.5%"><col style="width:17.5%"><col style="width:18%"><col style="width:13%"><col style="width:8%"><col style="width:10%"><col style="width:11%"></colgroup>
    <thead>${entete}</thead>
    <tbody>${corps}</tbody>
  </table>
  ${d.piedPage ? `<p class="pied">${esc(d.piedPage)}</p>` : ''}
</div>
</body></html>`;
}

function pdtMajApercu() {
  const f = document.getElementById('pdt-apercu');
  const d = pdtCur();
  if (f && d) f.srcdoc = pdtDocHtml(d, true);
}

async function pdtPdf() {
  const d = pdtCur();
  if (!d) return;
  clearTimeout(pdtSaveTimer); pdtSaveTimer = null; saveDb();
  ouvrirDocument(pdtDocHtml(d, false));
  await imprimerDocument();
}
