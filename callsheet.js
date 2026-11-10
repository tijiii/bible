// ── CALLSHEETS (FEUILLES DE SERVICE) ─────────────────────────────────────────
// La feuille de service d'une journée (tournage ou prépa), sur le modèle des
// onglets CALLSHEET des fiches de suivi : en-tête (client, titre, lieu, horaires,
// basecamp), le déroulé de la journée, la note à l'équipe, puis le tableau de
// l'équipe par groupes (client, talents, photo, vidéo, glam, production,
// catering, lieux) avec téléphone, mail, pick-up, véhicule et call time.
// Comme dans le Google Sheet, on choisit une personne du projet et ses infos se
// remplissent toutes seules (OPTIONS TEAM de la fiche de suivi, fiches de la
// bible, contacts Widen). Chaque callsheet appartient à un projet du suivi
// production (projets.js). Gardé sous db.prod.callsheets.

let csId = null;              // callsheet ouverte

const CS_NOTE_DEFAUT = 'Afin de garantir un environnement de travail bienveillant et respectueux, aucun comportement, geste ou propos à caractère raciste, sexiste, LGBTQIA+phobe ou, plus généralement, discriminatoire ne sera toléré.';
const CS_WIDEN_ADRESSE = 'Widen - 1 Av. Bouvard, 74000 Annecy';
const CS_VEHICULES = ['OWN', 'VAN', 'CAMION', 'VOLVO', 'TRAIN', 'AVION', 'TAXI'];
// Les colonnes du tableau de l'équipe : leur titre par défaut (modifiable sur le
// document) et leur largeur relative. On en ajoute (x1, x2…), on les déplace, on
// les retire (sauf POSITION et NAME) ; l'ordre est gardé dans c.cols.
const CS_COL_TITRES = { pos: 'POSITION', nom: 'NAME', tel: 'PHONE NUMBER', mail: 'EMAIL', pickup: 'PICK-UP TIME', pickupLieu: 'PICK-UP LOCATION', vehicule: 'VEHICLE', hebergement: 'ACCOMMODATION', call: 'CALL TIME' };
const CS_LARG = { pos: 14, nom: 13, tel: 12, mail: 19, pickup: 7, pickupLieu: 21, vehicule: 7, hebergement: 11, call: 7 };
const CS_COLS_BASE = ['pos', 'nom', 'tel', 'mail', 'pickup', 'pickupLieu', 'vehicule', 'call'];
const CS_COLS_FIXES = ['pos', 'nom'];
// Celles qu'on coche dans le formulaire
const CS_COLS = [['tel', 'Téléphone'], ['mail', 'Mail'], ['pickup', 'Heure de pick-up'], ['pickupLieu', 'Lieu de pick-up'], ['vehicule', 'Véhicule'], ['hebergement', 'Hébergement'], ['call', 'Call time']];

// Les groupes du tableau, dans l'ordre de la fiche de suivi.
// [clé, titre, rôle qui y mène]. L'ordre des tests compte : « Art director » va
// en production avant que « director » ne l'envoie en vidéo.
const CS_GROUPES = [
  ['client', 'CLIENT', /\bclient|agence|agency|brand|marque/],
  ['cast', 'TALENTS', null],                 // pdtEstCast (rôle ou chapitre de la bible)
  ['glam', 'GLAM TEAM', /make ?up|maquill|\bmua\b|hair|coiff|stylis|\bhmc\b|habill|costum|wardrobe/],
  ['prod', 'PRODUCTION', /art director|direct\w* artist|produc|coordinat|\bregi|set design|\bdeco|runner|assistant de prod|chauffeur|driver|fixer/],
  ['photo', 'PHOTO TEAM', /photo|digit|retouch|assistant light/],
  ['video', 'VIDEO TEAM', /\breal|director|\bdop\b|chef op|\bcam\b|\bcam |camera|cadr|gaffer|spark|electr|machin|grip|focus|steadi|drone|\bson\b|sound|perch|\bdit\b|data|video|1st ac|2nd ac|assistant cam/],
];
const CS_GROUPES_FIN = [['autres', 'TEAM'], ['catering', 'CATERING'], ['lieux', 'STUDIO / LOCATION']];
// L'ordre des groupes sur la feuille (celui de la fiche de suivi)
const CS_ORDRE = ['client', 'cast', 'photo', 'video', 'glam', 'prod', 'autres', 'catering', 'lieux'];

function csList() {
  const p = prodData();
  if (!Array.isArray(p.callsheets)) p.callsheets = [];
  return p.callsheets;
}
function csById(id) { return csList().find(c => c.id === id); }
function csCur() { return csById(csId); }
function csDuProjet(pid) { return csList().filter(c => c.projetId === pid).sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.jour || 0) - (b.jour || 0)); }
const csLid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// L'ordre des colonnes (une callsheet de la première version gardait des cases cochées)
function csColsListe(c) {
  if (Array.isArray(c.cols) && c.cols.length) return c.cols;
  const b = c.cols && typeof c.cols === 'object' ? c.cols : {};
  c.cols = ['pos', 'nom', ...['tel', 'mail', 'pickup', 'pickupLieu', 'vehicule', 'hebergement'].filter(k => b[k] != null ? b[k] : k !== 'hebergement'), 'call'];
  return c.cols;
}
const csColTitre = (c, k) => { const t = (c.textes || {})['col_' + k]; return t != null ? t : CS_COL_TITRES[k] || 'COLONNE'; };
// Largeurs en % (somme 100), dans l'ordre des colonnes
function csLargeurs(c) {
  const cols = csColsListe(c);
  const ws = cols.map(k => Number((c.largeurs || {})[k]) || CS_LARG[k] || 10);
  const t = ws.reduce((a, b) => a + b, 0);
  return ws.map(w => Math.round(w / t * 10000) / 100);
}
// Le déroulé d'un bloc : une ligne par horaire ({ h: '14:00 - 16:00', t: 'Installation' }) ;
// une ligne sans heure (« avec Models + Figurants ») s'écrit sous la précédente.
const CS_RE_HEURE = /^\s*((?:\d{1,2}[:h.]\d{2}|TBC|TBD)(?:\s*[-–]\s*(?:\d{1,2}[:h.]\d{2}|TBC|TBD))?)(?:\s+(.*))?$/i;
function csSchDepuisTexte(t) {
  return String(t || '').split('\n').filter(x => x.trim()).map(x => {
    const m = CS_RE_HEURE.exec(x);
    return m ? { id: csLid(), h: m[1].trim(), t: (m[2] || '').trim() } : { id: csLid(), h: '', t: x.trim() };
  });
}
function csSchTexte(sc) { return csSchLignes(sc).map(l => (l.h ? l.h + '   ' : '') + (l.t || '')).join('\n'); }
function csSchLignes(sc) {
  if (!Array.isArray(sc.lignes)) { sc.lignes = csSchDepuisTexte(sc.texte); delete sc.texte; }
  return sc.lignes;
}
const csSch = (titre, texte) => ({ id: csLid(), titre, lignes: csSchDepuisTexte(texte) });


// ── Les personnes et leurs infos ─────────────────────────────────────────────
// Le groupe d'une personne d'après son rôle (et le client du projet)
function csGroupeDe(a, p) {
  const r = pjNorm(a.role);
  const client = pjNorm(p && p.client);
  if (client && r && (r === client || r.includes(client))) return 'client';
  for (const [k, , re] of CS_GROUPES) {
    if (k === 'cast' ? pdtEstCast(a) : re.test(r)) return k;
  }
  return 'autres';
}

// Ce qu'on sait d'une personne : rôle, téléphone, mail. On cherche dans l'OPTIONS
// TEAM du projet, puis sa fiche dans la bible, les contacts Widen, et l'OPTIONS
// TEAM des autres projets (les mêmes techniciens reviennent souvent).
function csInfos(nom, ref, p) {
  const n = pjNorm(String(nom || '').replace(/\(.*?\)/g, ''));
  const out = { role: '', tel: '', mail: '' };
  const prendre = src => { if (!src) return; ['role', 'tel', 'mail'].forEach(k => { if (!out[k] && src[k]) out[k] = String(src[k]).trim(); }); };
  const memeNom = x => x && pjNorm(String(x).replace(/\(.*?\)/g, '')) === n;
  if (!n && ref == null) return out;
  if (p) prendre((p.options || []).find(o => memeNom(o.nom)));
  const t = (ref != null && pjTalent(ref)) || (n ? pjTalentPour(nom, '') : null);
  if (t) prendre({ tel: t.tel, mail: t.mail });
  prendre(((db.prod && db.prod.contacts) || []).find(c => memeNom(c.nom)));
  for (const q of pjList()) {
    if (out.tel && out.mail) break;
    if (q !== p) prendre((q.options || []).find(o => memeNom(o.nom)));
  }
  return out;
}

// L'équipe d'un jour : les gens du projet pris ce jour-là (d'après leurs étapes
// ou leurs dates), sans ceux qui ne font que la post-prod (monteur, coloriste…).
function csGensDuJour(p, date) {
  return (p.equipe || []).filter(a => {
    if (!pjNomPersonne(a)) return false;
    const pp = pjRolePostProd(a.role);
    if (pp && pp.seulPost) return false;
    if (!date) return true;
    const per = pjPeriodes(p, a).filter(x => x && x.du);
    return !per.length || per.some(x => x.du <= date && date <= (x.au || x.du));
  });
}

function csLigneDe(a, p) {
  const nom = pjNomPersonne(a);
  const inf = csInfos(nom, a.ref, p);
  return { id: csLid(), aid: a.id, poste: a.role || inf.role || '', nom, tel: inf.tel, mail: inf.mail, pickup: '', pickupLieu: '', vehicule: '', hebergement: '', call: '' };
}

// Range des personnes dans les groupes (crée les groupes qui manquent, dans l'ordre)
function csTitreGroupe(cle) { const g = [...CS_GROUPES, ...CS_GROUPES_FIN].find(x => x[0] === cle); return g ? g[1] : 'GROUPE'; }
function csRanger(c, gens, p) {
  const ordre = CS_ORDRE;
  const titres = Object.fromEntries([...CS_GROUPES, ...CS_GROUPES_FIN].map(g => [g[0], g[1]]));
  gens.forEach(a => {
    const k = csGroupeDe(a, p);
    let s = c.sections.find(x => x.cle === k);
    if (!s) {
      s = { id: csLid(), cle: k, titre: titres[k], lignes: [] };
      // On le met à sa place : avant le premier groupe qui vient après lui
      const i = c.sections.findIndex(x => ordre.indexOf(x.cle) > ordre.indexOf(k));
      if (i < 0) c.sections.push(s); else c.sections.splice(i, 0, s);
    }
    s.lignes.push(csLigneDe(a, p));
  });
}

// Le titre de production et les crédits (réal, photographe) d'après l'équipe
function csCredits(p) {
  const qui = re => (p.equipe || []).filter(a => re.test(pjNorm(a.role)) && !/art|assist|\bdop\b|casting|photography/.test(pjNorm(a.role))).map(pjNomPersonne).filter(Boolean);
  const ph = qui(/photograph|photographe/), dir = qui(/\breal|director/);
  return [ph.length ? `Photographer : ${ph.join(', ')}` : '', dir.length ? `Director : ${dir.join(', ')}` : ''].filter(Boolean).join(' / ');
}

// Les jours de tournage et de prépa du calendrier, dans l'ordre
function csJours(p) {
  const tournage = new Set(pdtJoursTournage(p));
  const prepa = new Set();
  (p.etapes || []).forEach(e => {
    const d = pjEtapeDates(e);
    if (!d || !/prepa|prelight|install|repera|set ?design/.test(pjNorm(e.type + ' ' + pjEtapeNom(e)))) return;
    for (let x = d.du; x <= d.au; x = pjPlusJours(x, 1)) if (!tournage.has(x)) prepa.add(x);
  });
  return { tournage: [...tournage].sort(), prepa };
}

