// ── PLANS DE TRAVAIL (PDT) ───────────────────────────────────────────────────
// Le plan de travail d'une journée de tournage (shooting schedule), rempli dans
// un formulaire et exporté en PDF. Chaque PDT appartient à un projet du suivi
// production (projets.js) : client, titre, date du tournage, lieu et cast sont
// repris du projet. Les horaires se calculent tout seuls à partir de l'heure du
// premier plan et de la durée de chaque ligne. Gardé sous db.prod.pdts.

let pdtId = null;             // PDT ouvert

const PDT_HORAIRES_DEFAUT = ['PAT', 'REPAS', 'WRAP'];
// Tableau de l'équipe en haut à gauche : colonnes de base (on peut en ajouter, retirer, déplacer)
const PDT_EQ_COLS = ['nom', 'role', 'call', 'pat'];
const PDT_EQ_TITRES = { nom: ['cast', 'TEAM'], role: ['role', 'ROLE'], call: ['call', 'CALL'], pat: ['pat', 'PAT'] };
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
  await pdtAjouterDonnees(x, p, true);
}

// Ajoute un PDT tout prêt (fichier importé ou modèle) au projet p, et envoie ses images au serveur
async function pdtAjouterDonnees(x, p, ouvrir) {
  const d = JSON.parse(JSON.stringify(x));
  Object.assign(d, { id: uid(), projetId: p.id, maj: Date.now(), type: d.type === 'photo' ? 'photo' : 'video' });
  d.lignes = d.lignes.filter(l => l && PDT_TYPES_NOM[l.type]).map(l => ({ ...l, id: pdtLid() }));
  ['horaires', 'cast'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.client) d.client = String(p.client || '').trim();
  if (!d.logo) d.logo = prodData().logos[tsCleClient(d.client)] || '';
  pdtList().push(d);
  saveDb();
  if (ouvrir) pdtOuvrir(d.id);
  else if (!document.querySelector('.pdt-editor, .ts-editor') && !(typeof pjEnEdition === 'function' && pjEnEdition())) render();
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

// PDT déjà préparés, ajoutés une seule fois au projet qui leur correspond dès que la base est chargée
// (on peut ensuite les modifier ou les supprimer : ils ne reviennent pas)
const PDT_MODELES = [{
  cle: 'simond-avantgarde-3', nom: 'PDT SIMOND « AVANTGARDE »', fichier: 'modeles/pdt-simond-avantgarde.json',
  projet: /simond/i, deja: /avant.?garde/i,
  present: d => (d.lignes || []).some(l => l.shot === '5bis') // une ligne qui n'existe que dans ce PDT
}];
const pdtModelesDu = p => PDT_MODELES.filter(m => m.projet.test(`${p.client || ''} ${p.nom || ''}`));
const pdtModelePresent = (m, p) => pdtDuProjet(p.id).some(m.present);

// Bouton « + PDT SIMOND… » : ajoute le modèle au projet et l'ouvre
async function pdtAjouterModele(cle, pid, ouvrir = true) {
  const m = PDT_MODELES.find(x => x.cle === cle), p = pjById(pid);
  if (!m || !p) return;
  try {
    const r = await fetch(m.fichier, { cache: 'no-store' });
    const o = await r.json();
    await pdtAjouterDonnees(o.pdt || o, p, ouvrir);
  } catch (e) {
    console.error(e);
    if (ouvrir) alert('Le PDT prérempli n\'a pas pu être chargé. Réessaie dans un instant.');
    throw e;
  }
}

let pdtSemis = false;
async function pdtSemer() {
  if (pdtSemis) return;
  pdtSemis = true;
  const faits = prodData().pdtModeles || (prodData().pdtModeles = []);
  for (const m of PDT_MODELES) {
    if (faits.includes(m.cle)) continue;
    const projets = (db.projets || []).filter(p => pdtModelesDu(p).includes(m));
    const p = projets.find(x => m.deja.test(x.nom || '')) || projets[0];
    if (!p) continue;
    faits.push(m.cle);
    if (pdtModelePresent(m, p)) { saveDb(); continue; }
    try { await pdtAjouterModele(m.cle, p.id, false); }
    catch (e) { faits.splice(faits.indexOf(m.cle), 1); pdtSemis = false; }
  }
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
        <span class="pj-nom"><span class="ch-dot" style="background:${PJ_PISTES.find(x => x[0] === pdtType(d))[2]}"></span>PDT ${pdtType(d) === 'photo' ? 'PHOTO' : 'VIDÉO'} · JOUR ${d.jour || 1} / ${d.jours || 1}${d.titre ? ' · ' + esc(d.titre) : ''}</span>
        <span class="pj-muted">${n} ${pdtType(d) === 'photo' ? 'photo' : 'plan'}${n > 1 ? 's' : ''}${d.lieu ? ' · ' + esc(d.lieu) : ''}</span>
        <span class="pj-muted">${d.date ? esc(tsDateCourte(d.date)) : 'date à compléter'}</span>
      </div>`;
    }).join('')}</div>` : '<p class="field-hint">Aucun plan de travail pour ce projet. Le PDT reprend les dates de tournage, le lieu et le cast du projet.</p>'}
    <div class="ts-add-row">
      <button type="button" class="btn-upload" onclick="pdtNouveau(${p.id}, 'video')">+ PDT VIDÉO</button>
      <button type="button" class="btn-upload" onclick="pdtNouveau(${p.id}, 'photo')">+ PDT PHOTO</button>
      ${pdtModelesDu(p).filter(m => !pdtModelePresent(m, p)).map(m => `<button type="button" class="btn-upload" onclick="pdtAjouterModele('${m.cle}', ${p.id})">+ ${esc(m.nom)} (PRÉREMPLI)</button>`).join('')}
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
    const duree = pdtDuree(l.duree);
    const du = t;
    if (t != null) t += duree;
    res[l.id] = { du, au: du != null ? du + duree : null, duree };
  });
  res.fin = t;
  return res;
}
// Une durée écrite comme on veut : 15, 15 min, 1h, 1h30, 1:30, 1,5h, 2 h 15 → en minutes
function pdtDuree(v) {
  const t = String(v == null ? '' : v).toLowerCase().replace(',', '.').replace(/\s+/g, '');
  if (!t) return 0;
  let m = /^(\d+(?:\.\d+)?)(?:h|:)(\d{1,2})?(?:m(?:in(?:s|utes?)?)?)?$/.exec(t);
  if (m) return Math.round(Number(m[1]) * 60 + Number(m[2] || 0));
  m = /^(\d+(?:\.\d+)?)(?:h(?:eures?|rs?)?)$/.exec(t);
  if (m) return Math.round(Number(m[1]) * 60);
  m = /(\d+(?:\.\d+)?)/.exec(t);
  return m ? Math.max(0, Math.round(Number(m[1]))) : 0;
}
// Le texte d'une durée : comme elle a été écrite en heures (1H30), sinon « 45 mins »
function pdtDureeTexte(v, court) {
  const min = pdtDuree(v);
  if (!min && !String(v == null ? '' : v).trim()) return '';
  if (/[h:]/i.test(String(v))) return `${Math.floor(min / 60)}H${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  return `${min} ${court ? 'min' : 'mins'}`;
}
const pdtPlage = h => h && h.du != null ? (h.au !== h.du ? `${pdtHh(h.du)}-${pdtHh(h.au)}` : pdtHh(h.du)) : '';

// ── Éditeur ──────────────────────────────────────────────────────────────────
let pdtSaveTimer = null, pdtApercuTimer = null;

function pdtReprendre(d) {
  const list = pdtList();
  const i = list.findIndex(x => x.id === d.id);
  if (i >= 0) list[i] = d; else list.push(d);
}

// ── Annuler / rétablir (Cmd/Ctrl + Z, Cmd/Ctrl + Maj + Z) ─────────────────────
// On garde des copies du PDT ouvert ; les frappes rapprochées (moins de 0,7 s) ne font qu'une étape.
// Copie sans JSON : les longs textes (images en data:) sont partagés, pas dupliqués.
const pdtClone = v => Array.isArray(v) ? v.map(pdtClone)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pdtClone(x)])) : v;
let pdtHist = { id: null, avant: [], apres: [], etat: null, timer: null };
let pdtSansHist = false;
function pdtHistPret() {
  const d = pdtCur();
  if (d && pdtHist.id !== d.id) {
    clearTimeout(pdtHist.timer);
    pdtHist = { id: d.id, avant: [], apres: [], etat: pdtClone(d), timer: null };
  }
  return d;
}
function pdtHistNote() {
  if (!pdtHistPret()) return;
  if (!pdtHist.timer) {
    pdtHist.avant.push(pdtHist.etat);
    if (pdtHist.avant.length > 80) pdtHist.avant.shift();
    pdtHist.apres = [];
  }
  clearTimeout(pdtHist.timer);
  pdtHist.timer = setTimeout(() => { pdtHist.timer = null; const d = pdtCur(); if (d && d.id === pdtHist.id) pdtHist.etat = pdtClone(d); }, 700);
  pdtMajBoutonsHist();
}
function pdtAnnuler(sens) {   // -1 : annuler, 1 : rétablir
  const d = pdtHistPret();
  if (!d) return;
  clearTimeout(pdtHist.timer); pdtHist.timer = null;
  const de = sens < 0 ? pdtHist.avant : pdtHist.apres, vers = sens < 0 ? pdtHist.apres : pdtHist.avant;
  if (!de.length) return;
  vers.push(pdtClone(d));
  const s = de.pop();
  Object.keys(d).forEach(k => delete d[k]);
  Object.assign(d, pdtClone(s));
  pdtHist.etat = pdtClone(d);
  pdtSansHist = true;
  pdtChange();
  pdtSansHist = false;
  pdtRedessiner();
}
function pdtMajBoutonsHist() {
  const a = document.querySelector('.pdt-ed-outils .annuler'), r = document.querySelector('.pdt-ed-outils .retablir');
  if (a) a.disabled = !pdtHist.avant.length;
  if (r) r.disabled = !pdtHist.apres.length;
}
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || !document.querySelector('.pdt-editor')) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  e.preventDefault();
  pdtAnnuler(k === 'y' || e.shiftKey ? 1 : -1);
}, true);

function pdtChange() {
  const d = pdtCur();
  if (!d) return;
  if (!pdtSansHist) pdtHistNote();
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
    row[k] = k === 'duree' && /^\d+$/.test(String(v).trim()) ? Number(v) : v;
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

// Deux façons de remplir un PDT : directement sur le document (par défaut sur
// ordinateur) ou avec le formulaire (pratique sur téléphone). Choix gardé sur l'appareil.
let pdtMode = (() => { try { return localStorage.getItem('pdtMode') || ''; } catch { return ''; } })() || (window.innerWidth < 760 ? 'form' : 'doc');
function pdtSetMode(m) {
  pdtMode = m === 'form' ? 'form' : 'doc';
  try { localStorage.setItem('pdtMode', pdtMode); } catch {}
  pdtRedessiner();
}

function renderPdtEditor(main) {
  pdtHistPret();
  if (pdtMode !== 'form') { renderPdtDoc(main); return; }
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
        <button type="button" class="btn-cancel" onclick="pdtSetMode('doc')">MODIFIER SUR LE DOCUMENT</button>
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

// ── Éditeur sur le document ──────────────────────────────────────────────────
function renderPdtDoc(main) {
  const d = pdtCur();
  const p = pjById(d.projetId);
  const scroll = window.scrollY;
  const equipe = p ? (p.equipe || []).filter(a => pjNomPersonne(a)) : [];
  main.innerHTML = `<div class="pdt-editor pdt-ed-page">
    <div class="pdt-ed-barre">
      <div class="field"><label>TYPE</label><select data-k="type" onchange="pdtInput(this); pdtRedessiner()">${PDT_TYPES.map(([v, lab]) => `<option value="${v}"${pdtType(d) === v ? ' selected' : ''}>${lab}</option>`).join('')}</select></div>
      <div class="field"><label>1ER PLAN À</label><input type="time" data-k="debut" value="${esc(d.debut || '')}" oninput="pdtInput(this); pdtMajHeuresDoc()" onchange="pdtRedessiner()"></div>
      ${equipe.length ? `<div class="field"><label>CAST</label><select onchange="pdtCastEquipe(this.value)"><option value="">Ajouter de l'équipe…</option>${equipe.map(a => `<option value="${a.id}">${esc(pjNomPersonne(a) + (a.role ? ' · ' + a.role : ''))}</option>`).join('')}</select></div>` : ''}
      <div class="field ts-logo" id="pdt-logo-zone">${pdtLogoZoneHtml(d)}</div>
      <div class="spacer"></div>
      <div class="pdt-ed-actions">
        <button type="button" class="btn-del" onclick="pdtSupprimer()">✕ SUPPRIMER</button>
        <button type="button" class="btn-cancel" onclick="pdtSetMode('form')">FORMULAIRE</button>
        <button type="button" class="btn-cancel" onclick="pdtDupliquer()">DUPLIQUER</button>
        <button type="button" class="btn-save" onclick="pdtPdf()">CRÉER LE PDF</button>
      </div>
    </div>
    <p class="field-hint pdt-ed-aide">Clique dans une case pour écrire. Tous les textes se modifient, même les titres. Sélectionne du texte puis utilise la barre au-dessus (gras, italique, souligné, couleur). Passe sur un titre de colonne pour en ajouter une (+), la déplacer (◂ ▸) ou la retirer (✕) ; tire son bord pour changer sa largeur. Passe sur une ligne pour ses outils dans la marge : ⠿ à glisser pour la déplacer, + ajouter dessous, ⧉ dupliquer, ✕ supprimer. Les horaires se calculent avec les durées (15, 1h, 1h30…) ; écris une heure dans la case HORAIRES d'une ligne pour la fixer. Clique sur une image (ou colle-la) pour la changer.</p>
    <div class="pdt-ed-outils" onmousedown="if (event.target.closest('button')) event.preventDefault()">
      <button type="button" class="annuler" title="Annuler (Cmd/Ctrl + Z)" onclick="pdtAnnuler(-1)"${pdtHist.avant.length ? '' : ' disabled'}>↶</button>
      <button type="button" class="retablir" title="Rétablir (Cmd/Ctrl + Maj + Z)" onclick="pdtAnnuler(1)"${pdtHist.apres.length ? '' : ' disabled'}>↷</button>
      <span class="sep"></span>
      <button type="button" class="b" title="Gras (Cmd/Ctrl + B)" onclick="pdtFormat('bold')">B</button>
      <button type="button" class="i" title="Italique (Cmd/Ctrl + I)" onclick="pdtFormat('italic')">I</button>
      <button type="button" class="u" title="Souligné (Cmd/Ctrl + U)" onclick="pdtFormat('underline')">U</button>
      <span class="sep"></span>
      ${[['#111111', 'Noir'], ['#e00000', 'Rouge'], ['#2f5597', 'Bleu'], ['#2e7d32', 'Vert'], ['#e67e00', 'Orange'], ['#888888', 'Gris']].map(([c, n]) => `<button type="button" class="pastille" style="--c:${c}" title="Texte en ${n.toLowerCase()}" onclick="pdtFormat('foreColor', '${c}')"></button>`).join('')}
      <button type="button" title="Enlever la mise en forme" onclick="pdtFormat('removeFormat')">⌀</button>
      <span class="sep"></span>
      <select title="Couleur de la case lumière de la ligne où tu as cliqué" onchange="pdtFondLumiere(this.value); this.value='-'"><option value="-">FOND LUMIÈRE…</option>${PDT_LUMIERES_CHOIX.map(([v, lab]) => `<option value="${v}">${v ? lab : 'Auto (jour / nuit)'}</option>`).join('')}</select>
      <span class="sep"></span>
      <button type="button" class="${d.paysage ? '' : 'on'}" title="Page en hauteur" onclick="pdtPaysage(false)">▯ PORTRAIT</button>
      <button type="button" class="${d.paysage ? 'on' : ''}" title="Page en largeur : plus de place pour les colonnes et les images" onclick="pdtPaysage(true)">▭ PAYSAGE</button>
    </div>
    <div class="pdt-ed-zone">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400;0,700;1,400&display=swap">
      <style>${pdtDocCss(true, true, d.paysage)}</style>
      ${pdtDocCorps(d, true)}
    </div>
    <div class="pdt-zoom" title="Zoom sur le document (ou Ctrl + molette, ou pincer le pavé tactile)">
      <button type="button" onclick="pdtZoomer(pdtZoom / 1.2)" title="Dézoomer">−</button>
      <button type="button" class="pdt-zoom-val" onclick="pdtZoomer(1)" title="Revenir à 100 %">${Math.round(pdtZoom * 100)} %</button>
      <button type="button" onclick="pdtZoomer(pdtZoom * 1.2)" title="Zoomer">+</button>
    </div>
  </div>`;
  pdtZoomer(pdtZoom);
  window.scrollTo(0, scroll);
  const zone = main.querySelector('.pdt-ed-zone');
  // Zoom au Ctrl + molette (et pincer sur le pavé tactile), centré sous la souris
  zone.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    pdtZoomer(pdtZoom * Math.exp(-e.deltaY / 500), e);
  }, { passive: false });
  // Safari : pincer
  let pz0 = null;
  zone.addEventListener('gesturestart', e => { e.preventDefault(); pz0 = pdtZoom; });
  zone.addEventListener('gesturechange', e => { e.preventDefault(); if (pz0) pdtZoomer(pz0 * e.scale, e); });
  zone.addEventListener('gestureend', () => { pz0 = null; });
  zone.addEventListener('input', pdtEdInput);
  zone.addEventListener('focusout', pdtEdSortie);
  zone.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.ed');
    if (el && e.key === 'Enter' && !el.dataset.multi) { e.preventDefault(); el.blur(); }
  });
  zone.addEventListener('click', e => {
    const r = e.target.closest('[data-img]');
    if (!r) return;
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'image/*';
    f.onchange = () => pdtImageFichier(f.files[0], r.dataset.img);
    f.click();
  });
  zone.addEventListener('paste', e => {
    const r = e.target.closest('[data-img]');
    if (r) return pdtImageColle(e, r.dataset.img);
    // Dans une case : on colle le texte seul, sans la mise en forme d'ailleurs
    if (e.target.closest('.ed')) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); }
  });
  zone.addEventListener('focusin', e => { const tr = e.target.closest('tr[data-li]'); if (tr) pdtLigneActive = (pdtCur().lignes[Number(tr.dataset.li)] || {}).id || null; });
  // Glisser une ligne par sa poignée ⠿ pour la déplacer ; tirer le bord d'une colonne pour la régler
  zone.addEventListener('mousedown', e => {
    const r = e.target.closest('.pdt-redim');
    if (r) return pdtRedimDebut(e, r);
    const rl = e.target.closest('.pdt-redim-l');
    if (rl) return pdtHautDebut(e, rl);
    const p = e.target.closest('.pdt-poignee');
    if (p) p.closest('tr').draggable = true;
  });
  zone.addEventListener('mouseup', () => zone.querySelectorAll('tr[draggable="true"]').forEach(tr => { if (pdtGlisse == null) tr.draggable = false; }));
  zone.addEventListener('dragstart', e => {
    const tr = e.target.closest && e.target.closest('tr[data-li]');
    if (!tr || !tr.draggable) return;
    pdtGlisse = Number(tr.dataset.li);
    pdtGlisseVers = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    tr.classList.add('pdt-glisse');
  });
  zone.addEventListener('dragend', () => {
    // Certains navigateurs (Safari…) ne déclenchent pas toujours le lâcher : on pose la ligne
    // là où le trait bleu était affiché
    if (pdtGlisse != null && pdtGlisseVers != null) {
      const de = pdtGlisse, vers = pdtGlisseVers;
      pdtGlisse = pdtGlisseVers = null;
      return pdtDeplacerVers(de, vers);
    }
    pdtGlisse = pdtGlisseVers = null;
    zone.querySelectorAll('tr[data-li]').forEach(tr => { tr.draggable = false; tr.classList.remove('pdt-glisse', 'pdt-vise-haut', 'pdt-vise-bas'); });
  });
  zone.addEventListener('dragover', e => {
    if (pdtGlisse == null) { if (e.target.closest('[data-img]')) e.preventDefault(); return; }
    e.preventDefault();
    const tr = pdtGlisseCible(zone, e);
    if (!tr) return;
    e.dataTransfer.dropEffect = 'move';
    const bas = pdtGlisseDessous(tr, e);
    pdtGlisseVers = Number(tr.dataset.li) + (bas ? 1 : 0);
    zone.querySelectorAll('.pdt-vise-haut, .pdt-vise-bas').forEach(x => x.classList.remove('pdt-vise-haut', 'pdt-vise-bas'));
    tr.classList.add(bas ? 'pdt-vise-bas' : 'pdt-vise-haut');
  });
  zone.addEventListener('drop', e => {
    if (pdtGlisse != null) {
      e.preventDefault();
      const tr = pdtGlisseCible(zone, e);
      if (!tr) { pdtGlisse = pdtGlisseVers = null; return pdtRedessiner(); }
      const bas = pdtGlisseDessous(tr, e);
      const de = pdtGlisse;
      pdtGlisse = pdtGlisseVers = null;
      pdtDeplacerVers(de, Number(tr.dataset.li) + (bas ? 1 : 0));
      return;
    }
    const r = e.target.closest('[data-img]');
    if (r) pdtImageDepose(e, r.dataset.img);
  });
}

// Une case du document modifiée
function pdtEdInput(e) {
  const t = e.target.closest && e.target.closest('[data-t]');
  if (t) {
    const d = pdtCur();
    if (!d) return;
    d.textes = d.textes || {};
    d.textes[t.dataset.t] = t.innerText.replace(/\n$/, '');
    pdtGarderHtml(d, 'textesHtml', t.dataset.t, t);
    pdtChange();
    return;
  }
  const el = e.target.closest && e.target.closest('[data-k]');
  if (!el || (el.dataset.k === 'heure' && el.dataset.l === 'lignes')) return;
  let v = el.tagName === 'INPUT' ? el.value : el.innerText.replace(/\n$/, '');
  if (!el.dataset.multi) v = v.replace(/\n/g, ' ');
  pdtInput({ value: v, type: '', dataset: el.dataset });
  if (el.tagName !== 'INPUT') pdtGarderHtml(pdtSource(pdtCur(), el.dataset.l, el.dataset.i), 'html', el.dataset.k, el);
  if (el.dataset.k === 'duree') pdtMajHeuresDoc();
  if (el.dataset.k === 'lumiere') {
    const l = pdtLigne(el.dataset.i), td = el.closest('td'), c = l && pdtLumiere(l);
    if (td) { td.style.background = c ? c[0] : ''; td.style.color = c ? c[1] : ''; }
  }
}

// ── Mise en forme (gras, italique, souligné, couleur) ───────────────────────
// Le texte reste dans son champ habituel ; sa version mise en forme est gardée à côté
// (objet.html[champ]) et n'est utilisée que tant qu'elle correspond au texte.
function pdtSource(d, l, i) {
  if (!d) return null;
  if (!l) return d;
  if (l === 'lignes') return (d.lignes || []).find(x => String(x.id) === String(i));
  return (d[l] || [])[Number(i)];
}
function pdtHtmlTexte(h) {
  return String(h).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
const pdtNorm = t => String(t == null ? '' : t).replace(/\u00a0/g, ' ').replace(/\s+$/, '');
function pdtHtmlValide(h, v) {
  return h && pdtNorm(pdtHtmlTexte(h)) === pdtNorm(v) ? h : '';
}
// Ne garde que gras, italique, souligné, couleur et retours à la ligne
function pdtNettoie(html, multi) {
  const t = document.createElement('template');
  t.innerHTML = html;
  const sortie = n => [...n.childNodes].map(c => {
    if (c.nodeType === 3) return esc(c.textContent);
    if (c.nodeType !== 1) return '';
    const tag = c.tagName.toLowerCase(), st = c.style || {};
    if (tag === 'br') return '<br>';
    let r = sortie(c);
    if (tag === 'div' || tag === 'p') return '<br>' + r;
    const col = (tag === 'font' && c.getAttribute('color')) || st.color;
    if (col && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(col)) r = `<span style="color:${col}">${r}</span>`;
    if (tag === 'u' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) r = `<u>${r}</u>`;
    if (tag === 'i' || tag === 'em' || st.fontStyle === 'italic') r = `<i>${r}</i>`;
    if (tag === 'b' || tag === 'strong' || /bold|[6-9]00/.test(st.fontWeight || '')) r = `<b>${r}</b>`;
    // Gras retiré dans une case grasse par défaut (n°, titres, barres) : on le garde aussi
    else if (/normal|[1-5]00/.test(st.fontWeight || '')) r = `<span style="font-weight:400">${r}</span>`;
    return r;
  }).join('');
  let h = sortie(t.content).replace(/^<br>/, '').replace(/(<br>)+$/, '');
  if (!multi) h = h.replace(/<br>/g, ' ');
  return h;
}
function pdtGarderHtml(src, cle, k, el) {
  if (!src || !k) return;
  const h = pdtNettoie(el.innerHTML, !!el.dataset.multi);
  if (/<(b|i|u|span)\b/.test(h)) (src[cle] = src[cle] || {})[k] = h;
  else if (src[cle]) delete src[cle][k];
}
function pdtFormat(cmd, val) {
  const el = document.activeElement;
  if (!el || !el.closest || !el.closest('.pdt-doc-ed .ed')) return;
  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
  document.execCommand(cmd, false, val);
  pdtEtatFormat();
}
// Les boutons B / I / U restent allumés quand le texte sélectionné est en gras, italique, souligné
function pdtEtatFormat() {
  const barre = document.querySelector('.pdt-ed-outils');
  if (!barre) return;
  const el = document.activeElement, dedans = !!(el && el.closest && el.closest('.pdt-doc-ed .ed'));
  [['b', 'bold'], ['i', 'italic'], ['u', 'underline']].forEach(([c, cmd]) => {
    const btn = barre.querySelector('button.' + c);
    let on = false;
    try { on = dedans && document.queryCommandState(cmd); } catch (e) {}
    if (btn) btn.classList.toggle('on', on);
  });
}
document.addEventListener('selectionchange', pdtEtatFormat);
// Dernière ligne où l'on a cliqué : pour la couleur de la case lumière
let pdtLigneActive = null;
function pdtFondLumiere(v) {
  const l = pdtLigneActive && pdtLigne(pdtLigneActive);
  if (!l || l.type !== 'plan') { alert('Clique d\'abord dans une ligne de plan.'); return; }
  pdtLigneRegler(l.id, 'lumCouleur', v);
}
function pdtPaysage(v) {
  const d = pdtCur();
  if (!d) return;
  if (v) d.paysage = true; else delete d.paysage;
  pdtChange();
  pdtRedessiner();
}

// Case HORAIRES d'une ligne quittée : l'heure écrite devient son début fixe (vide : à la suite)
function pdtEdSortie(e) {
  const el = e.target.closest && e.target.closest('[data-k="heure"][data-l="lignes"]');
  const d = pdtCur(), l = el && pdtLigne(el.dataset.i);
  if (!l) return;
  const m = /(\d{1,2})[:h.](\d{2})/.exec(el.innerText);
  const avant = l.heure;
  if (!m) delete l.heure;
  else {
    const hh = String(m[1]).padStart(2, '0') + ':' + m[2];
    delete l.heure;
    const calc = pdtHoraires(d)[l.id];
    if (avant || !calc || hh !== pdtHh(calc.du)) l.heure = hh;
  }
  pdtChange();
  pdtMajHeuresDoc(true);
}

// Les horaires calculés affichés dans le document, sans le redessiner
function pdtMajHeuresDoc(tout) {
  const d = pdtCur();
  if (!d) return;
  const h = pdtHoraires(d);
  document.querySelectorAll('.pdt-doc-ed [data-hd]').forEach(el => {
    if (!tout && el === document.activeElement) return;
    const x = h[el.dataset.hd], l = pdtLigne(el.dataset.hd);
    if (!x || !l) return;
    if (l.type === 'partie' && l.etiquette != null) return;
    el.textContent = l.type === 'partie' ? (l.hors ? 'HORS PLATEAU' : `PARTIE ${x.num}`) : pdtPlage(x);
  });
}

function pdtLigneRegler(id, k, v) {
  const l = pdtLigne(id);
  if (!l) return;
  if (v === '' || v === false) delete l[k]; else l[k] = v;
  pdtChange();
  pdtRedessiner();
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
  const temps = `${pdtField('DURÉE', 'duree', l.duree, { ...o, ph: '15 · 1h · 1h30' })}
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

// Zoom du document dans l'éditeur (pas de la page) ; gardé d'une fois sur l'autre
let pdtZoom = (() => { try { return Number(localStorage.getItem('pdtZoom')) || 1; } catch (e) { return 1; } })();
function pdtZoomer(z, e) {
  z = Math.min(3, Math.max(0.5, Math.round(z * 100) / 100));
  const zone = document.querySelector('.pdt-ed-zone'), doc = zone && zone.querySelector('.pdt-doc');
  if (!doc) { pdtZoom = z; return; }
  // Le point sous la souris reste sous la souris
  const r = doc.getBoundingClientRect();
  const fx = e ? (e.clientX - r.left) / r.width : 0.5, fy = e ? (e.clientY - r.top) / r.height : null;
  const old = pdtZoom;
  pdtZoom = z;
  doc.style.zoom = z;
  zone.classList.toggle('zoome', z > 1);
  if (e && old !== z) {
    const r2 = doc.getBoundingClientRect();
    zone.scrollLeft += r2.left + fx * r2.width - e.clientX;
    window.scrollBy(0, r2.top + fy * r2.height - e.clientY);
  }
  const v = document.querySelector('.pdt-zoom-val');
  if (v) v.textContent = Math.round(z * 100) + ' %';
  try { localStorage.setItem('pdtZoom', z); } catch (err) {}
}

// ── Colonnes du tableau des plans ───────────────────────────────────────────
const PDT_COLS_BASE = ['hh', 'du', 'num', 'ref', 'scene', 'technique', 'optique', 'lum', 'note'];
const PDT_COLS_LARG = { hh: 10, du: 7, num: 5.5, ref: 17.5, scene: 18, technique: 13, optique: 8, lum: 10, note: 11 };
const PDT_COLS_FIXES = ['hh', 'du']; // nécessaires aux horaires : on ne les retire pas
const pdtCols = d => Array.isArray(d.cols) && d.cols.length ? d.cols : PDT_COLS_BASE;
// Largeurs en %, qui font 100 au total
function pdtLargeurs(d) {
  const ws = pdtCols(d).map(k => Number((d.largeurs || {})[k]) || PDT_COLS_LARG[k] || 9);
  const t = ws.reduce((a, b) => a + b, 0);
  return ws.map(w => Math.round(w / t * 10000) / 100);
}
// Colonnes du tableau de l'équipe (en haut à gauche)
function pdtEqCols(d) { return Array.isArray(d.eqCols) && d.eqCols.length ? d.eqCols : PDT_EQ_COLS; }
function pdtEqColAjouter(pos) {
  const d = pdtCur();
  if (!d) return;
  const cols = pdtEqCols(d).slice();
  let n = 1;
  while (cols.includes('x' + n)) n++;
  cols.splice(pos, 0, 'x' + n);
  d.eqCols = cols;
  pdtChange();
  pdtRedessiner();
}
function pdtEqColDeplacer(k, sens) {
  const d = pdtCur();
  if (!d) return;
  const cols = pdtEqCols(d).slice(), i = cols.indexOf(k), j = i + sens;
  if (i < 0 || j < 0 || j >= cols.length) return;
  [cols[i], cols[j]] = [cols[j], cols[i]];
  d.eqCols = cols;
  pdtChange();
  pdtRedessiner();
}
function pdtEqColRetirer(k) {
  const d = pdtCur();
  if (!d) return;
  const cols = pdtEqCols(d).filter(x => x !== k);
  if (!cols.length) return;
  if ((d.cast || []).some(c => c[k === 'nom' ? 'nom' : PDT_EQ_TITRES[k] ? k : 'x_' + k]) && !confirm('Retirer cette colonne et ce qu\'elle contient ?')) return;
  d.eqCols = cols;
  pdtChange();
  pdtRedessiner();
}

function pdtColAjouter(pos) {
  const d = pdtCur();
  if (!d) return;
  const cols = pdtCols(d).slice();
  let n = 1;
  while (cols.includes('x' + n)) n++;
  cols.splice(pos, 0, 'x' + n);
  d.cols = cols;
  d.textes = d.textes || {};
  if (d.textes['col_x' + n] == null) d.textes['col_x' + n] = 'COLONNE';
  pdtChange();
  pdtRedessiner();
}
function pdtColDeplacer(k, sens) {
  const d = pdtCur();
  if (!d) return;
  const cols = pdtCols(d).slice(), i = cols.indexOf(k), j = i + sens;
  if (i < 0 || j < 0 || j >= cols.length) return;
  [cols[i], cols[j]] = [cols[j], cols[i]];
  d.cols = cols;
  pdtChange();
  pdtRedessiner();
}
function pdtColRetirer(k) {
  const d = pdtCur();
  if (!d || PDT_COLS_FIXES.includes(k)) return;
  const nom = k[0] === 'x' ? ((d.textes || {})['col_' + k] || 'cette colonne') : 'cette colonne';
  if (!confirm(`Retirer ${nom} du PDT ?`)) return;
  d.cols = pdtCols(d).filter(x => x !== k);
  pdtChange();
  pdtRedessiner();
}
// Tirer le bord droit d'un titre de colonne : elle s'élargit, sa voisine de droite rétrécit
function pdtRedimDebut(e, h) {
  e.preventDefault();
  const d = pdtCur(), th = h.closest('th'), table = th.closest('table');
  const cols = table.querySelectorAll('col');
  const j = th.cellIndex;
  const tw = table.getBoundingClientRect().width;
  const ws = pdtLargeurs(d);
  const x0 = e.clientX, a0 = ws[j], b0 = ws[j + 1];
  document.body.classList.add('pdt-redim-en-cours');
  const bouge = ev => {
    const dx = (ev.clientX - x0) / tw * 100;
    const a = Math.min(a0 + b0 - 3, Math.max(3, a0 + dx));
    ws[j] = Math.round(a * 100) / 100;
    ws[j + 1] = Math.round((a0 + b0 - a) * 100) / 100;
    cols[j].style.width = ws[j] + '%';
    cols[j + 1].style.width = ws[j + 1] + '%';
  };
  const fin = () => {
    document.removeEventListener('mousemove', bouge);
    document.removeEventListener('mouseup', fin);
    document.body.classList.remove('pdt-redim-en-cours');
    d.largeurs = {};
    pdtCols(d).forEach((k, i) => { d.largeurs[k] = ws[i]; });
    pdtChange();
  };
  document.addEventListener('mousemove', bouge);
  document.addEventListener('mouseup', fin);
}

// Tirer le bas d'une ligne pour la rendre plus haute ou plus serrée (double-clic : hauteur normale)
function pdtHautDebut(e, h) {
  e.preventDefault();
  const tr = h.closest('tr[data-li]'), d = pdtCur();
  const l = tr && d && d.lignes[Number(tr.dataset.li)];
  if (!l) return;
  if (e.detail > 1) { delete l.haut; pdtChange(); return pdtRedessiner(); }
  const doc = tr.closest('.pdt-doc');
  const mmParPx = (doc.classList.contains('paysage') ? 297 : 210) / doc.getBoundingClientRect().width;
  const y0 = e.clientY, h0 = tr.getBoundingClientRect().height;
  let mm = null;
  document.body.classList.add('pdt-redim-h-en-cours');
  const bouge = ev => {
    mm = Math.max(3, Math.round((h0 + ev.clientY - y0) * mmParPx * 2) / 2);
    tr.setAttribute('data-h', '');
    tr.style.setProperty('--h', mm + 'mm');
  };
  const fin = () => {
    document.removeEventListener('mousemove', bouge);
    document.removeEventListener('mouseup', fin);
    document.body.classList.remove('pdt-redim-h-en-cours');
    if (mm == null) return;
    l.haut = mm;
    pdtChange();
    pdtRedessiner();
  };
  document.addEventListener('mousemove', bouge);
  document.addEventListener('mouseup', fin);
}

// La ligne visée par le glisser : celle sous la souris, ou la plus proche
// (sur une bordure, un saut de page ou entre deux lignes, on ne perd pas le lâcher)
function pdtGlisseCible(zone, e) {
  let cible = null, ecart = Infinity;
  zone.querySelectorAll('tr[data-li]').forEach(tr => {
    const r = tr.getBoundingClientRect();
    const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
    if (d < ecart) { ecart = d; cible = tr; }
  });
  return cible;
}

// Où poser la ligne glissée : sur une barre de partie, toujours dessous (dans la partie) ;
// ailleurs, au-dessus ou au-dessous selon la moitié de la ligne visée (taille réelle, zoom compris)
function pdtGlisseDessous(tr, e) {
  const l = (pdtCur().lignes || [])[Number(tr.dataset.li)];
  if (l && l.type === 'partie') return true;
  const r = tr.getBoundingClientRect();
  return e.clientY > r.top + r.height / 2;
}

let pdtGlisse = null, pdtGlisseVers = null;

// Pendant le glisser, la page défile toute seule quand la souris approche du haut ou du bas
// de l'écran : on peut emmener une ligne loin sans lâcher
document.addEventListener('dragover', e => {
  if (pdtGlisse == null) return;
  const bord = 90, h = window.innerHeight;
  const v = e.clientY < bord ? e.clientY - bord : e.clientY > h - bord ? e.clientY - (h - bord) : 0;
  if (v) window.scrollBy(0, Math.round(v / 3));
});

// Déplace la ligne i à la place « avant la ligne j » (j = longueur : à la fin)
function pdtDeplacerVers(i, j) {
  const d = pdtCur();
  if (!d || !d.lignes[i] || j === i || j === i + 1) return pdtRedessiner();
  const [l] = d.lignes.splice(i, 1);
  d.lignes.splice(j > i ? j - 1 : j, 0, l);
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
  if (pdtMode !== 'form') pdtRedessiner();
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

// Le document : edit = true pour l'éditeur « sur le document » (cases modifiables,
// outils de ligne dans la marge), sinon le rendu de l'aperçu et du PDF.
function pdtDocCorps(d, edit) {
  const M = pdtMots(d);
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const h = pdtHoraires(d);
  const lignes = d.lignes || [];
  const premier = lignes.find(l => l.type !== 'partie' && h[l.id] && h[l.id].du != null);
  // READY TO SHOOT (ou PAT) et WRAP vides : l'heure du premier plan et celle de la fin
  const auto = lab => /ready|^\s*pat\b/i.test(lab) && premier ? pdtHh(h[premier.id].du) : /wrap/i.test(lab) && h.fin != null ? pdtHh(h.fin) : '';
  const up = v => String(v == null ? '' : v).toUpperCase();
  // Les textes fixes du modèle (titres de colonnes, SHOOT DAY…) : modifiables, gardés dans d.textes
  const T = (k, def) => {
    def = def.replace(/<br\s*\/?>/g, '\n');
    const v = d.textes && d.textes[k] != null ? d.textes[k] : def;
    const h = pdtHtmlValide((d.textesHtml || {})[k], v);
    return edit ? `<span class="ed" contenteditable="true" spellcheck="false" data-t="${k}" data-multi="1" data-ph="${esc(def.replace(/\n/g, ' '))}">${h || esc(v)}</span>`
      : h || esc(v).replace(/\n/g, '<br>');
  };
  // Une case : modifiable dans l'éditeur, texte simple sinon. Gras, italique… : gardés à part (html)
  const fmt = (v, k, o) => pdtHtmlValide(((pdtSource(d, o.l, o.i) || {}).html || {})[k], v);
  const ed = (v, k, o = {}) => {
    const h = fmt(v, k, o);
    return edit
      ? `<span class="ed${o.up ? ' up' : ''}${o.tbc ? ' ph-tbc' : ''}" contenteditable="true" spellcheck="false" data-k="${k}"${o.l ? ` data-l="${o.l}" data-i="${o.i}"` : ''}${o.multi ? ' data-multi="1"' : ''} data-ph="${esc(o.ph || '')}">${h || esc(v == null ? '' : v)}</span>`
      : h ? (o.up ? `<span style="text-transform:uppercase">${h}</span>` : h)
      : o.tbc ? pdtTbc(o.up ? up(v) : v) : esc(o.up ? up(v) : v);
  };
  const outils = (l, i) => !edit ? '' : `<div class="pdt-outils" contenteditable="false">
      <span class="pdt-poignee" title="Glisser pour déplacer la ligne">⠿</span>
      <select title="Ajouter une ligne en dessous" onchange="pdtAjouter(this.value, ${i}); this.value=''"><option value="">+</option><option value="plan">${M.plan === 'PHOTO' ? 'Photo' : 'Plan'}</option><option value="install">Mise en place</option><option value="pause">Pause / battement</option><option value="partie">Partie (décor)</option></select>
      <button type="button" title="Dupliquer la ligne" onclick="pdtCopierLigne(${i})">⧉</button>
      ${l.type === 'partie' ? `<button type="button" class="${l.hors ? 'on' : ''}" title="Hors plateau (sans horaires)" onclick="pdtLigneRegler('${l.id}', 'hors', ${l.hors ? 'false' : 'true'})">HORS</button>` : ''}
      <button type="button" title="Retirer" onclick="pdtRetirer('lignes', ${i})">✕</button>
    </div>`;

  // En-tête : horaires de la journée à gauche, cast à droite
  const horaires = edit ? d.horaires || [] : (d.horaires || []).filter(x => x.label || x.heure);
  const cast = edit ? d.cast || [] : (d.cast || []).filter(x => x.nom || x.role);
  const x0 = { up: true };
  // À gauche, l'équipe (TEAM, ROLE, CALL, PAT… colonnes au choix) ; à droite, les horaires du jour
  const eqCols = pdtEqCols(d);
  const eqTitre = k => PDT_EQ_TITRES[k] ? T(PDT_EQ_TITRES[k][0], PDT_EQ_TITRES[k][1]) : T('eqcol_' + k, 'COLONNE');
  const eqOutils = (k, j) => !edit ? '' : `<div class="pdt-col-outils" contenteditable="false">
      <button type="button" title="Ajouter une colonne à gauche" onclick="pdtEqColAjouter(${j})">+</button>
      ${j ? `<button type="button" title="Déplacer la colonne vers la gauche" onclick="pdtEqColDeplacer('${k}', -1)">◂</button>` : ''}
      ${eqCols.length > 1 ? `<button type="button" title="Retirer cette colonne" onclick="pdtEqColRetirer('${k}')">✕</button>` : ''}
      ${j < eqCols.length - 1 ? `<button type="button" title="Déplacer la colonne vers la droite" onclick="pdtEqColDeplacer('${k}', 1)">▸</button>` : ''}
      <button type="button" title="Ajouter une colonne à droite" onclick="pdtEqColAjouter(${j + 1})">+</button>
    </div>`;
  const eqCase = (c, k, oc) => k === 'nom' ? `<td class="c">${ed(c.nom, 'nom', { ...oc, up: true, tbc: true, ph: 'TBC' })}</td>`
    : k === 'role' ? `<td class="c b">${ed(c.role, 'role', { ...oc, up: true, ph: 'RÔLE' })}</td>`
    : k === 'call' || k === 'pat' ? `<td class="c${k === 'pat' ? ' pat' : ''}">${ed(c[k], k, { ...oc, tbc: true, ph: 'TBC' })}</td>`
    : `<td class="c">${ed(c['x_' + k], 'x_' + k, { ...oc, multi: true })}</td>`;
  const eqLignes = cast.map((c, i) => {
    const oc = { l: 'cast', i };
    const cases = eqCols.map(k => eqCase(c, k, oc));
    if (edit) cases[cases.length - 1] = cases[cases.length - 1].replace(/<\/td>$/, `<div class="pdt-outils droite" contenteditable="false"><button type="button" title="Retirer" onclick="pdtRetirer('cast', ${i})">✕</button></div></td>`);
    return `<tr>${cases.join('')}</tr>`;
  });
  const eqTable = `<table class="haut eq">
    <colgroup>${eqCols.map(k => `<col style="width:${(k === 'nom' || k === 'role' ? 2 : 1) / eqCols.reduce((t, x) => t + (x === 'nom' || x === 'role' ? 2 : 1), 0) * 100}%">`).join('')}</colgroup>
    <tr>${eqCols.map((k, j) => `<th data-eqcol="${k}">${eqOutils(k, j)}${eqTitre(k)}</th>`).join('')}</tr>
    ${eqLignes.join('')}
    ${edit ? `<tr class="pdt-ajout-haut"><td colspan="${eqCols.length}"><button type="button" onclick="pdtAjouterSimple('cast')">+ personne</button></td></tr>` : ''}
  </table>`;
  const horTable = `<table class="haut hor">
    <colgroup><col style="width:58%"><col style="width:42%"></colgroup>
    ${horaires.map((x, i) => {
      const oh = { l: 'horaires', i };
      return `<tr><td class="lab">${ed(x.label, 'label', { ...oh, ...x0, ph: 'QUOI' })}</td>
        <td class="hh">${ed(x.heure || (edit ? '' : auto(x.label)), 'heure', { ...oh, tbc: true, ph: auto(x.label) || 'TBC' })}${edit ? `<div class="pdt-outils droite" contenteditable="false"><button type="button" title="Retirer" onclick="pdtRetirer('horaires', ${i})">✕</button></div>` : ''}</td></tr>`;
    }).join('')}
    ${edit ? `<tr class="pdt-ajout-haut"><td colspan="2"><button type="button" onclick="pdtAjouterSimple('horaires')">+ horaire</button></td></tr>` : ''}
  </table>`;

  // Colonnes du tableau : celles du modèle (qu'on peut retirer) et celles ajoutées (x…)
  const cols = pdtCols(d);
  const nc = cols.length;
  const titres = { hh: T('horaires', 'HORAIRES'), du: T('duration', 'DURATION'), num: T('num', M.num), ref: T('reference', 'REFERENCE'), scene: T('scene', M.sceneCol), technique: T('technique', M.techniqueCol), optique: T('optique', M.optiqueCol), lum: T('lighting', 'LIGHTING\nEFFECT'), note: T('notes', 'NOTES /\nÀ PRÉVOIR') };
  const colOutils = (k, j) => !edit ? '' : `<div class="pdt-col-outils" contenteditable="false">
      <button type="button" title="Ajouter une colonne à gauche" onclick="pdtColAjouter(${j})">+</button>
      ${j ? `<button type="button" title="Déplacer la colonne vers la gauche" onclick="pdtColDeplacer('${k}', -1)">◂</button>` : ''}
      ${PDT_COLS_FIXES.includes(k) ? '' : `<button type="button" title="Retirer cette colonne" onclick="pdtColRetirer('${k}')">✕</button>`}
      ${j < nc - 1 ? `<button type="button" title="Déplacer la colonne vers la droite" onclick="pdtColDeplacer('${k}', 1)">▸</button>` : ''}
      <button type="button" title="Ajouter une colonne à droite" onclick="pdtColAjouter(${j + 1})">+</button>
    </div>${j < nc - 1 ? '<span class="pdt-redim" contenteditable="false" title="Tirer pour changer la largeur"></span>' : ''}`;
  const entete = `<tr class="th">
    ${cols.map((k, j) => `<th data-col="${k}">${colOutils(k, j)}${titres[k] || T('col_' + k, '')}</th>`).join('')}
  </tr>`;
  // Hauteur réglée à la main (l.haut, en mm) ; en édition, une poignée au bas de chaque case la règle
  const poigneeH = '<span class="pdt-redim-l" contenteditable="false" title="Tirer pour changer la hauteur de la ligne (double-clic : hauteur normale)"></span>';
  const rangee = (l, html) => {
    const k = html.lastIndexOf('<tr');
    let tr = html.slice(k);
    if (l.haut) tr = tr.replace('<tr', `<tr data-h style="--h:${Number(l.haut)}mm"`);
    if (edit) tr = tr.replace(/<\/td>/g, poigneeH + '</td>');
    return html.slice(0, k) + tr;
  };
  const corps = lignes.map((l, i) => rangee(l, (() => {
    const x = h[l.id] || {};
    const o = { l: 'lignes', i: l.id };
    if (l.type === 'partie') {
      const t = up(l.titre);
      const etiq = l.hors ? 'HORS PLATEAU' : `PARTIE ${x.num}`;
      const titre = edit ? `${l.etiquette != null ? ed(l.etiquette, 'etiquette', { ...o, up: true, ph: etiq }) : `<span class="ed up" contenteditable="plaintext-only" spellcheck="false" data-k="etiquette" data-l="lignes" data-i="${l.id}" data-hd="${l.id}" data-ph="${etiq}">${etiq}</span>`} — ${ed(l.titre, 'titre', { ...o, up: true, ph: 'DÉCOR — AMBIANCE' })}`
        : l.etiquette != null ? esc([up(l.etiquette), t].filter(Boolean).join(' — '))
        : esc(l.hors ? (/^HORS PLATEAU/.test(t) ? t : 'HORS PLATEAU' + (t ? ' — ' + t : '')) : /^PARTIE/.test(t) ? t : `PARTIE ${x.num}${t ? ' — ' + t : ''}`);
      return `${l.hors ? `<tr class="saut"><td colspan="${nc}"></td></tr><tr class="noir"><td colspan="${nc}"></td></tr>` : ''}<tr class="barre" data-li="${i}"><td colspan="${nc}">${outils(l, i)}${titre}</td></tr>`;
    }
    if (l.type === 'pause') {
      if (!edit) return `<tr class="barre"><td colspan="${nc}">${esc([up(l.nom || 'PAUSE'), pdtPlage(x)].filter(Boolean).join(' ') + (l.texte ? ' — ' + up(l.texte) : ''))}</td></tr>`;
      return `<tr class="barre" data-li="${i}"><td colspan="${nc}">${outils(l, i)}${ed(l.nom, 'nom', { ...o, up: true, ph: 'PAUSE' })} <span data-hd="${l.id}">${esc(pdtPlage(x))}</span> — ${ed(l.texte, 'texte', { ...o, up: true, ph: 'détail' })} <span class="pdt-duree-barre">(${ed(pdtDureeTexte(l.duree, true), 'duree', { ...o, ph: '30 min' })})</span></td></tr>`;
    }
    const heure = edit ? `<span class="ed" contenteditable="plaintext-only" spellcheck="false" data-k="heure" data-l="lignes" data-i="${l.id}" data-hd="${l.id}" title="Écris une heure pour fixer le début de cette ligne">${esc(pdtPlage(x))}</span>` : esc(pdtPlage(x));
    const duree = x.hors && !edit ? '-' : edit ? ed(pdtDureeTexte(l.duree), 'duree', { ...o, ph: '15 mins' }) : x.duree ? esc(pdtDureeTexte(l.duree)) : '-';
    const outilsMis = { v: false };
    const avecOutils = html => { if (outilsMis.v) return html; outilsMis.v = true; return outils(l, i) + html; };
    if (l.type === 'install') {
      // HORAIRES, DURÉE et # gardent leur case ; le texte s'étend sur les autres colonnes
      const cases = [];
      let texteMis = false;
      for (let j = 0; j < nc; j++) {
        const k = cols[j];
        if (k === 'hh') cases.push(`<td class="hh">${avecOutils(heure)}</td>`);
        else if (k === 'du') cases.push(`<td class="du">${avecOutils(duree)}</td>`);
        else if (k === 'num') cases.push(`<td class="c">${avecOutils(ed(l.shot || (edit ? '' : '-'), 'shot', { ...o, ph: '-' }))}</td>`);
        else {
          let n = 1;
          while (j + n < nc && !['hh', 'du', 'num'].includes(cols[j + n])) n++;
          cases.push(`<td colspan="${n}" class="it">${avecOutils(texteMis ? '' : ed(l.texte, 'texte', { ...o, up: true, ph: 'MISE EN PLACE…' }))}</td>`);
          texteMis = true;
          j += n - 1;
        }
      }
      return `<tr class="install"${edit ? ` data-li="${i}"` : ''}>${cases.join('')}</tr>`;
    }
    const lum = pdtLumiere(l);
    const lumStyle = lum ? ` style="background:${lum[0]};color:${lum[1]}"` : '';
    const [lum1, ...lumS] = pdtLignes(l.lumiere);
    const opt = pdtLignes(l.optique);
    const ref = edit
      ? `<div class="pdt-ref-ed" tabindex="0" data-img="${l.id}" title="Clique pour choisir une image, ou colle / glisse une image ici">${l.img ? `<img src="${esc(pdtImgSrc(l.img))}" alt="">` : `<span>${l.imgEnvoi ? 'ENVOI…' : '+ IMAGE'}</span>`}</div>`
      : l.img ? `<img src="${esc(pdtImgSrc(l.img))}" alt="">` : '';
    const cases = {
      hh: () => `<td class="hh">${avecOutils(heure)}</td>`,
      du: () => `<td class="du">${avecOutils(duree)}</td>`,
      num: () => `<td class="shot">${avecOutils(ed(l.shot || (edit ? '' : '-'), 'shot', { ...o, ph: '#' }))}</td>`,
      ref: () => `<td class="ref">${avecOutils(ref)}</td>`,
      scene: () => `<td class="txt">${avecOutils(ed(l.scene, 'scene', { ...o, multi: true, ph: M.phScene }))}</td>`,
      technique: () => `<td class="txt">${avecOutils(ed(l.technique, 'technique', { ...o, multi: true, ph: M.phTech }))}</td>`,
      optique: () => `<td class="opt">${avecOutils(edit || fmt(l.optique, 'optique', o) ? ed(l.optique, 'optique', { ...o, up: true, multi: true, ph: '35MM' }) : opt.map((v, j) => j ? `<small>${esc(up(v))}</small>` : esc(up(v))).join(''))}</td>`,
      lum: () => `<td class="lum"${lumStyle}>${avecOutils(edit || fmt(l.lumiere, 'lumiere', o) ? ed(l.lumiere, 'lumiere', { ...o, up: true, multi: true, ph: 'JOUR / NUIT' }) : (lum1 ? esc(up(lum1)) : '') + lumS.map(s => `<small>${esc(up(s))}</small>`).join(''))}</td>`,
      note: () => `<td class="note${l.noteNoire ? '' : ' rouge'}">${avecOutils(ed(l.note, 'note', { ...o, multi: true, ph: 'à prévoir…' }))}</td>`
    };
    return `<tr class="plan${l.img || edit ? ' avec-img' : ''}"${edit ? ` data-li="${i}"` : ''}>
      ${cols.map(k => cases[k] ? cases[k]() : `<td class="txt">${avecOutils(ed(l['x_' + k], 'x_' + k, { ...o, multi: true }))}</td>`).join('')}
    </tr>`;
  })())).join('');

  const date = edit
    ? `${ed(d.dateTexte, 'dateTexte', { up: true, ph: pdtDateTexte(d.date) })}<label class="pdt-ed-date" title="Choisir la date du tournage">📅<input type="date" data-k="date" value="${esc(d.date || '')}" onclick="try{this.showPicker()}catch(e){}" onchange="pdtInput(this); pdtRedessiner()"></label> · ${ed(d.lieu, 'lieu', { up: true, ph: 'LIEU' })}`
    : esc(d.dateTexte ? up(d.dateTexte) : pdtDateTexte(d.date)) + (d.lieu ? ' · ' + esc(up(d.lieu)) : '');
  const jours = Math.max(Number(d.jours) || 1, Number(d.jour) || 1);
  const client = d.logo ? `<img src="${esc(d.logo)}" alt="${esc(d.client)}"${edit ? ' title="Logo du client : change-le dans la barre au-dessus"' : ''}>` : ed(d.client, 'client', { up: true, ph: 'CLIENT' });
  return `<div class="pdt-doc${edit ? ' pdt-doc-ed' : ''}${d.paysage ? ' paysage' : ''}">
  <div class="tete">
    <img class="widen" src="${base}widen-logo.png" alt="WIDEN">
    <div class="mil">
      <h1>${T('h1', 'SHOOTING SCHEDULE')}</h1>
      <div class="t">${ed(d.titre, 'titre', { up: true, ph: 'CLIENT “PROJET”' })}</div>
      <div class="d">${date}</div>
      <div class="d">${T('shootDay', (pdtType(d) === 'photo' ? 'PHOTO · ' : '') + 'SHOOT DAY')} ${edit ? `${ed(d.jour || 1, 'jour')} / ${ed(d.jours || 1, 'jours')}` : `${Number(d.jour) || 1} / ${jours}`}</div>
    </div>
    <div class="cl">${client}</div>
  </div>
  <div class="haut-2">${eqTable}${horTable}</div>
  <table class="haut prepa-t">
    <colgroup><col style="width:10%"><col style="width:90%"></colgroup>
    <tr class="noir"><td colspan="2"></td></tr>
    <tr class="prepa"><td>${edit ? ed(d.prepaHeure, 'prepaHeure', { ph: d.debut ? 'TBC-' + d.debut : 'TBC' }) : pdtTbc(d.prepaHeure || (d.debut ? 'TBC-' + d.debut : ''))}</td><td>${ed(d.prepaTexte, 'prepaTexte', { up: true, ph: 'PRÉPA…' })}</td></tr>
  </table>
  <table class="plan-t">
    <colgroup>${pdtLargeurs(d).map(w => `<col style="width:${w}%">`).join('')}</colgroup>
    <thead>${entete}</thead>
    <tbody>${corps}</tbody>
  </table>
  ${edit ? `<div class="pdt-ajout-bas">
      <button type="button" onclick="pdtAjouter('partie')">+ PARTIE (DÉCOR)</button>
      <button type="button" onclick="pdtAjouter('install')">+ MISE EN PLACE</button>
      <button type="button" onclick="pdtAjouter('plan')">+ ${M.plan}</button>
      <button type="button" onclick="pdtAjouter('pause')">+ PAUSE / BATTEMENT</button>
    </div>
    <p class="pied">${ed(d.piedPage, 'piedPage', { ph: 'Note en bas de page (facultatif) : Rouge = à prévoir · TBC = à confirmer…' })}</p>`
    : d.piedPage ? `<p class="pied">${esc(d.piedPage)}</p>` : ''}
</div>`;
}

// Styles du document. ecran : aperçu (fond blanc) ; edit : dans la page du site
function pdtDocCss(ecran, edit, paysage) {
  return `${edit ? '' : `@page {
    size: A4 ${paysage ? 'landscape' : 'portrait'}; margin: 9mm 8mm 11mm;
    /* Des cases de marge remplies : le navigateur n'imprime plus l'adresse du site, la date ni le titre */
    @top-right { content: " "; }
    @bottom-right { content: "PAGE " counter(page) " / " counter(pages); font-family: 'Karla', Arial, sans-serif; font-size: 8px; font-weight: 700; letter-spacing: .02em; color: #111; vertical-align: middle; }
  }
  body { margin: 0; background: ${ecran ? '#fff' : '#e9e9e7'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
  .pdt-doc, .pdt-doc * { box-sizing: border-box; }
  .pdt-doc { font-family: 'Karla', Arial, sans-serif; color: #111; width: 210mm; min-height: 297mm; margin: ${ecran ? '0' : '10mm'} auto; background: #fff; padding: 9mm 8mm; font-size: 8px; line-height: 1.25; text-align: left; letter-spacing: normal; }
  .pdt-doc.paysage { width: 297mm; min-height: 210mm; }
  .pdt-doc.paysage tr.plan.avec-img td, .pdt-doc.paysage td.ref img { height: 32mm; }
  .pdt-doc .tete { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; margin-bottom: 5mm; }
  .pdt-doc .tete .widen { height: 15px; display: block; }
  .pdt-doc .tete .mil { text-align: center; }
  .pdt-doc .tete .mil h1 { font-family: inherit; font-size: 15px; font-weight: 700; margin: 0 0 9px; letter-spacing: .02em; }
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
  .pdt-doc .haut-2 { display: flex; gap: 6mm; align-items: flex-start; }
  .pdt-doc .haut-2 table.eq { flex: 1 1 64%; width: auto; }
  .pdt-doc .haut-2 table.hor { flex: 0 0 30%; width: auto; }
  .pdt-doc .haut.hor .lab { font-weight: 700; }
  .pdt-doc table.prepa-t { margin-top: 4mm; }
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
  .pdt-doc tr[data-h] > td { height: var(--h) !important; }
  .pdt-doc tr[data-h] td.ref img, .pdt-doc-ed tr[data-h] .pdt-ref-ed { height: var(--h) !important; }
  .pdt-doc td.shot { font-weight: 700; font-size: 10px; }
  .pdt-doc td.ref { padding: 0; }
  .pdt-doc td.ref img { width: 100%; height: 25mm; object-fit: cover; display: block; }
  .pdt-doc td.txt { font-size: 7px; white-space: pre-line; }
  .pdt-doc td.opt, .pdt-doc td.lum { font-size: 8px; }
  .pdt-doc td small { display: block; font-size: 5.5px; margin-top: 3px; }
  .pdt-doc td.note { font-size: 7px; white-space: pre-line; }
  .pdt-doc td.note.rouge { color: #e00000; }
  .pdt-doc thead { display: table-header-group; }
  .pdt-doc .pied { margin: 6px 0 0; font-size: 7px; font-style: italic; }
  ${edit ? `
  .pdt-doc-ed .ed { outline: none; min-width: 1.2em; display: inline-block; border-radius: 1px; cursor: text; }
  .pdt-doc-ed td > .ed, .pdt-doc-ed .t > .ed, .pdt-doc-ed .pied > .ed { display: block; min-height: 1.25em; }
  .pdt-doc-ed .ed:hover { box-shadow: 0 0 0 1px #9cb6d8; }
  .pdt-doc-ed .ed:focus { box-shadow: 0 0 0 1.5px #2f5597; background: #fff8; }
  .pdt-doc-ed .ed:empty::before { content: attr(data-ph); color: #aaa; font-weight: 400; font-style: italic; }
  .pdt-doc-ed .ed.ph-tbc:empty::before { color: #c00000; font-weight: 700; font-style: normal; }
  .pdt-doc-ed .ed.up { text-transform: uppercase; }
  .pdt-doc-ed .ed.up:empty::before { text-transform: none; }
  .pdt-doc-ed th .ed[data-t] { white-space: pre-wrap; }
  .pdt-doc-ed .eq th { position: relative; }
  .pdt-doc-ed td.txt .ed, .pdt-doc-ed td.note .ed, .pdt-doc-ed td.opt .ed, .pdt-doc-ed td.lum .ed { white-space: pre-wrap; }
  .pdt-doc-ed td.lum .ed, .pdt-doc-ed td.opt .ed { font-size: 5.5px; }
  .pdt-doc-ed td.lum .ed::first-line, .pdt-doc-ed td.opt .ed::first-line { font-size: 8px; }
  .pdt-doc-ed tr.barre .ed { min-width: 3em; }
  .pdt-doc-ed tr.barre td > .ed { display: inline-block; }
  .pdt-doc-ed .pdt-duree-barre { font-weight: 400; color: #666; }
  .pdt-doc-ed .pdt-ed-date { position: relative; cursor: pointer; }
  .pdt-doc-ed .pdt-ed-date:hover { box-shadow: 0 0 0 1px #9cb6d8; }
  .pdt-doc-ed .pdt-ed-date input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; padding: 0; }
  .pdt-doc-ed td.du { white-space: nowrap; }
  .pdt-doc-ed td.du > .ed { display: inline-block; min-height: 0; }
  .pdt-doc-ed .pdt-ref-ed { width: 100%; height: 25mm; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; color: #999; font-size: 7px; letter-spacing: .05em; }
  .pdt-doc-ed .pdt-ref-ed img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pdt-doc-ed .pdt-ref-ed:hover, .pdt-doc-ed .pdt-ref-ed:focus { box-shadow: inset 0 0 0 1.5px #2f5597; }
  .pdt-doc-ed td { position: relative; }
  .pdt-doc-ed .pdt-outils { position: absolute; right: 100%; top: 50%; transform: translateY(-50%); display: flex; gap: 2px; flex-direction: row; align-items: center; z-index: 3; font-size: 10px; font-family: Arial, sans-serif; padding: 6px 6px 6px 10px; visibility: hidden; opacity: 0; transition: opacity .15s, visibility 0s linear .8s; }
  .pdt-doc-ed .pdt-outils.droite { right: auto; left: 100%; padding: 6px 10px 6px 6px; }
  .pdt-doc-ed tr:hover .pdt-outils, .pdt-doc-ed tr:focus-within .pdt-outils, .pdt-doc-ed .pdt-outils:hover { visibility: visible; opacity: 1; transition-delay: 0s; }
  .pdt-doc-ed .pdt-outils button, .pdt-doc-ed .pdt-outils select { font: 10px Arial, sans-serif; background: #fff; border: 1px solid #ccc; color: #333; padding: 0 3px; height: 18px; cursor: pointer; min-width: 18px; max-width: 46px; }
  .pdt-doc-ed .pdt-outils button:hover { border-color: #2f5597; }
  .pdt-doc-ed tr.th th { position: relative; overflow-wrap: anywhere; }
  .pdt-doc-ed .pdt-col-outils { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); display: flex; gap: 1px; z-index: 4; white-space: nowrap; padding: 6px 4px 3px; visibility: hidden; opacity: 0; transition: opacity .15s, visibility 0s linear .8s; }
  .pdt-doc-ed tr.th th:hover .pdt-col-outils, .pdt-doc-ed tr.th th:focus-within .pdt-col-outils, .pdt-doc-ed .eq th:hover .pdt-col-outils, .pdt-doc-ed .eq th:focus-within .pdt-col-outils, .pdt-doc-ed .pdt-col-outils:hover { visibility: visible; opacity: 1; transition-delay: 0s; }
  .pdt-doc-ed .pdt-col-outils button { font: 10px Arial, sans-serif; background: #fff; border: 1px solid #ccc; color: #333; padding: 0 3px; height: 16px; min-width: 16px; cursor: pointer; }
  .pdt-doc-ed .pdt-col-outils button:hover { border-color: #2f5597; }
  .pdt-doc-ed .pdt-redim { position: absolute; top: 0; right: -4px; width: 7px; height: 100%; cursor: col-resize; z-index: 3; }
  .pdt-doc-ed .pdt-redim:hover, .pdt-redim-en-cours .pdt-doc-ed .pdt-redim:hover { background: #2f559766; }
  .pdt-redim-en-cours, .pdt-redim-en-cours * { cursor: col-resize !important; user-select: none; }
  .pdt-doc-ed .pdt-redim-l { position: absolute; left: 0; right: 0; bottom: -3px; height: 6px; cursor: row-resize; z-index: 2; }
  .pdt-doc-ed tr:hover > td > .pdt-redim-l:hover, .pdt-redim-h-en-cours .pdt-doc-ed .pdt-redim-l:hover { background: #2f559766; }
  .pdt-redim-h-en-cours, .pdt-redim-h-en-cours * { cursor: row-resize !important; user-select: none; }
  .pdt-doc-ed .pdt-poignee { cursor: grab; text-align: center; font-size: 14px; line-height: 1; color: #555; background: #fff; border: 1px solid #ccc; padding: 1px 4px; user-select: none; }
  .pdt-doc-ed tr.pdt-glisse { opacity: .4; }
  .pdt-doc-ed tr.pdt-vise-haut > td { box-shadow: inset 0 3px 0 #2f5597; }
  .pdt-doc-ed tr.pdt-vise-bas > td { box-shadow: inset 0 -3px 0 #2f5597; }
  .pdt-doc-ed .pdt-outils .on, .pdt-doc-ed .pdt-outils .on-rouge { color: #e00000; border-color: #e00000; font-weight: 700; }
  .pdt-doc-ed .pdt-outils .on { color: #2f5597; border-color: #2f5597; }
  .pdt-doc-ed tr.pdt-ajout-haut td { border: none; height: auto; padding: 3px 0; text-align: left; }
  .pdt-doc-ed .pdt-ajout-haut button, .pdt-doc-ed .pdt-ajout-bas button { font: 10px Arial, sans-serif; background: #fff; border: 1px dashed #aaa; color: #555; padding: 3px 8px; cursor: pointer; }
  .pdt-doc-ed .pdt-ajout-haut button:hover, .pdt-doc-ed .pdt-ajout-bas button:hover { border-color: #2f5597; color: #2f5597; }
  .pdt-doc-ed .pdt-ajout-bas { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }` : `
  @media screen and (max-width: 760px) { .pdt-doc { zoom: .46; margin: 8px auto; } }
  @media print { body { background: #fff; } .barre-impr { display: none; } .pdt-doc { width: auto; min-height: 0; margin: 0; padding: 0; } }`}`;
}

function pdtDocHtml(d, ecran) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PDT ${esc([d.titre || d.client, 'J' + (d.jour || 1)].filter(Boolean).join(' ').replace(/[“”"]/g, ''))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400;0,700;1,400&display=swap">
<style>${pdtDocCss(ecran, false, d.paysage)}</style></head><body>
${ecran ? '' : '<div class="barre barre-impr" style="position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:center;padding:12px;background:#111;color:#fff;font:14px Arial">Vérifie le plan de travail puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>'}
${pdtDocCorps(d, false)}
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
