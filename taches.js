// ═══════════════════════════════════════════════════════════════════════════
// TÂCHES (onglet Suivi production)
// Une to-do par projet (p.taches), chaque tâche attribuée à quelqu'un, avec
// une échéance et un rappel. Chacun dit sur cet appareil qui il est (« moi »,
// gardé dans le navigateur) : le site lui montre ses tâches et ses rappels.
// ═══════════════════════════════════════════════════════════════════════════

// Rappel : avant l'échéance (nombre de jours), ou récurrent (« j » + tous les n jours),
// pour une tâche sans date
const TD_RAPPELS = [
  ['', 'pas de rappel'],
  ['j1', 'tous les jours'],
  ['j2', 'tous les 2 jours'],
  ['j3', 'tous les 3 jours'],
  ['j7', 'chaque semaine'],
  ['0', 'le jour J'],
  ['1', 'la veille'],
  ['2', '2 jours avant'],
  ['3', '3 jours avant'],
  ['7', '1 semaine avant'],
];
const TD_STATUTS = [['afaire', 'À faire'], ['encours', 'En cours'], ['fait', 'Terminé']];
const TD_URGENCES = [['4', 'Urgent'], ['3', 'Haute'], ['2', 'Normale'], ['1', 'Basse']];
const TD_TRIS = [['date', 'PAR DATE'], ['urgence', 'PAR URGENCE'], ['statut', 'PAR STATUT'], ['personne', 'PAR PERSONNE'], ['projet', 'PAR PROJET']];
const TD_VUES_STATUT = [['ouvertes', 'À FAIRE + EN COURS'], ['afaire', 'À FAIRE'], ['encours', 'EN COURS'], ['fait', 'TERMINÉES'], ['toutes', 'TOUTES']];

let tdFiltre = 'moi';        // vue TÂCHES, pour qui : 'moi' | 'tous' | un nom
// Statut montré et ordre de la vue TÂCHES, gardés sur l'appareil
let tdVueStatut = 'ouvertes', tdVueTri = 'date';
try { const v = JSON.parse(localStorage.getItem('tdVue') || '{}') || {}; if (v.statut) tdVueStatut = v.statut; if (v.tri) tdVueTri = v.tri; } catch {}
function tdVueRegler(k, v) {
  if (k === 'qui') tdFiltre = v; else if (k === 'statut') tdVueStatut = v; else tdVueTri = v;
  try { localStorage.setItem('tdVue', JSON.stringify({ statut: tdVueStatut, tri: tdVueTri })); } catch {}
  pjRedessinerListe();
}
let tdFaitesOuvert = false;  // tâches faites d'un projet dépliées
let tdOuvert = false;        // bloc TO-DO d'un projet déplié
let tdBandeauFerme = false;  // bandeau « pour toi » fermé pour cette visite

// ── Qui est sur cet appareil ─────────────────────────────────────────────────
// Les seules personnes qui peuvent se connecter
const TD_EQUIPE = ['Théo Ledru', 'Tom Grandjean', 'Félicie Corby', 'Jonas Rouyer', 'Célian Durand', 'Philippine Monnier'];
function tdMembre(nom) { return TD_EQUIPE.find(n => pjNorm(n) === pjNorm(nom)) || ''; }
// Un nom gardé qui n'est plus dans l'équipe ne compte plus : on redemande
function tdMoi() { try { return tdMembre(localStorage.getItem('moi')); } catch { return ''; } }
// Choisir un profil : s'il a un mot de passe, on le demande d'abord
function tdChoisir(nom) {
  nom = tdMembre(nom);
  if (!nom) return;
  if (tdProfil(nom) && tdProfil(nom).hash && !tdEstMoi(nom)) { tdOuvrirMdp(nom); return; }
  tdSetMoi(nom);
}
function tdSetMoi(nom) {
  try { if (nom) localStorage.setItem('moi', nom); else localStorage.removeItem('moi'); } catch {}
  tdFermerQui();
  tdBandeauFerme = false;
  buildTabs();
  render();
  tdNotifier();
}
function tdEstMoi(nom) { const m = tdMoi(); return !!m && pjNorm(nom) === pjNorm(m); }

// Les gens de Widen
function tdWiden() { return TD_EQUIPE.slice(); }

function tdOuvrirQui() {
  tdFermerQui();
  const moi = tdMoi();
  const el = document.createElement('div');
  el.className = 'modal-bg td-qui-bg';
  el.style.display = 'flex';
  el.innerHTML = `<div class="modal td-qui">
    <div class="modal-hdr"><span class="modal-title">Qui es-tu ?</span><button class="modal-close" onclick="tdFermerQui()">✕</button></div>
    <div class="td-qui-corps">
      <p class="field-hint">Le site te montre les tâches qui te sont attribuées et te rappelle celles qui arrivent. C'est gardé sur cet appareil.</p>
      <div class="td-qui-noms">${tdNomsProfils().map(n => `<button type="button" class="btn-upload${tdEstMoi(n) ? ' on' : ''}" onclick="tdChoisir(this.dataset.n)" data-n="${esc(n)}">${tdProfil(n) && tdProfil(n).hash ? '🔒 ' : ''}${esc(n)}</button>`).join('')}</div>
      ${moi ? `<button type="button" class="export-lien" onclick="tdSetMoi('')">se déconnecter (${esc(moi)})</button>` : ''}
    </div>
  </div>`;
  el.addEventListener('click', e => { if (e.target === el) tdFermerQui(); });
  document.body.appendChild(el);
}
function tdFermerQui() { document.querySelectorAll('.td-qui-bg').forEach(x => x.remove()); }

