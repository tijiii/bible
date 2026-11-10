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
// Colonnes du tableau qu'on peut masquer (POSITION, NAME et CALL TIME restent)
const CS_COLS = [['tel', 'PHONE NUMBER', 'Téléphone'], ['mail', 'EMAIL', 'Mail'], ['pickup', 'PICK-UP TIME', 'Heure de pick-up'],
  ['pickupLieu', 'PICK-UP LOCATION', 'Lieu de pick-up'], ['vehicule', 'VEHICLE', 'Véhicule'], ['hebergement', 'ACCOMMODATION', 'Hébergement']];
// Largeur relative de chaque colonne dans le PDF
const CS_LARG = { pos: 13, nom: 14, tel: 12, mail: 19, pickup: 7, pickupLieu: 17, vehicule: 7, hebergement: 11, call: 7 };
const CS_COLS_DEFAUT = { tel: true, mail: true, pickup: true, pickupLieu: true, vehicule: true, hebergement: false };

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
const csCols = c => ({ ...CS_COLS_DEFAUT, ...(c.cols || {}) });

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
    schedules: [], sections: [], cols: { ...CS_COLS_DEFAUT },
  };
  csRanger(c, csGensDuJour(p, date), p);
  CS_GROUPES_FIN.slice(1).forEach(([cle, titre]) => c.sections.push({ id: csLid(), cle, titre, lignes: [] }));
  csSchedulesDesPdt(c, true);
  if (!c.schedules.length) c.schedules = csPistes(p).map(k => ({ id: csLid(), titre: k === 'photo' ? 'SCHEDULE PHOTO' : k === 'video' ? 'SCHEDULE VIDEO' : 'SCHEDULE', texte: '' }));
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
  c.sections.forEach(s => { s.id = csLid(); s.lignes.forEach(l => { l.id = csLid(); }); });
  (c.schedules || []).forEach(s => { s.id = csLid(); });
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
  c.schedules = pdts.map(d => ({ id: csLid(), titre: pdtType(d) === 'photo' ? 'SCHEDULE PHOTO' : 'SCHEDULE VIDEO', texte: csScheduleDuPdt(d) }));
  // La partie (photo ou vidéo) qui n'a pas de PDT ce jour-là garde un bloc vide à remplir
  const p = pjById(c.projetId);
  if (p) csPistes(p).forEach(k => {
    const t = k === 'photo' ? 'SCHEDULE PHOTO' : 'SCHEDULE VIDEO';
    if (k && !c.schedules.some(s => s.titre === t)) c.schedules.push({ id: csLid(), titre: t, texte: '' });
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
  if (c.schedules.some(s => String(s.texte || '').trim()) && csPdtDuJour(c).length && !confirm('Remplacer le déroulé par celui des PDT de ce jour ?')) return;
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
let csSaveTimer = null, csApercuTimer = null;

function csReprendre(c) {
  const list = csList();
  const i = list.findIndex(x => x.id === c.id);
  if (i >= 0) list[i] = c; else list.push(c);
}
function csChange() {
  const c = csCur();
  if (!c) return;
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

// data-k : champ de la callsheet ; data-s (+ data-l) : champ d'un groupe (ou d'une de ses lignes) ;
// data-sch : champ d'un bloc de déroulé ; data-col : colonne affichée ou non
function csInput(el) {
  const c = csCur();
  if (!c) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  const k = el.dataset.k;
  if (el.dataset.col) c.cols = { ...csCols(c), [el.dataset.col]: v };
  else if (el.dataset.sch) { const s = (c.schedules || []).find(x => x.id === el.dataset.sch); if (s) s[k] = v; }
  else if (el.dataset.s) {
    const cible = el.dataset.l ? csLigne(el.dataset.s, el.dataset.l) : csSection(el.dataset.s);
    if (!cible) return;
    cible[k] = v;
  } else {
    c[k] = k === 'jour' ? Math.max(0, Number(v) || 0) : v;
    if (k === 'jour' || k === 'date') buildTabs();
    if (k === 'client' && !c.logo) { const l = prodData().logos[tsCleClient(c.client)]; if (l) { c.logo = l; csLogoMaj(); } }
    if (k === 'basecamp') { const lien = csLienLieu(v); if (lien) c.basecampLien = lien; }
  }
  csChange();
}

function csField(label, k, v, o = {}) {
  const attrs = `data-k="${k}"${o.s ? ` data-s="${o.s}"` : ''}${o.l ? ` data-l="${o.l}"` : ''}${o.sch ? ` data-sch="${o.sch}"` : ''}`;
  let input;
  if (o.textarea) input = `<textarea rows="${o.rows || 3}" ${attrs} oninput="csInput(this)" placeholder="${esc(o.ph || '')}">${esc(v == null ? '' : v)}</textarea>`;
  else input = `<input type="${o.type || 'text'}" ${attrs} value="${esc(v == null ? '' : v)}" placeholder="${esc(o.ph || '')}"${o.list ? ` list="${o.list}"` : ''}${o.min != null ? ` min="${o.min}"` : ''} oninput="csInput(this)"${o.onchange ? ` onchange="${o.onchange}"` : ''}>`;
  return `<div class="field${o.full ? ' full' : ''}${o.cls ? ' ' + o.cls : ''}"><label>${esc(label)}</label>${input}</div>`;
}

// Les noms proposés : l'équipe du projet d'abord, puis l'OPTIONS TEAM, puis la bible et les contacts
function csChoix(p) {
  const out = [], vus = new Set();
  const add = (nom, info) => { const n = pjNorm(nom); if (!n || vus.has(n)) return; vus.add(n); out.push({ nom: String(nom).trim(), info }); };
  if (p) {
    (p.equipe || []).forEach(a => add(pjNomPersonne(a), [a.role, 'équipe du projet'].filter(Boolean).join(' · ')));
    (p.options || []).forEach(o => add(o.nom, [o.role, 'options team'].filter(Boolean).join(' · ')));
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
  if (!t || /^own\b/i.test(t) || /^(tbc|tbd)$/i.test(t)) return '';
  const n = pjNorm(t);
  const l = lieuxList().find(x => x.nom && (pjNorm(x.nom) === n || n.startsWith(pjNorm(x.nom) + ' -')));
  if (l && /^https?:\/\//.test(l.lien || '')) return l.lien;
  const g = l && typeof parseGps === 'function' ? parseGps(l.gps) : null;
  if (g) return `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((l && l.adresse) || t.replace(/^basecamp\s*:\s*/i, ''))}`;
}

// Un nom choisi ou tapé : on remplit le poste, le téléphone et le mail
function csNomChoisi(el) {
  const c = csCur(), p = c && pjById(c.projetId);
  const l = csLigne(el.dataset.s, el.dataset.l);
  if (!l) return;
  const a = p && (p.equipe || []).find(x => pjNorm(pjNomPersonne(x)) === pjNorm(l.nom));
  const inf = csInfos(l.nom, a ? a.ref : null, p);
  let change = false;
  if (a && !l.poste && a.role) { l.poste = a.role; change = true; }
  if (!l.poste && inf.role) { l.poste = inf.role; change = true; }
  if (inf.tel && inf.tel !== l.tel) { l.tel = inf.tel; change = true; }
  if (inf.mail && inf.mail !== l.mail) { l.mail = inf.mail; change = true; }
  l.aid = a ? a.id : null;
  if (change) { csChange(); csRedessiner(); }
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
  c.sections.forEach(s => s.lignes.forEach(l => {
    if (!l.nom || s.cle === 'lieux') return;
    const a = p && ((l.aid && (p.equipe || []).find(x => x.id === l.aid)) || (p.equipe || []).find(x => pjNorm(pjNomPersonne(x)) === pjNorm(l.nom)));
    const inf = csInfos(l.nom, a ? a.ref : null, p);
    if (a && !l.poste && a.role) { l.poste = a.role; n++; }
    ['tel', 'mail'].forEach(k => { if (!l[k] && inf[k]) { l[k] = inf[k]; n++; } });
  }));
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
  csRedessiner();
  csMsg(`${nouveaux.length} personne${nouveaux.length > 1 ? 's' : ''} ajoutée${nouveaux.length > 1 ? 's' : ''} : ${nouveaux.map(pjNomPersonne).join(', ')}.`);
}
let csMsgTexte = '';
function csMsg(t) { csMsgTexte = t; const m = document.getElementById('cs-msg'); if (m) m.textContent = t; }

function csAjouterPersonne(sid, v) {
  const c = csCur(), p = c && pjById(c.projetId), s = csSection(sid);
  if (!s || !v) return;
  const a = p && (p.equipe || []).find(x => String(x.id) === v);
  s.lignes.push(a ? csLigneDe(a, p) : { id: csLid(), poste: '', nom: '', tel: '', mail: '', pickup: '', pickupLieu: '', vehicule: '', hebergement: '', call: '' });
  csChange();
  csRedessiner();
}
function csLigneRetirer(sid, lid) { const s = csSection(sid); if (!s) return; s.lignes = s.lignes.filter(l => l.id !== lid); csChange(); csRedessiner(); }
function csLigneDeplacer(sid, lid, sens) {
  const s = csSection(sid);
  if (!s) return;
  const i = s.lignes.findIndex(l => l.id === lid), j = i + sens;
  if (i < 0 || j < 0 || j >= s.lignes.length) return;
  [s.lignes[i], s.lignes[j]] = [s.lignes[j], s.lignes[i]];
  csChange(); csRedessiner();
}
// Déplace une personne dans un autre groupe
function csLigneVers(sid, lid, vers) {
  const c = csCur(), s = csSection(sid), d = csSection(vers);
  if (!c || !s || !d || s === d) return;
  const l = s.lignes.find(x => x.id === lid);
  if (!l) return;
  s.lignes = s.lignes.filter(x => x !== l);
  d.lignes.push(l);
  csChange(); csRedessiner();
}
// Une valeur pour toutes les personnes d'un groupe (call, pick-up, véhicule…)
function csAppliquer(sid, k, v) {
  const s = csSection(sid);
  if (!s || !k) return;
  s.lignes.forEach(l => { l[k] = v; });
  csChange(); csRedessiner();
}
function csAppliquerDemande(sid, k) {
  const s = csSection(sid);
  if (!s || !k) return;
  const v = prompt(`Valeur pour tout le groupe ${s.titre} :`);
  if (v !== null) csAppliquer(sid, k, v.trim());
}
function csSectionAjouter() {
  const c = csCur();
  if (!c) return;
  c.sections.push({ id: csLid(), cle: 'autres', titre: 'NOUVEAU GROUPE', lignes: [] });
  csChange(); csRedessiner();
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
function csScheduleAjouter() { const c = csCur(); if (!c) return; c.schedules.push({ id: csLid(), titre: 'SCHEDULE', texte: '' }); csChange(); csRedessiner(); }
function csScheduleRetirer(id) { const c = csCur(); if (!c) return; c.schedules = c.schedules.filter(s => s.id !== id); csChange(); csRedessiner(); }

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
  const c = csCur();
  const p = pjById(c.projetId);
  const scroll = window.scrollY;
  const cols = csCols(c);
  const choix = csChoix(p);
  const dans = new Set(c.sections.flatMap(s => s.lignes.map(l => pjNorm(l.nom))));
  const equipe = p ? (p.equipe || []).filter(a => pjNomPersonne(a)) : [];
  const nbPdt = csPdtDuJour(c).length;
  const champsLigne = [['call', 'CALL TIME'], ['pickup', 'PICK-UP TIME'], ['pickupLieu', 'PICK-UP LOCATION'], ['vehicule', 'VEHICLE'], ['hebergement', 'ACCOMMODATION']]
    .filter(([k]) => k === 'call' || cols[k]);
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
    return `<div class="cs-ligne"><div class="cs-l">
      ${csField('POSTE', 'poste', l.poste, { ...o, ph: 'DOP' })}
      ${csField('NOM', 'nom', l.nom, { ...o, list: 'cs-gens', ph: 'Choisis ou écris un nom', onchange: 'csNomChoisi(this)' })}
      ${cols.tel ? csField('TÉLÉPHONE', 'tel', l.tel, o) : ''}
      ${cols.mail ? csField('MAIL', 'mail', l.mail, { ...o, type: 'email', cls: 'cs-large' }) : ''}
      </div><div class="cs-l">
      ${champsLigne.map(([k, lab]) => csField(lab, k, l[k], { ...o, ph: k === 'call' && c.callDefaut ? c.callDefaut : '', cls: ['call', 'pickup'].includes(k) ? 'cs-court' : k === 'pickupLieu' ? 'cs-large' : '', list: k === 'pickupLieu' ? 'cs-lieux' : k === 'vehicule' ? 'cs-vehicules' : '' })).join('')}
      ${outils}</div></div>`;
  };
  main.innerHTML = `<div class="ts-editor cs-editor">
    <div class="ts-form">
      <section class="ts-bloc">
        <h3>EN-TÊTE</h3>
        <div class="ts-grid">
          ${csField('DATE', 'date', c.date, { type: 'date', onchange: 'csRedessiner()' })}
          ${csField('JOUR N°', 'jour', c.jour != null ? c.jour : 1, { type: 'number', min: 0 })}
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
          ${csField('', 'texte', s.texte, { sch: s.id, textarea: true, rows: 7, full: true, ph: '14:00 - 16:00   Installation\n16:00 - 17:00   Shoot\navec Models + Figurants' })}
        </div>`).join('')}</div>
        <div class="ts-add-row">
          <button type="button" class="btn-upload" onclick="csScheduleAjouter()">+ BLOC</button>
          <button type="button" class="btn-upload" onclick="csReprendrePdt()"${nbPdt ? '' : ' title="Aucun PDT de ce projet n\'a cette date"'}>REPRENDRE DES PDT DU JOUR${nbPdt ? ` (${nbPdt})` : ''}</button>
        </div>
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
          <div class="field"><label>COLONNES DU TABLEAU</label><div class="cs-cols">${CS_COLS.map(([k, , lab]) => `<label class="cat-check"><input type="checkbox" data-col="${k}" ${cols[k] ? 'checked' : ''} onchange="csInput(this); csRedessiner()"><span>${lab}</span></label>`).join('')}</div></div>
        </div>
        <div class="ts-add-row">
          <button type="button" class="btn-upload" onclick="csAjouterEquipe()">+ L'ÉQUIPE DU JOUR</button>
          <button type="button" class="btn-upload" onclick="csMajInfos()">COMPLÉTER TÉLÉPHONES ET MAILS</button>
        </div>
        <div class="field-hint" id="cs-msg">${esc(csMsgTexte)}</div>
        ${c.sections.map((s, si) => `<div class="cs-groupe">
          <div class="cs-groupe-hdr">
            <input class="cs-groupe-titre" data-k="titre" data-s="${s.id}" value="${esc(s.titre)}" oninput="csInput(this)" aria-label="Titre du groupe">
            <small class="pj-muted">${s.lignes.length}</small>
            <div class="spacer"></div>
            ${s.lignes.length && s.cle !== 'lieux' ? `<select class="filter-sel" title="Mettre la même valeur à tout le groupe" onchange="csAppliquerDemande('${s.id}', this.value); this.value=''">
              <option value="">Tout le groupe…</option>${champsLigne.map(([k, lab]) => `<option value="${k}">${lab}</option>`).join('')}
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
  const champClient = main.querySelector('[data-k="client"]:not([data-s])');
  if (champClient) champClient.addEventListener('change', () => { const x = csCur(); if (x && !x.logo && tsCleClient(x.client)) csLogoChercher(); });
  csMajApercu();
}

// ── Le document ──────────────────────────────────────────────────────────────
function csDocHtml(c, ecran) {
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const cols = csCols(c);
  const vis = CS_COLS.filter(([k]) => cols[k]);
  const nCols = 2 + vis.length + 1;
  const lien = (t, href) => href ? `<a href="${esc(href)}">${esc(t)}</a>` : esc(t);
  const tbc = v => /^(tbc|tbd)\s*\??$/i.test(String(v || '').trim()) ? `<span class="tbc">${esc(String(v).toUpperCase())}</span>` : esc(v || '');
  const val = (l, k) => {
    const v = k === 'call' ? (l.call || c.callDefaut || '') : l[k] || '';
    if (k === 'pickupLieu') { const h = csLienLieu(v); return h ? lien(v, h) : tbc(v); }
    if (k === 'tel' && v) return `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
    if (k === 'mail' && v) return `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
    return tbc(v);
  };
  const schedules = (c.schedules || []).filter(s => String(s.texte || '').trim() || String(s.titre || '').trim());
  const schHtml = s => `<div class="sch"><h3>${esc(String(s.titre || '').toUpperCase())}</h3>${String(s.texte || '').split('\n').filter(x => x.trim()).map(x => {
    const m = /^\s*((?:\d{1,2}[:h.]\d{2}|TBC|TBD)(?:\s*[-–]\s*(?:\d{1,2}[:h.]\d{2}|TBC|TBD))?)\s+(.*)$/i.exec(x);
    return m ? `<p class="h"><b>${esc(m[1].replace(/\s*[-–]\s*/, ' – '))}</b><span>${esc(m[2].trim())}</span></p>` : `<p class="sous">${esc(x.trim())}</p>`;
  }).join('')}</div>`;
  const sections = c.sections.filter(s => s.lignes.some(l => l.nom || l.poste || l.adresse));
  const ligne = (s, l) => s.cle === 'lieux'
    ? `<tr><td class="pos">${esc(l.nom || '')}</td><td colspan="${Math.max(1, nCols - 2)}" class="adr">${l.adresse ? lien(l.adresse, csLienLieu(l.adresse)) : ''}${l.tel ? ` <span class="sep">·</span> ${val(l, 'tel')}` : ''}</td><td class="call">${tbc(l.call || '')}</td></tr>`
    : `<tr><td class="pos">${esc(l.poste || '')}</td><td class="nom">${tbc(l.nom || '')}</td>${vis.map(([k]) => `<td class="${k}">${val(l, k)}</td>`).join('')}<td class="call">${val(l, 'call')}</td></tr>`;
  const titreDoc = ['CALLSHEET', c.client, c.titre && pjNorm(c.titre) !== pjNorm(c.client) ? c.titre : '', 'J' + (c.jour != null ? c.jour : 1)].filter(Boolean).join(' ').replace(/[“”"]/g, '');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreDoc)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap">
<style>
  @page { size: A4 portrait; margin: 0; }
  .cs-doc, .cs-doc * { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; background: ${ecran ? '#fff' : '#e9e9e7'}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cs-doc { --ink: #141414; --gris: #8a8a86; --filet: #e2e2de; --rouge: #9b1c1c; font-family: 'EB Garamond', Garamond, Georgia, serif; font-variant-numeric: lining-nums; color: var(--ink); width: 210mm; min-height: 297mm; margin: ${ecran ? '0' : '10mm'} auto; background: #fff; padding: 13mm 12mm 12mm; font-size: 11px; line-height: 1.3; }
  .cs-doc a { color: inherit; text-decoration: none; }
  .cs-doc .adr a, .cs-doc .pickupLieu a, .cs-doc .base a { border-bottom: 1px solid var(--filet); }

  /* En-tête : logos aux coins, jour et date au centre (comme la travel sheet) */
  .entete { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--ink); }
  .entete .client { font-weight: 500; font-size: 22px; letter-spacing: .06em; line-height: 1; }
  .entete .client img { max-width: 34mm; max-height: 15mm; display: block; }
  .entete .milieu { text-align: center; line-height: 1.25; }
  .entete .k { font-size: 10px; font-weight: 500; letter-spacing: .32em; color: var(--gris); padding-left: .32em; }
  .entete .jour { display: block; font-size: 26px; font-weight: 500; letter-spacing: .05em; margin: 4px 0 3px; }
  .entete .date { font-size: 12px; letter-spacing: .16em; color: #555; }
  .entete .widen { justify-self: end; height: 15px; }

  /* Infos de la journée */
  .infos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; padding: 11px 0 10px; border-bottom: 1px solid var(--filet); }
  .infos div { display: flex; gap: 10px; align-items: baseline; font-size: 12.5px; }
  .infos .r { justify-content: flex-end; text-align: right; }
  .k2 { font-size: 9.5px; font-weight: 500; letter-spacing: .2em; text-transform: uppercase; color: var(--gris); white-space: nowrap; }
  .infos b { font-weight: 600; letter-spacing: .02em; }
  .base { padding: 9px 0; text-align: center; font-size: 13px; border-bottom: 1px solid var(--filet); }
  .base .k2 { color: var(--rouge); margin-right: 10px; }
  .meteo { padding: 7px 0 0; text-align: center; font-size: 12px; color: #555; font-style: italic; }

  /* Titres de section : petites capitales espacées, filet fin de chaque côté */
  .sec { margin-top: 16px; }
  .sec-t { display: flex; align-items: center; gap: 12px; font-size: 10.5px; font-weight: 600; letter-spacing: .26em; margin-bottom: 8px; }
  .sec-t::before, .sec-t::after { content: ''; flex: 1; height: 1px; background: var(--ink); }
  .sec-t span { padding-left: .26em; }

  /* Déroulé : un bloc par partie (vidéo, photo), côte à côte */
  .schs { display: grid; grid-template-columns: repeat(${Math.min(3, Math.max(1, schedules.length))}, minmax(0, 1fr)); gap: 0 26px; }
  .sch { break-inside: avoid; }
  .sch h3 { font-size: 9.5px; font-weight: 500; letter-spacing: .22em; color: var(--gris); margin-bottom: 5px; }
  .sch p { font-size: 12px; }
  .sch p.h { display: grid; grid-template-columns: 82px 1fr; gap: 8px; margin-top: 3px; }
  .sch p.h b { font-weight: 600; color: var(--rouge); white-space: nowrap; letter-spacing: .02em; }
  .sch p.h span { font-weight: 500; }
  .sch p.sous { padding-left: 90px; font-style: italic; color: #555; font-size: 11.5px; }

  .note { text-align: center; font-size: 11.5px; font-style: italic; color: #444; max-width: 88%; margin: 0 auto; white-space: pre-line; }

  /* Tableau de l'équipe */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
  thead th { font-size: 7.5px; font-weight: 500; letter-spacing: .12em; color: var(--gris); text-align: left; padding: 0 4px 5px; border-bottom: 1.5px solid var(--ink); vertical-align: bottom; line-height: 1.2; }
  td { padding: 2.5px 4px; vertical-align: baseline; border-bottom: 1px solid var(--filet); overflow-wrap: anywhere; }
  tbody tr:last-child td { border-bottom: none; }
  tr.grp td { padding: 11px 4px 3px; border-bottom: 1px solid var(--ink); font-size: 9.5px; font-weight: 600; letter-spacing: .24em; }
  tbody.g { break-inside: avoid; }
  td.pos { color: #555; font-style: italic; }
  td.nom { font-weight: 600; font-size: 11px; }
  td.call, th.call { text-align: right; white-space: nowrap; }
  td.call { font-weight: 600; color: var(--rouge); }
  td.tel { white-space: nowrap; }
  td.vehicule { letter-spacing: .06em; font-size: 9.5px; }
  td.adr .sep { color: var(--gris); }
  .tbc { color: var(--rouge); font-weight: 600; letter-spacing: .06em; }
  @media screen and (max-width: 760px) { .cs-doc { zoom: .46; margin: 8px auto; } }
  @media print { body { background: #fff; } .barre { display: none; } .cs-doc { margin: 0; } }
</style></head><body>
${ecran ? '' : '<div class="barre" style="position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:center;padding:12px;background:#111;color:#fff;font:14px Arial">Vérifie la callsheet puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>'}
<div class="cs-doc">
  <header class="entete">
    <div class="client">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.client)}">` : esc(String(c.client || '').toUpperCase())}</div>
    <div class="milieu"><span class="k">FEUILLE DE SERVICE</span><b class="jour">JOUR ${esc(String(c.jour != null ? c.jour : 1))}</b><span class="date">${esc(pdtDateTexte(c.date))}</span></div>
    <img class="widen" src="${base}widen-logo.png" alt="WIDEN">
  </header>
  <div class="infos">
    <div><span class="k2">Production</span><b>${esc(c.titre || '')}</b></div>
    <div class="r"><span class="k2">Location</span><b>${esc(c.lieu || '')}</b></div>
    <div>${c.credits ? esc(c.credits) : ''}</div>
    <div class="r">${c.timing ? `<span class="k2">Timing</span><b>${esc(c.timing)}</b>` : ''}</div>
  </div>
  ${c.basecamp ? `<div class="base"><span class="k2">Basecamp</span>${lien(c.basecamp, c.basecampLien || csLienLieu(c.basecamp))}</div>` : ''}
  ${c.meteo ? `<p class="meteo">Météo : ${esc(c.meteo)}</p>` : ''}
  ${schedules.length ? `<section class="sec"><h2 class="sec-t"><span>SCHEDULE</span></h2><div class="schs">${schedules.map(schHtml).join('')}</div></section>` : ''}
  ${String(c.note || '').trim() ? `<section class="sec"><h2 class="sec-t"><span>CREW NOTE</span></h2><p class="note">${esc(c.note.trim())}</p></section>` : ''}
  <section class="sec"><h2 class="sec-t"><span>CREW</span></h2>
    <table>
      <colgroup>${['pos', 'nom', ...vis.map(x => x[0]), 'call'].map(k => `<col style="width:${(100 * CS_LARG[k] / ['pos', 'nom', ...vis.map(x => x[0]), 'call'].reduce((t, x) => t + CS_LARG[x], 0)).toFixed(2)}%">`).join('')}</colgroup>
      <thead><tr><th>POSITION</th><th>NAME</th>${vis.map(([k, t]) => `<th class="${k}">${t}</th>`).join('')}<th class="call">CALL TIME</th></tr></thead>
      ${sections.map(s => `<tbody class="g"><tr class="grp"><td colspan="${nCols}">${esc(String(s.titre || '').toUpperCase())}</td></tr>
        ${s.lignes.filter(l => l.nom || l.poste || l.adresse).map(l => ligne(s, l)).join('')}</tbody>`).join('')}
    </table>
  </section>
</div>
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
  ouvrirDocument(csDocHtml(c, false));
  await imprimerDocument();
}