// Nouvelle callsheet : le prochain jour de tournage qui n'en a pas encore.
// S'il y en a déjà une, elle reprend son en-tête, ses groupes et ses pick-up.
function csNouvelle(pid) {
  const p = pjById(pid);
  if (!p) return;
  const siennes = csDuProjet(pid);
  const { tournage } = csJours(p);
  const prises = new Set(siennes.map(c => c.date).filter(Boolean));
  const avant = siennes[siennes.length - 1];
  let date = tournage.find(d => !prises.has(d)) || '';
  if (!date && avant && avant.date) date = pjPlusJours(avant.date, 1);
  if (avant) { csDupliquer(avant, date); return; }
  const client = String(p.client || '').trim();
  const nom = String(p.nom || '').trim();
  const c = {
    id: uid(), projetId: p.id, maj: Date.now(),
    date, jour: date ? tournage.indexOf(date) + 1 || 1 : 1,
    client, logo: prodData().logos[tsCleClient(client)] || '',
    titre: [client, nom && !pjNorm(nom).includes(pjNorm(client)) ? nom : ''].filter(Boolean).join(' ') || nom,
    credits: csCredits(p), lieu: p.lieu || '', timing: '', basecamp: '', basecampLien: '',
    callDefaut: '', meteo: '', note: CS_NOTE_DEFAUT,
    schedules: [], cols: CS_COLS_BASE.slice(),
    // Tous les groupes du modèle sont là dès le départ, même vides (vides, ils ne sont pas dans le PDF)
    sections: CS_ORDRE.filter(k => k !== 'autres').map(cle => ({ id: csLid(), cle, titre: csTitreGroupe(cle), lignes: [] })),
  };
  csRanger(c, csGensDuJour(p, date), p);
  csSchedulesDesPdt(c, true);
  if (!c.schedules.length) c.schedules = csPistes(p).map(k => csSch(k === 'photo' ? 'SCHEDULE PHOTO' : k === 'video' ? 'SCHEDULE VIDEO' : 'SCHEDULE', ''));
  csList().push(c);
  saveDb();
  csOuvrir(c.id);
}

// Les parties du projet (vidéo, photo) d'après ses étapes ; à défaut, un seul déroulé
function csPistes(p) {
  const s = new Set((p.etapes || []).map(pjPisteDe).filter(Boolean));
  const l = ['video', 'photo'].filter(k => s.has(k));
  return l.length ? l : [''];
}

// Duplique une callsheet pour un autre jour (le suivant par défaut) : même en-tête,
// mêmes groupes et mêmes personnes ; les heures de pick-up et de call sont gardées.
function csDupliquer(src, date) {
  src = src || csCur();
  if (!src) return;
  const c = JSON.parse(JSON.stringify(src));
  c.id = uid(); c.maj = Date.now();
  c.date = date !== undefined ? date : src.date ? pjPlusJours(src.date, 1) : '';
  const p = pjById(c.projetId);
  const t = p ? csJours(p).tournage : [];
  c.jour = c.date && t.includes(c.date) ? t.indexOf(c.date) + 1 : (src.jour || 0) + 1;
  delete c.dateTexte;
  c.sections.forEach(s => { s.id = csLid(); s.lignes.forEach(l => { l.id = csLid(); }); });
  (c.schedules || []).forEach(s => { s.id = csLid(); csSchLignes(s).forEach(l => { l.id = csLid(); }); });
  // Les PDT de ce nouveau jour remplacent le déroulé recopié
  if (p) csSchedulesDesPdt(c, true);
  csList().push(c);
  saveDb();
  csOuvrir(c.id);
}

// ── Déroulé repris des PDT du même jour ──────────────────────────────────────
// Un PDT vidéo et un PDT photo du même jour donnent SCHEDULE VIDEO et SCHEDULE
// PHOTO : une ligne par partie (de son premier à son dernier horaire), plus les
// pauses repas. Rien n'est fait si aucun PDT n'a cette date.
function csScheduleDuPdt(d) {
  const h = pdtHoraires(d);
  const lignes = [];
  let partie = null;
  let fin = null, dernier = null;
  const fermer = () => {
    if (partie && partie.du != null) {
      // Deux parties de suite au même nom ne font qu'une ligne
      if (dernier && dernier.titre === partie.titre && dernier.au === partie.du) { dernier.au = partie.au; lignes[lignes.length - 1] = `${pdtHh(dernier.du)} - ${pdtHh(dernier.au)}   ${dernier.titre}`; }
      else { lignes.push(`${pdtHh(partie.du)} - ${pdtHh(partie.au)}   ${partie.titre}`); dernier = partie; }
    }
    partie = null;
  };
  (d.lignes || []).forEach(l => {
    const x = h[l.id] || {};
    if (l.type === 'partie') { fermer(); if (!l.hors) partie = { titre: String(l.titre || 'SHOOT').trim(), du: null, au: null }; return; }
    if (x.hors || x.du == null) return;
    if (x.au != null) fin = fin == null ? x.au : Math.max(fin, x.au);
    if (l.type === 'pause' && /dej|din|repas|lunch|dinner|break/.test(pjNorm(l.nom + ' ' + l.texte))) {
      fermer();
      lignes.push(`${pdtHh(x.du)} - ${pdtHh(x.au)}   ${[l.nom, l.texte].filter(Boolean).join(' · ') || 'REPAS'}`);
      dernier = null;
      return;
    }
    if (!partie) partie = { titre: l.type === 'install' ? String(l.texte || 'MISE EN PLACE') : 'SHOOT', du: null, au: null };
    if (partie.du == null) partie.du = x.du;
    partie.au = x.au;
  });
  fermer();
  if (fin != null) lignes.push(`${pdtHh(fin)}   WRAP`);
  const prepa = d.prepaHeure ? `${String(d.prepaHeure).replace(/\s*-\s*/, ' - ')}   ${d.prepaTexte || 'PRÉPA'}` : '';
  return [prepa, ...lignes].filter(Boolean).join('\n');
}
// La fin de la journée d'un PDT (dernier horaire, même s'il finit par une partie hors plateau)
function csFinPdt(d) {
  const h = pdtHoraires(d);
  let fin = null;
  (d.lignes || []).forEach(l => { const x = h[l.id]; if (x && !x.hors && x.au != null) fin = fin == null ? x.au : Math.max(fin, x.au); });
  return fin;
}
function csPdtDuJour(c) { return c.date ? pdtDuProjet(c.projetId).filter(d => d.date === c.date) : []; }
function csSchedulesDesPdt(c, auCalme) {
  const pdts = csPdtDuJour(c);
  if (!pdts.length) { if (!auCalme) alert(c.date ? 'Aucun PDT de ce projet n\'a cette date.' : 'Choisis d\'abord la date de la callsheet.'); return false; }
  c.schedules = pdts.map(d => csSch(pdtType(d) === 'photo' ? 'SCHEDULE PHOTO' : 'SCHEDULE VIDEO', csScheduleDuPdt(d)));
  // La partie (photo ou vidéo) qui n'a pas de PDT ce jour-là garde un bloc vide à remplir
  const p = pjById(c.projetId);
  if (p) csPistes(p).forEach(k => {
    const t = k === 'photo' ? 'SCHEDULE PHOTO' : 'SCHEDULE VIDEO';
    if (k && !c.schedules.some(s => s.titre === t)) c.schedules.push(csSch(t, ''));
  });
  // Le lieu et les horaires de la journée, s'ils sont vides
  const debuts = pdts.map(d => pdtMin(d.debut)).filter(x => x != null), fins = pdts.map(csFinPdt).filter(x => x != null);
  if (!c.timing && debuts.length && fins.length) c.timing = `${pdtHh(Math.min(...debuts))} - ${pdtHh(Math.max(...fins))}`;
  if (!c.lieu && pdts[0].lieu) c.lieu = pdts[0].lieu;
  return true;
}
function csReprendrePdt() {
  const c = csCur();
  if (!c) return;
  if (c.schedules.some(s => csSchLignes(s).length) && csPdtDuJour(c).length && !confirm('Remplacer le déroulé par celui des PDT de ce jour ?')) return;
  if (csSchedulesDesPdt(c)) { csChange(); csRedessiner(); }
}

// ── Ouvrir, revenir ──────────────────────────────────────────────────────────
function csOuvrir(id) { csId = id; pjGo('cs'); }
function csRetour() {
  const c = csCur();
  if (c && pjById(c.projetId)) { pjGo('projet', c.projetId); pjSetOnglet('callsheet'); }
  else pjGo('liste');
}
function csTitreCourt(c) { return `CALLSHEET · JOUR ${c.jour != null ? c.jour : 1}${c.date ? ' · ' + tsDateCourte(c.date).toUpperCase() : ''}`; }

// Onglet CALLSHEETS de la page d'un projet
function pjCallsheetsHtml(p) {
  const siennes = csDuProjet(p.id);
  const gens = c => c.sections.reduce((n, s) => n + s.lignes.filter(l => l.nom).length, 0);
  return `<section class="ts-bloc">
    <h3>CALLSHEETS${siennes.length ? ` <small class="pj-muted">· ${siennes.length}</small>` : ''}</h3>
    ${siennes.length ? `<div class="pj-ts-liste">${siennes.map(c => `<div class="pj-ts-ligne" onclick="csOuvrir(${c.id})">
        <span class="pj-nom"><span class="ch-dot" style="background:#141414"></span>FEUILLE DE SERVICE · JOUR ${c.jour != null ? c.jour : 1}</span>
        <span class="pj-muted">${gens(c)} personne${gens(c) > 1 ? 's' : ''}${c.lieu ? ' · ' + esc(c.lieu) : ''}</span>
        <span class="pj-muted">${c.date ? esc(tsDateCourte(c.date)) : 'date à compléter'}</span>
      </div>`).join('')}</div>` : '<p class="field-hint">Aucune callsheet pour ce projet. Elle reprend le jour de tournage, le lieu, le déroulé des PDT du jour et l\'équipe du projet, avec leurs téléphones et leurs mails.</p>'}
    <div class="ts-add-row">
      <button type="button" class="btn-upload" onclick="csNouvelle(${p.id})">+ NOUVELLE CALLSHEET</button>
    </div>
  </section>`;
}

// ── Éditeur ──────────────────────────────────────────────────────────────────
// Deux façons de remplir une callsheet, comme le PDT : directement sur le document
// (par défaut sur ordinateur : tout se modifie, même les titres) ou avec le
// formulaire (par défaut sur téléphone). Choix gardé sur l'appareil.
let csSaveTimer = null, csApercuTimer = null;
let csMode = (() => { try { return localStorage.getItem('csMode') || ''; } catch { return ''; } })() || (window.innerWidth < 760 ? 'form' : 'doc');
function csSetMode(m) {
  csMode = m === 'form' ? 'form' : 'doc';
  try { localStorage.setItem('csMode', csMode); } catch {}
  csRedessiner();
}

function csReprendre(c) {
  const list = csList();
  const i = list.findIndex(x => x.id === c.id);
  if (i >= 0) list[i] = c; else list.push(c);
}

// ── Annuler / rétablir (Cmd/Ctrl + Z, Cmd/Ctrl + Maj + Z) ─────────────────────
// Des copies de la callsheet ouverte ; les frappes rapprochées ne font qu'une étape.
let csHist = { id: null, avant: [], apres: [], etat: null, timer: null };
let csSansHist = false;
function csHistPret() {
  const c = csCur();
  if (c && csHist.id !== c.id) { clearTimeout(csHist.timer); csHist = { id: c.id, avant: [], apres: [], etat: pdtClone(c), timer: null }; }
  return c;
}
// La frappe se regroupe en une étape d'annulation (700 ms sans taper) ; chaque
// action (ajouter, déplacer, choisir un nom…) est une étape à elle seule.
let csFrappe = false;
function csHistNote() {
  const c = csHistPret();
  if (!c) return;
  if (csHist.timer) {
    clearTimeout(csHist.timer); csHist.timer = null;
    // fin de la frappe en cours : l'état d'avant l'action est celui de la dernière touche
    if (!csFrappe) csHist.etat = csHist.dernier;
  }
  if (!csFrappe || !csHist.enFrappe) {
    csHist.avant.push(csHist.etat);
    if (csHist.avant.length > 80) csHist.avant.shift();
    csHist.apres = [];
  }
  if (csFrappe) {
    csHist.enFrappe = true;
    csHist.dernier = pdtClone(c);
    csHist.timer = setTimeout(() => { csHist.timer = null; csHist.enFrappe = false; const x = csCur(); if (x && x.id === csHist.id) csHist.etat = pdtClone(x); }, 700);
  } else {
    csHist.enFrappe = false;
    csHist.etat = pdtClone(c);
  }
  csMajBoutonsHist();
}
function csAnnuler(sens) {
  const c = csHistPret();
  if (!c) return;
  clearTimeout(csHist.timer); csHist.timer = null; csHist.enFrappe = false;
  const de = sens < 0 ? csHist.avant : csHist.apres, vers = sens < 0 ? csHist.apres : csHist.avant;
  if (!de.length) return;
  vers.push(pdtClone(c));
  const x = de.pop();
  Object.keys(c).forEach(k => delete c[k]);
  Object.assign(c, pdtClone(x));
  csHist.etat = pdtClone(c);
  csSansHist = true;
  csChange();
  csSansHist = false;
  buildTabs();
  csRedessiner();
}
function csMajBoutonsHist() {
  const a = document.querySelector('.cs-editor .annuler'), r = document.querySelector('.cs-editor .retablir');
  if (a) a.disabled = !csHist.avant.length;
  if (r) r.disabled = !csHist.apres.length;
}
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || !document.querySelector('.cs-editor')) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  e.preventDefault();
  csAnnuler(k === 'y' || e.shiftKey ? 1 : -1);
}, true);