// ── Profils et mots de passe ─────────────────────────────────────────────────
// Un profil peut avoir un mot de passe, pour que personne ne prenne le nom d'un
// autre par erreur. Il est gardé haché (SHA-256 avec un sel) dans la base
// partagée : c'est un verrou entre collègues, pas une vraie sécurité (la base
// elle-même n'est pas protégée par ce mot de passe).
function tdProfils() { const p = prodData(); if (!p.profils || typeof p.profils !== 'object') p.profils = {}; return p.profils; }
function tdProfil(nom) { return tdProfils()[pjNorm(nom)] || null; }
// Les noms proposés : l'équipe, et rien d'autre
function tdNomsProfils() { return TD_EQUIPE.slice(); }
async function tdHacher(mdp, sel) {
  if (!window.crypto || !crypto.subtle) throw new Error('Ce navigateur ne permet pas les mots de passe (page non sécurisée).');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sel + ':' + mdp));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function tdMdpOk(nom, mdp) {
  const p = tdProfil(nom);
  return !p || !p.hash || (await tdHacher(mdp, p.sel)) === p.hash;
}

function tdModale(titre, corps) {
  tdFermerQui();
  const el = document.createElement('div');
  el.className = 'modal-bg td-qui-bg';
  el.style.display = 'flex';
  el.innerHTML = `<div class="modal td-qui">
    <div class="modal-hdr"><span class="modal-title">${titre}</span><button class="modal-close" onclick="tdFermerQui()">✕</button></div>
    <div class="td-qui-corps">${corps}</div>
  </div>`;
  el.addEventListener('click', e => { if (e.target === el) tdFermerQui(); });
  document.body.appendChild(el);
  const champ = el.querySelector('input');
  if (champ) setTimeout(() => champ.focus(), 50);
}

// Se connecter à un profil protégé
function tdOuvrirMdp(nom) {
  tdModale(esc(nom), `
    <p class="field-hint">Ce profil a un mot de passe.</p>
    <div class="td-qui-autre">
      <input type="password" id="td-mdp" placeholder="Mot de passe" autocomplete="current-password" onkeydown="if(event.key==='Enter')tdValiderMdp(this.dataset.n)" data-n="${esc(nom)}">
      <button type="button" class="btn-save" onclick="tdValiderMdp(document.getElementById('td-mdp').dataset.n)">ENTRER</button>
    </div>
    <p class="field-hint td-mdp-msg" id="td-mdp-msg"></p>
    <p class="field-hint">Mot de passe oublié : un collègue connecté peut le retirer depuis le menu sous son nom (PROFILS PROTÉGÉS).</p>
    <button type="button" class="export-lien" onclick="tdOuvrirQui()">← autre profil</button>`);
}
async function tdValiderMdp(nom) {
  const mdp = (document.getElementById('td-mdp') || {}).value || '';
  if (await tdMdpOk(nom, mdp)) { tdSetMoi(nom); return; }
  const m = document.getElementById('td-mdp-msg');
  if (m) m.textContent = 'Mot de passe incorrect.';
  const c = document.getElementById('td-mdp');
  if (c) { c.value = ''; c.focus(); }
}

