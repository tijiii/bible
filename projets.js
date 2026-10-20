// ── PRODUCTION ───────────────────────────────────────────────────────────────
// Troisième onglet du site, après « Production interne » : le suivi des projets
// (comme la base Airtable). Une vue globale des projets, et dans chaque projet
// son calendrier d'étapes et les gens qui sont dessus. Le site prévient quand
// une même personne est sur deux projets aux mêmes dates.
// Tout est gardé dans la base partagée, sous db.projets.

let pjVue = 'liste';         // 'liste' | 'projet'
let pjId = null;             // projet ouvert
let pjQ = '';                // recherche dans la liste
let pjFStatut = '';          // filtre statut ('' = tous sauf livrés et annulés, 'tous' = tout)
let pjMode = (() => { try { return localStorage.getItem('pjMode') || 'liste'; } catch { return 'liste'; } })(); // 'liste' | 'planning' | 'personnes'
let pjPlanDebut = '';        // premier mois du planning ('AAAA-MM')
let pjMois = '';             // mois affiché dans le calendrier du projet ('AAAA-MM')
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
// dates libres si on en a mis, sinon les étapes cochées, sinon toutes les étapes.
function pjPeriodes(p, a) {
  if (a.du) return [{ du: a.du, au: a.au && a.au >= a.du ? a.au : a.du, label: 'dates choisies' }];
  const et = pjEtapesDatees(p);
  const choix = (a.etapes || []).length ? et.filter(e => a.etapes.includes(e.id)) : et;
  return choix.map(e => ({ ...pjEtapeDates(e), label: pjEtapeNom(e) }));
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
  pjVue = vue;
  if (id !== undefined && id !== pjId) { pjId = id; pjMois = ''; }
  buildTabs();
  render();
  window.scrollTo(0, 0);
}

function buildPjTabs(nav) {
  if (pjVue !== 'projet' || !pjCur()) { nav.innerHTML = ''; nav.style.display = 'none'; return; }
  const p = pjCur();
  nav.style.display = '';
  nav.innerHTML = `<button class="crumb-back" onclick="pjGo('liste')">← PROJETS</button>
    <span class="crumb-sep">/</span>
    <span class="crumb-title"><span class="ch-dot" style="background:${esc(p.couleur || '#3c6e8f')}"></span>${esc((p.nom || 'Nouveau projet').toUpperCase())}</span>`;
}