function csChangeFrappe() { csFrappe = true; try { csChange(); } finally { csFrappe = false; } }
function csChange() {
  const c = csCur();
  if (!c) return;
  if (!csSansHist) csHistNote();
  c.maj = Date.now();
  clearTimeout(csSaveTimer);
  csSaveTimer = setTimeout(() => { csSaveTimer = null; saveDb(); }, 900);
  clearTimeout(csApercuTimer);
  csApercuTimer = setTimeout(csMajApercu, 250);
}
function csRedessiner() {
  const main = document.getElementById('main-content');
  if (main && document.querySelector('.cs-editor')) renderCsEditor(main);
}
function csSection(sid) { const c = csCur(); return c && c.sections.find(s => s.id === sid); }
function csLigne(sid, lid) { const s = csSection(sid); return s && s.lignes.find(l => l.id === lid); }
function csSchBloc(id) { const c = csCur(); return c && (c.schedules || []).find(s => s.id === id); }
// L'objet que vise un champ : data-s (+ data-l) un groupe (ou une personne),
// data-sch (+ data-sl) un bloc de déroulé (ou une de ses lignes), sinon la callsheet
function csCible(ds) {
  const c = csCur();
  if (!c) return null;
  if (ds.sch) { const b = csSchBloc(ds.sch); return b && ds.sl ? csSchLignes(b).find(l => l.id === ds.sl) : b; }
  if (ds.s) return ds.l ? csLigne(ds.s, ds.l) : csSection(ds.s);
  return c;
}

// Un champ du formulaire (ou de la barre au-dessus du document)
function csInput(el) {
  const c = csCur();
  if (!c) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  const k = el.dataset.k;
  if (el.dataset.col) {
    const cols = csColsListe(c).filter(x => x !== el.dataset.col);
    if (v) { const i = cols.indexOf('call'); cols.splice(el.dataset.col === 'call' || i < 0 ? cols.length : i, 0, el.dataset.col); }
    c.cols = cols;
  } else if (el.dataset.sch && k === 'texte') {
    const b = csSchBloc(el.dataset.sch);
    if (b) b.lignes = csSchDepuisTexte(v);
  } else if (el.dataset.s || el.dataset.sch) {
    const cible = csCible(el.dataset);
    if (!cible) return;
    cible[k] = v;
  } else {
    c[k] = v;
    if (k === 'date') delete c.dateTexte;
    if (k === 'jour' || k === 'date') buildTabs();
    if (k === 'client' && !c.logo) { const l = prodData().logos[tsCleClient(c.client)]; if (l) { c.logo = l; csLogoMaj(); } }
  }
  el.type === 'checkbox' ? csChange() : csChangeFrappe();
}

function csField(label, k, v, o = {}) {
  const attrs = `data-k="${k}"${o.s ? ` data-s="${o.s}"` : ''}${o.l ? ` data-l="${o.l}"` : ''}${o.sch ? ` data-sch="${o.sch}"` : ''}`;
  let input;
  if (o.textarea) input = `<textarea rows="${o.rows || 3}" ${attrs} oninput="csInput(this)" placeholder="${esc(o.ph || '')}">${esc(v == null ? '' : v)}</textarea>`;
  else input = `<input type="${o.type || 'text'}" ${attrs} value="${esc(v == null ? '' : v)}" placeholder="${esc(o.ph || '')}"${o.list ? ` list="${o.list}"` : ''}${o.min != null ? ` min="${o.min}"` : ''} oninput="csInput(this)"${o.onchange ? ` onchange="${o.onchange}"` : ''}>`;
  return `<div class="field${o.full ? ' full' : ''}${o.cls ? ' ' + o.cls : ''}">${label ? `<label>${esc(label)}</label>` : ''}${input}</div>`;
}

// Les noms proposés : l'équipe du projet d'abord, puis l'OPTIONS TEAM, puis la bible et les contacts
function csChoix(p) {
  const out = [], vus = new Set();
  const add = (nom, info, equipe) => { const n = pjNorm(nom); if (!n || vus.has(n)) return; vus.add(n); out.push({ nom: String(nom).trim(), info, equipe }); };
  if (p) {
    (p.equipe || []).forEach(a => add(pjNomPersonne(a), [a.role, 'équipe du projet'].filter(Boolean).join(' · '), true));
    (p.options || []).forEach(o => add(o.nom, [o.role, 'options team'].filter(Boolean).join(' · '), true));
  }
  pjChoixGens().forEach(g => add(g.label.split(' · ')[0], g.label.split(' · ').slice(1).join(' · ')));
  return out;
}
function csLieuxChoix() {
  const out = [CS_WIDEN_ADRESSE, 'OWN'];
  lieuxList().forEach(l => { const t = [l.nom, l.adresse].filter(Boolean).join(' - '); if (t) out.push(t); });
  const c = csCur();
  if (c) c.sections.forEach(s => s.lignes.forEach(l => { if (l.pickupLieu) out.push(l.pickupLieu); }));
  return [...new Set(out)];
}
// Un lien Google Maps pour une adresse ou un lieu de la bible
function csLienLieu(t) {
  t = String(t || '').trim();
  if (!t || /^own\b/i.test(t) || /^(tbc|tbd)\s*\??$/i.test(t)) return '';
  const n = pjNorm(t);
  const l = lieuxList().find(x => x.nom && (pjNorm(x.nom) === n || n.startsWith(pjNorm(x.nom) + ' -')));
  if (l && /^https?:\/\//.test(l.lien || '')) return l.lien;
  const g = l && typeof parseGps === 'function' ? parseGps(l.gps) : null;
  if (g) return `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((l && l.adresse) || t.replace(/^basecamp\s*:\s*/i, ''))}`;
}

// Remplit une ligne avec ce qu'on sait de la personne (poste s'il est vide, téléphone, mail)
function csRemplirLigne(l, p, ecraser) {
  const a = p && (p.equipe || []).find(x => pjNorm(pjNomPersonne(x)) === pjNorm(l.nom));
  const inf = csInfos(l.nom, a ? a.ref : null, p);
  let n = 0;
  const poste = (a && a.role) || inf.role;
  if (!l.poste && poste) { l.poste = poste; n++; }
  ['tel', 'mail'].forEach(k => { if (inf[k] && (ecraser ? inf[k] !== l[k] : !l[k])) { l[k] = inf[k]; if (l.html) delete l.html[k]; n++; } });
  l.aid = a ? a.id : null;
  return n;
}
// Un nom choisi ou tapé dans le formulaire
function csNomChoisi(el) {
  const c = csCur(), l = csLigne(el.dataset.s, el.dataset.l);
  if (!l) return;
  if (csRemplirLigne(l, pjById(c.projetId), true)) { csChange(); csRedessiner(); }
}
// Lieu choisi dans un groupe STUDIO / LOCATION : son adresse
function csLieuChoisi(el) {
  const l = csLigne(el.dataset.s, el.dataset.l);
  if (!l) return;
  const x = lieuxList().find(y => pjNorm(y.nom) === pjNorm(l.nom));
  if (x && x.adresse && !l.adresse) { l.adresse = x.adresse; if (!l.tel && x.tel) l.tel = x.tel; csChange(); csRedessiner(); }
}

// Remplit ce qui manque (poste, téléphone, mail) pour toutes les personnes
function csMajInfos() {
  const c = csCur(), p = c && pjById(c.projetId);
  if (!c) return;
  let n = 0;
  c.sections.forEach(s => s.lignes.forEach(l => { if (l.nom && s.cle !== 'lieux') n += csRemplirLigne(l, p, false); }));
  csMsg(n ? `${n} info${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}.` : 'Rien à compléter : les infos manquantes ne sont ni dans l\'OPTIONS TEAM, ni dans la bible.');
  if (n) { csChange(); csRedessiner(); }
}
// Ajoute les gens du projet pris ce jour-là qui ne sont pas encore sur la callsheet
function csAjouterEquipe() {
  const c = csCur(), p = c && pjById(c.projetId);
  if (!p) return;
  const deja = new Set(c.sections.flatMap(s => s.lignes.map(l => pjNorm(l.nom))));
  const nouveaux = csGensDuJour(p, c.date).filter(a => !deja.has(pjNorm(pjNomPersonne(a))));
  if (!nouveaux.length) { csMsg('Toute l\'équipe du jour est déjà sur la callsheet.'); return; }
  csRanger(c, nouveaux, p);
  csChange();
  csMsg(`${nouveaux.length} personne${nouveaux.length > 1 ? 's' : ''} ajoutée${nouveaux.length > 1 ? 's' : ''} : ${nouveaux.map(pjNomPersonne).join(', ')}.`);
  csRedessiner();
}
let csMsgTexte = '';
function csMsg(t) { csMsgTexte = t; const m = document.getElementById('cs-msg'); if (m) m.textContent = t; }

const csLigneVide = () => ({ id: csLid(), poste: '', nom: '', tel: '', mail: '', pickup: '', pickupLieu: '', vehicule: '', hebergement: '', call: '' });
// v : l'id d'une personne de l'équipe, ou 'vide'. apres : l'id de la ligne après laquelle l'ajouter
function csAjouterPersonne(sid, v, apres) {
  const c = csCur(), p = c && pjById(c.projetId), s = csSection(sid);
  if (!s || !v) return;
  const a = p && (p.equipe || []).find(x => String(x.id) === String(v));
  const l = a ? csLigneDe(a, p) : csLigneVide();
  const i = apres ? s.lignes.findIndex(x => x.id === apres) : -1;
  if (i >= 0) s.lignes.splice(i + 1, 0, l); else s.lignes.push(l);
  csChange();
  csRedessiner();
  if (!a) csFocus(`.ed[data-l="${l.id}"][data-k="nom"]`);
}
function csFocus(sel) {
  const el = document.querySelector('.cs-editor ' + sel);
  if (!el) return;
  el.focus();
  if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel2 = getSelection(); sel2.removeAllRanges(); sel2.addRange(r); }
}
function csLigneRetirer(sid, lid) { const s = csSection(sid); if (!s) return; s.lignes = s.lignes.filter(l => l.id !== lid); csChange(); csRedessiner(); }
function csLigneCopier(sid, lid) {
  const s = csSection(sid);
  if (!s) return;
  const i = s.lignes.findIndex(l => l.id === lid);
  if (i < 0) return;
  s.lignes.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(s.lignes[i])), id: csLid() });
  csChange(); csRedessiner();
}
function csLigneDeplacer(sid, lid, sens) {
  const s = csSection(sid);
  if (!s) return;
  const i = s.lignes.findIndex(l => l.id === lid), j = i + sens;
  if (i < 0 || j < 0 || j >= s.lignes.length) return;
  [s.lignes[i], s.lignes[j]] = [s.lignes[j], s.lignes[i]];
  csChange(); csRedessiner();
}
// Déplace une personne dans un autre groupe (à la fin, ou avant la ligne « avant »)
function csLigneVers(sid, lid, vers, avant) {
  const s = csSection(sid), d = csSection(vers);
  if (!s || !d) return;
  const l = s.lignes.find(x => x.id === lid);
  if (!l || l.id === avant) return csRedessiner();
  s.lignes = s.lignes.filter(x => x !== l);
  const j = avant ? d.lignes.findIndex(x => x.id === avant) : -1;
  if (j >= 0) d.lignes.splice(j, 0, l); else d.lignes.push(l);
  csChange(); csRedessiner();
}
// Une valeur pour toutes les personnes d'un groupe (call, pick-up, véhicule…)
function csAppliquer(sid, k, v) {
  const s = csSection(sid);
  if (!s || !k) return;
  s.lignes.forEach(l => { l[k] = v; if (l.html) delete l.html[k]; });
  csChange(); csRedessiner();
}
function csAppliquerDemande(sid, k) {
  const c = csCur(), s = csSection(sid);
  if (!s || !k) return;
  const v = prompt(`${csColTitre(c, k)} pour tout le groupe ${s.titre} :`);
  if (v !== null) csAppliquer(sid, k, v.trim());
}
function csSectionAjouter(apres) {
  const c = csCur();
  if (!c) return;
  const s = { id: csLid(), cle: 'autres', titre: 'NOUVEAU GROUPE', lignes: [] };
  const i = apres ? c.sections.findIndex(x => x.id === apres) : -1;
  if (i >= 0) c.sections.splice(i + 1, 0, s); else c.sections.push(s);
  csChange(); csRedessiner();
  csFocus(`.ed[data-s="${s.id}"][data-k="titre"]:not([data-l])`);
}
function csSectionRetirer(sid) {
  const c = csCur(), s = csSection(sid);
  if (!c || !s) return;
  if (s.lignes.some(l => l.nom) && !confirm(`Retirer le groupe ${s.titre} et ses ${s.lignes.length} ligne(s) ?`)) return;
  c.sections = c.sections.filter(x => x !== s);
  csChange(); csRedessiner();
}
function csSectionDeplacer(sid, sens) {
  const c = csCur();
  if (!c) return;
  const i = c.sections.findIndex(s => s.id === sid), j = i + sens;
  if (i < 0 || j < 0 || j >= c.sections.length) return;
  [c.sections[i], c.sections[j]] = [c.sections[j], c.sections[i]];
  csChange(); csRedessiner();
}
function csScheduleAjouter() { const c = csCur(); if (!c) return; const b = csSch('SCHEDULE', ''); b.lignes.push({ id: csLid(), h: '', t: '' }); c.schedules.push(b); csChange(); csRedessiner(); }
function csScheduleRetirer(id) {
  const c = csCur(), b = csSchBloc(id);
  if (!b || (csSchLignes(b).some(l => l.h || l.t) && !confirm(`Retirer le bloc ${b.titre} ?`))) return;
  c.schedules = c.schedules.filter(s => s.id !== id);
  csChange(); csRedessiner();
}
function csSchLigneAjouter(id, apres) {
  const b = csSchBloc(id);
  if (!b) return;
  const l = { id: csLid(), h: '', t: '' };
  const ls = csSchLignes(b), i = apres ? ls.findIndex(x => x.id === apres) : -1;
  if (i >= 0) ls.splice(i + 1, 0, l); else ls.push(l);
  csChange(); csRedessiner();
  csFocus(`.ed[data-sl="${l.id}"][data-k="h"]`);
}
function csSchLigneRetirer(id, lid) { const b = csSchBloc(id); if (!b) return; b.lignes = csSchLignes(b).filter(l => l.id !== lid); csChange(); csRedessiner(); }