// Ajouter, changer ou retirer le mot de passe de mon profil
function tdOuvrirGererMdp() {
  const moi = tdMoi();
  if (!moi) { tdOuvrirQui(); return; }
  const a = !!(tdProfil(moi) && tdProfil(moi).hash);
  tdModale(a ? 'Changer le mot de passe' : 'Ajouter un mot de passe', `
    <p class="field-hint">${a ? 'Pour changer ou retirer le mot de passe de ' + esc(moi) + ', tape d\'abord l\'actuel.' : 'Personne ne pourra plus choisir le profil ' + esc(moi) + ' sans ce mot de passe, sur aucun appareil.'}</p>
    <div class="td-mdp-champs">
      ${a ? '<input type="password" id="td-mdp-ancien" placeholder="Mot de passe actuel" autocomplete="current-password">' : ''}
      <input type="password" id="td-mdp-nouveau" placeholder="${a ? 'Nouveau mot de passe' : 'Mot de passe'}" autocomplete="new-password">
      <input type="password" id="td-mdp-encore" placeholder="Encore une fois" autocomplete="new-password" onkeydown="if(event.key==='Enter')tdEnregistrerMdp(false)">
    </div>
    <p class="field-hint td-mdp-msg" id="td-mdp-msg"></p>
    <div class="ts-add-row">
      ${a ? '<button type="button" class="btn-cancel" onclick="tdEnregistrerMdp(true)">RETIRER LE MOT DE PASSE</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn-save" onclick="tdEnregistrerMdp(false)">ENREGISTRER</button>
    </div>`);
}
async function tdEnregistrerMdp(retirer) {
  const moi = tdMoi();
  const v = id => (document.getElementById(id) || {}).value || '';
  const dire = t => { const m = document.getElementById('td-mdp-msg'); if (m) m.textContent = t; };
  if (!moi) return;
  try { await tdHacher('', ''); } catch (e) { dire(e.message); return; }
  if (!(await tdMdpOk(moi, v('td-mdp-ancien')))) { dire('Le mot de passe actuel est incorrect.'); return; }
  const profils = tdProfils();
  if (retirer) {
    delete profils[pjNorm(moi)];
  } else {
    const n = v('td-mdp-nouveau');
    if (n.length < 4) { dire('4 caractères au moins.'); return; }
    if (n !== v('td-mdp-encore')) { dire('Les deux mots de passe ne sont pas pareils.'); return; }
    const sel = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
    profils[pjNorm(moi)] = { nom: moi, sel, hash: await tdHacher(n, sel), le: pjAujourdhui() };
  }
  saveDb();
  tdModale(retirer ? 'Mot de passe retiré' : 'Mot de passe enregistré', `<p>${retirer ? 'Le profil ' + esc(moi) + ' n\'a plus de mot de passe.' : 'Le profil ' + esc(moi) + ' est protégé. Sur un autre appareil, il faudra ce mot de passe pour le choisir.'}</p>
    <div class="ts-add-row"><span class="spacer"></span><button type="button" class="btn-save" onclick="tdFermerQui()">OK</button></div>`);
}

// Menu sous mon nom : mes tâches, changer de profil, mot de passe, se déconnecter
function tdMenu(ev) {
  if (ev) ev.stopPropagation();
  const moi = tdMoi();
  if (!moi) { tdOuvrirQui(); return; }
  const ouvert = document.querySelector('.td-menu');
  if (ouvert) { ouvert.remove(); return; }
  const b = document.getElementById('btn-moi');
  const a = !!(tdProfil(moi) && tdProfil(moi).hash);
  const n = tdUrgentes().length;
  const m = document.createElement('div');
  m.className = 'td-menu';
  m.innerHTML = `<div class="td-menu-qui">${a ? '🔒 ' : ''}${esc(moi)}</div>
    <button type="button" onclick="tdMenuFermer();tdMesTachesVoir()">MES TÂCHES${n ? ` <span class="td-badge">${n}</span>` : ''}</button>
    <button type="button" onclick="tdMenuFermer();tdOuvrirQui()">CHANGER DE PROFIL</button>
    <button type="button" onclick="tdMenuFermer();tdOuvrirGererMdp()">${a ? 'CHANGER LE MOT DE PASSE' : 'AJOUTER UN MOT DE PASSE'}</button>
    ${Object.values(tdProfils()).some(p => p.hash && !tdEstMoi(p.nom)) ? '<button type="button" onclick="tdMenuFermer();tdOuvrirProteges()">PROFILS PROTÉGÉS</button>' : ''}
    <button type="button" onclick="tdMenuFermer();tdSetMoi('')">SE DÉCONNECTER</button>`;
  const r = b.getBoundingClientRect();
  m.style.top = (r.bottom + window.scrollY + 6) + 'px';
  document.body.appendChild(m);
  // Aligné sur la droite du bouton, sans sortir de l'écran
  const w = m.offsetWidth, W = document.documentElement.clientWidth;
  m.style.left = Math.max(8, Math.min(r.right - w, W - w - 8)) + 'px';
  setTimeout(() => document.addEventListener('click', tdMenuFermer, { once: true }), 0);
}
// Les profils protégés des autres : retirer un mot de passe oublié
function tdOuvrirProteges() {
  const l = Object.values(tdProfils()).filter(p => p.hash && !tdEstMoi(p.nom));
  tdModale('Profils protégés', `<p class="field-hint">Si quelqu'un a oublié son mot de passe, retire-le ici : il pourra en remettre un depuis son menu.</p>
    ${l.map(p => `<div class="td-protege"><span>🔒 ${esc(p.nom)}${p.le ? ` <small class="pj-muted">depuis le ${esc(pjDateCourte(p.le))}</small>` : ''}</span><button type="button" class="btn-edit-inline" data-n="${esc(p.nom)}" onclick="tdRetirerMdpDe(this.dataset.n)">RETIRER LE MOT DE PASSE</button></div>`).join('') || '<p>Aucun.</p>'}`);
}
function tdRetirerMdpDe(nom) {
  if (!confirm('Retirer le mot de passe du profil « ' + nom + ' » ?')) return;
  delete tdProfils()[pjNorm(nom)];
  saveDb();
  tdOuvrirProteges();
}
function tdMenuFermer() { document.querySelectorAll('.td-menu').forEach(x => x.remove()); }
function tdMesTachesVoir() {
  if (!enProjets()) setEspace('projets');
  tdFiltre = 'moi';
  pjSetMode('taches');
  if (pjVue !== 'liste') pjGo('liste');
}