function renderProjets(main) {
  pjEnDessin = true;
  try {
    if (pjVue === 'projet' && pjCur()) renderPjProjet(main);
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
    return [p.nom, p.client, ...(p.equipe || []).map(pjNomPersonne)].some(v => pjNorm(v).includes(q));
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
      const lien = q => `<a href="#" onclick="event.preventDefault();pjGo('projet', ${q.p.id})">${esc(q.p.nom || 'Sans nom')}</a> <small>(${esc(q.per.label)})</small>`;
      return `<div class="pj-alerte"><b>${esc(c.nom)}</b> est sur ${p ? '' : lien(a) + ' et '}${lien(b)}${p ? ` pendant ${esc(a.per.label)}` : ''} : ${esc(pjPeriodeTexte(c.du, c.au))}</div>`;
    }).join('')}
  </div>`;
}

function renderPjListe(main) {
  const list = pjFiltres();
  const conflits = pjConflits();
  const modes = [['liste', 'LISTE'], ['planning', 'PLANNING'], ['personnes', 'PERSONNES']];
  main.innerHTML = `<div class="toolbar">
      <div class="search-wrap"><input id="pj-q" placeholder="Projet, client, personne..." value="${esc(pjQ)}" oninput="pjQ=this.value;pjRedessinerListe()"></div>
      <select class="filter-sel" onchange="pjFStatut=this.value;pjRedessinerListe()">
        <option value=""${pjFStatut === '' ? ' selected' : ''}>En cours</option>
        <option value="tous"${pjFStatut === 'tous' ? ' selected' : ''}>Tous les projets</option>
        ${PJ_STATUTS.map(s => `<option value="${s[0]}"${pjFStatut === s[0] ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}
      </select>
      <div class="pj-modes">${modes.map(m => `<button type="button" class="${pjMode === m[0] ? 'on' : ''}" onclick="pjSetMode('${m[0]}')">${m[1]}</button>`).join('')}</div>
      <div class="spacer"></div>
      <button class="btn-add" onclick="pjNouveau()">+ NOUVEAU PROJET</button>
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
        <span class="pj-nom"><span class="ch-dot" style="background:${esc(p.couleur || '#3c6e8f')}"></span>${esc(p.nom || 'Sans nom')}${nb ? ` <span class="pj-warn" title="Conflits de dates">⚠ ${nb}</span>` : ''}</span>
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
          return `<div class="pj-plan-barre" style="left:${pos(a)}%;width:${Math.max((pjJours(a, b) + 1) / total * 100, .6)}%;--c:${pjEtapeType(e.type)[2]}" title="${esc(pjEtapeNom(e) + ' · ' + pjPeriodeTexte(d.du, d.au))}"><span>${esc(pjEtapeNom(e))}</span></div>`;
        }).join('');
        return `<div class="pj-plan-row" onclick="pjGo('projet', ${p.id})">
          <div class="pj-plan-nom"><span class="ch-dot" style="background:${esc(p.couleur || '#3c6e8f')}"></span>${esc(p.nom || 'Sans nom')}</div>
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
        <span class="ch-dot" style="background:${esc(x.p.couleur || '#3c6e8f')}"></span>
        <span class="pj-gens-projet">${esc(x.p.nom || 'Sans nom')}${x.a.role ? ` <small class="pj-muted">${esc(x.a.role)}</small>` : ''}</span>
        <span class="pj-muted">${x.per.length ? x.per.map(per => esc(per.label + ' ' + pjPeriodeTexte(per.du, per.au))).join(' · ') : 'pas de dates'}</span>
      </div>`).join('')}
    </div>`;
  }).join('')}</div>`;
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
  else input = `<input type="${opts.type || 'text'}" ${attrs} value="${esc(v || '')}" placeholder="${esc(opts.ph || '')}" oninput="pjInput(this)"${opts.change ? ' onchange="pjRedessiner()"' : ''}>`;
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
        <div class="field pj-couleur"><label>COULEUR</label><input type="color" value="${esc(p.couleur || '#3c6e8f')}" data-k="couleur" onchange="pjInput(this, true)"></div>
      </div>
    </section>

    <section class="ts-bloc">
      <h3>CALENDRIER</h3>
      ${pjCalendrierHtml(p)}
      <div class="pj-etapes">${pjEtapesDatees(p).concat((p.etapes || []).filter(e => !pjEtapeDates(e))).map(e => pjEtapeHtml(e)).join('') || '<p class="field-hint">Aucune étape. Ajoute la prépa, le tournage, la post-prod… avec leurs dates.</p>'}</div>
      <div class="ts-add-row">${PJ_ETAPES.map(t => `<button type="button" class="btn-upload" onclick="pjAjouterEtape('${t[0]}')">+ ${t[1].toUpperCase()}</button>`).join('')}</div>
    </section>

    <section class="ts-bloc">
      <h3>ÉQUIPE</h3>
      <datalist id="pj-gens">${choix.map(c => `<option value="${esc(c.label)}"></option>`).join('')}</datalist>
      <div class="pj-equipe">${(p.equipe || []).map(a => pjAffectationHtml(p, a)).join('') || '<p class="field-hint">Personne pour le moment. Les talents et techniciens de la bible sont proposés quand tu tapes un nom ; tu peux aussi écrire n\'importe quel nom.</p>'}</div>
      <div class="ts-add-row"><button type="button" class="btn-upload" onclick="pjAjouterPersonne()">+ PERSONNE</button></div>
    </section>

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
  const cases = Array.from({ length: nbCases }, (_, i) => {
    const d = pjPlusJours(debut, i);
    const dedans = d.slice(0, 7) === pjMois;
    const ici = et.filter(e => { const x = pjEtapeDates(e); return d >= x.du && d <= x.au; });
    return `<div class="pj-jour${dedans ? '' : ' hors'}${d === auj ? ' auj' : ''}">
      <span class="pj-jour-num">${pjDate(d).getDate()}</span>
      ${ici.map(e => `<span class="pj-chip" style="--c:${pjEtapeType(e.type)[2]}" title="${esc(pjEtapeNom(e))}">${esc(pjEtapeNom(e))}</span>`).join('')}
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
    </div>`;
}

function pjEtapeHtml(e) {
  const o = { l: 'etapes', i: e.id };
  return `<div class="pj-etape" style="--c:${pjEtapeType(e.type)[2]}">
    ${pjField('TYPE', 'type', e.type, { ...o, select: PJ_ETAPES.map(t => [t[0], t[1]]) })}
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
      ${pjField('RÔLE', 'role', a.role, { l: 'equipe', i: a.id, ph: 'ex : chef op, mannequin…' })}
      <button type="button" class="ts-x" title="Retirer" onclick="pjRetirer('equipe', ${a.id})">✕</button>
    </div>
    <div class="pj-aff-quand">
      <span class="pj-muted">Sur :</span>
      ${libres ? '' : `<label class="cat-check"><input type="checkbox" ${(a.etapes || []).length ? '' : 'checked'} onchange="pjToutLeProjet(${a.id})"><span>tout le projet</span></label>
      ${et.map(e => `<label class="cat-check"><input type="checkbox" ${(a.etapes || []).includes(e.id) ? 'checked' : ''} onchange="pjCocherEtape(${a.id}, ${e.id}, this.checked)"><span>${esc(pjEtapeNom(e))} <small>${esc(pjPeriodeTexte(e.du, pjEtapeDates(e).au))}</small></span></label>`).join('')}`}
      ${libres ? `${pjField('DU', 'du', a.du, { l: 'equipe', i: a.id, type: 'date', cls: 'pj-mini' })}${pjField('AU', 'au', a.au, { l: 'equipe', i: a.id, type: 'date', cls: 'pj-mini' })}
        <button type="button" class="btn-edit-inline" onclick="pjDatesLibres(${a.id}, false)">SUIVRE LES ÉTAPES</button>`
        : `<button type="button" class="btn-edit-inline" onclick="pjDatesLibres(${a.id}, true)">AUTRES DATES</button>`}
    </div>
    ${conflits.map(c => { const b = pjAutre(c, p); return `<div class="pj-aff-conflit">⚠ Déjà sur <a href="#" onclick="event.preventDefault();pjGo('projet', ${b.p.id})">${esc(b.p.nom || 'Sans nom')}</a> (${esc(b.per.label)}) : ${esc(pjPeriodeTexte(c.du, c.au))}</div>`; }).join('')}
  </div>`;
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
  if (!p || !confirm('Supprimer le projet « ' + (p.nom || 'Sans nom') + ' » ?')) return;
  db.projets = pjList().filter(x => x.id !== p.id);
  clearTimeout(pjSaveTimer); pjSaveTimer = null;
  saveDb();
  pjGo('liste');
}

if (enProjets()) { buildTabs(); render(); }