// ── Colonnes du tableau (sur le document) ────────────────────────────────────
function csColAjouter(pos) {
  const c = csCur();
  if (!c) return;
  const cols = csColsListe(c).slice();
  let n = 1;
  while (cols.includes('x' + n)) n++;
  cols.splice(pos, 0, 'x' + n);
  c.cols = cols;
  c.textes = c.textes || {};
  if (c.textes['col_x' + n] == null) c.textes['col_x' + n] = 'COLONNE';
  csChange(); csRedessiner();
}
function csColDeplacer(k, sens) {
  const c = csCur();
  if (!c) return;
  const cols = csColsListe(c).slice(), i = cols.indexOf(k), j = i + sens;
  if (i < 0 || j < 0 || j >= cols.length) return;
  [cols[i], cols[j]] = [cols[j], cols[i]];
  c.cols = cols;
  csChange(); csRedessiner();
}
function csColRetirer(k) {
  const c = csCur();
  if (!c || CS_COLS_FIXES.includes(k)) return;
  if (!confirm(`Retirer la colonne ${csColTitre(c, k)} ?`)) return;
  c.cols = csColsListe(c).filter(x => x !== k);
  csChange(); csRedessiner();
}
// Tirer le bord droit d'un titre : la colonne s'élargit, sa voisine de droite rétrécit (double-clic : par défaut)
function csRedimDebut(e, h) {
  e.preventDefault();
  const c = csCur(), th = h.closest('th'), table = th.closest('table');
  const cols = table.querySelectorAll('col');
  const j = th.cellIndex;
  if (e.detail > 1) { delete c.largeurs; csChange(); return csRedessiner(); }
  const tw = table.getBoundingClientRect().width;
  const ws = csLargeurs(c);
  const x0 = e.clientX, a0 = ws[j], b0 = ws[j + 1];
  document.body.classList.add('pdt-redim-en-cours');
  const bouge = ev => {
    const a = Math.min(a0 + b0 - 3, Math.max(3, a0 + (ev.clientX - x0) / tw * 100));
    ws[j] = Math.round(a * 100) / 100;
    ws[j + 1] = Math.round((a0 + b0 - a) * 100) / 100;
    cols[j].style.width = ws[j] + '%';
    cols[j + 1].style.width = ws[j + 1] + '%';
  };
  const fin = () => {
    document.removeEventListener('mousemove', bouge);
    document.removeEventListener('mouseup', fin);
    document.body.classList.remove('pdt-redim-en-cours');
    c.largeurs = {};
    csColsListe(c).forEach((k, i) => { c.largeurs[k] = ws[i]; });
    csChange();
  };
  document.addEventListener('mousemove', bouge);
  document.addEventListener('mouseup', fin);
}

function csSupprimer() {
  const c = csCur();
  if (!c || !confirm('Supprimer cette callsheet ?')) return;
  prodData().callsheets = csList().filter(x => x.id !== c.id);
  clearTimeout(csSaveTimer); csSaveTimer = null;
  saveDb();
  csRetour();
}

// Logo du client (le même que pour les travel sheets et les PDT, gardé par client)
function csLogoZoneHtml(c) {
  return `<label>LOGO DU CLIENT</label>
    <div class="ts-logo-row">
      ${c.logo ? `<img class="ts-logo-actuel" src="${esc(c.logo)}" alt="">` : '<span class="field-hint">Sans logo, le nom du client est écrit à la place.</span>'}
      <button type="button" class="btn-upload" onclick="csLogoChercher()">TROUVER LE LOGO</button>
      <label class="btn-upload">FICHIER<input type="file" accept="image/*,.svg" hidden onchange="csLogoFichier(this.files[0])"></label>
      ${c.logo ? '<button type="button" class="btn-upload" onclick="csLogoMettre(\'\')">RETIRER</button>' : ''}
    </div>
    <div class="field-hint" id="cs-logo-msg"></div>`;
}
function csLogoMaj(msg) {
  const z = document.getElementById('cs-logo-zone'), c = csCur();
  if (z && c) z.innerHTML = csLogoZoneHtml(c);
  const m = document.getElementById('cs-logo-msg');
  if (m && msg) m.textContent = msg;
}
function csLogoMettre(png) {
  const c = csCur();
  if (!c) return;
  c.logo = png;
  if (png && c.client) prodData().logos[tsCleClient(c.client)] = png;
  csChange();
  if (csMode !== 'form') csRedessiner();
  csLogoMaj();
}
async function csLogoFichier(f) {
  if (!f) return;
  try { csLogoMettre(await tsLogoPng(await tsLogoDataUrl(f))); }
  catch (e) { csLogoMaj('Logo : ' + e.message); }
}
async function csLogoChercher() {
  const c = csCur();
  if (!c) return;
  if (!tsCleClient(c.client)) { csLogoMaj('Écris d\'abord le nom du client.'); return; }
  csLogoMaj(`Recherche du logo ${c.client}…`);
  try {
    for (const src of await tsLogoServeur({ client: c.client.trim() })) {
      try { csLogoMettre(await tsLogoPng(src)); csLogoMaj('Logo trouvé. Si ce n\'est pas le bon, ajoute le fichier.'); return; } catch {}
    }
    throw new Error('aucune image lisible.');
  } catch (e) { csLogoMaj('Logo : ' + e.message); }
}

function renderCsEditor(main) {
  csHistPret();
  const c = csCur();
  csColsListe(c);
  (c.schedules || []).forEach(csSchLignes);
  if (csMode !== 'form') { renderCsDoc(main); return; }
  renderCsForm(main);
}

// Les boutons communs aux deux modes
function csBoutonsEquipeHtml(c) {
  const nbPdt = csPdtDuJour(c).length;
  return `<button type="button" class="btn-upload" onclick="csAjouterEquipe()" title="Ajoute les gens du projet pris ce jour-là qui ne sont pas encore sur la callsheet">+ L'ÉQUIPE DU JOUR</button>
    <button type="button" class="btn-upload" onclick="csMajInfos()" title="Remplit les téléphones et mails vides (OPTIONS TEAM, bible, contacts)">COMPLÉTER TÉLÉPHONES ET MAILS</button>
    <button type="button" class="btn-upload" onclick="csReprendrePdt()"${nbPdt ? '' : ' title="Aucun PDT de ce projet n\'a cette date"'}>REPRENDRE LE DÉROULÉ DES PDT${nbPdt ? ` (${nbPdt})` : ''}</button>`;
}