// À l'arrivée sur le site : on demande qui c'est (une fois par visite tant qu'on n'a pas répondu)
function tdAccueil() {
  if (!tdMoi()) {
    let deja = false;
    try { deja = sessionStorage.getItem('quiDemande') === '1'; sessionStorage.setItem('quiDemande', '1'); } catch {}
    if (!deja) tdOuvrirQui();
  }
  tdNotifier();
}

// ── Les tâches ───────────────────────────────────────────────────────────────
function tdTaches(p) { if (!Array.isArray(p.taches)) p.taches = []; return p.taches; }
function tdToutes() {
  const out = [];
  pjList().forEach(p => (Array.isArray(p.taches) ? p.taches : []).forEach(t => out.push({ t, p })));
  return out;
}
function tdStatut(t) { return t.fait ? 'fait' : t.statut === 'encours' ? 'encours' : 'afaire'; }
function tdUrgence(t) { return Number(t.urgence) || 2; }
function tdRecurrence(t) { const r = String(t.rappel == null ? '' : t.rappel); return r[0] === 'j' ? Number(r.slice(1)) || 1 : 0; }
// Où en est une tâche : faite, en retard, à rappeler (dans la fenêtre du rappel,
// ou un jour de son rappel récurrent), à venir, ou sans date
function tdEtat(t) {
  if (t.fait) return 'fait';
  const auj = pjAujourdhui();
  if (t.echeance && t.echeance < auj) return 'retard';
  const n = tdRecurrence(t);
  if (n) { const d = pjJours(t.le || auj, auj); if (d >= 0 && d % n === 0) return 'rappel'; }
  else if (t.echeance && t.rappel !== '' && t.rappel != null && pjPlusJours(t.echeance, -Number(t.rappel)) <= auj) return 'rappel';
  return t.echeance ? 'avenir' : 'libre';
}
// Ordre par défaut : l'échéance la plus proche (sans date à la fin), puis la plus urgente
function tdTri(a, b) {
  const x = a.t || a, y = b.t || b;
  return (x.echeance || '9999').localeCompare(y.echeance || '9999') || tdUrgence(y) - tdUrgence(x);
}
function tdTriUrgence(a, b) { return tdUrgence(b.t || b) - tdUrgence(a.t || a) || tdTri(a, b); }
const TD_ORDRE_STATUT = { encours: 0, afaire: 1, fait: 2 };
function tdTriStatut(a, b) { return TD_ORDRE_STATUT[tdStatut(a.t || a)] - TD_ORDRE_STATUT[tdStatut(b.t || b)] || tdTriUrgence(a, b); }
function tdMesTaches() { return tdToutes().filter(x => !x.t.fait && tdEstMoi(x.t.qui)).sort(tdTriUrgence); }
function tdUrgentes() { return tdMesTaches().filter(x => ['retard', 'rappel'].includes(tdEtat(x.t))); }

function tdEcheanceTexte(t) {
  if (!t.echeance) { const n = tdRecurrence(t); return n ? (TD_RAPPELS.find(r => r[0] === 'j' + n) || [, ''])[1] : ''; }
  const auj = pjAujourdhui();
  const n = pjJours(auj, t.echeance);
  const quand = n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : n === -1 ? 'hier' : n < 0 ? `il y a ${-n} jours` : `le ${pjDateCourte(t.echeance)}`;
  return n < -1 || n > 1 ? `${quand}` : `${quand} (${pjDateCourte(t.echeance)})`;
}

// Les noms proposés pour « qui » : Widen, puis l'équipe du projet (ou de tous les projets)
function tdNoms(p) {
  const noms = tdWiden();
  (p ? [p] : pjList()).forEach(q => (q.equipe || []).forEach(a => { const n = pjNomPersonne(a); if (n) noms.push(n); }));
  const vus = new Set();
  return noms.filter(n => { const k = pjNorm(n); if (vus.has(k)) return false; vus.add(k); return true; });
}

