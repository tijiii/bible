// ── SUIVI PRODUCTION ─────────────────────────────────────────────────────────
// Deuxième onglet du site, après la bible : le suivi des projets (comme la
// base Airtable), avec les travel sheets de chaque projet (prod.js). Une vue globale des projets, et dans chaque projet
// son calendrier d'étapes et les gens qui sont dessus. Le site prévient quand
// une même personne est sur deux projets aux mêmes dates.
// Tout est gardé dans la base partagée, sous db.projets.

let pjVue = 'liste';         // 'liste' | 'projet' | 'ts' (travel sheet ouverte, prod.js)
let pjTsDepuis = null;       // projet d'où la travel sheet a été ouverte (pour y revenir)
let pjId = null;             // projet ouvert
let pjQ = '';                // recherche dans la liste
let pjFStatut = '';          // filtre statut ('' = tous sauf livrés et annulés, 'tous' = tout)
let pjMode = (() => { try { return localStorage.getItem('pjMode') || 'liste'; } catch { return 'liste'; } })(); // 'liste' | 'planning' | 'personnes' | 'travel'
let pjPlanDebut = '';        // premier mois du planning ('AAAA-MM')
let pjMois = '';             // mois affiché dans le calendrier du projet ('AAAA-MM')
let pjRetro = null;          // import de rétroplanning en cours : { pid, fichier, enCours, msg, etapes }
let pjOptionsOuvert = false; // bloc OPTIONS TEAM déplié (fermé par défaut, il est long)
let pjRetroOuvert = false;   // bloc d'import du rétroplanning déplié
let pjEtapesOuvert = false;  // liste des étapes (à modifier) dépliée
let pjEnDessin = false;      // la page est en train d'être remplacée (le champ quitté envoie « change »)

const PJ_STATUTS = [
  ['devis', 'En discussion', '#9a9a96'],
  ['confirme', 'Confirmé', '#3c6e8f'],
  ['prepa', 'En prépa', '#8f7a3c'],
  ['tournage', 'Tournage', '#b3261e'],
  ['postprod', 'Post-prod', '#7a3c8f'],
  ['livre', 'Livré', '#3c8f6e'],
  ['annule', 'Annulé', '#bdbdbb'],
];
const PJ_ETAPES = [
  ['prepa', 'Prépa', '#8f7a3c'],
  ['reperage', 'Repérage', '#3c8f6e'],
  ['casting', 'Casting', '#c46a2b'],
  ['tournage', 'Tournage', '#b3261e'],
  ['postprod', 'Post-prod', '#7a3c8f'],
  ['livraison', 'Livraison', '#111111'],
  ['autre', 'Autre', '#9a9a96'],
];
// Partie du projet : une étape peut être côté vidéo, côté photo, ou commune
const PJ_PISTES = [
  ['video', 'Vidéo', '#24527a'],
  ['photo', 'Photo', '#c9821a'],
];
const PJ_COULEURS = ['#3c6e8f', '#b3261e', '#3c8f6e', '#8f7a3c', '#7a3c8f', '#c46a2b', '#2b7a8a', '#8a2b5c'];
const PJ_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const PJ_MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function pjList() {
  if (!Array.isArray(db.projets)) db.projets = [];
  return db.projets;
}
function pjById(id) { return pjList().find(p => p.id === id); }
function pjCur() { return pjById(pjId); }
function pjStatut(k) { return PJ_STATUTS.find(s => s[0] === k) || PJ_STATUTS[0]; }
function pjEtapeType(k) { return PJ_ETAPES.find(t => t[0] === k) || PJ_ETAPES[PJ_ETAPES.length - 1]; }
function pjEtapeNom(e) { return e.nom || pjEtapeType(e.type)[1]; }
function pjPisteInfo(k) { return PJ_PISTES.find(x => x[0] === k) || null; }
// La piste d'une étape : celle choisie, sinon devinée d'après son nom (anciens imports « Montage (vidéo) »)
function pjPisteDe(e) { return typeof e.piste === 'string' ? e.piste : pjDevinerPiste(e.nom); }
function pjDevinerPiste(t) {
  const n = pjNorm(t);
  if (/\bphotos?\b|stills|retouch|selection|print/.test(n)) return 'photo';
  if (/\bvideos?\b|\bfilm\b|motion|montage|etalo|grading|sound|mixage|\bv\d\b/.test(n)) return 'video';
  return '';
}
// Nom affiché : « IKKS FW27 » (le client devant, s'il n'est pas déjà dans le nom)
function pjTitre(p) {
  const nom = (p.nom || '').trim();
  if (!p.client || pjNorm(nom).includes(pjNorm(p.client))) return nom || p.client || 'Sans nom';
  return (p.client.trim() + ' ' + nom).trim();
}
// Les projets venus de PROJETS WIDEN n'ont pas de couleur : une couleur fixe tirée de leur N°
function pjCouleur(p) {
  if (p.couleur) return p.couleur;
  const n = parseInt(String(p.code || p.id).replace(/\D/g, ''), 10) || 0;
  return PJ_COULEURS[n % PJ_COULEURS.length];
}

// ── Dates (texte 'AAAA-MM-JJ', qu'on compare comme du texte) ────────────────
function pjAujourdhui() { const d = new Date(); return pjIso(d); }
function pjIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function pjDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function pjPlusJours(s, n) { const d = pjDate(s); d.setDate(d.getDate() + n); return pjIso(d); }
function pjJours(du, au) { return Math.round((pjDate(au) - pjDate(du)) / 86400000); }
function pjMoisPlus(m, n) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return pjIso(d).slice(0, 7); }
function pjDateCourte(s) { if (!s) return ''; const d = pjDate(s); return d.getDate() + ' ' + PJ_MOIS_COURT[d.getMonth()]; }
function pjPeriodeTexte(du, au) {
  if (!du) return '';
  if (!au || au === du) return pjDateCourte(du) + ' ' + du.slice(0, 4);
  const memeAn = du.slice(0, 4) === au.slice(0, 4);
  if (du.slice(0, 7) === au.slice(0, 7)) return pjDate(du).getDate() + '–' + pjDateCourte(au) + ' ' + au.slice(0, 4);
  return pjDateCourte(du) + (memeAn ? '' : ' ' + du.slice(0, 4)) + ' – ' + pjDateCourte(au) + ' ' + au.slice(0, 4);
}

// Une étape avec des dates valides : { du, au } avec au >= du
function pjEtapeDates(e) {
  if (!e || !e.du) return null;
  return { du: e.du, au: e.au && e.au >= e.du ? e.au : e.du };
}
function pjEtapesDatees(p) {
  return (p.etapes || []).filter(e => pjEtapeDates(e)).sort((a, b) => a.du.localeCompare(b.du));
}
function pjSpan(p) {
  const et = pjEtapesDatees(p);
  if (!et.length) return null;
  return { du: et[0].du, au: et.map(e => pjEtapeDates(e).au).sort().pop() };
}

// ── Les gens ─────────────────────────────────────────────────────────────────
// Une personne sur un projet : un talent / technicien de la bible (ref = son id)
// ou un nom libre (quelqu'un de Widen, un freelance pas encore dans la bible).
function pjTalent(ref) { return ref == null ? null : (db.talents || []).find(t => t.id === ref); }
function pjNomTalent(t) { return [t.prenom, t.nom].filter(Boolean).join(' ').trim() || 'Sans nom'; }
function pjNomPersonne(a) { const t = pjTalent(a.ref); return t ? pjNomTalent(t) : (a.nom || '').trim(); }
function pjNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function pjCle(a) { return a.ref != null && pjTalent(a.ref) ? 't' + a.ref : 'n:' + pjNorm(a.nom); }