// ── Formulaire (téléphone) ───────────────────────────────────────────────────
function renderCsForm(main) {
  const c = csCur();
  const p = pjById(c.projetId);
  const scroll = window.scrollY;
  const cols = csColsListe(c);
  const choix = csChoix(p);
  const dans = new Set(c.sections.flatMap(s => s.lignes.map(l => pjNorm(l.nom))));
  const equipe = p ? (p.equipe || []).filter(a => pjNomPersonne(a)) : [];
  const champs = cols.filter(k => !['pos', 'nom'].includes(k));
  const ligneHtml = (s, l, i) => {
    const o = { s: s.id, l: l.id };
    const outils = `<div class="cs-ligne-outils">
        <button type="button" class="ts-x" onclick="csLigneDeplacer('${s.id}', '${l.id}', -1)" title="Monter"${i ? '' : ' disabled'}>↑</button>
        <button type="button" class="ts-x" onclick="csLigneDeplacer('${s.id}', '${l.id}', 1)" title="Descendre"${i < s.lignes.length - 1 ? '' : ' disabled'}>↓</button>
        ${c.sections.length > 1 ? `<select class="cs-vers" title="Déplacer dans un autre groupe" onchange="csLigneVers('${s.id}', '${l.id}', this.value)"><option value="">→</option>${c.sections.filter(x => x !== s).map(x => `<option value="${x.id}">${esc(x.titre)}</option>`).join('')}</select>` : ''}
        <button type="button" class="ts-x" onclick="csLigneRetirer('${s.id}', '${l.id}')" title="Retirer">✕</button>
      </div>`;
    if (s.cle === 'lieux') return `<div class="cs-ligne cs-ligne-lieu"><div class="cs-l">
      ${csField('LIEU', 'nom', l.nom, { ...o, list: 'cs-lieux-noms', ph: 'Bureau Simond', onchange: 'csLieuChoisi(this)' })}
      ${csField('ADRESSE', 'adresse', l.adresse, { ...o, ph: '150 Rte des Papillons, 74400 Chamonix', cls: 'cs-large' })}
      ${csField('TÉLÉPHONE', 'tel', l.tel, o)}
      ${csField('HORAIRE', 'call', l.call, { ...o, ph: 'OWN', cls: 'cs-court' })}
      ${outils}</div></div>`;
    const champ = k => csField(csColTitre(c, k), k, l[k], { ...o, type: k === 'mail' ? 'email' : 'text', ph: k === 'call' && c.callDefaut ? c.callDefaut : '', cls: ['call', 'pickup'].includes(k) ? 'cs-court' : ['pickupLieu', 'mail'].includes(k) ? 'cs-large' : '', list: k === 'pickupLieu' ? 'cs-lieux' : k === 'vehicule' ? 'cs-vehicules' : '' });
    return `<div class="cs-ligne"><div class="cs-l">
      ${csField(csColTitre(c, 'pos'), 'poste', l.poste, { ...o, ph: 'DOP' })}
      ${csField(csColTitre(c, 'nom'), 'nom', l.nom, { ...o, list: 'cs-gens', ph: 'Choisis ou écris un nom', onchange: 'csNomChoisi(this)' })}
      ${champs.filter(k => ['tel', 'mail'].includes(k)).map(champ).join('')}
      </div><div class="cs-l">
      ${champs.filter(k => !['tel', 'mail'].includes(k)).map(champ).join('')}
      ${outils}</div></div>`;
  };
  main.innerHTML = `<div class="ts-editor cs-editor">
    <div class="ts-form">
      <div class="ts-actions cs-mode"><span class="field-hint">Formulaire</span><div class="spacer"></div><button type="button" class="btn-cancel" onclick="csSetMode('doc')">MODIFIER SUR LE DOCUMENT</button></div>
      <section class="ts-bloc">
        <h3>EN-TÊTE</h3>
        <div class="ts-grid">
          ${csField('DATE', 'date', c.date, { type: 'date', onchange: 'csRedessiner()' })}
          ${csField('JOUR N°', 'jour', c.jour != null ? c.jour : 1)}
          ${csField('CLIENT', 'client', c.client, { ph: 'ex : Simond' })}
          ${csField('PRODUCTION TITLE', 'titre', c.titre, { ph: 'ex : Simond Avant Garde' })}
          ${csField('CRÉDITS', 'credits', c.credits, { full: true, ph: 'Photographer : Célian Durand / Director : Evan Ravo' })}
          ${csField('LOCATION', 'lieu', c.lieu, { ph: 'ex : Simond / Decathlon Mountain Store', list: 'cs-lieux-noms' })}
          ${csField('TIMING', 'timing', c.timing, { ph: 'ex : 14:00 - 04:30' })}
          ${csField('BASECAMP', 'basecamp', c.basecamp, { full: true, list: 'cs-lieux', ph: 'ex : Simond - 150 Rte des Papillons, 74400 Chamonix-Mont-Blanc' })}
          ${csField('MÉTÉO (FACULTATIF)', 'meteo', c.meteo, { full: true, ph: 'ex : Nuageux · 2°C / -4°C' })}
          <div class="field full ts-logo" id="cs-logo-zone">${csLogoZoneHtml(c)}</div>
        </div>
      </section>

      <section class="ts-bloc">
        <h3>DÉROULÉ DE LA JOURNÉE</h3>
        <p class="field-hint">Une ligne par horaire : « 14:00 - 16:00 Installation ». Une ligne sans heure (« avec Models + Figurants ») s'écrit plus discrètement sous la précédente.</p>
        <div class="cs-schedules">${(c.schedules || []).map(s => `<div class="cs-schedule">
          <div class="cs-schedule-hdr">${csField('TITRE', 'titre', s.titre, { sch: s.id })}<button type="button" class="ts-x" onclick="csScheduleRetirer('${s.id}')" title="Retirer">✕</button></div>
          ${csField('', 'texte', csSchTexte(s), { sch: s.id, textarea: true, rows: 7, full: true, ph: '14:00 - 16:00   Installation\n16:00 - 17:00   Shoot\navec Models + Figurants' })}
        </div>`).join('')}</div>
        <div class="ts-add-row"><button type="button" class="btn-upload" onclick="csScheduleAjouter()">+ BLOC</button></div>
      </section>

      <section class="ts-bloc">
        <h3>CREW NOTE</h3>
        ${csField('', 'note', c.note, { textarea: true, rows: 3, full: true })}
      </section>

      <section class="ts-bloc cs-equipe">
        <h3>ÉQUIPE</h3>
        <p class="field-hint">Choisis une personne dans la liste (équipe du projet, OPTIONS TEAM de la fiche de suivi, bible) : son poste, son téléphone et son mail se remplissent tout seuls.</p>
        <div class="ts-grid cs-grid-haut">
          ${csField('CALL TIME PAR DÉFAUT', 'callDefaut', c.callDefaut, { ph: 'ex : 14:00' })}
          <div class="field"><label>COLONNES DU TABLEAU</label><div class="cs-cols">${CS_COLS.map(([k, lab]) => `<label class="cat-check"><input type="checkbox" data-col="${k}" ${cols.includes(k) ? 'checked' : ''} onchange="csInput(this); csRedessiner()"><span>${lab}</span></label>`).join('')}</div></div>
        </div>
        <div class="ts-add-row">${csBoutonsEquipeHtml(c)}</div>
        <div class="field-hint" id="cs-msg">${esc(csMsgTexte)}</div>
        ${c.sections.map((s, si) => `<div class="cs-groupe">
          <div class="cs-groupe-hdr">
            <input class="cs-groupe-titre" data-k="titre" data-s="${s.id}" value="${esc(s.titre)}" oninput="csInput(this)" aria-label="Titre du groupe">
            <small class="pj-muted">${s.lignes.length}</small>
            <div class="spacer"></div>
            ${s.lignes.length && s.cle !== 'lieux' ? `<select class="filter-sel" title="Mettre la même valeur à tout le groupe" onchange="csAppliquerDemande('${s.id}', this.value); this.value=''">
              <option value="">Tout le groupe…</option>${champs.map(k => `<option value="${k}">${esc(csColTitre(c, k))}</option>`).join('')}
            </select>` : ''}
            <button type="button" class="ts-x" onclick="csSectionDeplacer('${s.id}', -1)" title="Monter le groupe"${si ? '' : ' disabled'}>↑</button>
            <button type="button" class="ts-x" onclick="csSectionDeplacer('${s.id}', 1)" title="Descendre le groupe"${si < c.sections.length - 1 ? '' : ' disabled'}>↓</button>
            <button type="button" class="ts-x" onclick="csSectionRetirer('${s.id}')" title="Retirer le groupe">✕</button>
          </div>
          <div class="cs-lignes">${s.lignes.map((l, i) => ligneHtml(s, l, i)).join('') || '<p class="field-hint">Personne dans ce groupe.</p>'}</div>
          <div class="ts-add-row">
            <button type="button" class="btn-upload" onclick="csAjouterPersonne('${s.id}', 'vide')">+ ${s.cle === 'lieux' ? 'LIEU' : 'LIGNE'}</button>
            ${s.cle !== 'lieux' && equipe.length ? `<select class="filter-sel" onchange="csAjouterPersonne('${s.id}', this.value)">
              <option value="">Ajouter quelqu'un de l'équipe du projet…</option>
              ${equipe.map(a => `<option value="${a.id}">${dans.has(pjNorm(pjNomPersonne(a))) ? '✓ ' : ''}${esc(pjNomPersonne(a) + (a.role ? ' · ' + a.role : ''))}</option>`).join('')}
            </select>` : ''}
          </div>
        </div>`).join('')}
        <div class="ts-add-row"><button type="button" class="btn-upload" onclick="csSectionAjouter()">+ GROUPE</button></div>
        <datalist id="cs-gens">${choix.map(g => `<option value="${esc(g.nom)}">${esc(g.info)}</option>`).join('')}</datalist>
        <datalist id="cs-lieux">${csLieuxChoix().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <datalist id="cs-lieux-noms">${lieuxList().filter(l => l.nom).map(l => `<option value="${esc(l.nom)}">${esc(l.adresse || '')}</option>`).join('')}</datalist>
        <datalist id="cs-vehicules">${[...new Set([...CS_VEHICULES, ...c.sections.flatMap(s => s.lignes.map(l => l.vehicule).filter(Boolean))])].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      </section>

      <div class="ts-actions">
        <button type="button" class="btn-del" onclick="csSupprimer()">✕ SUPPRIMER</button>
        <div class="spacer"></div>
        <button type="button" class="btn-cancel" onclick="csDupliquer()">DUPLIQUER POUR LE JOUR SUIVANT</button>
        <button type="button" class="btn-save" onclick="csPdf()">CRÉER LE PDF</button>
      </div>
    </div>
    <div class="ts-apercu-col">
      <div class="ts-apercu-lbl">APERÇU</div>
      <div class="ts-apercu-cadre"><iframe id="cs-apercu" title="Aperçu de la callsheet"></iframe></div>
    </div>
  </div>`;
  window.scrollTo(0, scroll);
  csMajApercu();
}