// ── Dans un projet : la to-do ────────────────────────────────────────────────
// Filtres et tri de la to-do d'un projet (rangés avec ceux des autres blocs, pjBF)
const TD_P_TRIS = [['', 'PAR STATUT'], ['urgence', 'PAR URGENCE'], ['date', 'PAR DATE'], ['personne', 'PAR PERSONNE']];
function tdProjetHtml(p) {
  const toutes = tdTaches(p);
  const f = pjBF(p);
  const quiF = f.tdQui || '', stF = f.tdStatut || '', tri = f.tdTri || '';
  let l = quiF ? toutes.filter(t => (quiF === '~' ? !t.qui : pjNorm(t.qui) === quiF)) : toutes;
  if (stF && stF !== 'toutes') l = l.filter(t => tdStatut(t) === stF);
  // Les personnes du filtre : celles qui ont une tâche, puis l'équipe du projet et Widen
  const gensMap = new Map(toutes.filter(t => t.qui).map(t => [pjNorm(t.qui), t.qui]));
  tdNoms(p).forEach(n => { if (!gensMap.has(pjNorm(n))) gensMap.set(pjNorm(n), n); });
  const gens = [...gensMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  if (toutes.some(t => !t.qui)) gens.push(['~', 'Personne']);
  const parPersonne = (a, b) => (a.qui ? '0' + pjNorm(a.qui) : '1').localeCompare(b.qui ? '0' + pjNorm(b.qui) : '1', 'fr') || tdTriUrgence(a, b);
  const ordre = { urgence: tdTriUrgence, date: tdTri, personne: parPersonne }[tri] || tdTriStatut;
  // Par défaut, les terminées sont rangées à part ; un filtre de statut montre une seule liste
  const apart = !stF;
  const ouvertes = (apart ? l.filter(t => !t.fait) : l).slice().sort(ordre);
  const faites = apart ? l.filter(t => t.fait).sort(ordre) : [];
  const nbOuvertes = toutes.filter(t => !t.fait).length;
  const barre = toutes.length ? pjBFBarre(`${pjBFSel('tdQui', quiF, [['', 'TOUT LE MONDE']].concat(gens.map(([k, n]) => [k, n.toUpperCase()])), 'Personne')}
    ${pjBFSel('tdStatut', stF, [['', 'À FAIRE + EN COURS'], ['afaire', 'À FAIRE'], ['encours', 'EN COURS'], ['fait', 'TERMINÉES'], ['toutes', 'TOUTES']], 'Statut')}
    ${pjBFSel('tdTri', tri, TD_P_TRIS, 'Ordre')}`, quiF || stF ? 'tdQui,tdStatut' : '') : '';
  // Repliable comme l'équipe : fermé dès qu'il y a des tâches, le résumé donne le compte
  const ouvert = tdOuvert || !toutes.length;
  const nbRetard = toutes.filter(t => tdEtat(t) === 'retard').length;
  return `<details class="ts-bloc pj-repli pj-taches"${ouvert ? ' open' : ''} ontoggle="if(this.open!==${ouvert})tdOuvert=this.open">
    <summary><h3>TO-DO <small class="pj-muted">${nbOuvertes ? `· ${nbOuvertes} à faire` : ''}</small>${nbRetard ? ` <span class="pj-warn">⚠ ${nbRetard} en retard</span>` : ''}${barre}</h3></summary>
    <datalist id="td-noms">${tdNoms(p).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
    <div class="td-liste">${ouvertes.map(t => tdLigneHtml(t)).join('') || (l.length !== toutes.length || stF ? '<p class="field-hint">Aucune tâche avec ces filtres.</p>' : '<p class="field-hint">Rien à faire pour le moment. Ajoute une tâche, attribue-la à quelqu\'un : elle apparaîtra chez lui. La date est facultative : sans date, choisis un rappel tous les jours ou tous les 2 jours.</p>')}</div>
    <div class="ts-add-row"><button type="button" class="btn-upload" onclick="tdAjouter()">+ TÂCHE</button></div>
    ${faites.length ? `<details class="pj-sous-bloc"${tdFaitesOuvert ? ' open' : ''} ontoggle="if(this.open!==${tdFaitesOuvert})tdFaitesOuvert=this.open">
      <summary><span class="pj-sous-titre">TERMINÉES</span> <small class="pj-muted">${faites.length}</small></summary>
      <div class="td-liste">${faites.map(t => tdLigneHtml(t)).join('')}</div>
    </details>` : ''}
  </details>`;
}

function tdLigneHtml(t) {
  const o = { l: 'taches', i: t.id };
  const etat = tdEtat(t);
  return `<div class="td-ligne td-${etat} td-u${tdUrgence(t)}">
    ${tdStatutSelectHtml(t)}
    ${pjField('', 'texte', t.texte, { ...o, ph: 'Tâche (ex : envoyer la V1 au client)', cls: 'td-texte' })}
    <div class="field td-qui-champ"><label></label><input list="td-noms" data-k="qui" data-l="taches" data-i="${t.id}" value="${esc(t.qui || '')}" placeholder="Pour qui ?" oninput="pjInput(this)" onchange="pjRedessiner()"></div>
    <div class="field td-date"><label></label><input type="date" data-k="echeance" data-l="taches" data-i="${t.id}" value="${esc(t.echeance || '')}" title="Échéance (facultative)" onchange="pjInput(this, true)"></div>
    ${pjField('', 'rappel', t.rappel == null ? '' : String(t.rappel), { ...o, select: TD_RAPPELS, cls: 'td-rappel' })}
    ${pjField('', 'urgence', String(tdUrgence(t)), { ...o, select: TD_URGENCES, cls: 'td-urgence' })}
    <button type="button" class="ts-x" title="Supprimer la tâche" onclick="pjRetirer('taches', ${t.id})">✕</button>
    <div class="td-meta">${tdMetaHtml(t)}</div>
  </div>`;
}

function tdMetaHtml(t) {
  const etat = tdEtat(t);
  const bouts = [];
  if (t.fait) bouts.push(`terminé${t.faitPar ? ' par ' + esc(t.faitPar) : ''}${t.faitLe ? ' le ' + esc(pjDateCourte(t.faitLe)) : ''}`);
  else if (etat === 'retard') bouts.push(`<span class="td-alerte">en retard : ${esc(tdEcheanceTexte(t))}</span>`);
  else if (etat === 'rappel') bouts.push(`<span class="td-alerte">${t.echeance ? 'à faire ' + esc(tdEcheanceTexte(t)) : "rappel aujourd'hui"}</span>`);
  else if (!t.echeance && t.rappel !== '' && t.rappel != null && !tdRecurrence(t)) bouts.push('sans date : ce rappel ne sonnera pas, choisis « tous les jours » ou « tous les 2 jours »');
  if (tdStatut(t) === 'encours' && t.enCoursPar) bouts.push(`en cours (${esc(t.enCoursPar)})`);
  if (t.par) bouts.push(`ajoutée par ${esc(t.par)}`);
  return bouts.join(' · ');
}

function tdAjouter() {
  const p = pjCur();
  if (!p) return;
  // Filtrée sur une personne : la nouvelle tâche est pour elle (sinon elle disparaîtrait)
  const f = pjBF(p).tdQui && pjBF(p).tdQui !== '~' ? pjBF(p).tdQui : '';
  const qui = f ? (tdTaches(p).find(t => pjNorm(t.qui) === f) || {}).qui || tdNoms(p).find(n => pjNorm(n) === f) || '' : '';
  // Filtrée sur « en cours » : la tâche naît en cours ; sur « terminées » : on remontre les ouvertes
  const st = pjBF(p).tdStatut === 'encours' ? 'encours' : 'afaire';
  if (pjBF(p).tdStatut === 'fait') delete pjBF(p).tdStatut;
  tdTaches(p).push({ id: uid(), texte: '', qui, echeance: '', rappel: 'j2', urgence: '2', statut: st, fait: false, par: tdMoi(), le: pjAujourdhui() });
  tdOuvert = true;
  pjChange(true);
  const champs = document.querySelectorAll('.pj-taches .td-texte input');
  if (champs.length) champs[champs.length - 1].focus();
}

function tdCocher(id, on, pid) { tdChangerStatut(id, on ? 'fait' : 'afaire', pid); }
// Le statut d'une tâche ; « fait » reste à jour pour le reste du site
function tdChangerStatut(id, v, pid) {
  const p = pid != null ? pjById(pid) : pjCur();
  const t = p && tdTaches(p).find(x => x.id === id);
  if (!t) return;
  t.statut = v;
  t.fait = v === 'fait';
  if (t.fait) { if (!t.faitLe) { t.faitPar = tdMoi(); t.faitLe = pjAujourdhui(); } } else { delete t.faitPar; delete t.faitLe; }
  if (v === 'encours') t.enCoursPar = t.enCoursPar || tdMoi(); else delete t.enCoursPar;
  pjChange(true, p);
}
function tdStatutSelectHtml(t, pid) {
  const st = tdStatut(t);
  return `<select class="td-statut td-st-${st}" title="Statut" onchange="tdChangerStatut(${t.id}, this.value${pid != null ? ', ' + pid : ''})">${TD_STATUTS.map(([v, l]) => `<option value="${v}"${st === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

// ── Vue TÂCHES : toutes les tâches, à filtrer (qui, statut) et à trier ─────────
function tdVueHtml() {
  const moi = tdMoi();
  if (tdFiltre === 'moi' && !moi) tdFiltre = 'tous';
  let l = tdToutes().filter(x => x.p.statut !== 'annule' || x.t.fait);
  const q = pjNorm(pjQ);
  if (q) l = l.filter(x => pjNorm([x.t.texte, x.t.qui, pjTitre(x.p)].join(' ')).includes(q));
  if (tdFiltre === 'moi') l = l.filter(x => tdEstMoi(x.t.qui));
  else if (tdFiltre !== 'tous') l = l.filter(x => pjNorm(x.t.qui) === pjNorm(tdFiltre));
  if (tdVueStatut === 'ouvertes') l = l.filter(x => !x.t.fait);
  else if (tdVueStatut !== 'toutes') l = l.filter(x => tdStatut(x.t) === tdVueStatut);
  // L'ordre, et les groupes qui vont avec
  const tri = tdVueTri;
  const parDate = (a, b) => tdVueStatut === 'fait' ? (b.t.faitLe || '').localeCompare(a.t.faitLe || '') : tdTri(a, b);
  const cle = {
    urgence: x => [String(5 - tdUrgence(x.t)), TD_URGENCES.find(u => u[0] === String(tdUrgence(x.t)))[1]],
    statut: x => [String(TD_ORDRE_STATUT[tdStatut(x.t)]), TD_STATUTS.find(u => u[0] === tdStatut(x.t))[1]],
    personne: x => [x.t.qui ? '0' + pjNorm(x.t.qui) : '1', x.t.qui || 'Personne'],
    projet: x => [pjNorm(pjTitre(x.p)) + '|' + x.p.id, pjTitre(x.p)],
  }[tri];
  const dans = tri === 'statut' || tri === 'urgence' ? tdTriUrgence : parDate;
  l.sort((a, b) => (cle ? cle(a)[0].localeCompare(cle(b)[0], 'fr') : 0) || (tri === 'urgence' ? tdTri(a, b) : dans(a, b)));
  const groupes = [];
  l.forEach(x => { const k = cle ? cle(x) : ['', '']; const g = groupes[groupes.length - 1]; if (g && g.k === k[0]) g.l.push(x); else groupes.push({ k: k[0], nom: k[1], l: [x] }); });
  // Les personnes proposées : l'équipe, puis tous ceux qui ont une tâche
  const gens = tdNoms();
  tdToutes().forEach(x => { if (x.t.qui && !gens.some(n => pjNorm(n) === pjNorm(x.t.qui))) gens.push(x.t.qui); });
  const projets = pjList().filter(p => p.statut !== 'annule' && p.statut !== 'livre').sort((a, b) => pjTitre(a).localeCompare(pjTitre(b), 'fr'));
  const sel = (k, val, opts, titre) => `<select class="filter-sel" title="${titre}" onchange="tdVueRegler('${k}', this.value)">${opts.map(([v, lab]) => `<option value="${esc(v)}"${val === v ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  const quiOpts = [['moi', moi ? 'MES TÂCHES' : 'MES TÂCHES (dis qui tu es)'], ['tous', 'TOUT LE MONDE']].concat(gens.filter(n => !tdEstMoi(n)).map(n => [n, n.toUpperCase()]));
  if (!quiOpts.some(o => o[0] === tdFiltre)) quiOpts.push([tdFiltre, tdFiltre.toUpperCase()]);
  return `<div class="td-vue">
    <div class="td-filtres">
      ${moi ? sel('qui', tdFiltre, quiOpts, 'Pour qui') : `<button type="button" class="btn-edit-inline" onclick="tdOuvrirQui()">MES TÂCHES (dis qui tu es)</button>${sel('qui', tdFiltre, quiOpts.slice(1), 'Pour qui')}`}
      ${sel('statut', tdVueStatut, TD_VUES_STATUT, 'Statut')}
      ${sel('tri', tdVueTri, TD_TRIS, 'Trier')}
      <span class="spacer"></span>
      <button type="button" class="export-lien" onclick="tdOuvrirQui()">${moi ? 'tu es ' + esc(moi) + ' · changer' : 'qui es-tu ?'}</button>
    </div>
    <div class="td-ajout">
      <datalist id="td-noms">${tdNoms().map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <input id="td-n-texte" placeholder="Nouvelle tâche…" onkeydown="if(event.key==='Enter')tdAjouterVue()">
      <select id="td-n-projet"><option value="">Projet…</option>${projets.map(p => `<option value="${p.id}">${esc(pjTitre(p))}</option>`).join('')}</select>
      <input id="td-n-qui" list="td-noms" placeholder="Pour qui ?" value="${esc(moi)}">
      <input id="td-n-date" type="date" title="Échéance (facultative)">
      <select id="td-n-rappel" title="Rappel">${TD_RAPPELS.map(r => `<option value="${r[0]}"${r[0] === 'j2' ? ' selected' : ''}>${r[1]}</option>`).join('')}</select>
      <select id="td-n-urgence" title="Urgence">${TD_URGENCES.map(r => `<option value="${r[0]}"${r[0] === '2' ? ' selected' : ''}>${r[1]}</option>`).join('')}</select>
      <button type="button" class="btn-save" onclick="tdAjouterVue()">AJOUTER</button>
    </div>
    <p class="field-hint td-ajout-msg" id="td-n-msg"></p>
    ${l.length ? groupes.map(g => `${g.nom ? `<div class="td-groupe">${esc(g.nom.toUpperCase())} <small class="pj-muted">${g.l.length}</small></div>` : ''}
      ${g.l.map(x => tdVueLigneHtml(x)).join('')}`).join('') : `<div class="empty">${tdFiltre === 'moi' && tdVueStatut === 'ouvertes' ? 'RIEN À FAIRE POUR TOI' : 'AUCUNE TÂCHE'}</div>`}
  </div>`;
}

function tdVueLigneHtml({ t, p }) {
  const etat = tdEtat(t);
  const u = tdUrgence(t);
  return `<div class="td-vligne td-${etat} td-u${u}">
    ${tdStatutSelectHtml(t, p.id)}
    <span class="td-vtexte">${u > 2 ? `<span class="td-u-pastille" title="${TD_URGENCES.find(x => x[0] === String(u))[1]}">${u === 4 ? 'URGENT' : 'HAUTE'}</span> ` : ''}${esc(t.texte || 'Tâche sans titre')}</span>
    <a href="#" class="td-vprojet" onclick="event.preventDefault();pjGo('projet', ${p.id})"><span class="ch-dot" style="background:${esc(pjCouleur(p))}"></span>${esc(pjTitre(p))}</a>
    <span class="td-vqui">${esc(t.qui || '')}</span>
    <span class="td-vdate">${t.fait ? (t.faitLe ? 'terminé le ' + esc(pjDateCourte(t.faitLe)) : 'terminé') : etat === 'retard' || etat === 'rappel' ? `<span class="td-alerte">${esc(tdEcheanceTexte(t))}</span>` : esc(tdEcheanceTexte(t))}</span>
  </div>`;
}

function tdAjouterVue() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const msg = document.getElementById('td-n-msg');
  const texte = v('td-n-texte').trim();
  const p = pjById(Number(v('td-n-projet')));
  if (!texte) { document.getElementById('td-n-texte').focus(); return; }
  if (!p) { if (msg) msg.textContent = 'Choisis le projet de la tâche.'; return; }
  tdTaches(p).push({ id: uid(), texte, qui: v('td-n-qui').trim(), echeance: v('td-n-date'), rappel: v('td-n-rappel'), urgence: v('td-n-urgence') || '2', statut: 'afaire', fait: false, par: tdMoi(), le: pjAujourdhui() });
  pjChange(false, p);
  pjRedessinerListe();
  const t = document.getElementById('td-n-texte');
  if (t) t.focus();
}

// ── Pour toi : le bandeau en haut du suivi production ────────────────────────
function tdBandeauHtml() {
  const moi = tdMoi();
  if (tdBandeauFerme || pjMode === 'taches') return '';
  if (!moi) return `<div class="td-bandeau td-bandeau-qui"><span>Dis qui tu es pour voir tes tâches et tes rappels.</span> <button type="button" class="btn-edit-inline" onclick="tdOuvrirQui()">QUI ES-TU ?</button></div>`;
  const mes = tdMesTaches();
  if (!mes.length) return '';
  const urg = mes.filter(x => ['retard', 'rappel'].includes(tdEtat(x.t)));
  const montre = (urg.length ? urg : mes).slice(0, 5);
  const notif = typeof Notification !== 'undefined' && Notification.permission === 'default';
  return `<div class="td-bandeau${urg.length ? ' urgent' : ''}">
    <div class="td-bandeau-titre">POUR TOI, ${esc(moi.split(' ')[0].toUpperCase())} · ${mes.length} ${mes.length > 1 ? 'tâches' : 'tâche'} à faire${urg.length ? `, dont ${urg.length} à rappeler` : ''}
      <button type="button" class="ts-x" title="Fermer" onclick="tdBandeauFerme=true;render()">✕</button></div>
    ${montre.map(x => tdVueLigneHtml(x)).join('')}
    <div class="td-bandeau-pied">
      <button type="button" class="btn-edit-inline" onclick="tdFiltre='moi';pjSetMode('taches')">TOUTES MES TÂCHES</button>
      ${notif ? '<button type="button" class="btn-edit-inline" onclick="tdActiverNotifs()">RECEVOIR LES RAPPELS SUR CET APPAREIL</button>' : ''}
    </div>
  </div>`;
}

// Pastille dans l'en-tête : qui je suis, et mes tâches à rappeler
function tdMajBadge() {
  const hdr = document.querySelector('.hdr-right');
  if (!hdr) return;
  let b = document.getElementById('btn-moi');
  if (!b) {
    b = document.createElement('button');
    b.id = 'btn-moi';
    b.className = 'btn-quick btn-moi';
    b.onclick = tdMenu;
    hdr.insertBefore(b, hdr.firstChild);
  }
  const moi = tdMoi();
  const n = moi ? tdUrgentes().length : 0;
  b.innerHTML = moi ? `${esc(moi.split(' ')[0].toUpperCase())}${n ? ` <span class="td-badge">${n}</span>` : ''}` : 'QUI ES-TU ?';
  b.title = moi ? `${moi} : ${n ? n + (n > 1 ? ' tâches à rappeler' : ' tâche à rappeler') : 'mes tâches'}` : 'Dis qui tu es pour voir tes tâches';
}

// ── Rappels sur l'appareil (notifications du navigateur, quand le site est ouvert)
function tdActiverNotifs() {
  if (typeof Notification === 'undefined') return;
  Notification.requestPermission().then(() => { render(); tdNotifier(); });
}
function tdNotifier() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !tdMoi()) return;
  const auj = pjAujourdhui();
  let vus = {};
  try { vus = JSON.parse(localStorage.getItem('rappelsVus') || '{}') || {}; } catch {}
  tdUrgentes().forEach(({ t, p }) => {
    if (vus[t.id] === auj) return;
    vus[t.id] = auj;
    try { new Notification(`${pjTitre(p)} : ${t.texte || 'tâche'}`, { body: tdEtat(t) === 'retard' ? `En retard (${pjDateCourte(t.echeance)})` : t.echeance ? `À faire ${tdEcheanceTexte(t)}` : `Rappel ${tdEcheanceTexte(t)}`, tag: 'tache-' + t.id }); } catch {}
  });
  Object.keys(vus).forEach(k => { if (vus[k] < auj) delete vus[k]; });
  try { localStorage.setItem('rappelsVus', JSON.stringify(vus)); } catch {}
}
