// ═══════════════════════════════════════════════════════════════════════════
// TÂCHES (onglet Suivi production)
// Une to-do par projet (p.taches), chaque tâche attribuée à quelqu'un, avec
// une échéance et un rappel. Chacun dit sur cet appareil qui il est (« moi »,
// gardé dans le navigateur) : le site lui montre ses tâches et ses rappels.
// ═══════════════════════════════════════════════════════════════════════════

const TD_RAPPELS = [
  ['', 'pas de rappel'],
  ['0', 'le jour même'],
  ['1', 'la veille'],
  ['2', '2 jours avant'],
  ['3', '3 jours avant'],
  ['7', '1 semaine avant'],
];

let tdFiltre = 'moi';        // vue TÂCHES : 'moi' | 'tous' | 'faites'
let tdFaitesOuvert = false;  // tâches faites d'un projet dépliées
let tdBandeauFerme = false;  // bandeau « pour toi » fermé pour cette visite

// ── Qui est sur cet appareil ─────────────────────────────────────────────────
function tdMoi() { try { return localStorage.getItem('moi') || ''; } catch { return ''; } }
function tdSetMoi(nom) {
  try { if (nom) localStorage.setItem('moi', nom); else localStorage.removeItem('moi'); } catch {}
  tdFermerQui();
  tdBandeauFerme = false;
  buildTabs();
  render();
  tdNotifier();
}
function tdEstMoi(nom) { const m = tdMoi(); return !!m && pjNorm(nom) === pjNorm(m); }