// Les choix du champ « personne » : talents de la bible et contacts Widen
function pjChoixGens() {
  const out = [];
  const cat = t => { const c = (t.cats || []).map(id => catById(id)).find(Boolean); return c ? c.label : ''; };
  (db.talents || []).forEach(t => out.push({ label: pjNomTalent(t) + (cat(t) ? ' · ' + cat(t) : ''), ref: t.id }));
  const vus = new Set(out.map(o => pjNorm(o.label.split(' · ')[0])));
  ((db.prod && db.prod.contacts) || []).forEach(c => {
    if (c.nom && !vus.has(pjNorm(c.nom))) out.push({ label: c.nom + ' · ' + (c.groupe || 'Contact'), nom: c.nom });
  });
  return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

// Les périodes où une personne est prise sur un projet :
// ses dates libres si on en a mis, plus les étapes cochées ;
// sans dates libres ni étape cochée, toutes les étapes (tout le projet).
function pjPeriodes(p, a) {
  const et = pjEtapesDatees(p);
  const coches = et.filter(e => (a.etapes || []).includes(e.id));
  const out = coches.length || a.du ? coches : et;
  return (a.du ? [{ du: a.du, au: a.au && a.au >= a.du ? a.au : a.du, label: 'dates choisies' }] : [])
    .concat(out.map(e => ({ ...pjEtapeDates(e), label: pjEtapeNom(e) })));
}

// ── Post-prod d'office ───────────────────────────────────────────────────────
// D'après son rôle, une personne va sur la post-prod de sa partie :
// le photographe et le retoucheur sur la post-prod photo, le réal sur la
// post-prod vidéo, le monteur sur le montage, le coloriste sur l'étalonnage,
// le sound designer sur le son. Sans étape à son nom (pas d'étape « étalonnage »),
// elle va sur toute la post-prod de sa partie.
// [rôle, partie, étapes qui lui reviennent, ne fait que la post-prod]
const PJ_ROLES_POSTPROD = [
  [/retouch/, 'photo', /retouch/, true],
  [/photograph|photographe|^photo$/, 'photo', null, false],
  [/colori|etalonn|grading/, 'video', /etalo|grading|colou?r/, true],
  [/sound|\bson\b|mixeu|mixage|\bmix\b|musique|music|compos|audio/, 'video', /\bson\b|sound|mix|musique|music|audio/, true],
  [/monteu|monteuse|editor|\bmontage\b|\bedit\b/, 'video', /montage|\bedit|\bv\d|feedback|retour|conform|offline|online/, true],
  [/post ?-?prod/, null, null, true],
  [/\breal\b|\breals\b|realisat|director/, 'video', null, false],
];
function pjRolePostProd(role) {
  const r = pjNorm(role);
  if (!r) return null;
  for (const [re, piste, motif, seulPost] of PJ_ROLES_POSTPROD) {
    if (!re.test(r)) continue;
    // « Art director », « Director of photography », « Casting director »… ne font pas la post-prod
    if (re === PJ_ROLES_POSTPROD[6][0] && /art|photograph|\bdop\b|casting|production|creati|artistique|photo/.test(r)) return null;
    return { piste: piste === null ? (/film|video/.test(r) ? 'video' : /photo/.test(r) ? 'photo' : '') : piste, motif, seulPost };
  }
  return null;
}
// Parmi des étapes, celles de post-prod qui reviennent à ce rôle
function pjEtapesPourRole(role, etapes) {
  const pp = pjRolePostProd(role);
  if (!pp) return [];
  const siennes = etapes.filter(e => e.type === 'postprod' && (!pp.piste || (pp.piste === 'photo' ? pjPisteDe(e) === 'photo' : pjPisteDe(e) !== 'photo')));
  const precises = pp.motif ? siennes.filter(e => pp.motif.test(pjNorm(pjEtapeNom(e)))) : [];
  return precises.length ? precises : siennes;
}
// Ajoute à une personne de l'équipe les étapes de post-prod de son rôle.
// Si elle était sur « tout le projet » : le monteur, le coloriste… ne gardent
// que leur post-prod ; le réal et le photographe gardent aussi le reste de leur
// partie (prépa, tournage…), sans la post-prod des autres.
function pjMettreSurPostProd(p, a, ids) {
  ids = ids || pjEtapesPourRole(a.role, pjEtapesDatees(p)).map(e => e.id);
  if (!ids.length) return false;
  const avant = (a.etapes || []).slice();
  if (!avant.length && !a.du) {
    const pp = pjRolePostProd(a.role);
    a.etapes = pp.seulPost ? [] : pjEtapesDatees(p).filter(e => e.type !== 'postprod' && (!pp.piste || [pp.piste, ''].includes(pjPisteDe(e)))).map(e => e.id);
  }
  ids.forEach(id => { if (!a.etapes.includes(id)) a.etapes.push(id); });
  return a.etapes.length !== avant.length;
}

// ── Options de la fiche de suivi (onglet OPTIONS TEAM, envoyé par PROJETS WIDEN)
// Une option compte comme « pris » sauf si elle est relâchée, refusée, N/A…
function pjOptionLibre(statut) { return /n\/?a\b|relach|release|over budget|pas retenu|pas dispo|annul|trop/i.test(pjNorm(statut)); }
function pjOptionDates(o) { return (o.dispos || []).filter(d => d.date && !pjOptionLibre(d.statut)); }
function pjTalentPour(nom, mail) {
  const m = pjNorm(mail);
  const n = pjNorm(String(nom || '').replace(/\(.*?\)/g, ''));
  return (db.talents || []).find(t => m && pjNorm(t.mail) === m)
    || (n ? (db.talents || []).find(t => pjNorm(pjNomTalent(t)) === n || pjNorm([t.nom, t.prenom].join(' ')) === n) : null);
}
// L'option vue comme une personne : le talent de la bible s'il existe, sinon le nom
function pjOptionPersonne(o) {
  const t = pjTalentPour(o.nom, o.mail);
  return t ? { ref: t.id, nom: '', role: o.role, opt: o } : { ref: null, nom: o.nom, role: o.role, opt: o };
}

// ── Conflits : une même personne sur deux projets aux mêmes dates ────────────
function pjConflits() {
  const prises = {};
  pjList().forEach(p => {
    if (p.statut === 'annule') return;
    (p.equipe || []).forEach(a => {
      if (!pjNomPersonne(a)) return;
      const cle = pjCle(a);
      pjPeriodes(p, a).forEach(per => (prises[cle] = prises[cle] || []).push({ p, a, per }));
    });
    // Options de la fiche de suivi (OPTIONS TEAM), sauf pour qui est déjà dans l'équipe du projet
    const dansEquipe = new Set((p.equipe || []).filter(a => pjNomPersonne(a)).map(pjCle));
    (p.options || []).forEach(o => {
      const a = pjOptionPersonne(o);
      const cle = pjCle(a);
      if (!o.nom || dansEquipe.has(cle)) return;
      pjOptionDates(o).forEach(d => (prises[cle] = prises[cle] || []).push({ p, a, per: { du: d.date, au: d.date, label: d.statut } }));
    });
  });
  const out = [];
  Object.entries(prises).forEach(([cle, l]) => {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const x = l[i], y = l[j];
      if (x.p.id === y.p.id) continue;
      if (x.per.du > y.per.au || y.per.du > x.per.au) continue;
      out.push({ cle, nom: pjNomPersonne(x.a), x, y, du: x.per.du > y.per.du ? x.per.du : y.per.du, au: x.per.au < y.per.au ? x.per.au : y.per.au });
    }
  });
  return out.sort((a, b) => a.du.localeCompare(b.du));
}
function pjConflitsDe(p, a) {
  return pjConflits().filter(c => (c.x.p.id === p.id && (!a || c.x.a === a)) || (c.y.p.id === p.id && (!a || c.y.a === a)));
}
// Vu depuis le projet p : l'autre côté du conflit
function pjAutre(c, p) { return c.x.p.id === p.id ? c.y : c.x; }
function pjMien(c, p) { return c.x.p.id === p.id ? c.x : c.y; }

// ── Navigation ───────────────────────────────────────────────────────────────
function pjGo(vue, id) {
  if (vue === 'ts' && pjVue !== 'ts') pjTsDepuis = pjVue === 'projet' && pjCur() ? pjId : null;
  pjVue = vue;
  if (id !== undefined && id !== pjId) { pjId = id; pjMois = ''; pjOptionsOuvert = false; pjRetroOuvert = false; pjEtapesOuvert = false; pjAffOuvert = new Set(); if (pjRetro && !pjRetro.enCours) pjRetro = null; }
  buildTabs();
  render();
  window.scrollTo(0, 0);
}

// Retour depuis une travel sheet : le projet d'où on venait, sinon la liste des travel sheets
function pjRetourTs() {
  const s = tsById(tsId);
  const dest = (pjTsDepuis && pjById(pjTsDepuis)) || (s && s.projetId && pjById(s.projetId));
  if (dest) { pjGo('projet', dest.id); return; }
  pjMode = 'travel';
  pjGo('liste');
}

function buildPjTabs(nav) {
  if (pjVue === 'ts' && tsById(tsId)) {
    const s = tsById(tsId);
    const dest = (pjTsDepuis && pjById(pjTsDepuis)) || (s.projetId && pjById(s.projetId));
    nav.style.display = '';
    nav.innerHTML = `<button class="crumb-back" onclick="pjRetourTs()">← ${esc((dest ? pjTitre(dest) : 'TRAVEL SHEETS').toUpperCase())}</button>
      <span class="crumb-sep">/</span>
      <span class="crumb-title"><span class="ch-dot" style="background:#3c6e8f"></span>${esc((s.voyageur || 'Nouvelle travel sheet').toUpperCase())}</span>`;
    return;
  }
  if (pjVue !== 'projet' || !pjCur()) { nav.innerHTML = ''; nav.style.display = 'none'; return; }
  const p = pjCur();
  nav.style.display = '';
  nav.innerHTML = `<button class="crumb-back" onclick="pjGo('liste')">← PROJETS</button>
    <span class="crumb-sep">/</span>
    <span class="crumb-title"><span class="ch-dot" style="background:${esc(pjCouleur(p))}"></span>${esc((pjTitre(p) || 'Nouveau projet').toUpperCase())}</span>`;
}

function renderProjets(main) {
  pjEnDessin = true;
  try {
    if (pjVue === 'ts' && tsById(tsId)) renderTsEditor(main);
    else if (pjVue === 'projet' && pjCur()) renderPjProjet(main);
    else { pjVue = 'liste'; renderPjListe(main); }
  } finally { pjEnDessin = false; }
}

// ── Vue globale ──────────────────────────────────────────────────────────────
function pjFiltres() {
  const q = pjNorm(pjQ);
  return pjList().filter(p => {
    if (pjFStatut === '' && (p.statut === 'livre' || p.statut === 'annule')) return false;
    if (pjFStatut && pjFStatut !== 'tous' && p.statut !== pjFStatut) return false;
    if (!q) return true;
    return [p.code, p.nom, p.client, ...(p.equipe || []).map(pjNomPersonne), ...(p.options || []).map(o => o.nom)].some(v => pjNorm(v).includes(q));
  }).sort((a, b) => {
    const sa = pjSpan(a), sb = pjSpan(b);
    if (sa && sb) return sa.du.localeCompare(sb.du);
    if (sa || sb) return sa ? -1 : 1;
    return (b.maj || 0) - (a.maj || 0);
  });
}