// ── Sur le document (ordinateur) ─────────────────────────────────────────────
// Toute la feuille se modifie à l'endroit où elle s'imprime : on clique dans une
// case pour écrire ; les outils d'une ligne apparaissent dans la marge au survol.
function renderCsDoc(main) {
  const c = csCur();
  const p = pjById(c.projetId);
  const scroll = window.scrollY;
  main.innerHTML = `<div class="cs-editor pdt-ed-page">
    <div class="pdt-ed-barre">
      <div class="field"><label>DATE</label><input type="date" data-k="date" value="${esc(c.date || '')}" oninput="csInput(this)" onchange="csRedessiner()"></div>
      <div class="field"><label>CALL TIME PAR DÉFAUT</label><input data-k="callDefaut" value="${esc(c.callDefaut || '')}" placeholder="ex : 14:00" oninput="csInput(this); csMajCallsDoc()"></div>
      <div class="field"><label>CLIENT</label><input data-k="client" value="${esc(c.client || '')}" placeholder="ex : Simond" oninput="csInput(this)" onchange="csRedessiner()"></div>
      <div class="field ts-logo" id="cs-logo-zone">${csLogoZoneHtml(c)}</div>
      <div class="spacer"></div>
      <div class="pdt-ed-actions">
        <button type="button" class="btn-del" onclick="csSupprimer()">✕ SUPPRIMER</button>
        <button type="button" class="btn-cancel" onclick="csSetMode('form')">FORMULAIRE</button>
        <button type="button" class="btn-cancel" onclick="csDupliquer()">DUPLIQUER POUR LE JOUR SUIVANT</button>
        <button type="button" class="btn-save" onclick="csPdf()">CRÉER LE PDF</button>
      </div>
    </div>
    <div class="pdt-ed-barre cs-ed-barre2">${csBoutonsEquipeHtml(c)}<span class="field-hint" id="cs-msg">${esc(csMsgTexte)}</span></div>
    <p class="field-hint pdt-ed-aide">Clique dans une case pour écrire : tout se modifie, même les titres. Dans NAME, la liste propose l'équipe du projet et l'OPTIONS TEAM ; choisir quelqu'un remplit son poste, son téléphone et son mail. Passe sur une ligne pour ses outils dans la marge : ⠿ à glisser pour la déplacer (même dans un autre groupe), + ajouter dessous, ⧉ dupliquer, ✕ supprimer. Passe sur un titre de colonne pour en ajouter une (+), la déplacer (◂ ▸) ou la retirer (✕) ; tire son bord pour sa largeur. Sélectionne du texte pour la barre ci-dessous (gras, italique, couleur). Les groupes vides ne sont pas dans le PDF.</p>
    <div class="pdt-ed-outils" onmousedown="if (event.target.closest('button')) event.preventDefault()">
      <button type="button" class="annuler" title="Annuler (Cmd/Ctrl + Z)" onclick="csAnnuler(-1)"${csHist.avant.length ? '' : ' disabled'}>↶</button>
      <button type="button" class="retablir" title="Rétablir (Cmd/Ctrl + Maj + Z)" onclick="csAnnuler(1)"${csHist.apres.length ? '' : ' disabled'}>↷</button>
      <span class="sep"></span>
      <button type="button" class="b" title="Gras (Cmd/Ctrl + B)" onclick="pdtFormat('bold')">B</button>
      <button type="button" class="i" title="Italique (Cmd/Ctrl + I)" onclick="pdtFormat('italic')">I</button>
      <button type="button" class="u" title="Souligné (Cmd/Ctrl + U)" onclick="pdtFormat('underline')">U</button>
      <span class="sep"></span>
      ${[['#141414', 'Noir'], ['#9b1c1c', 'Rouge'], ['#2f5597', 'Bleu'], ['#2e7d32', 'Vert'], ['#c46a2b', 'Orange'], ['#8a8a86', 'Gris']].map(([col, n]) => `<button type="button" class="pastille" style="--c:${col}" title="Texte en ${n.toLowerCase()}" onclick="pdtFormat('foreColor', '${col}')"></button>`).join('')}
      <button type="button" title="Enlever la mise en forme" onclick="pdtFormat('removeFormat')">⌀</button>
    </div>
    <div class="pdt-ed-zone">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap">
      <style>${csDocCss(true, true)}</style>
      ${csDocCorps(c, true)}
    </div>
    <div class="pdt-zoom" title="Zoom sur le document (ou Ctrl + molette)">
      <button type="button" onclick="pdtZoomer(pdtZoom / 1.2)" title="Dézoomer">−</button>
      <button type="button" class="pdt-zoom-val" onclick="pdtZoomer(1)" title="Revenir à 100 %">${Math.round(pdtZoom * 100)} %</button>
      <button type="button" onclick="pdtZoomer(pdtZoom * 1.2)" title="Zoomer">+</button>
    </div>
  </div>`;
  pdtZoomer(pdtZoom);
  window.scrollTo(0, scroll);
  const zone = main.querySelector('.pdt-ed-zone');
  zone.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    pdtZoomer(pdtZoom * Math.exp(-e.deltaY / 500), e);
  }, { passive: false });
  zone.addEventListener('input', csEdInput);
  zone.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.ed[data-k="nom"][data-l]'); if (el) csSuggOuvrir(el); });
  zone.addEventListener('focusout', csEdSortie);
  zone.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.ed');
    if (!el) return;
    if (csSugg && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key) && csSuggTouche(e)) return;
    if (e.key !== 'Enter' || el.dataset.multi) return;
    e.preventDefault();
    // Entrée dans le déroulé : une nouvelle ligne dessous
    if (el.dataset.sl) return csSchLigneAjouter(el.dataset.sch, el.dataset.sl);
    el.blur();
  });
  zone.addEventListener('paste', e => {
    if (!e.target.closest('.ed')) return;
    e.preventDefault();
    let t = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!e.target.closest('.ed').dataset.multi) t = t.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, t);
  });
  // Glisser une personne par sa poignée ⠿ (même vers un autre groupe) ; tirer le bord d'une colonne
  zone.addEventListener('mousedown', e => {
    const r = e.target.closest('.pdt-redim');
    if (r) return csRedimDebut(e, r);
    const h = e.target.closest('.pdt-poignee');
    if (h) h.closest('tr').draggable = true;
  });
  zone.addEventListener('mouseup', () => zone.querySelectorAll('tr[draggable="true"]').forEach(tr => { if (!csGlisse) tr.draggable = false; }));
  zone.addEventListener('dragstart', e => {
    const tr = e.target.closest && e.target.closest('tr[data-l]');
    if (!tr || !tr.draggable) return;
    csGlisse = { s: tr.dataset.s, l: tr.dataset.l };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    tr.classList.add('pdt-glisse');
  });
  const cible = e => {
    let best = null, ecart = Infinity;
    zone.querySelectorAll('tr[data-l], tr.grp[data-s]').forEach(tr => {
      const r = tr.getBoundingClientRect();
      const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      if (d < ecart) { ecart = d; best = tr; }
    });
    if (!best) return null;
    const r = best.getBoundingClientRect();
    // Sur le titre d'un groupe : en tête du groupe ; sur une personne : au-dessus ou au-dessous
    if (!best.dataset.l) { const s = csSection(best.dataset.s); return { tr: best, bas: true, s: best.dataset.s, avant: s && s.lignes[0] ? s.lignes[0].id : null }; }
    const bas = e.clientY > r.top + r.height / 2;
    const s = csSection(best.dataset.s), i = s ? s.lignes.findIndex(x => x.id === best.dataset.l) : -1;
    return { tr: best, bas, s: best.dataset.s, avant: bas ? (s && s.lignes[i + 1] ? s.lignes[i + 1].id : null) : best.dataset.l };
  };
  zone.addEventListener('dragover', e => {
    if (!csGlisse) return;
    e.preventDefault();
    const x = cible(e);
    if (!x) return;
    csGlisseVers = x;
    zone.querySelectorAll('.pdt-vise-haut, .pdt-vise-bas').forEach(t => t.classList.remove('pdt-vise-haut', 'pdt-vise-bas'));
    x.tr.classList.add(x.bas ? 'pdt-vise-bas' : 'pdt-vise-haut');
  });
  const poser = () => {
    const g = csGlisse, v = csGlisseVers;
    csGlisse = csGlisseVers = null;
    if (g && v) csLigneVers(g.s, g.l, v.s, v.avant); else csRedessiner();
  };
  zone.addEventListener('drop', e => { if (csGlisse) { e.preventDefault(); poser(); } });
  zone.addEventListener('dragend', () => { if (csGlisse) poser(); });
  csMajBoutonsHist();
}
let csGlisse = null, csGlisseVers = null;

// Une case du document modifiée
function csEdInput(e) {
  const el = e.target.closest && e.target.closest('.ed');
  const c = csCur();
  if (!el || !c) return;
  let v = el.innerText.replace(/\n$/, '');
  if (!el.dataset.multi) v = v.replace(/\n/g, ' ');
  if (el.dataset.t) {
    c.textes = c.textes || {};
    c.textes[el.dataset.t] = v;
    pdtGarderHtml(c, 'textesHtml', el.dataset.t, el);
    csChangeFrappe();
    return;
  }
  const cible = csCible(el.dataset), k = el.dataset.k;
  if (!cible || !k) return;
  cible[k] = v;
  pdtGarderHtml(cible, 'html', k, el);
  if (cible === c && (k === 'jour' || k === 'dateTexte')) buildTabs();
  if (cible === c && k === 'dateTexte' && !v.trim()) delete c.dateTexte;
  csChangeFrappe();
  if (k === 'nom' && el.dataset.l) csSuggOuvrir(el);
}
// Case quittée : un nom reconnu remplit le poste, le téléphone et le mail vides
function csEdSortie(e) {
  const el = e.target.closest && e.target.closest('.ed[data-k="nom"][data-l]');
  if (!el) return;
  setTimeout(() => {
    if (csSugg && csSugg.el === el) csSuggFermer();
    const c = csCur(), l = csLigne(el.dataset.s, el.dataset.l), s = csSection(el.dataset.s);
    if (!c || !l || !l.nom || (s && s.cle === 'lieux')) return;
    if (csRemplirLigne(l, pjById(c.projetId), false)) { csChange(); csRedessiner(); }
  }, 150);
}
// Le call time par défaut, montré en gris dans les cases vides
function csMajCallsDoc() {
  const c = csCur();
  document.querySelectorAll('.cs-editor .ed[data-k="call"][data-l]').forEach(el => { el.dataset.ph = c.callDefaut || 'CALL'; });
}

// ── Liste des personnes proposées sous la case NAME ──────────────────────────
let csSugg = null;   // { el, items, i }
function csSuggOuvrir(el) {
  const c = csCur(), s = csSection(el.dataset.s);
  if (!c || !s || s.cle === 'lieux') return csSuggFermer();
  const q = pjNorm(el.innerText);
  const deja = new Set(c.sections.flatMap(x => x.lignes.map(l => pjNorm(l.nom))));
  let items = csChoix(pjById(c.projetId));
  items = q ? items.filter(g => pjNorm(q.length >= 3 ? g.nom + ' ' + g.info : g.nom).includes(q) && pjNorm(g.nom) !== q) : items.filter(g => g.equipe && !deja.has(pjNorm(g.nom)));
  items = items.slice(0, 8);
  if (!items.length) return csSuggFermer();
  let box = document.getElementById('cs-sugg');
  if (!box) { box = document.createElement('div'); box.id = 'cs-sugg'; document.body.appendChild(box); }
  csSugg = { el, items, i: -1 };
  box.innerHTML = items.map((g, i) => `<div class="cs-sugg-it" data-i="${i}" onmousedown="event.preventDefault(); csSuggChoisir(${i})"><b>${esc(g.nom)}</b>${g.info ? `<small>${esc(g.info)}</small>` : ''}</div>`).join('');
  const r = el.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 284)) + 'px';
  box.style.top = (r.bottom + 4) + 'px';
  box.style.display = 'block';
}
function csSuggFermer() { csSugg = null; const b = document.getElementById('cs-sugg'); if (b) b.style.display = 'none'; }
function csSuggTouche(e) {
  if (e.key === 'Escape') { csSuggFermer(); return true; }
  if (e.key === 'Enter') { if (csSugg.i < 0) return false; e.preventDefault(); csSuggChoisir(csSugg.i); return true; }
  e.preventDefault();
  csSugg.i = (csSugg.i + (e.key === 'ArrowDown' ? 1 : -1) + csSugg.items.length) % csSugg.items.length;
  document.querySelectorAll('#cs-sugg .cs-sugg-it').forEach((x, i) => x.classList.toggle('on', i === csSugg.i));
  return true;
}
function csSuggChoisir(i) {
  const c = csCur(), g = csSugg && csSugg.items[i];
  if (!c || !g) return;
  const el = csSugg.el, l = csLigne(el.dataset.s, el.dataset.l);
  csSuggFermer();
  if (!l) return;
  l.nom = g.nom;
  if (l.html) delete l.html.nom;
  csRemplirLigne(l, pjById(c.projetId), true);
  csChange();
  csRedessiner();
}
window.addEventListener('scroll', () => { if (csSugg) csSuggFermer(); }, true);