// Les gens de Widen (contacts habituels des travel sheets)
function tdWiden() {
  return prodData().contacts.filter(c => c.nom && /widen/i.test(c.groupe || '')).map(c => c.nom);
}

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
      <div class="td-qui-noms">${tdWiden().map(n => `<button type="button" class="btn-upload${tdEstMoi(n) ? ' on' : ''}" onclick="tdSetMoi(this.dataset.n)" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="td-qui-autre">
        <input id="td-qui-nom" placeholder="Autre : ton prénom et nom" value="${esc(moi && !tdWiden().some(n => tdEstMoi(n)) ? moi : '')}" onkeydown="if(event.key==='Enter')tdSetMoi(this.value.trim())">
        <button type="button" class="btn-save" onclick="tdSetMoi(document.getElementById('td-qui-nom').value.trim())">C'EST MOI</button>
      </div>
      ${moi ? `<button type="button" class="export-lien" onclick="tdSetMoi('')">je ne suis pas ${esc(moi)}</button>` : ''}
    </div>
  </div>`;
  el.addEventListener('click', e => { if (e.target === el) tdFermerQui(); });
  document.body.appendChild(el);
}
function tdFermerQui() { document.querySelectorAll('.td-qui-bg').forEach(x => x.remove()); }

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
// Où en est une tâche : faite, en retard, à rappeler (dans la fenêtre du rappel), à venir
function tdEtat(t) {
  if (t.fait) return 'fait';
  if (!t.echeance) return 'libre';
  const auj = pjAujourdhui();
  if (t.echeance < auj) return 'retard';
  if (t.rappel !== '' && t.rappel != null && pjPlusJours(t.echeance, -Number(t.rappel)) <= auj) return 'rappel';
  return 'avenir';
}
function tdTri(a, b) {
  const ea = (a.t || a).echeance || '9999', eb = (b.t || b).echeance || '9999';
  return ea.localeCompare(eb);
}
function tdMesTaches() { return tdToutes().filter(x => !x.t.fait && tdEstMoi(x.t.qui)).sort(tdTri); }
function tdUrgentes() { return tdMesTaches().filter(x => ['retard', 'rappel'].includes(tdEtat(x.t))); }

function tdEcheanceTexte(t) {
  if (!t.echeance) return '';
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
function tdProjetHtml(p) {
  const l = tdTaches(p);
  const ouvertes = l.filter(t => !t.fait).sort(tdTri);
  const faites = l.filter(t => t.fait);
  return `<section class="ts-bloc pj-taches">
    <h3>TO-DO <small class="pj-muted">${ouvertes.length ? `· ${ouvertes.length} à faire` : ''}</small></h3>
    <datalist id="td-noms">${tdNoms(p).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
    <div class="td-liste">${ouvertes.map(t => tdLigneHtml(t)).join('') || '<p class="field-hint">Rien à faire pour le moment. Ajoute une tâche, attribue-la à quelqu\'un : elle apparaîtra chez lui, avec un rappel avant l\'échéance.</p>'}</div>
    <div class="ts-add-row"><button type="button" class="btn-upload" onclick="tdAjouter()">+ TÂCHE</button></div>
    ${faites.length ? `<details class="pj-sous-bloc"${tdFaitesOuvert ? ' open' : ''} ontoggle="if(this.open!==${tdFaitesOuvert})tdFaitesOuvert=this.open">
      <summary><span class="pj-sous-titre">FAITES</span> <small class="pj-muted">${faites.length}</small></summary>
      <div class="td-liste">${faites.map(t => tdLigneHtml(t)).join('')}</div>
    </details>` : ''}
  </section>`;
}

function tdLigneHtml(t) {
  const o = { l: 'taches', i: t.id };
  const etat = tdEtat(t);
  return `<div class="td-ligne td-${etat}">
    <input type="checkbox" class="td-coche" ${t.fait ? 'checked' : ''} title="Fait" onchange="tdCocher(${t.id}, this.checked)">
    ${pjField('', 'texte', t.texte, { ...o, ph: 'Tâche (ex : envoyer la V1 au client)', cls: 'td-texte' })}
    <div class="field td-qui-champ"><label></label><input list="td-noms" data-k="qui" data-l="taches" data-i="${t.id}" value="${esc(t.qui || '')}" placeholder="Pour qui ?" oninput="pjInput(this)" onchange="pjRedessiner()"></div>
    ${pjField('', 'echeance', t.echeance, { ...o, type: 'date', cls: 'td-date' })}
    ${pjField('', 'rappel', t.rappel == null ? '' : String(t.rappel), { ...o, select: TD_RAPPELS, cls: 'td-rappel' })}
    <button type="button" class="ts-x" title="Supprimer la tâche" onclick="pjRetirer('taches', ${t.id})">✕</button>
    <div class="td-meta">${tdMetaHtml(t)}</div>
  </div>`;
}

function tdMetaHtml(t) {
  const etat = tdEtat(t);
  const bouts = [];
  if (t.fait) bouts.push(`fait${t.faitPar ? ' par ' + esc(t.faitPar) : ''}${t.faitLe ? ' le ' + esc(pjDateCourte(t.faitLe)) : ''}`);
  else if (etat === 'retard') bouts.push(`<span class="td-alerte">en retard : ${esc(tdEcheanceTexte(t))}</span>`);
  else if (etat === 'rappel') bouts.push(`<span class="td-alerte">à faire ${esc(tdEcheanceTexte(t))}</span>`);
  if (t.par) bouts.push(`ajoutée par ${esc(t.par)}`);
  return bouts.join(' · ');
}

function tdAjouter() {
  const p = pjCur();
  if (!p) return;
  tdTaches(p).push({ id: uid(), texte: '', qui: '', echeance: '', rappel: '1', fait: false, par: tdMoi(), le: pjAujourdhui() });
  pjChange(true);
  const champs = document.querySelectorAll('.pj-taches .td-texte input');
  if (champs.length) champs[champs.length - 1].focus();
}

function tdCocher(id, on, pid) {
  const p = pid != null ? pjById(pid) : pjCur();
  const t = p && tdTaches(p).find(x => x.id === id);
  if (!t) return;
  t.fait = on;
  if (on) { t.faitPar = tdMoi(); t.faitLe = pjAujourdhui(); } else { delete t.faitPar; delete t.faitLe; }
  pjChange(true, p);
}

// ── Vue TÂCHES (toutes les tâches, les miennes d'abord) ──────────────────────
function tdVueHtml() {
  const moi = tdMoi();
  if (tdFiltre === 'moi' && !moi) tdFiltre = 'tous';
  let l = tdToutes();
  const q = pjNorm(pjQ);
  if (q) l = l.filter(x => pjNorm([x.t.texte, x.t.qui, pjTitre(x.p)].join(' ')).includes(q));
  if (tdFiltre === 'faites') l = l.filter(x => x.t.fait).sort((a, b) => (b.t.faitLe || '').localeCompare(a.t.faitLe || ''));
  else {
    l = l.filter(x => !x.t.fait && x.p.statut !== 'annule');
    if (tdFiltre === 'moi') l = l.filter(x => tdEstMoi(x.t.qui));
    l.sort(tdTri);
  }
  // Toutes les tâches : regroupées par personne
  const groupes = tdFiltre === 'tous'
    ? Object.values(l.reduce((acc, x) => { const k = pjNorm(x.t.qui) || '~'; (acc[k] = acc[k] || { nom: x.t.qui || 'Personne', l: [] }).l.push(x); return acc; }, {}))
      .sort((a, b) => (a.nom === 'Personne') - (b.nom === 'Personne') || a.nom.localeCompare(b.nom, 'fr'))
    : [{ nom: '', l }];
  const projets = pjList().filter(p => p.statut !== 'annule' && p.statut !== 'livre').sort((a, b) => pjTitre(a).localeCompare(pjTitre(b), 'fr'));
  return `<div class="td-vue">
    <div class="td-filtres">
      ${[['moi', moi ? 'MES TÂCHES' : 'MES TÂCHES (dis qui tu es)'], ['tous', 'TOUT LE MONDE'], ['faites', 'FAITES']].map(f => `<button type="button" class="btn-edit-inline${tdFiltre === f[0] ? ' on' : ''}" onclick="${f[0] === 'moi' && !moi ? 'tdOuvrirQui()' : `tdFiltre='${f[0]}';pjRedessinerListe()`}">${f[1]}</button>`).join('')}
      <span class="spacer"></span>
      <button type="button" class="export-lien" onclick="tdOuvrirQui()">${moi ? 'tu es ' + esc(moi) + ' · changer' : 'qui es-tu ?'}</button>
    </div>
    <div class="td-ajout">
      <datalist id="td-noms">${tdNoms().map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <input id="td-n-texte" placeholder="Nouvelle tâche…" onkeydown="if(event.key==='Enter')tdAjouterVue()">
      <select id="td-n-projet"><option value="">Projet…</option>${projets.map(p => `<option value="${p.id}">${esc(pjTitre(p))}</option>`).join('')}</select>
      <input id="td-n-qui" list="td-noms" placeholder="Pour qui ?" value="${esc(moi)}">
      <input id="td-n-date" type="date" title="Échéance">
      <select id="td-n-rappel">${TD_RAPPELS.map(r => `<option value="${r[0]}"${r[0] === '1' ? ' selected' : ''}>${r[1]}</option>`).join('')}</select>
      <button type="button" class="btn-save" onclick="tdAjouterVue()">AJOUTER</button>
    </div>
    <p class="field-hint td-ajout-msg" id="td-n-msg"></p>
    ${l.length ? groupes.map(g => `${g.nom ? `<div class="td-groupe">${esc(g.nom.toUpperCase())} <small class="pj-muted">${g.l.length}</small></div>` : ''}
      ${g.l.map(x => tdVueLigneHtml(x)).join('')}`).join('') : `<div class="empty">${tdFiltre === 'moi' ? 'RIEN À FAIRE POUR TOI' : tdFiltre === 'faites' ? 'AUCUNE TÂCHE FAITE' : 'AUCUNE TÂCHE'}</div>`}
  </div>`;
}

function tdVueLigneHtml({ t, p }) {
  const etat = tdEtat(t);
  return `<div class="td-vligne td-${etat}">
    <input type="checkbox" ${t.fait ? 'checked' : ''} title="Fait" onchange="tdCocher(${t.id}, this.checked, ${p.id})">
    <span class="td-vtexte">${esc(t.texte || 'Tâche sans titre')}</span>
    <a href="#" class="td-vprojet" onclick="event.preventDefault();pjGo('projet', ${p.id})"><span class="ch-dot" style="background:${esc(pjCouleur(p))}"></span>${esc(pjTitre(p))}</a>
    <span class="td-vqui">${esc(t.qui || '')}</span>
    <span class="td-vdate">${t.fait ? (t.faitLe ? 'fait le ' + esc(pjDateCourte(t.faitLe)) : 'fait') : etat === 'retard' || etat === 'rappel' ? `<span class="td-alerte">${esc(tdEcheanceTexte(t))}</span>` : esc(tdEcheanceTexte(t))}</span>
  </div>`;
}

function tdAjouterVue() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const msg = document.getElementById('td-n-msg');
  const texte = v('td-n-texte').trim();
  const p = pjById(Number(v('td-n-projet')));
  if (!texte) { document.getElementById('td-n-texte').focus(); return; }
  if (!p) { if (msg) msg.textContent = 'Choisis le projet de la tâche.'; return; }
  tdTaches(p).push({ id: uid(), texte, qui: v('td-n-qui').trim(), echeance: v('td-n-date'), rappel: v('td-n-rappel'), fait: false, par: tdMoi(), le: pjAujourdhui() });
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
    b.onclick = () => { if (!tdMoi()) { tdOuvrirQui(); return; } if (!enProjets()) setEspace('projets'); tdFiltre = 'moi'; pjSetMode('taches'); if (pjVue !== 'liste') pjGo('liste'); };
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
    try { new Notification(`${pjTitre(p)} : ${t.texte || 'tâche'}`, { body: tdEtat(t) === 'retard' ? `En retard (${pjDateCourte(t.echeance)})` : `À faire ${tdEcheanceTexte(t)}`, tag: 'tache-' + t.id }); } catch {}
  });
  Object.keys(vus).forEach(k => { if (vus[k] < auj) delete vus[k]; });
  try { localStorage.setItem('rappelsVus', JSON.stringify(vus)); } catch {}
}