function pjAlertesHtml(conflits, p) {
  if (!conflits.length) return '';
  return `<div class="pj-alertes">
    <div class="pj-alertes-titre">⚠ ${conflits.length === 1 ? 'UN CONFLIT DE DATES' : conflits.length + ' CONFLITS DE DATES'}</div>
    ${conflits.map(c => {
      const a = p ? pjMien(c, p) : c.x, b = p ? pjAutre(c, p) : c.y;
      const lien = q => `<a href="#" onclick="event.preventDefault();pjGo('projet', ${q.p.id})">${esc(pjTitre(q.p))}</a> <small>(${esc(q.per.label)})</small>`;
      return `<div class="pj-alerte"><b>${esc(c.nom)}</b> est sur ${p ? '' : lien(a) + ' et '}${lien(b)}${p ? ` pendant ${esc(a.per.label)}` : ''} : ${esc(pjPeriodeTexte(c.du, c.au))}</div>`;
    }).join('')}
  </div>`;
}

function renderPjListe(main) {
  const list = pjFiltres();
  const conflits = pjConflits();
  const modes = [['liste', 'LISTE'], ['planning', 'PLANNING'], ['personnes', 'PERSONNES'], ['travel', 'TRAVEL SHEETS']];
  main.innerHTML = `<div class="toolbar">
      <div class="search-wrap"><input id="pj-q" placeholder="Projet, client, personne..." value="${esc(pjQ)}" oninput="pjQ=this.value;pjRedessinerListe()"></div>
      <select class="filter-sel"${pjMode === 'travel' ? ' style="display:none"' : ''} onchange="pjFStatut=this.value;pjRedessinerListe()">
        <option value=""${pjFStatut === '' ? ' selected' : ''}>En cours</option>
        <option value="tous"${pjFStatut === 'tous' ? ' selected' : ''}>Tous les projets</option>
        ${PJ_STATUTS.map(s => `<option value="${s[0]}"${pjFStatut === s[0] ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}
      </select>
      <div class="pj-modes">${modes.map(m => `<button type="button" class="${pjMode === m[0] ? 'on' : ''}" onclick="pjSetMode('${m[0]}')">${m[1]}</button>`).join('')}</div>
      <div class="spacer"></div>
      ${pjMode === 'travel' ? '<button class="btn-add" onclick="tsNouvelle()">+ NOUVELLE TRAVEL SHEET</button>' : '<button class="btn-add" onclick="pjNouveau()">+ NOUVEAU PROJET</button>'}
    </div>
    ${pjAlertesHtml(conflits)}
    <div id="pj-liste-corps">${pjCorpsListe(list)}</div>`;
}

// Redessine seulement le corps (la recherche garde le focus)
function pjRedessinerListe() {
  const c = document.getElementById('pj-liste-corps');
  if (c) c.innerHTML = pjCorpsListe(pjFiltres());
}

function pjSetMode(m) {
  pjMode = m;
  try { localStorage.setItem('pjMode', m); } catch {}
  render();
}

function pjCorpsListe(list) {
  if (pjMode === 'travel') return pjTsListeHtml();
  if (!list.length) return `<div class="empty">${pjList().length ? 'AUCUN PROJET ICI' : 'AUCUN PROJET POUR LE MOMENT'}</div>`;
  if (pjMode === 'planning') return pjPlanningHtml(list);
  if (pjMode === 'personnes') return pjPersonnesHtml(list);
  const conflits = pjConflits();
  const auj = pjAujourdhui();
  return `<div class="pj-table">
    <div class="pj-tr pj-th"><span>PROJET</span><span>CLIENT</span><span>DATES</span><span>ÉTAPE EN COURS / SUIVANTE</span><span>ÉQUIPE</span><span>STATUT</span></div>
    ${list.map(p => {
      const sp = pjSpan(p);
      const st = pjStatut(p.statut);
      const et = pjEtapesDatees(p);
      const enCours = et.find(e => e.du <= auj && pjEtapeDates(e).au >= auj) || et.find(e => e.du > auj);
      const nb = conflits.filter(c => c.x.p.id === p.id || c.y.p.id === p.id).length;
      const n = (p.equipe || []).filter(a => pjNomPersonne(a)).length;
      return `<div class="pj-tr" onclick="pjGo('projet', ${p.id})">
        <span class="pj-nom"><span class="ch-dot" style="background:${esc(pjCouleur(p))}"></span>${p.code ? `<span class="pj-code">${esc(p.code)}</span>` : ''}${esc(p.nom || 'Sans nom')}${nb ? ` <span class="pj-warn" title="Conflits de dates">⚠ ${nb}</span>` : ''}</span>
        <span class="pj-muted">${esc(p.client || '')}</span>
        <span>${sp ? esc(pjPeriodeTexte(sp.du, sp.au)) : '<span class="pj-muted">pas de dates</span>'}</span>
        <span>${enCours ? `<span class="pj-chip" style="--c:${pjEtapeType(enCours.type)[2]}">${esc(pjEtapeNom(enCours))}</span> <small class="pj-muted">${esc(pjDateCourte(enCours.du))}</small>` : ''}</span>
        <span class="pj-muted">${n ? n + (n > 1 ? ' personnes' : ' personne') : ''}</span>
        <span><span class="pj-statut" style="--c:${st[2]}">${esc(st[1])}</span></span>
      </div>`;
    }).join('')}
  </div>`;
}

// Planning de tous les projets : une ligne par projet, une barre par étape
function pjPlanningHtml(list) {
  if (!pjPlanDebut) pjPlanDebut = pjMoisPlus(pjAujourdhui().slice(0, 7), 0);
  const NB = 4;
  const debut = pjPlanDebut + '-01';
  const fin = pjPlusJours(pjMoisPlus(pjPlanDebut, NB) + '-01', -1);
  const total = pjJours(debut, fin) + 1;
  const pos = d => (pjJours(debut, d) / total) * 100;
  const mois = Array.from({ length: NB }, (_, i) => pjMoisPlus(pjPlanDebut, i));
  const auj = pjAujourdhui();
  const ligneAuj = auj >= debut && auj <= fin ? `<div class="pj-plan-auj" style="left:${pos(auj)}%"></div>` : '';
  const grille = mois.map(m => `<div class="pj-plan-sep" style="left:${pos(m + '-01')}%"></div>`).join('');
  return `<div class="pj-plan-nav">
      <button type="button" class="btn-upload" onclick="pjPlanDebut=pjMoisPlus(pjPlanDebut,-1);pjRedessinerListe()">‹</button>
      <button type="button" class="btn-upload" onclick="pjPlanDebut='';pjRedessinerListe()">AUJOURD'HUI</button>
      <button type="button" class="btn-upload" onclick="pjPlanDebut=pjMoisPlus(pjPlanDebut,1);pjRedessinerListe()">›</button>
      <span class="pj-legende">${PJ_ETAPES.map(t => `<span class="pj-chip" style="--c:${t[2]}">${t[1]}</span>`).join('')}</span>
    </div>
    <div class="pj-plan-scroll"><div class="pj-plan">
      <div class="pj-plan-row pj-plan-head"><div class="pj-plan-nom"></div><div class="pj-plan-piste">
        ${mois.map(m => { const [y, mm] = m.split('-').map(Number); return `<div class="pj-plan-mois" style="left:${pos(m + '-01')}%">${PJ_MOIS[mm - 1]} ${y}</div>`; }).join('')}
      </div></div>
      ${list.map(p => {
        const barres = pjEtapesDatees(p).map(e => {
          const d = pjEtapeDates(e);
          if (d.au < debut || d.du > fin) return '';
          const a = d.du < debut ? debut : d.du, b = d.au > fin ? fin : d.au;
          const pi = pjPisteInfo(pjPisteDe(e));
          return `<div class="pj-plan-barre" style="left:${pos(a)}%;width:${Math.max((pjJours(a, b) + 1) / total * 100, .6)}%;--c:${pjEtapeType(e.type)[2]}${pi ? ';--p:' + pi[2] : ''}"${pi ? ` data-piste="${pi[0]}"` : ''} title="${esc(pjEtapeNom(e) + (pi ? ' · ' + pi[1] : '') + ' · ' + pjPeriodeTexte(d.du, d.au))}"><span>${esc(pjEtapeNom(e))}</span></div>`;
        }).join('');
        return `<div class="pj-plan-row" onclick="pjGo('projet', ${p.id})">
          <div class="pj-plan-nom"><span class="ch-dot" style="background:${esc(pjCouleur(p))}"></span>${esc(pjTitre(p))}</div>
          <div class="pj-plan-piste">${grille}${ligneAuj}${barres}</div>
        </div>`;
      }).join('')}
    </div></div>`;
}

// Par personne : sur quoi chacun est pris, et quand
function pjPersonnesHtml(list) {
  const ids = new Set(list.map(p => p.id));
  const conflits = pjConflits();
  const gens = {};
  list.forEach(p => (p.equipe || []).forEach(a => {
    const nom = pjNomPersonne(a);
    if (!nom) return;
    const cle = pjCle(a);
    const g = gens[cle] = gens[cle] || { nom, ref: pjTalent(a.ref) ? a.ref : null, lignes: [] };
    const per = pjPeriodes(p, a);
    g.lignes.push({ p, a, per, du: per.length ? per.map(x => x.du).sort()[0] : '' });
  }));
  const l = Object.entries(gens).sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'));
  if (!l.length) return '<div class="empty">PERSONNE N\'EST ENCORE SUR CES PROJETS</div>';
  return `<div class="pj-gens">${l.map(([cle, g]) => {
    const nbc = conflits.filter(c => c.cle === cle && ids.has(c.x.p.id) && ids.has(c.y.p.id)).length;
    return `<div class="pj-gens-bloc">
      <div class="pj-gens-nom">${g.ref != null ? `<a href="#" onclick="event.preventDefault();openDetail('talent', ${g.ref})">${esc(g.nom)}</a>` : esc(g.nom)}${nbc ? ` <span class="pj-warn">⚠ ${nbc === 1 ? 'conflit' : nbc + ' conflits'}</span>` : ''}</div>
      ${g.lignes.sort((a, b) => (a.du || '9').localeCompare(b.du || '9')).map(x => `<div class="pj-gens-ligne" onclick="pjGo('projet', ${x.p.id})">
        <span class="ch-dot" style="background:${esc(pjCouleur(x.p))}"></span>
        <span class="pj-gens-projet">${esc(pjTitre(x.p))}${x.a.role ? ` <small class="pj-muted">${esc(x.a.role)}</small>` : ''}</span>
        <span class="pj-muted">${x.per.length ? x.per.map(per => esc(per.label + ' ' + pjPeriodeTexte(per.du, per.au))).join(' · ') : 'pas de dates'}</span>
      </div>`).join('')}
    </div>`;
  }).join('')}</div>`;
}

// Toutes les travel sheets, avec leur projet (la recherche filtre aussi ici)
function pjTsListeHtml() {
  const q = pjNorm(pjQ);
  const l = tsList().filter(s => {
    if (!q) return true;
    const pj = s.projetId && pjById(s.projetId);
    return [s.voyageur, s.client, s.projet, pj ? pjTitre(pj) : '', ...(s.trajets || []).flatMap(t => [t.numero, t.de, t.a])].some(v => pjNorm(v).includes(q));
  }).sort((a, b) => (tsPremiereDate(b) || '').localeCompare(tsPremiereDate(a) || '') || (b.maj || 0) - (a.maj || 0));
  if (!l.length) return `<div class="empty">${tsList().length ? 'AUCUN RÉSULTAT' : 'AUCUNE TRAVEL SHEET POUR LE MOMENT'}</div>`;
  return `<div class="pj-table">${l.map(pjTsLigneHtml).join('')}</div>`;
}

function pjTsLigneHtml(s, avecProjet = true) {
  const d = tsPremiereDate(s);
  const pj = s.projetId && pjById(s.projetId);
  return `<div class="pj-ts-ligne" onclick="prodGo('sheet', ${s.id})">
    <span class="pj-nom"><span class="ch-dot" style="background:#3c6e8f"></span>${esc(s.voyageur || 'Sans nom')}</span>
    <span class="pj-muted">${esc(avecProjet ? (pj ? pjTitre(pj) : [s.client, s.projet].filter(Boolean).join(' ') || 'sans projet') : [s.client, s.projet].filter(Boolean).join(' '))}</span>
    <span class="pj-muted">${d ? esc(tsDateCourte(d)) : ''}</span>
  </div>`;
}

// Bloc TRAVEL SHEETS d'un projet : ses feuilles, en créer une, en rattacher une existante
function pjTravelHtml(p) {
  const siennes = tsList().filter(s => s.projetId === p.id)
    .sort((a, b) => (tsPremiereDate(a) || '9').localeCompare(tsPremiereDate(b) || '9'));
  const libres = tsList().filter(s => !s.projetId || !pjById(s.projetId));
  return `<section class="ts-bloc">
    <h3>TRAVEL SHEETS${siennes.length ? ` <small class="pj-muted">· ${siennes.length}</small>` : ''}</h3>
    ${siennes.length ? `<div class="pj-ts-liste">${siennes.map(s => pjTsLigneHtml(s, false)).join('')}</div>` : '<p class="field-hint">Aucune travel sheet pour ce projet.</p>'}
    <div class="ts-add-row">
      <button type="button" class="btn-upload" onclick="tsNouvelle(null, ${p.id})">+ NOUVELLE TRAVEL SHEET</button>
      ${libres.length ? `<select class="filter-sel pj-ts-rattacher" onchange="pjRattacherTs(this.value)">
        <option value="">Rattacher une travel sheet existante…</option>
        ${libres.map(s => `<option value="${s.id}">${esc([s.voyageur || 'Sans nom', [s.client, s.projet].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</option>`).join('')}
      </select>` : ''}
    </div>
  </section>`;
}

function pjRattacherTs(v) {
  const p = pjCur();
  const s = v && tsById(Number(v));
  if (!p || !s) return;
  s.projetId = p.id;
  s.maj = Date.now();
  pjChange(true);
}

function pjNouveau() {
  const p = {
    id: uid(), nom: '', client: '', statut: 'confirme', notes: '',
    couleur: PJ_COULEURS[pjList().length % PJ_COULEURS.length],
    etapes: [], equipe: [], maj: Date.now(),
  };
  pjList().push(p);
  saveDb();
  pjGo('projet', p.id);
  const n = document.querySelector('.pj-page [data-k="nom"]');
  if (n) n.focus();
}

// ── Page d'un projet ─────────────────────────────────────────────────────────
let pjSaveTimer = null;

// Une modification en cours sur ce projet : la synchro ne doit pas l'écraser
function pjEnEdition() {
  if (!document.querySelector('.pj-page')) return false;
  const f = document.activeElement;
  return !!pjSaveTimer || !!(f && f.closest && f.closest('.pj-page') && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName));
}
function pjReprendre(p) {
  const list = pjList();
  const i = list.findIndex(x => x.id === p.id);
  if (i >= 0) list[i] = p; else list.push(p);
}

function pjChange(redessiner) {
  const p = pjCur();
  if (!p) return;
  p.maj = Date.now();
  clearTimeout(pjSaveTimer);
  pjSaveTimer = setTimeout(() => { pjSaveTimer = null; saveDb(); }, 700);
  if (redessiner) pjRedessiner();
}

// Redessine la page en gardant la position et le champ où l'on écrit.
// Si on est en train de cliquer (un champ qui perd le focus déclenche le
// redessin), on attend la fin du clic, sinon le bouton visé disparaîtrait.
let pjAppui = false, pjAttente = false;
document.addEventListener('pointerdown', () => { pjAppui = true; }, true);
document.addEventListener('pointerup', () => {
  pjAppui = false;
  if (pjAttente) { pjAttente = false; setTimeout(pjRedessiner, 0); }
}, true);

function pjRedessiner() {
  if (pjEnDessin) return;
  if (pjAppui) { pjAttente = true; return; }
  if (!enProjets()) return;
  const y = window.scrollY;
  const f = document.activeElement;
  const cle = f && f.dataset && f.dataset.k ? [f.dataset.k, f.dataset.l || '', f.dataset.i || ''] : null;
  render();
  window.scrollTo(0, y);
  if (!cle) return;
  const el = [...document.querySelectorAll('.pj-page [data-k]')].find(x => x.dataset.k === cle[0] && (x.dataset.l || '') === cle[1] && (x.dataset.i || '') === cle[2]);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (el.type === 'text' && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
}

// data-k="nom" : champ du projet ; data-l="etapes" data-i="<id>" data-k="du" : champ d'une ligne
function pjInput(el, redessiner) {
  const p = pjCur();
  if (!p) return;
  const v = el.value;
  if (el.dataset.l) {
    const row = (p[el.dataset.l] || []).find(r => String(r.id) === el.dataset.i);
    if (!row) return;
    row[el.dataset.k] = v;
    if (el.dataset.k === 'du' && v && (!row.au || row.au < v)) row.au = v;
    // Le calendrier montre le mois de l'étape qu'on vient de dater
    if (el.dataset.l === 'etapes' && el.dataset.k === 'du' && v) pjMois = v.slice(0, 7);
  } else p[el.dataset.k] = v;
  if (el.dataset.k === 'nom' && !el.dataset.l) buildTabs();
  pjChange(redessiner);
}

function pjField(label, k, v, opts = {}) {
  const ligne = opts.l ? ` data-l="${opts.l}" data-i="${opts.i}"` : '';
  const attrs = `data-k="${k}"${ligne}`;
  let input;
  if (opts.textarea) input = `<textarea rows="${opts.rows || 3}" ${attrs} oninput="pjInput(this)" placeholder="${esc(opts.ph || '')}">${esc(v || '')}</textarea>`;
  else if (opts.select) input = `<select ${attrs} onchange="pjInput(this, true)">${opts.select.map(([val, lab]) => `<option value="${val}"${v === val ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  else if (opts.type === 'date') input = `<input type="date" ${attrs} value="${esc(v || '')}" onchange="pjInput(this, true)">`;
  else input = `<input type="${opts.type || 'text'}" ${attrs} value="${esc(v || '')}" placeholder="${esc(opts.ph || '')}" oninput="pjInput(this)"${opts.change ? ' onchange="pjRedessiner()"' : opts.onchange ? ` onchange="${opts.onchange}"` : ''}>`;
  return `<div class="field${opts.full ? ' full' : ''}${opts.cls ? ' ' + opts.cls : ''}"><label>${esc(label)}</label>${input}</div>`;
}

function renderPjProjet(main) {
  const p = pjCur();
  const conflits = pjConflitsDe(p);
  const choix = pjChoixGens();
  main.innerHTML = pjPageHtml(p, conflits, choix);
}

function pjPageHtml(p, conflits, choix) {
  return `<div class="pj-page">
    ${pjAlertesHtml(conflits, p)}
    <section class="ts-bloc">
      <h3>PROJET</h3>
      <div class="ts-grid pj-grid-infos">
        ${pjField('NOM DU PROJET', 'nom', p.nom, { ph: 'ex : IKKS FW26', change: true })}
        ${pjField('CLIENT', 'client', p.client, { ph: 'ex : IKKS' })}
        ${pjField('STATUT', 'statut', p.statut, { select: PJ_STATUTS.map(s => [s[0], s[1]]) })}
        <div class="field pj-couleur"><label>COULEUR</label><input type="color" value="${esc(pjCouleur(p))}" data-k="couleur" onchange="pjInput(this, true)"></div>
      </div>
      ${pjInfosTableauHtml(p)}
    </section>

    <section class="ts-bloc">
      <h3>CALENDRIER</h3>
      ${pjCalendrierHtml(p)}
      ${pjEtapesBlocHtml(p)}
      ${pjRetroBlocHtml(p)}
    </section>

    <section class="ts-bloc">
      <h3>ÉQUIPE</h3>
      <datalist id="pj-gens">${choix.map(c => `<option value="${esc(c.label)}"></option>`).join('')}</datalist>
      <div class="pj-equipe">${(p.equipe || []).map(a => pjAffectationHtml(p, a)).join('') || '<p class="field-hint">Personne pour le moment. Les talents et techniciens de la bible sont proposés quand tu tapes un nom ; tu peux aussi écrire n\'importe quel nom.</p>'}</div>
      <div class="ts-add-row"><button type="button" class="btn-upload" onclick="pjAjouterPersonne()">+ PERSONNE</button></div>
    </section>

    ${pjOptionsHtml(p)}

    ${pjTravelHtml(p)}

    <section class="ts-bloc">
      <h3>NOTES</h3>
      ${pjField('', 'notes', p.notes, { textarea: true, rows: 4, full: true, ph: 'Infos utiles, liens (devis, Dropbox, rétroplanning)…' })}
    </section>

    <div class="ts-actions">
      <button type="button" class="btn-del" onclick="pjSupprimer()">✕ SUPPRIMER LE PROJET</button>
      <div class="spacer"></div>
      <button type="button" class="btn-save" onclick="pjGo('liste')">TERMINÉ</button>
    </div>
  </div>`;
}

// Calendrier du mois : chaque jour montre les étapes qui le couvrent
function pjCalendrierHtml(p) {
  const et = pjEtapesDatees(p);
  if (!pjMois) {
    const auj = pjAujourdhui();
    const sp = pjSpan(p);
    pjMois = (sp && (auj < sp.du || auj > sp.au) ? sp.du : auj).slice(0, 7);
  }
  const [y, m] = pjMois.split('-').map(Number);
  const premier = new Date(y, m - 1, 1);
  const decal = (premier.getDay() + 6) % 7;           // lundi en premier
  const debut = pjPlusJours(pjIso(premier), -decal);
  const nbJours = new Date(y, m, 0).getDate();
  const nbCases = Math.ceil((decal + nbJours) / 7) * 7;
  const auj = pjAujourdhui();
  const ordre = e => ['', 'video', 'photo'].indexOf(pjPisteDe(e));
  const pistes = PJ_PISTES.filter(x => et.some(e => pjPisteDe(e) === x[0]));
  const cases = Array.from({ length: nbCases }, (_, i) => {
    const d = pjPlusJours(debut, i);
    const dedans = d.slice(0, 7) === pjMois;
    const ici = et.filter(e => { const x = pjEtapeDates(e); return d >= x.du && d <= x.au; })
      .sort((a, b) => ordre(a) - ordre(b));
    return `<div class="pj-jour${dedans ? '' : ' hors'}${d === auj ? ' auj' : ''}">
      <span class="pj-jour-num">${pjDate(d).getDate()}</span>
      ${ici.map(e => pjChipHtml(e)).join('')}
    </div>`;
  }).join('');
  return `<div class="pj-cal-nav">
      <button type="button" class="btn-upload" onclick="pjMois=pjMoisPlus(pjMois,-1);pjRedessiner()">‹</button>
      <span class="pj-cal-titre">${PJ_MOIS[m - 1]} ${y}</span>
      <button type="button" class="btn-upload" onclick="pjMois=pjMoisPlus(pjMois,1);pjRedessiner()">›</button>
    </div>
    <div class="pj-cal">
      ${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(j => `<div class="pj-cal-jsem">${j}</div>`).join('')}
      ${cases}
    </div>
    ${pistes.length ? `<div class="pj-legende pj-cal-legende">${pistes.map(x => `<span class="pj-chip" data-piste="${x[0]}" style="--p:${x[2]}">${x[1]}</span>`).join('')}<span class="pj-muted">· sans couleur : commun · le trait à gauche donne le type d'étape</span></div>` : ''}`;
}

// Une étape dans le calendrier : la couleur de sa piste (vidéo, photo), le trait de son type
function pjChipHtml(e) {
  const pi = pjPisteInfo(pjPisteDe(e));
  const titre = pjEtapeNom(e) + (pi ? ' · ' + pi[1] : '') + ' · ' + pjEtapeType(e.type)[1];
  return pi
    ? `<span class="pj-chip" data-piste="${pi[0]}" style="--c:${pjEtapeType(e.type)[2]};--p:${pi[2]}" title="${esc(titre)}">${esc(pjEtapeNom(e))}</span>`
    : `<span class="pj-chip" style="--c:${pjEtapeType(e.type)[2]}" title="${esc(titre)}">${esc(pjEtapeNom(e))}</span>`;
}

// La liste des étapes à modifier, repliée une fois qu'il y en a (le calendrier suffit pour lire)
function pjEtapesBlocHtml(p) {
  const toutes = pjEtapesDatees(p).concat((p.etapes || []).filter(e => !pjEtapeDates(e)));
  const ouvert = pjEtapesOuvert || !toutes.length;
  const groupes = [['', 'COMMUN']].concat(PJ_PISTES.map(x => [x[0], x[1].toUpperCase()]))
    .map(([k, lab]) => [lab, toutes.filter(e => pjPisteDe(e) === k)]).filter(g => g[1].length);
  const avecTitres = groupes.length > 1 || (groupes[0] && groupes[0][0] !== 'COMMUN');
  return `<details class="pj-sous-bloc"${ouvert ? ' open' : ''} ontoggle="if(this.open!==${ouvert})pjEtapesOuvert=this.open">
    <summary><span class="pj-sous-titre">ÉTAPES</span> <small class="pj-muted">${toutes.length ? `${toutes.length} · modifier les dates, ajouter une étape` : 'aucune pour le moment'}</small></summary>
    <div class="pj-etapes">${groupes.map(([lab, l]) => (avecTitres ? `<div class="pj-etapes-groupe">${lab}</div>` : '') + l.map(e => pjEtapeHtml(e)).join('')).join('') || '<p class="field-hint">Aucune étape. Importe le rétroplanning ci-dessous, ou ajoute la prépa, le tournage, la post-prod… avec leurs dates.</p>'}</div>
    <div class="ts-add-row">${PJ_ETAPES.map(t => `<button type="button" class="btn-upload" onclick="pjAjouterEtape('${t[0]}')">+ ${t[1].toUpperCase()}</button>`).join('')}</div>
  </details>`;
}

// L'import du rétroplanning, replié tant qu'on ne s'en sert pas
function pjRetroBlocHtml(p) {
  const r = pjRetro && pjRetro.pid === p.id ? pjRetro : null;
  const ouvert = pjRetroOuvert || !!r;
  const dernier = p.retro && p.retro.fichier ? `dernier import : « ${esc(p.retro.fichier)} »${p.retro.date ? ' le ' + esc(pjDateCourte(p.retro.date)) : ''}` : 'Excel, PDF ou capture, lu automatiquement';
  return `<details class="pj-sous-bloc pj-retro"${ouvert ? ' open' : ''} ontoggle="if(this.open!==${ouvert})pjRetroOuvert=this.open">
    <summary><span class="pj-sous-titre">IMPORTER UN RÉTROPLANNING</span> <small class="pj-muted">${r && r.enCours ? 'lecture en cours…' : dernier}</small></summary>
    ${pjRetroHtml(p)}
  </details>`;
}

// Ce qui vient du tableau PROJETS WIDEN (lecture seule) et les liens
function pjInfosTableauHtml(p) {
  const lignes = [['N°', p.code], ['PRODUCER', p.producer], ['DATES', p.datesTexte], ['LIEU', p.lieu], ['USAGES', p.usages], ['LIVRABLES', p.livrables]]
    .filter(l => l[1]);
  const liens = [[p.lienFiche, 'FICHE DE SUIVI'], [p.lienDropbox, 'DOSSIER DROPBOX']].filter(l => /^https?:\/\//.test(l[0] || ''));
  if (!lignes.length && !liens.length) return '';
  return `<div class="pj-tableau">
    ${liens.length ? `<div class="pj-liens">${liens.map(l => `<a class="btn-upload" href="${esc(l[0])}" target="_blank" rel="noopener">${l[1]} ↗</a>`).join('')}</div>` : ''}
    ${lignes.length ? `<dl>${lignes.map(l => `<dt>${l[0]}</dt><dd>${esc(l[1])}</dd>`).join('')}</dl>` : ''}
    ${p.code ? '<p class="field-hint">Ces infos viennent du tableau PROJETS WIDEN et se mettent à jour toutes seules.</p>' : ''}
  </div>`;
}

// Onglet OPTIONS TEAM de la fiche de suivi : qui est en option, et quand
function pjOptionsHtml(p) {
  const options = p.options || [];
  if (!options.length) return p.code ? `<section class="ts-bloc"><h3>OPTIONS TEAM</h3><p class="field-hint">Personne dans l'onglet OPTIONS TEAM de la fiche de suivi pour le moment.</p></section>` : '';
  const conflits = pjConflits();
  const equipe = new Set((p.equipe || []).filter(a => pjNomPersonne(a)).map(pjCle));
  const nbConflits = conflits.filter(c => [c.x, c.y].some(q => q.p.id === p.id && q.a.opt)).length;
  return `<details class="ts-bloc pj-options-bloc"${pjOptionsOuvert ? ' open' : ''} ontoggle="pjOptionsOuvert=this.open">
    <summary><h3>OPTIONS TEAM <small class="pj-muted">· fiche de suivi · ${options.length} ${options.length > 1 ? 'personnes' : 'personne'}</small>${nbConflits ? ` <span class="pj-warn">⚠ ${nbConflits}</span>` : ''}</h3></summary>
    <div class="pj-options">${options.map((o, i) => {
      const a = pjOptionPersonne(o);
      const t = pjTalent(a.ref);
      const cle = pjCle(a);
      const dejaLa = equipe.has(cle);
      const sesConflits = conflits.filter(c => [c.x, c.y].some(q => q.p.id === p.id && q.a.opt === o));
      return `<div class="pj-option${sesConflits.length ? ' conflit' : ''}">
        <div class="pj-option-tete">
          <span class="pj-option-role">${esc(o.role || '')}</span>
          <span class="pj-option-nom">${t ? `<a href="#" onclick="event.preventDefault();openDetail('talent', ${t.id})">${esc(o.nom)}</a>` : esc(o.nom)}</span>
          <span class="pj-muted pj-option-contact">${[o.tel, o.mail].filter(Boolean).map(x => esc(x)).join(' · ')}</span>
          ${dejaLa ? '<span class="pj-muted pj-option-ok">dans l\'équipe</span>' : `<button type="button" class="btn-edit-inline" onclick="pjOptionVersEquipe(${i})">+ ÉQUIPE</button>`}
        </div>
        ${(o.dispos || []).length ? `<div class="pj-option-dispos">${o.dispos.map(d => `<span class="pj-dispo${pjOptionLibre(d.statut) ? ' libre' : ''}">${esc(d.date ? pjDateCourte(d.date) : d.label || '')} : ${esc(d.statut)}</span>`).join('')}</div>` : ''}
        ${o.notes ? `<div class="pj-muted pj-option-notes">${esc(o.notes)}</div>` : ''}
        ${sesConflits.map(c => { const b = c.x.p.id === p.id && c.x.a.opt === o ? c.y : c.x; return `<div class="pj-aff-conflit">⚠ Aussi sur <a href="#" onclick="event.preventDefault();pjGo('projet', ${b.p.id})">${esc(pjTitre(b.p))}</a> (${esc(b.per.label)}) : ${esc(pjPeriodeTexte(c.du, c.au))}</div>`; }).join('')}
      </div>`;
    }).join('')}</div>
  </details>`;
}

// « + ÉQUIPE » sur une option : la personne passe dans l'équipe, sur les dates où elle est prise
function pjOptionVersEquipe(i) {
  const p = pjCur();
  const o = p && (p.options || [])[i];
  if (!o) return;
  if (!Array.isArray(p.equipe)) p.equipe = [];
  const a = pjOptionVersAffectation(o);
  p.equipe.push(a);
  pjMettreSurPostProd(p, a);
  pjChange(true);
}
function pjOptionVersAffectation(o) {
  const a = pjOptionPersonne(o);
  const dates = pjOptionDates(o).map(d => d.date).sort();
  return { id: uid(), ref: a.ref, nom: a.nom, role: o.role || '', etapes: [], du: dates[0] || '', au: dates[dates.length - 1] || '' };
}

// Rôle tapé ou changé : la personne va d'office sur la post-prod qui lui revient
function pjRoleChange(id) {
  const p = pjCur();
  const a = pjAffectation(id);
  if (p && a && pjMettreSurPostProd(p, a)) pjChange(true);
}

// ── Import du rétroplanning ──────────────────────────────────────────────────
// Un tableur (Excel, CSV) avec des colonnes PHASE / DÉBUT / FIN, comme l'onglet
// RÉTROPLANNING des fiches de suivi, est lu directement dans le navigateur.
// Les autres (PDF, capture, tableur en grille) sont lus par le serveur (route
// /retro, avec Claude). Dans les deux cas, les étapes trouvées s'affichent
// pour être vérifiées avant d'être ajoutées au calendrier.

const PJ_XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

function pjRetroHtml(p) {
  const r = pjRetro && pjRetro.pid === p.id ? pjRetro : null;
  const occupe = r && r.enCours;
  if (r && r.etapes && r.etapes.length) {
    const n = r.etapes.filter(e => e.choisi).length;
    const pp = pjRetroPostProd(p, r);
    const nomsEtapes = idx => idx.map(i => r.etapes[i].nom || pjEtapeType(r.etapes[i].type)[1]).join(', ');
    return `<div class="pj-retro-apercu">
      <div class="pj-retro-titre">${r.fichier ? `« ${esc(r.fichier)} » · ` : ''}${r.etapes.length} ${r.etapes.length > 1 ? 'étapes trouvées' : 'étape trouvée'}, à vérifier</div>
      <div class="pj-retro-tout"><span class="pj-muted">Tout ce rétroplanning est :</span>
        ${PJ_PISTES.map(x => `<button type="button" class="btn-edit-inline" onclick="pjRetroPisteTout('${x[0]}')">${x[1].toUpperCase()}</button>`).join('')}
        <button type="button" class="btn-edit-inline" onclick="pjRetroPisteTout('')">COMMUN</button></div>
      ${r.etapes.map((e, i) => { const pi = pjPisteInfo(e.piste); return `<div class="pj-retro-ligne${e.choisi ? '' : ' off'}"${pi ? ` data-piste="${pi[0]}" style="--p:${pi[2]}"` : ''}>
        <input type="checkbox" ${e.choisi ? 'checked' : ''} onchange="pjRetro.etapes[${i}].choisi=this.checked;pjRedessiner()">
        <select onchange="pjRetro.etapes[${i}].piste=this.value;pjRedessiner()">${[['', 'Commun']].concat(PJ_PISTES.map(x => [x[0], x[1]])).map(([k, l]) => `<option value="${k}"${e.piste === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <select onchange="pjRetro.etapes[${i}].type=this.value;pjRedessiner()">${PJ_ETAPES.map(t => `<option value="${t[0]}"${e.type === t[0] ? ' selected' : ''}>${t[1]}</option>`).join('')}</select>
        <input type="text" value="${esc(e.nom)}" oninput="pjRetro.etapes[${i}].nom=this.value" onchange="pjRedessiner()">
        <input type="date" value="${esc(e.du)}" onchange="pjRetro.etapes[${i}].du=this.value">
        <input type="date" value="${esc(e.au)}" onchange="pjRetro.etapes[${i}].au=this.value">
      </div>`; }).join('')}
      ${r.msg ? `<p class="field-hint">${esc(r.msg)}</p>` : ''}
      ${pp.length ? `<div class="pj-retro-pp">
        <div class="pj-retro-titre">POST-PROD · l'équipe mise d'office sur sa partie</div>
        ${pp.map(x => `<label class="pj-retro-pp-ligne${x.choisi ? '' : ' off'}"><input type="checkbox" ${x.choisi ? 'checked' : ''} onchange="pjRetro.pp['${x.cle}']=this.checked;pjRedessiner()">
          <span><b>${esc(x.nom)}</b> <span class="pj-muted">${esc(x.role)}${x.option ? ' · options team' : ''}</span> → ${esc(nomsEtapes(x.idx))}</span></label>`).join('')}
      </div>` : ''}
      <div class="ts-add-row">
        <button type="button" class="btn-cancel" onclick="pjRetro=null;pjRedessiner()">ANNULER</button>
        <button type="button" class="btn-save" onclick="pjRetroAjouter()"${n ? '' : ' disabled'}>AJOUTER AU CALENDRIER (${n})</button>
      </div>
    </div>`;
  }
  return `<div class="pj-retro-import">
      <label class="btn-upload${occupe ? ' attente' : ''}">${occupe ? 'LECTURE…' : 'CHOISIR LE FICHIER'}<input type="file" hidden accept=".xlsx,.xlsm,.xls,.csv,.ods,application/pdf,image/*" onchange="pjRetroFichier(this)"${occupe ? ' disabled' : ''}></label>
      <span class="field-hint">Excel, PDF ou capture. Les étapes, leurs dates et leur partie (vidéo ou photo) sont lues ; tu vérifies, puis elles vont dans le calendrier, avec l'équipe sur sa post-prod. Un rétroplanning photo et un vidéo peuvent s'importer l'un après l'autre.</span>
    </div>
    <details class="pj-retro-colle"><summary>ou colle le contenu du rétroplanning</summary>
      <textarea id="pj-retro-texte" rows="4" placeholder="Copie les lignes du tableau (Excel, Google Sheets) ou le texte d'un e-mail…"></textarea>
      <div class="ts-add-row"><button type="button" class="btn-upload" onclick="pjRetroTexte()"${occupe ? ' disabled' : ''}>LIRE</button></div>
    </details>
    ${r && r.msg ? `<p class="field-hint pj-retro-msg">${esc(r.msg)}</p>` : ''}`;
}

function pjRetroPisteTout(k) {
  if (!pjRetro || !pjRetro.etapes) return;
  pjRetro.etapes.forEach(e => { e.piste = k; });
  pjRedessiner();
}

// Qui va sur quelle post-prod du rétroplanning importé : l'équipe du projet,
// et les personnes de l'OPTIONS TEAM (pas encore dans l'équipe) dont le rôle
// est de post-prod. Chacune peut être décochée.
function pjRetroPostProd(p, r) {
  const etapes = r.etapes.map((e, i) => ({ ...e, i })).filter(e => e.choisi && e.du);
  const out = [];
  const vus = new Set();
  (p.equipe || []).forEach(a => {
    const nom = pjNomPersonne(a);
    if (!nom) return;
    vus.add(pjCle(a));
    const idx = pjEtapesPourRole(a.role, etapes).map(e => e.i);
    if (idx.length) out.push({ cle: 'e' + a.id, nom, role: a.role, idx, aId: a.id });
  });
  (p.options || []).forEach((o, oi) => {
    const a = pjOptionPersonne(o);
    if (!o.nom || vus.has(pjCle(a))) return;
    // Une option relâchée partout (N/A, release, pas retenu…) n'est pas proposée
    if ((o.dispos || []).length && !pjOptionDates(o).length) return;
    const idx = pjEtapesPourRole(o.role, etapes).map(e => e.i);
    vus.add(pjCle(a));
    if (idx.length) out.push({ cle: 'o' + oi, nom: pjNomPersonne(a), role: o.role, idx, oi, option: true });
  });
  r.pp = r.pp || {};
  out.forEach(x => { x.choisi = x.cle in r.pp ? r.pp[x.cle] : true; });
  return out;
}

async function pjRetroFichier(input) {
  const f = input.files && input.files[0];
  input.value = '';
  const p = pjCur();
  if (!f || !p) return;
  await pjRetroLire(p, f.name, async () => {
    if (/\.(xlsx|xlsm|xls|csv|ods)$/i.test(f.name)) {
      const XLSX = await pjChargerXlsx();
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const etapes = pjRetroTableur(pjFeuilles(XLSX, wb));
      if (etapes.length) return { etapes };
      return pjRetroServeur(p, { text: pjTableurTexte(XLSX, wb) });
    }
    if (f.type === 'application/pdf' || /^image\/(jpeg|png|gif|webp)$/.test(f.type)) {
      if (f.size > 6 * 1024 * 1024) throw new Error('Fichier trop lourd (6 Mo au plus).');
      const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(f); });
      return pjRetroServeur(p, { files: [{ media_type: f.type, data }] });
    }
    throw new Error('Format non reconnu : dépose un Excel, un CSV, un PDF ou une image.');
  });
}

async function pjRetroTexte() {
  const t = (document.getElementById('pj-retro-texte') || {}).value || '';
  const p = pjCur();
  if (!p || !t.trim()) return;
  await pjRetroLire(p, '', async () => {
    // Lignes copiées d'un tableur : colonnes séparées par des tabulations
    const etapes = t.includes('\t') ? pjRetroTableur([t.split(/\r?\n/).map(l => l.split('\t'))]) : [];
    return etapes.length ? { etapes } : pjRetroServeur(p, { text: t });
  });
}

async function pjRetroLire(p, fichier, lire) {
  pjRetro = { pid: p.id, fichier, enCours: true, msg: 'Lecture du rétroplanning…' };
  pjRedessiner();
  try {
    const r = await lire();
    // Sans partie indiquée : d'après le nom de l'étape, sinon celui du fichier (« Retro photo.xlsx »)
    const pisteFichier = pjDevinerPiste(String(fichier || '').replace(/\.[a-z0-9]+$/i, ''));
    const etapes = (r.etapes || []).filter(e => e.du).map(e => ({
      nom: e.nom || '', type: PJ_ETAPES.some(t => t[0] === e.type) ? e.type : pjDevinerType(e.nom),
      piste: PJ_PISTES.some(x => x[0] === e.piste) ? e.piste : pjDevinerPiste(e.nom) || pisteFichier,
      du: e.du, au: e.au && e.au >= e.du ? e.au : e.du, choisi: true,
    }));
    pjRetro = { pid: p.id, fichier, etapes, msg: r.remarque || (etapes.length ? '' : 'Aucune étape datée trouvée dans ce rétroplanning.') };
  } catch (e) {
    pjRetro = { pid: p.id, fichier, msg: e.message || 'Lecture impossible.' };
  }
  pjRedessiner();
}

async function pjRetroServeur(p, corps) {
  if (typeof SERVER_URL === 'undefined' || !SERVER_URL) throw new Error('Serveur non configuré : ce format ne peut pas être lu.');
  const sp = pjSpan(p);
  const projet = [pjTitre(p), p.datesTexte, sp ? pjPeriodeTexte(sp.du, sp.au) : ''].filter(Boolean).join(' · ');
  const res = await fetch(SERVER_URL + '/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corps, projet, fichier: (pjRetro && pjRetro.fichier) || '' }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Le serveur n\'a pas pu lire ce rétroplanning.');
  return data;
}

function pjChargerXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = PJ_XLSX_URL;
    sc.onload = () => window.XLSX ? ok(window.XLSX) : ko(new Error('Lecteur Excel indisponible.'));
    sc.onerror = () => ko(new Error('Lecteur Excel indisponible (connexion ?).'));
    document.head.appendChild(sc);
  });
}

// Les feuilles du classeur, celle qui ressemble à un rétroplanning en premier
function pjFeuilles(XLSX, wb) {
  const noms = wb.SheetNames.slice().sort((a, b) => (/r[ée]tro|planning|schedule/i.test(b) ? 1 : 0) - (/r[ée]tro|planning|schedule/i.test(a) ? 1 : 0));
  return noms.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
}

function pjTableurTexte(XLSX, wb) {
  return wb.SheetNames.slice(0, 4).map(n => `# Feuille « ${n} »\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join('\n\n').slice(0, 60000);
}

// Une case de date : numéro de série Excel, ou texte « 15/06/2026 », « 2026-06-15 »
function pjCaseDate(v) {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const t = String(v || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}

// Tableau avec une ligne d'en-tête PHASE (ou ÉTAPE, TÂCHE…) / DÉBUT / FIN
function pjRetroTableur(feuilles) {
  for (const rows of feuilles) {
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const h = (rows[r] || []).map(c => pjNorm(c).replace(/[^a-z ]/g, '').trim());
      const cNom = h.findIndex(c => /^(phase|phases|etape|etapes|tache|taches|task|tasks|quoi|step|steps)$/.test(c));
      const cDu = h.findIndex(c => /^(debut|start|du|date|dates|date de debut|start date)$/.test(c));
      if (cNom < 0 || cDu < 0) continue;
      const cAu = h.findIndex(c => /^(fin|end|au|date de fin|end date)$/.test(c));
      const out = [];
      let section = '';
      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const nom = String(row[cNom] || '').trim();
        const du = pjCaseDate(row[cDu]);
        const au = cAu >= 0 ? pjCaseDate(row[cAu]) : '';
        if (!nom) continue;
        if (!du) { if (nom === nom.toUpperCase()) section = nom; continue; }
        // Section VIDÉO / PHOTO : c'est la partie de l'étape ; une autre section reste dans le nom
        const piste = section ? pjDevinerPiste(section) : '';
        out.push({ nom: section && !piste ? `${nom} (${section.toLowerCase()})` : nom, du, au: au || du, piste });
      }
      if (out.length) return out;
    }
  }
  return [];
}

function pjDevinerType(nom) {
  const n = pjNorm(nom);
  if (/livraison|delivery|livrable|rendu final/.test(n)) return 'livraison';
  if (/shoot|tournage|prise de vue|\bpdv\b/.test(n)) return 'tournage';
  if (/recce|reperage|scouting/.test(n)) return 'reperage';
  if (/casting|fitting/.test(n)) return 'casting';
  if (/montage|edit|\bv\d\b|feedback|retour|etalo|grading|color|son|sound|mix|retouche|selection|post/.test(n)) return 'postprod';
  if (/prepa|prep|pre-prod|preprod|brief|devis|pitch|ppm/.test(n)) return 'prepa';
  return 'autre';
}

function pjRetroAjouter() {
  const p = pjCur();
  const r = pjRetro;
  if (!p || !r || !r.etapes) return;
  if (!Array.isArray(p.etapes)) p.etapes = [];
  if (!Array.isArray(p.equipe)) p.equipe = [];
  const pp = pjRetroPostProd(p, r).filter(x => x.choisi);
  // Une étape déjà là (même nom, même partie, mêmes dates) n'est pas ajoutée deux fois
  const cleEt = (nom, piste, du, au) => pjNorm(nom) + '|' + (piste || '') + '|' + du + '|' + (au || du);
  const deja = new Map(p.etapes.map(e => [cleEt(pjEtapeNom(e), pjPisteDe(e), e.du, e.au), e.id]));
  const ids = {};   // indice dans l'aperçu → id de l'étape du projet
  const ajout = [];
  r.etapes.forEach((e, i) => {
    if (!e.choisi || !e.du) return;
    const au = e.au && e.au >= e.du ? e.au : e.du;
    const cle = cleEt(e.nom || pjEtapeType(e.type)[1], e.piste, e.du, au);
    if (deja.has(cle)) { ids[i] = deja.get(cle); return; }
    const et = { id: uid(), type: e.type, nom: e.nom, piste: e.piste || '', du: e.du, au };
    p.etapes.push(et); ajout.push(et); deja.set(cle, et.id); ids[i] = et.id;
  });
  // L'équipe sur sa post-prod ; les personnes de l'OPTIONS TEAM entrent dans l'équipe
  pp.forEach(x => {
    const etIds = x.idx.map(i => ids[i]).filter(Boolean);
    if (!etIds.length) return;
    if (x.aId != null) { const a = p.equipe.find(y => y.id === x.aId); if (a) pjMettreSurPostProd(p, a, etIds); return; }
    const o = (p.options || [])[x.oi];
    if (!o) return;
    const a = pjOptionVersAffectation(o);
    a.etapes = etIds.slice();
    p.equipe.push(a);
  });
  p.retro = { fichier: r.fichier || 'texte collé', date: pjAujourdhui() };
  const premier = ajout.map(e => e.du).sort()[0];
  if (premier) pjMois = premier.slice(0, 7);
  pjRetro = null;
  pjRetroOuvert = false;
  pjChange(true);
}

function pjEtapeHtml(e) {
  const o = { l: 'etapes', i: e.id };
  const pi = pjPisteInfo(pjPisteDe(e));
  return `<div class="pj-etape" style="--c:${pjEtapeType(e.type)[2]}${pi ? ';--p:' + pi[2] : ''}"${pi ? ` data-piste="${pi[0]}"` : ''}>
    ${pjField('TYPE', 'type', e.type, { ...o, select: PJ_ETAPES.map(t => [t[0], t[1]]) })}
    ${pjField('PARTIE', 'piste', pjPisteDe(e), { ...o, select: [['', 'Commun']].concat(PJ_PISTES.map(x => [x[0], x[1]])) })}
    ${pjField('NOM', 'nom', e.nom, { ...o, ph: pjEtapeType(e.type)[1], change: true })}
    ${pjField('DU', 'du', e.du, { ...o, type: 'date' })}
    ${pjField('AU', 'au', e.au, { ...o, type: 'date' })}
    <button type="button" class="ts-x" title="Retirer" onclick="pjRetirer('etapes', ${e.id})">✕</button>
  </div>`;
}

function pjAffectationHtml(p, a) {
  const t = pjTalent(a.ref);
  const label = t ? (pjChoixGens().find(c => c.ref === a.ref) || {}).label || pjNomTalent(t) : (a.nom || '');
  const et = pjEtapesDatees(p);
  const conflits = pjNomPersonne(a) ? pjConflitsDe(p, a) : [];
  const libres = !!a.du;
  return `<div class="pj-aff${conflits.length ? ' conflit' : ''}">
    <div class="pj-aff-ligne">
      <div class="field pj-aff-qui"><label>PERSONNE${t ? ` · <a href="#" onclick="event.preventDefault();openDetail('talent', ${t.id})">fiche</a>` : ''}</label>
        <input list="pj-gens" data-k="qui" data-l="equipe" data-i="${a.id}" value="${esc(label)}" placeholder="Nom, ou choisis dans la bible" onchange="pjChoisirPersonne(${a.id}, this.value)"></div>
      ${pjField('RÔLE', 'role', a.role, { l: 'equipe', i: a.id, ph: 'ex : chef op, monteur, photographe…', onchange: `pjRoleChange(${a.id})` })}
      <button type="button" class="ts-x" title="Retirer" onclick="pjRetirer('equipe', ${a.id})">✕</button>
    </div>
    <details class="pj-aff-quand-bloc"${pjAffOuvert.has(a.id) ? ' open' : ''} ontoggle="pjAffToggle(${a.id}, this.open)">
    <summary><span class="pj-muted">Sur :</span> ${pjAffResume(p, a)}</summary>
    <div class="pj-aff-quand">
      ${libres ? `${pjField('DU', 'du', a.du, { l: 'equipe', i: a.id, type: 'date', cls: 'pj-mini' })}${pjField('AU', 'au', a.au, { l: 'equipe', i: a.id, type: 'date', cls: 'pj-mini' })}
        <button type="button" class="btn-edit-inline" onclick="pjDatesLibres(${a.id}, false)">SUIVRE LES ÉTAPES</button>
        ${et.length ? '<span class="pj-muted">et :</span>' : ''}`
        : `<label class="cat-check"><input type="checkbox" ${(a.etapes || []).length ? '' : 'checked'} onchange="pjToutLeProjet(${a.id})"><span>tout le projet</span></label>`}
      ${et.map(e => { const pi = pjPisteInfo(pjPisteDe(e)); return `<label class="cat-check"><input type="checkbox" ${(a.etapes || []).includes(e.id) ? 'checked' : ''} onchange="pjCocherEtape(${a.id}, ${e.id}, this.checked)"><span>${pi ? `<i class="pj-piste-pt" style="--p:${pi[2]}" title="${pi[1]}"></i>` : ''}${esc(pjEtapeNom(e))} <small>${esc(pjPeriodeTexte(e.du, pjEtapeDates(e).au))}</small></span></label>`; }).join('')}
      ${libres ? '' : `<button type="button" class="btn-edit-inline" onclick="pjDatesLibres(${a.id}, true)">AUTRES DATES</button>`}
    </div>
    </details>
    ${conflits.map(c => { const b = pjAutre(c, p); return `<div class="pj-aff-conflit">⚠ Déjà sur <a href="#" onclick="event.preventDefault();pjGo('projet', ${b.p.id})">${esc(pjTitre(b.p))}</a> (${esc(b.per.label)}) : ${esc(pjPeriodeTexte(c.du, c.au))}</div>`; }).join('')}
  </div>`;
}

// Les étapes d'une personne, repliées : un résumé, et les cases quand on déplie
let pjAffOuvert = new Set();
function pjAffToggle(id, open) { if (open) pjAffOuvert.add(id); else pjAffOuvert.delete(id); }
function pjAffResume(p, a) {
  const et = pjEtapesDatees(p).filter(e => (a.etapes || []).includes(e.id));
  const morceaux = (a.du ? [pjPeriodeTexte(a.du, a.au && a.au >= a.du ? a.au : a.du)] : [])
    .concat(et.map(e => { const pi = pjPisteInfo(pjPisteDe(e)); return (pi ? `<i class="pj-piste-pt" style="--p:${pi[2]}"></i>` : '') + esc(pjEtapeNom(e)); }));
  return (morceaux.length ? morceaux.map(m => `<span class="pj-aff-res">${m}</span>`).join('') : '<span class="pj-aff-res">tout le projet</span>')
    + ' <span class="pj-muted pj-aff-modif">modifier</span>';
}

function pjAffectation(id) { const p = pjCur(); return p && (p.equipe || []).find(a => a.id === id); }

function pjChoisirPersonne(id, v) {
  const a = pjAffectation(id);
  if (!a) return;
  const v2 = v.trim();
  const c = pjChoixGens().find(x => x.label === v2) || pjChoixGens().find(x => pjNorm(x.label.split(' · ')[0]) === pjNorm(v2));
  if (c && c.ref != null) { a.ref = c.ref; a.nom = ''; }
  else { a.ref = null; a.nom = c ? c.nom : v2; }
  pjChange(true);
}

function pjToutLeProjet(id) {
  const a = pjAffectation(id);
  if (!a) return;
  a.etapes = [];
  pjChange(true);
}

function pjCocherEtape(id, eid, on) {
  const a = pjAffectation(id);
  if (!a) return;
  a.etapes = (a.etapes || []).filter(x => x !== eid);
  if (on) a.etapes.push(eid);
  pjChange(true);
}

function pjDatesLibres(id, on) {
  const a = pjAffectation(id);
  if (!a) return;
  if (on) { const sp = pjSpan(pjCur()); a.du = sp ? sp.du : pjAujourdhui(); a.au = sp ? sp.au : a.du; }
  else { a.du = ''; a.au = ''; }
  pjChange(true);
}

function pjAjouterEtape(type) {
  const p = pjCur();
  if (!p) return;
  if (!Array.isArray(p.etapes)) p.etapes = [];
  p.etapes.push({ id: uid(), type, nom: '', du: '', au: '' });
  pjEtapesOuvert = true;
  pjChange(true);
  const champs = document.querySelectorAll('.pj-etape [data-k="du"]');
  const dernier = [...champs].find(c => !c.value);
  if (dernier) dernier.focus();
}

function pjAjouterPersonne() {
  const p = pjCur();
  if (!p) return;
  if (!Array.isArray(p.equipe)) p.equipe = [];
  p.equipe.push({ id: uid(), ref: null, nom: '', role: '', etapes: [], du: '', au: '' });
  pjChange(true);
  const champs = document.querySelectorAll('.pj-aff-qui input');
  if (champs.length) champs[champs.length - 1].focus();
}

function pjRetirer(liste, id) {
  const p = pjCur();
  if (!p) return;
  p[liste] = (p[liste] || []).filter(x => x.id !== id);
  // Une étape retirée n'est plus cochée pour personne
  if (liste === 'etapes') (p.equipe || []).forEach(a => { if (a.etapes) a.etapes = a.etapes.filter(x => x !== id); });
  pjChange(true);
}

function pjSupprimer() {
  const p = pjCur();
  if (!p || !confirm('Supprimer le projet « ' + pjTitre(p) + ' » ?' + (p.code ? '\n\nIl vient de PROJETS WIDEN : il reviendra au prochain envoi tant que sa ligne y est.' : ''))) return;
  db.projets = pjList().filter(x => x.id !== p.id);
  tsList().forEach(s => { if (s.projetId === p.id) delete s.projetId; });   // ses travel sheets restent, sans projet
  clearTimeout(pjSaveTimer); pjSaveTimer = null;
  saveDb();
  pjGo('liste');
}

if (enProjets()) { buildTabs(); render(); }