// ── Le document ──────────────────────────────────────────────────────────────
// Le même rendu sert à l'éditeur (edit = true : cases modifiables, outils dans la
// marge, groupes vides visibles) et au PDF.
function csDocCorps(c, edit) {
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const cols = csColsListe(c), larg = csLargeurs(c);
  const nCols = cols.length;
  const attrs = o => `${o.s ? ` data-s="${o.s}"` : ''}${o.l ? ` data-l="${o.l}"` : ''}${o.sch ? ` data-sch="${o.sch}"` : ''}${o.sl ? ` data-sl="${o.sl}"` : ''}`;
  // Une case : modifiable dans l'éditeur ; sinon son texte (avec sa mise en forme)
  const ed = (src, k, o = {}) => {
    const v = o.v !== undefined ? o.v : src ? src[k] : '';
    const h = src && src.html ? pdtHtmlValide(src.html[k], v) : '';
    if (edit) return `<span class="ed${o.cls ? ' ' + o.cls : ''}" contenteditable="true" spellcheck="false" data-k="${k}"${attrs(o)}${o.multi ? ' data-multi="1"' : ''} data-ph="${esc(o.ph || '')}">${h || esc(v == null ? '' : v)}</span>`;
    const t = h || (o.fmt ? o.fmt(v) : esc(v == null ? '' : v));
    return o.lien && String(v || '').trim() ? `<a href="${esc(o.lien)}">${t}</a>` : t;
  };
  // Les textes fixes du modèle (titres, étiquettes) : modifiables, gardés dans c.textes
  const T = (k, def, multi) => {
    const v = c.textes && c.textes[k] != null ? c.textes[k] : def;
    const h = pdtHtmlValide((c.textesHtml || {})[k], v);
    return edit ? `<span class="ed" contenteditable="true" spellcheck="false" data-t="${k}"${multi ? ' data-multi="1"' : ''} data-ph="${esc(def)}">${h || esc(v)}</span>` : h || esc(v).replace(/\n/g, '<br>');
  };
  const tbc = v => /^(tbc|tbd)\s*\??$/i.test(String(v || '').trim()) ? `<span class="tbc">${esc(String(v).toUpperCase())}</span>` : esc(v || '');
  const outils = html => edit ? `<div class="pdt-outils" contenteditable="false">${html}</div>` : '';
  const vide = l => !(l.nom || l.poste || l.adresse || cols.some(k => l[k]));

  // En-tête, comme l'onglet CALLSHEET du Google Sheet : logos, titre au centre, infos à droite
  const jour = c.jour != null ? c.jour : 1;
  const dateTexte = c.dateTexte || pdtDateTexte(c.date);
  // « Photographer : X / Director : Y » : les intitulés en gras, comme dans le sheet
  const credFmt = v => esc(v || '').replace(/(^|\/\s*)([^:\/]+?)\s*:/g, (m, a, b) => `${a}<b>${b.trim()} :</b>`);
  const champ = (lab, def, k, o = {}) => (edit || String(c[k] || '').trim()) ? `<p><b>${T(lab, def)} :</b> ${ed(c, k, o)}</p>` : '';
  const entete = `<header class="entete bloc">
    <div class="logos"><div class="client">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.client)}">` : esc(String(c.client || '').toUpperCase())}</div>
      <img class="widen" src="${base}widen-logo.png" alt="WIDEN"></div>
    <div class="titre"><b>${T('feuille', 'FEUILLE DE SERVICE')} ${T('jourMot', 'JOUR')} ${ed(c, 'jour', { v: jour, ph: '1' })}</b>
      <b class="date">${ed(c, 'dateTexte', { v: dateTexte, ph: 'DATE' })}</b></div>
    <div class="infos">
      ${champ('labTitre', 'Production Title', 'titre', { ph: 'Titre du projet' })}
      ${edit || c.credits ? `<p class="cred">${ed(c, 'credits', { ph: 'Photographer : … / Director : …', fmt: credFmt })}</p>` : ''}
      <div class="esp"></div>
      ${champ('labLieu', 'Location', 'lieu', { ph: 'Lieu' })}
      ${champ('labTiming', 'Timing', 'timing', { ph: '14:00 - 04:30' })}
    </div>
  </header>`;

  // Bloc gris : basecamp, météo, puis les déroulés côte à côte (vidéo, photo)
  const blocs = (c.schedules || []).filter(b => edit || csSchLignes(b).some(l => l.h || l.t));
  const schHtml = b => `<div class="sch">
    <h3>${ed(b, 'titre', { sch: b.id, ph: 'SCHEDULE' })}${edit ? `<span class="sch-x" contenteditable="false"><button type="button" title="Retirer ce bloc" onclick="csScheduleRetirer('${b.id}')">✕</button></span>` : ''}</h3>
    <table class="schl">${csSchLignes(b).filter(l => edit || l.h || l.t).map(l => {
      const o = { sch: b.id, sl: l.id };
      if (!edit && !l.h) return `<tr class="sous"><td colspan="2" class="tt">${ed(l, 't', o)}</td></tr>`;
      return `<tr class="${l.h ? 'h' : 'sous'}"><td class="hh">${ed(l, 'h', { ...o, ph: '00:00 - 00:00' })}${outils(`<button type="button" title="Ajouter une ligne dessous (ou Entrée)" onclick="csSchLigneAjouter('${b.id}', '${l.id}')">+</button><button type="button" title="Retirer" onclick="csSchLigneRetirer('${b.id}', '${l.id}')">✕</button>`)}</td><td class="tt">${ed(l, 't', { ...o, ph: l.h ? 'Ce qui se passe' : 'avec … (ligne sans heure)' })}</td></tr>`;
    }).join('')}</table>
    ${edit ? `<div class="pdt-ajout-bas"><button type="button" onclick="csSchLigneAjouter('${b.id}')">+ ligne</button></div>` : ''}
  </div>`;
  const aBase = edit || c.basecamp, aMeteo = edit || c.meteo;
  const infos = aBase || aMeteo || blocs.length || edit ? `<section class="bloc gris jour-b">
    ${aBase ? `<p class="base"><b class="rouge">${T('labBase', 'BASECAMP')}</b> <b>:</b> ${ed(c, 'basecamp', { ph: 'Adresse du basecamp', lien: csLienLieu(c.basecamp) })}</p>` : ''}
    ${aMeteo ? `<p class="meteo"><b>${T('labMeteo', 'MÉTÉO')} :</b> ${ed(c, 'meteo', { ph: 'facultatif (vide : pas dans le PDF)' })}</p>` : ''}
    ${blocs.length ? `<div class="schs" style="grid-template-columns:repeat(${Math.min(3, Math.max(1, blocs.length))}, minmax(0, 1fr))">${blocs.map(schHtml).join('')}</div>` : ''}
    ${edit ? `<div class="pdt-ajout-bas"><button type="button" onclick="csScheduleAjouter()">+ bloc (SCHEDULE …)</button></div>` : ''}
  </section>` : '';
  const schedule = '';

  const note = edit || String(c.note || '').trim() ? `<section class="bloc gris note-b"><h2>${T('crewNote', 'CREW NOTE')}</h2><p class="note">${ed(c, 'note', { multi: true, ph: 'Note à toute l\'équipe' })}</p></section>` : '';

  // Tableau de l'équipe
  const colOutils = (k, j) => !edit ? '' : `<div class="pdt-col-outils" contenteditable="false">
      <button type="button" title="Ajouter une colonne à gauche" onclick="csColAjouter(${j})">+</button>
      ${j ? `<button type="button" title="Déplacer à gauche" onclick="csColDeplacer('${k}', -1)">◂</button>` : ''}
      ${CS_COLS_FIXES.includes(k) ? '' : `<button type="button" title="Retirer la colonne" onclick="csColRetirer('${k}')">✕</button>`}
      ${j < nCols - 1 ? `<button type="button" title="Déplacer à droite" onclick="csColDeplacer('${k}', 1)">▸</button>` : ''}
      <button type="button" title="Ajouter une colonne à droite" onclick="csColAjouter(${j + 1})">+</button>
    </div>`;
  const thead = `<thead><tr class="th">${cols.map((k, j) => `<th class="${k}">${colOutils(k, j)}${T('col_' + k, CS_COL_TITRES[k] || 'COLONNE')}${edit && j < nCols - 1 ? '<span class="pdt-redim" contenteditable="false" title="Tirer pour changer la largeur (double-clic : largeurs par défaut)"></span>' : ''}</th>`).join('')}</tr></thead>`;
  const champsAppli = cols.filter(k => !CS_COLS_FIXES.includes(k));
  const cellule = (s, l, k) => {
    const o = { s: s.id, l: l.id };
    if (k === 'pos') return ed(l, 'poste', { ...o, ph: 'POSTE' });
    if (k === 'nom') return ed(l, 'nom', { ...o, ph: 'NOM', fmt: tbc });
    const v = l[k] || '';
    if (k === 'call') return ed(l, 'call', { ...o, v: edit ? v : v || c.callDefaut || '', ph: c.callDefaut || 'CALL', fmt: tbc });
    if (k === 'tel') return ed(l, k, { ...o, lien: v ? `tel:${v.replace(/[^\d+]/g, '')}` : '' });
    if (k === 'mail') return ed(l, k, { ...o, lien: v ? `mailto:${v}` : '' });
    if (k === 'pickupLieu') return ed(l, k, { ...o, lien: csLienLieu(v), fmt: tbc });
    return ed(l, k, { ...o, fmt: tbc });
  };
  const ligne = (s, l) => {
    const o = { s: s.id, l: l.id };
    const tools = outils(`<span class="pdt-poignee" title="Glisser pour déplacer (même dans un autre groupe)">⠿</span>
      <button type="button" title="Ajouter une ligne dessous" onclick="csAjouterPersonne('${s.id}', 'vide', '${l.id}')">+</button>
      <button type="button" title="Dupliquer" onclick="csLigneCopier('${s.id}', '${l.id}')">⧉</button>
      <button type="button" title="Retirer" onclick="csLigneRetirer('${s.id}', '${l.id}')">✕</button>`);
    const tr = `<tr${edit ? ` data-s="${s.id}" data-l="${l.id}"` : ''}>`;
    if (s.cle === 'lieux') {
      const iCall = cols.indexOf('call'), reste = nCols - 1 - (iCall >= 0 ? 1 : 0);
      return `${tr}<td class="pos">${tools}${ed(l, 'nom', { ...o, ph: 'LIEU' })}</td><td colspan="${Math.max(1, reste)}" class="adr">${ed(l, 'adresse', { ...o, ph: 'Adresse', lien: csLienLieu(l.adresse) })}${edit || l.tel ? ` <span class="sep">·</span> ${ed(l, 'tel', { ...o, ph: 'téléphone' })}` : ''}</td>${iCall >= 0 ? `<td class="call">${ed(l, 'call', { ...o, ph: 'OWN', fmt: tbc })}</td>` : ''}</tr>`;
    }
    return `${tr}${cols.map((k, j) => `<td class="${k}${k === 'vehicule' ? csVehClasse(l.vehicule) : ''}">${j === 0 ? tools : ''}${cellule(s, l, k)}</td>`).join('')}</tr>`;
  };
  const groupes = c.sections.filter(s => edit || s.lignes.some(l => !vide(l)));
  const equipe = (pjById(c.projetId) || {}).equipe || [];
  const groupeHtml = (s, si) => `<tbody class="g"><tr class="grp"${edit ? ` data-s="${s.id}"` : ''}><td colspan="${nCols}">${outils(`<button type="button" title="Monter le groupe" onclick="csSectionDeplacer('${s.id}', -1)"${si ? '' : ' disabled'}>↑</button><button type="button" title="Descendre le groupe" onclick="csSectionDeplacer('${s.id}', 1)"${si < c.sections.length - 1 ? '' : ' disabled'}>↓</button><button type="button" title="Ajouter un groupe dessous" onclick="csSectionAjouter('${s.id}')">+</button><button type="button" title="Retirer le groupe" onclick="csSectionRetirer('${s.id}')">✕</button>`)}${ed(s, 'titre', { s: s.id, ph: 'GROUPE', cls: 'up' })}
      ${edit ? `<span class="grp-plus" contenteditable="false"><button type="button" onclick="csAjouterPersonne('${s.id}', 'vide')">+ ${s.cle === 'lieux' ? 'lieu' : 'personne'}</button>${s.cle !== 'lieux' && equipe.length ? `<select title="Ajouter quelqu'un de l'équipe du projet" onchange="csAjouterPersonne('${s.id}', this.value)"><option value="">+ de l'équipe…</option>${equipe.filter(a => pjNomPersonne(a)).map(a => `<option value="${a.id}">${esc(pjNomPersonne(a) + (a.role ? ' · ' + a.role : ''))}</option>`).join('')}</select>` : ''}${s.lignes.length && s.cle !== 'lieux' && champsAppli.length ? `<select title="Mettre la même valeur à tout le groupe" onchange="csAppliquerDemande('${s.id}', this.value); this.value=''"><option value="">tout le groupe…</option>${champsAppli.map(k => `<option value="${k}">${esc(csColTitre(c, k))}</option>`).join('')}</select>` : ''}</span>` : ''}</td></tr>
      ${s.lignes.filter(l => edit || !vide(l)).map(l => ligne(s, l)).join('')}</tbody>`;
  const crew = `<section class="bloc crew-b"><div class="barre-noire"></div>
    <table class="crew">
      <colgroup>${larg.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
      ${thead}
      ${groupes.map((s, si) => groupeHtml(s, c.sections.indexOf(s))).join('')}
    </table>
    ${edit ? `<div class="pdt-ajout-bas"><button type="button" onclick="csSectionAjouter()">+ groupe</button></div>` : ''}
  </section>`;

  return `<div class="cs-doc${edit ? ' pdt-doc pdt-doc-ed' : ''}">${entete}${infos}${schedule}${note}${crew}</div>`;
}
// Les couleurs des véhicules du sheet
function csVehClasse(v) {
  const x = pjNorm(v || '');
  return /\bvan\b/.test(x) ? ' veh-van' : /camion/.test(x) ? ' veh-camion' : /volvo/.test(x) ? ' veh-volvo' : '';
}

function csDocCss(ecran, edit) {
  return `${edit ? '' : `@page { size: A4 portrait; margin: 0; }
  body { margin: 0; background: ${ecran ? '#fff' : '#e9e9e7'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
  .cs-doc, .cs-doc * { box-sizing: border-box; margin: 0; padding: 0; }
  .cs-doc { --ink: #000; --gris: #f3f3f3; --bande: #efefef; --rouge: #cc0000; --lien: #1155cc; font-family: 'Work Sans', Arial, sans-serif; color: var(--ink); width: 210mm; min-height: 297mm; margin: ${ecran && !edit ? '0' : '10mm'} auto; background: #fff; padding: 11mm 10mm 10mm; font-size: 8.5px; line-height: 1.35; text-align: left; letter-spacing: normal; }
  .cs-doc a { color: inherit; text-decoration: none; }
  .cs-doc .base a, .cs-doc td.pickupLieu a, .cs-doc td.adr a { color: var(--lien); text-decoration: underline; }
  .cs-doc .bloc { border: .5pt solid var(--ink); }
  .cs-doc .gris { background: var(--gris); }
  .cs-doc .rouge { color: var(--rouge); }

  /* En-tête : logo du client à gauche, WIDEN à droite, titre au centre, infos à droite */
  .cs-doc .entete { padding: 6px 8px 9px; }
  .cs-doc .logos { display: flex; justify-content: space-between; align-items: flex-start; min-height: 13mm; }
  .cs-doc .logos .client { font-size: 20px; font-weight: 600; letter-spacing: .02em; }
  .cs-doc .logos .client img { max-width: 48mm; max-height: 14mm; display: block; }
  .cs-doc .logos .widen { height: 20px; margin-top: 4px; }
  .cs-doc .entete .titre { text-align: center; font-size: 11px; line-height: 1.3; margin: 2px 0 12px; }
  .cs-doc .entete .titre b { display: block; font-weight: 700; text-transform: uppercase; }
  .cs-doc .entete .infos { text-align: right; font-style: italic; font-size: 7.5px; line-height: 1.45; }
  .cs-doc .entete .infos b { font-weight: 700; }
  .cs-doc .entete .infos .esp { height: 7px; }

  /* Bloc gris de la journée */
  .cs-doc .jour-b { margin-top: 8px; padding: 10px 8px 14px; }
  .cs-doc .base, .cs-doc .meteo { font-size: 9px; margin-bottom: 6px; }
  .cs-doc .base b, .cs-doc .meteo b { font-weight: 700; }
  .cs-doc .schs { display: grid; gap: 0 22px; margin-top: 10px; }
  .cs-doc .sch { break-inside: avoid; min-width: 0; }
  .cs-doc .sch h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; position: relative; }
  .cs-doc table.schl { border-collapse: collapse; font-size: 9px; }
  .cs-doc table.schl td { padding: 0; vertical-align: baseline; border: none; line-height: 1.45; }
  .cs-doc table.schl td.hh { padding-right: 9px; font-weight: 700; white-space: nowrap; }
  .cs-doc table.schl tr.h td.tt { font-weight: 700; }
  .cs-doc table.schl tr.sous td.tt { font-weight: 400; }

  .cs-doc .note-b { margin-top: 18px; padding: 8px 10px 10px; text-align: center; }
  .cs-doc .note-b h2 { font-size: 7.5px; font-weight: 700; margin-bottom: 1px; }
  .cs-doc .note { font-size: 6.8px; white-space: pre-line; }

  /* Tableau de l'équipe : barre noire, bandes grises par groupe, colonnes centrées */
  .cs-doc .crew-b { border-top: none; }
  .cs-doc .barre-noire { height: 8px; background: var(--ink); margin: 0 -1px; }
  .cs-doc table.crew { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5px; }
  .cs-doc table.crew thead th { font-size: 6.5px; font-weight: 400; text-transform: uppercase; text-align: center; padding: 6px 3px 1px; border-bottom: .5pt solid var(--ink); vertical-align: bottom; line-height: 1.2; }
  .cs-doc table.crew td { padding: 1px 3px; vertical-align: top; text-align: center; overflow-wrap: anywhere; line-height: 1.4; }
  .cs-doc table.crew tr.grp td { background: var(--bande); padding: 2px 3px; border-top: .5pt solid var(--ink); border-bottom: .5pt solid var(--ink); font-size: 6.5px; font-weight: 700; text-transform: uppercase; text-align: left; }
  .cs-doc table.crew tbody.g:first-of-type tr.grp td { border-top: none; }
  .cs-doc table.crew tr.grp + tr td { padding-top: 9px; }
  .cs-doc table.crew tbody.g tr:last-child:not(.grp) td { padding-bottom: 9px; }
  .cs-doc tbody.g { break-inside: avoid; }
  .cs-doc table.crew th.pos, .cs-doc table.crew td.pos { text-align: left; }
  .cs-doc table.crew th.call, .cs-doc table.crew td.call { text-align: right; }
  .cs-doc td.call, .cs-doc td.tel { white-space: nowrap; }
  .cs-doc td.veh-van { color: #e06666; }
  .cs-doc td.veh-camion { color: #8e7cc3; }
  .cs-doc td.veh-volvo { color: #93c47d; }
  .cs-doc td.adr { text-align: center; }
  .cs-doc td.adr .sep { color: #999; }
  .cs-doc .tbc { font-weight: 600; }
  ${edit ? `
  .pdt-ed-zone .cs-doc { box-shadow: 0 1px 6px rgba(0,0,0,.15); margin: 0 auto; }
  .cs-doc.pdt-doc-ed .ed { outline: none; min-width: 1.2em; display: inline-block; border-radius: 1px; cursor: text; white-space: pre-wrap; }
  .cs-doc.pdt-doc-ed td > .ed, .cs-doc.pdt-doc-ed .note > .ed, .cs-doc.pdt-doc-ed .cred > .ed { display: block; min-height: 1.25em; }
  .cs-doc.pdt-doc-ed .entete .infos .ed, .cs-doc.pdt-doc-ed .base > .ed { min-width: 6em; }
  .cs-doc.pdt-doc-ed td.hh .ed, .cs-doc.pdt-doc-ed td.call .ed, .cs-doc.pdt-doc-ed td.tel .ed { white-space: nowrap; }
  .cs-doc.pdt-doc-ed .ed:hover { box-shadow: 0 0 0 1px #9cb6d8; }
  .cs-doc.pdt-doc-ed .ed:focus { box-shadow: 0 0 0 1.5px #2f5597; background: #fff8; }
  .cs-doc.pdt-doc-ed .ed:empty::before { content: attr(data-ph); color: #b5b5b0; font-weight: 400; font-style: italic; letter-spacing: normal; text-transform: none; }
  .cs-doc.pdt-doc-ed td.call .ed:empty::before { color: #aaa; font-style: normal; }
  .cs-doc.pdt-doc-ed td { position: relative; }
  .cs-doc.pdt-doc-ed .pdt-outils { position: absolute; right: 100%; top: 50%; transform: translateY(-50%); display: flex; gap: 2px; align-items: center; z-index: 3; padding: 4px 6px 4px 10px; visibility: hidden; opacity: 0; transition: opacity .15s, visibility 0s linear .8s; font: 10px Arial, sans-serif; letter-spacing: normal; text-transform: none; }
  .cs-doc.pdt-doc-ed table.crew td:first-child { overflow: visible; }
  .cs-doc.pdt-doc-ed .crew-b, .cs-doc.pdt-doc-ed .jour-b { overflow: visible; }
  .cs-doc.pdt-doc-ed tr:hover .pdt-outils, .cs-doc.pdt-doc-ed tr:focus-within .pdt-outils, .cs-doc.pdt-doc-ed .pdt-outils:hover { visibility: visible; opacity: 1; transition-delay: 0s; }
  .cs-doc.pdt-doc-ed .pdt-outils button, .cs-doc.pdt-doc-ed .grp-plus button, .cs-doc.pdt-doc-ed .grp-plus select, .cs-doc.pdt-doc-ed .sch-x button { font: 10px Arial, sans-serif; letter-spacing: normal; text-transform: none; background: #fff; border: 1px solid #ccc; color: #333; padding: 0 4px; height: 18px; cursor: pointer; min-width: 18px; }
  .cs-doc.pdt-doc-ed .pdt-outils button:disabled { opacity: .35; cursor: default; }
  .cs-doc.pdt-doc-ed .pdt-outils button:hover, .cs-doc.pdt-doc-ed .grp-plus button:hover { border-color: #2f5597; }
  .cs-doc.pdt-doc-ed .pdt-poignee { cursor: grab; font-size: 13px; line-height: 1; color: #555; background: #fff; border: 1px solid #ccc; padding: 1px 3px; user-select: none; }
  .cs-doc.pdt-doc-ed tr.pdt-glisse { opacity: .4; }
  .cs-doc.pdt-doc-ed tr.pdt-vise-haut > td { box-shadow: inset 0 3px 0 #2f5597; }
  .cs-doc.pdt-doc-ed tr.pdt-vise-bas > td { box-shadow: inset 0 -3px 0 #2f5597; }
  .cs-doc.pdt-doc-ed tr.grp td { position: relative; }
  .cs-doc.pdt-doc-ed .grp-plus { position: absolute; right: 0; bottom: 3px; display: inline-flex; gap: 4px; visibility: hidden; opacity: 0; transition: opacity .15s, visibility 0s linear .8s; }
  .cs-doc.pdt-doc-ed tr.grp:hover .grp-plus, .cs-doc.pdt-doc-ed tr.grp:focus-within .grp-plus { visibility: visible; opacity: 1; transition-delay: 0s; }
  .cs-doc.pdt-doc-ed .grp-plus select { max-width: 120px; }
  .cs-doc.pdt-doc-ed .sch-x { position: absolute; right: 0; top: -2px; visibility: hidden; }
  .cs-doc.pdt-doc-ed .sch:hover .sch-x { visibility: visible; }
  .cs-doc.pdt-doc-ed tr.th th { position: relative; }
  .cs-doc.pdt-doc-ed .pdt-col-outils { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); display: flex; gap: 1px; z-index: 4; white-space: nowrap; padding: 6px 4px 3px; visibility: hidden; opacity: 0; transition: opacity .15s, visibility 0s linear .8s; }
  .cs-doc.pdt-doc-ed tr.th th:hover .pdt-col-outils, .cs-doc.pdt-doc-ed tr.th th:focus-within .pdt-col-outils, .cs-doc.pdt-doc-ed .pdt-col-outils:hover { visibility: visible; opacity: 1; transition-delay: 0s; }
  .cs-doc.pdt-doc-ed .pdt-col-outils button { font: 10px Arial, sans-serif; letter-spacing: normal; background: #fff; border: 1px solid #ccc; color: #333; padding: 0 3px; height: 16px; min-width: 16px; cursor: pointer; }
  .cs-doc.pdt-doc-ed .pdt-redim { position: absolute; top: 0; right: -4px; width: 7px; height: 100%; cursor: col-resize; z-index: 3; }
  .cs-doc.pdt-doc-ed .pdt-redim:hover { background: #2f559766; }
  .pdt-redim-en-cours, .pdt-redim-en-cours * { cursor: col-resize !important; user-select: none; }
  .cs-doc.pdt-doc-ed .pdt-ajout-bas { display: flex; gap: 6px; margin-top: 6px; }
  .cs-doc.pdt-doc-ed .pdt-ajout-bas button { font: 10px Arial, sans-serif; letter-spacing: normal; background: #fff; border: 1px dashed #aaa; color: #555; padding: 3px 8px; cursor: pointer; }
  .cs-doc.pdt-doc-ed .pdt-ajout-bas button:hover { border-color: #2f5597; color: #2f5597; }` : `
  @media screen and (max-width: 760px) { .cs-doc { zoom: .46; margin: 8px auto; } }
  @media print { body { background: #fff; } .barre { display: none; } .cs-doc { margin: 0 !important; max-width: 100% !important; } }`}`;
}

function csDocHtml(c, ecran) {
  csColsListe(c);
  const titreDoc = ['CALLSHEET', c.client, c.titre && pjNorm(c.titre) !== pjNorm(c.client) ? c.titre : '', 'J' + (c.jour != null ? c.jour : 1)].filter(Boolean).join(' ').replace(/[“”"]/g, '');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreDoc)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap">
<style>${csDocCss(ecran, false)}</style></head><body>
${ecran ? '' : '<div class="barre" style="position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:center;padding:12px;background:#111;color:#fff;font:14px Arial">Vérifie la callsheet puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>'}
${csDocCorps(c, false)}
</body></html>`;
}

function csMajApercu() {
  const f = document.getElementById('cs-apercu');
  const c = csCur();
  if (f && c) f.srcdoc = csDocHtml(c, true);
}

async function csPdf() {
  const c = csCur();
  if (!c) return;
  clearTimeout(csSaveTimer); csSaveTimer = null; saveDb();
  csSuggFermer();
  ouvrirDocument(csDocHtml(c, false));
  await imprimerDocument();
}
