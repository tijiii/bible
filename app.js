// ── STORAGE ───────────────────────────────────────────────────────────────────
// Les données sont sauvegardées en localStorage — elles persistent entre sessions.

const STORAGE_KEY = 'casting_bible_v1';

function loadDb() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  // Première visite : on part des données initiales
  return {
    talents:       [...INITIAL_DATA.talents],
    clubs:         [...INITIAL_DATA.clubs],
    marques:       [...INITIAL_DATA.marques],
    agences:       [...INITIAL_DATA.agences],
    sports:        [...INITIAL_DATA.sports],
    agencesCustom: []
  };
}

function saveDb() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch(e) {}
}

let db = loadDb();

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function uid() { return Date.now() + Math.floor(Math.random() * 9999); }
function initials(p, n) { return ((p||'')[0]||'').toUpperCase() + ((n||'')[0]||'').toUpperCase(); }
function allAgences() { return [...new Set([...db.agences.map(a => a.nom), ...db.agencesCustom])].sort(); }
function g(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

// ── STATE ─────────────────────────────────────────────────────────────────────
let curTab   = 'f';
let searchQ  = { f:'', h:'', c:'' };
let fSport   = { f:'', h:'' };
let fPays    = { f:'', h:'', c:'' };
let fAgence  = { f:'', h:'' };
let detailTab = null, detailId = null;
let formCtx   = null;
let formSexe  = 'f';

// ── TABS ──────────────────────────────────────────────────────────────────────
function switchTab(t) {
  curTab = t;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  const idx = {f:0, h:1, c:2, m:3, s:4}[t];
  document.querySelectorAll('.tab')[idx].classList.add('active');
  ['f','h','c','m','s'].forEach(x => {
    document.getElementById('panel-'+x).style.display = x === t ? '' : 'none';
  });
  render();
}

function render() {
  updateCounts();
  if      (curTab === 'f') renderModels('f');
  else if (curTab === 'h') renderModels('h');
  else if (curTab === 'c') renderClubs();
  else if (curTab === 'm') renderMarques();
  else                     renderSettings();
}

function updateCounts() {
  const f = db.talents.filter(t => t.sexe === 'f').length;
  const h = db.talents.filter(t => t.sexe === 'h').length;
  document.getElementById('cnt-f').textContent = '(' + f + ')';
  document.getElementById('cnt-h').textContent = '(' + h + ')';
  document.getElementById('cnt-c').textContent = '(' + db.clubs.length + ')';
  document.getElementById('total-count').textContent = (f+h) + ' TALENTS · ' + db.clubs.length + ' CLUBS';
}

// ── MODELS ────────────────────────────────────────────────────────────────────
function renderModels(t) {
  const panel = document.getElementById('panel-' + t);
  const list = db.talents.filter(p => p.sexe === t).filter(p => {
    const q = searchQ[t] || '';
    if (q && !Object.values(p).some(v => String(v).toLowerCase().includes(q.toLowerCase()))) return false;
    if (fSport[t]  && p.sport  !== fSport[t])  return false;
    if (fPays[t]   && p.pays   !== fPays[t])    return false;
    if (fAgence[t] && p.agence !== fAgence[t])  return false;
    return true;
  });

  const sports  = [...new Set(db.talents.filter(p => p.sexe===t).map(p=>p.sport).filter(Boolean))].sort();
  const pays    = [...new Set(db.talents.filter(p => p.sexe===t).map(p=>p.pays).filter(Boolean))].sort();
  const agences = [...new Set(db.talents.filter(p => p.sexe===t).map(p=>p.agence).filter(a=>a&&a!=='—'))].sort();
  const ac      = t === 'f' ? 'f' : 'h';

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville, agence..." value="${esc(searchQ[t])}"
             oninput="searchQ['${t}']=this.value;renderModels('${t}')">
    </div>
    <select class="filter-sel" onchange="fSport['${t}']=this.value;renderModels('${t}')">
      <option value="">SPORT</option>
      ${sports.map(s=>`<option value="${esc(s)}"${fSport[t]===s?' selected':''}>${esc(s)}</option>`).join('')}
    </select>
    <select class="filter-sel" onchange="fPays['${t}']=this.value;renderModels('${t}')">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fPays[t]===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <select class="filter-sel" onchange="fAgence['${t}']=this.value;renderModels('${t}')">
      <option value="">AGENCE</option>
      ${agences.map(a=>`<option value="${esc(a)}"${fAgence[t]===a?' selected':''}>${esc(a)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add ${ac}" onclick="openForm('talent')">+ AJOUTER</button>
  </div>`;

  if (!list.length) {
    html += `<div class="empty">AUCUN PROFIL TROUVÉ</div>`;
  } else {
    html += `<div class="grid">`;
    list.forEach(p => {
      const ig = p.insta && p.insta !== '—';
      html += `<div class="card" onclick="openDetail('talent',${p.id})">
        ${p.photo ? `<img class="card-img" src="${esc(p.photo)}" alt="${esc(p.nom)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="card-ph" style="${p.photo?'display:none':''}">${initials(p.prenom,p.nom)}</div>
        ${p.age ? `<span class="card-age">${esc(String(p.age))} ans</span>` : ''}
        <div class="card-dot ${t}"></div>
        ${ig ? `<div class="card-ig-hover">@${esc(p.insta)}</div>` : ''}
        <div class="card-body">
          <div class="card-name">${esc(p.nom)} <span class="card-prenom">${esc(p.prenom)}</span></div>
          <div class="card-meta">
            ${p.sport  && p.sport  !== '—' ? `<span class="tag sport">${esc(p.sport)}</span>`  : ''}
            ${p.agence && p.agence !== '—' ? `<span class="tag agence">${esc(p.agence)}</span>` : ''}
            ${p.pays                       ? `<span class="tag">${FLAGS[p.pays]||''} ${esc(p.pays)}</span>` : ''}
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  panel.innerHTML = html;
}

// ── CLUBS ─────────────────────────────────────────────────────────────────────
function renderClubs() {
  const panel = document.getElementById('panel-c');
  const q  = searchQ.c || '';
  const fp = fPays.c   || '';
  const list = db.clubs.filter(c => {
    if (q  && !Object.values(c).some(v => String(v).toLowerCase().includes(q.toLowerCase()))) return false;
    if (fp && c.pays !== fp) return false;
    return true;
  });
  const pays = [...new Set(db.clubs.map(c=>c.pays).filter(Boolean))].sort();

  let html = `<div class="toolbar">
    <div class="search-wrap">
      <input placeholder="Nom, ville..." value="${esc(q)}" oninput="searchQ.c=this.value;renderClubs()">
    </div>
    <select class="filter-sel" onchange="fPays.c=this.value;renderClubs()">
      <option value="">PAYS</option>
      ${pays.map(p=>`<option value="${esc(p)}"${fp===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn-add c" onclick="openForm('club')">+ AJOUTER</button>
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
  panel.innerHTML = html;
}

// ── MARQUES ───────────────────────────────────────────────────────────────────
function renderMarques() {
  document.getElementById('panel-m').innerHTML = `
    <div class="marques-section">
      <div class="sec-lbl">MARQUES RUNNING (${db.marques.length})</div>
      <div class="tag-cloud">
        ${db.marques.map(m => `<span class="marque-tag">${esc(m)}</span>`).join('')}
      </div>
      <div class="sec-lbl">AGENCES (${db.agences.length})</div>
      <table class="agence-tbl">
        ${db.agences.map(a => `<tr>
          <td>${esc(a.nom)}</td>
          <td>${FLAGS[a.pays]||''} ${esc(a.pays)}</td>
          <td>${a.mail ? `<a href="mailto:${esc(a.mail)}">${esc(a.mail)}</a>` : ''}</td>
        </tr>`).join('')}
      </table>
    </div>`;
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function renderSettings() {
  document.getElementById('panel-s').innerHTML = `
    <div class="settings-body">
      <div class="settings-section">
        <div class="settings-title">SPORTS / SPÉCIALITÉS (${db.sports.length})</div>
        <div class="settings-list">${db.sports.map(s => settingsTag('sport', s)).join('')}</div>
        <div class="settings-add">
          <input id="new-sport" placeholder="Ex: Parkour, Danse contemporaine..." onkeydown="if(event.key==='Enter')addItem('sport')">
          <button onclick="addItem('sport')">+ AJOUTER</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">AGENCES (${allAgences().length})</div>
        <div class="settings-list">${allAgences().map(a => settingsTag('agence', a)).join('')}</div>
        <div class="settings-add">
          <input id="new-agence" placeholder="Nom de l'agence..." onkeydown="if(event.key==='Enter')addItem('agence')">
          <button onclick="addItem('agence')">+ AJOUTER</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-title">MARQUES (${db.marques.length})</div>
        <div class="settings-list">${db.marques.map(m => settingsTag('marque', m)).join('')}</div>
        <div class="settings-add">
          <input id="new-marque" placeholder="Nom de la marque..." onkeydown="if(event.key==='Enter')addItem('marque')">
          <button onclick="addItem('marque')">+ AJOUTER</button>
        </div>
      </div>
    </div>`;
}

function settingsTag(type, val) {
  return `<div class="settings-item">
    <span>${esc(val)}</span>
    <button onclick="removeItem('${type}','${esc(val)}')" title="Supprimer">✕</button>
  </div>`;
}

function addItem(type) {
  const inputId = { sport:'new-sport', agence:'new-agence', marque:'new-marque' }[type];
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  if (type === 'sport'  && !db.sports.includes(val))  db.sports.push(val);
  if (type === 'agence' && !allAgences().includes(val)) db.agencesCustom.push(val);
  if (type === 'marque' && !db.marques.includes(val)) db.marques.push(val);
  saveDb();
  renderSettings();
}

function removeItem(type, val) {
  if (!confirm(`Supprimer "${val}" ?`)) return;
  if (type === 'sport')  db.sports        = db.sports.filter(s => s !== val);
  if (type === 'agence') { db.agencesCustom = db.agencesCustom.filter(a => a !== val); db.agences = db.agences.filter(a => a.nom !== val); }
  if (type === 'marque') db.marques       = db.marques.filter(m => m !== val);
  saveDb();
  renderSettings();
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function openDetail(type, pid) {
  detailTab = type;
  detailId  = pid;
  const arr = type === 'talent' ? db.talents : db.clubs;
  const p   = arr.find(x => x.id === pid);
  if (!p) return;

  document.getElementById('detail-title').textContent = (p.nom||'') + ' ' + (p.prenom||'');

  const ig = type === 'talent' && p.insta && p.insta !== '—';
  let body = '';

  if (type === 'talent') {
    body = `<div class="detail-layout">
      <div class="detail-img">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.nom)}"
          style="width:100%;height:100%;min-height:280px;object-fit:cover;display:block"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="detail-img-ph" style="${p.photo?'display:none':''}">${initials(p.prenom,p.nom)}</div>
      </div>
      <div class="detail-info">
        <div class="detail-name">${esc(p.nom)}<br><span class="detail-prenom">${esc(p.prenom)}</span></div>
        <div class="detail-tags">
          ${p.age    ? `<span class="tag">${esc(String(p.age))} ans</span>`       : ''}
          ${p.sexe   ? `<span class="tag" style="color:${p.sexe==='f'?'var(--accent)':'var(--accent2)'}">${p.sexe==='f'?'FEMME':'HOMME'}</span>` : ''}
          ${p.sport  && p.sport  !== '—' ? `<span class="tag sport">${esc(p.sport)}</span>`   : ''}
          ${p.agence && p.agence !== '—' ? `<span class="tag agence">${esc(p.agence)}</span>` : ''}
        </div>
        <div class="detail-row"><span class="detail-lbl">PAYS</span><span class="detail-val">${FLAGS[p.pays]||''} ${esc(p.pays)}</span></div>
        <div class="detail-row"><span class="detail-lbl">VILLE</span><span class="detail-val">${esc(p.ville)}</span></div>
        <div class="detail-row"><span class="detail-lbl">TEL</span><span class="detail-val">${esc(p.tel||'—')}</span></div>
        <div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val">
          ${p.mail && p.mail !== '—' ? `<a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : esc(p.mail||'—')}
        </span></div>
        <div class="detail-row"><span class="detail-lbl">INSTAGRAM</span><span class="detail-val">
          ${ig ? `<a href="https://instagram.com/${esc(p.insta)}" target="_blank">@${esc(p.insta)}</a>` : '—'}
        </span></div>
        ${p.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val">${esc(p.notes)}</span></div>` : ''}
        <div style="margin-top:14px">
          ${ig ? `<a class="btn-ig" href="https://instagram.com/${esc(p.insta)}" target="_blank">INSTAGRAM ↗</a>` : ''}
        </div>
      </div>
    </div>`;
  } else {
    body = `<div style="padding:20px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#fff;letter-spacing:.04em">${esc(p.nom)}</div>
      <div class="detail-tags" style="margin-top:8px">
        <span class="tag">${FLAGS[p.pays]||''} ${esc(p.pays)}</span>
        <span class="tag">${esc(p.ville)}</span>
      </div>
      ${p.mail ? `<div class="detail-row"><span class="detail-lbl">MAIL</span><span class="detail-val"><a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a></span></div>` : ''}
      ${p.lien ? `<div class="detail-row"><span class="detail-lbl">INSTAGRAM</span><span class="detail-val"><a href="https://instagram.com/${esc(p.lien)}" target="_blank" style="color:var(--accent2)">@${esc(p.lien)}</a></span></div>` : ''}
      ${p.notes ? `<div class="detail-row"><span class="detail-lbl">NOTES</span><span class="detail-val">${esc(p.notes)}</span></div>` : ''}
    </div>`;
  }

  document.getElementById('detail-body').innerHTML = body;
  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetail()    { document.getElementById('detail-modal').style.display = 'none'; }
function editFromDetail() { closeDetail(); openForm(detailTab, detailId); }
function delFromDetail()  {
  if (!confirm('Supprimer ce profil ?')) return;
  if (detailTab === 'talent') db.talents = db.talents.filter(p => p.id !== detailId);
  else                        db.clubs   = db.clubs.filter(c => c.id !== detailId);
  saveDb();
  closeDetail();
  render();
}

// ── FORM ──────────────────────────────────────────────────────────────────────
function openForm(type, pid) {
  formCtx = { type, id: pid || null };
  const arr = type === 'talent' ? db.talents : db.clubs;
  const p   = pid ? arr.find(x => x.id === pid) : {};
  const v   = p || {};
  const isEdit = !!pid;

  if (type === 'talent') {
    formSexe = v.sexe || 'f';
    document.getElementById('form-title').textContent  = isEdit ? 'ÉDITER PROFIL' : '+ NOUVEAU TALENT';
    document.getElementById('btn-save').className      = 'btn-save ' + formSexe;
    renderTalentForm(v);
  } else {
    document.getElementById('form-title').textContent  = isEdit ? 'ÉDITER CLUB' : '+ NOUVEAU CLUB';
    document.getElementById('btn-save').className      = 'btn-save c';
    renderClubForm(v);
  }
  document.getElementById('form-modal').style.display = 'flex';
}

function selectSexe(s) {
  formSexe = s;
  document.querySelectorAll('.radio-btn').forEach(b => b.className = 'radio-btn');
  document.getElementById('rb-' + s).className = 'radio-btn sel-' + s;
  document.getElementById('btn-save').className = 'btn-save ' + s;
}

function renderTalentForm(v) {
  const ags  = allAgences().map(a => `<option value="${esc(a)}"${v.agence===a?' selected':''}>${esc(a)}</option>`).join('');
  const sps  = db.sports.map(s => `<option value="${esc(s)}"${v.sport===s?' selected':''}>${esc(s)}</option>`).join('');
  const pays = COUNTRIES.map(p => `<option value="${esc(p)}"${v.pays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  const curPays = v.pays || COUNTRIES[0];
  const villes  = (GEO[curPays]||['—']).map(x => `<option value="${esc(x)}"${v.ville===x?' selected':''}>${esc(x)}</option>`).join('');

  document.getElementById('form-body').innerHTML = `
    <div class="field full">
      <label>SEXE</label>
      <div class="radio-group">
        <div class="radio-btn ${formSexe==='f'?'sel-f':''}" id="rb-f" onclick="selectSexe('f')">FEMME</div>
        <div class="radio-btn ${formSexe==='h'?'sel-h':''}" id="rb-h" onclick="selectSexe('h')">HOMME</div>
      </div>
    </div>
    <div class="field"><label>NOM *</label><input id="f-nom"    value="${esc(v.nom   ||'')}"></div>
    <div class="field"><label>PRÉNOM</label><input id="f-prenom" value="${esc(v.prenom||'')}"></div>
    <div class="field"><label>ÂGE</label><input id="f-age" type="number" min="16" max="75" value="${esc(String(v.age||''))}"></div>
    <div class="field"><label>SPORT / SPÉCIALITÉ</label>
      <select id="f-sport"><option value="">—</option>${sps}</select>
    </div>
    <div class="field"><label>PAYS</label>
      <select id="f-pays" onchange="onCountryChange()">${pays}</select>
    </div>
    <div class="field"><label>VILLE</label>
      <select id="f-ville">${villes}</select>
    </div>
    <div class="field"><label>AGENCE</label>
      <select id="f-agence"><option value="">—</option>${ags}</select>
    </div>
    <div class="field"><label>TEL</label><input id="f-tel"   value="${esc(v.tel  ||'')}" placeholder="+33 6..."></div>
    <div class="field"><label>MAIL</label><input id="f-mail"  type="email" value="${esc(v.mail ||'')}"></div>
    <div class="field"><label>INSTAGRAM (handle)</label><input id="f-insta" value="${esc(v.insta||'')}" placeholder="ex: monpseudo"></div>
    <div class="field full">
      <label>LIEN PHOTO (URL directe vers une image)</label>
      <input id="f-photo" value="${esc(v.photo||'')}" placeholder="https://..." oninput="previewPhoto(this.value)">
      <img id="photo-preview" class="photo-preview-img ${v.photo?'show':''}" src="${esc(v.photo||'')}" alt="aperçu">
    </div>
    <div class="field full"><label>NOTES</label><input id="f-notes" value="${esc(v.notes||'')}"></div>`;
}

function renderClubForm(v) {
  const pays = COUNTRIES.map(p => `<option value="${esc(p)}"${v.pays===p?' selected':''}>${FLAGS[p]||''} ${esc(p)}</option>`).join('');
  const curPays = v.pays || COUNTRIES[0];
  const villes  = (GEO[curPays]||['—']).map(x => `<option value="${esc(x)}"${v.ville===x?' selected':''}>${esc(x)}</option>`).join('');

  document.getElementById('form-body').innerHTML = `
    <div class="field"><label>NOM DU CLUB *</label><input id="f-nom" value="${esc(v.nom||'')}"></div>
    <div class="field"><label>MAIL</label><input id="f-mail" value="${esc(v.mail||'')}"></div>
    <div class="field"><label>PAYS</label>
      <select id="fc-pays" onchange="onCountryChangeClub()">${pays}</select>
    </div>
    <div class="field"><label>VILLE</label>
      <select id="fc-ville">${villes}</select>
    </div>
    <div class="field"><label>INSTAGRAM (handle)</label><input id="f-lien" value="${esc(v.lien||'')}"></div>
    <div class="field full"><label>NOTES</label><input id="f-notes" value="${esc(v.notes||'')}"></div>`;
}

function onCountryChange() {
  const pays   = document.getElementById('f-pays').value;
  const villes = GEO[pays] || ['—'];
  document.getElementById('f-ville').innerHTML = villes.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
function onCountryChangeClub() {
  const pays   = document.getElementById('fc-pays').value;
  const villes = GEO[pays] || ['—'];
  document.getElementById('fc-ville').innerHTML = villes.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function previewPhoto(url) {
  const img = document.getElementById('photo-preview');
  if (!img) return;
  if (url) { img.src = url; img.classList.add('show'); }
  else       img.classList.remove('show');
}

function closeForm() { document.getElementById('form-modal').style.display = 'none'; }

function submitForm() {
  if (!g('f-nom')) { alert('Le nom est requis.'); return; }
  const { type, id: pid } = formCtx;

  if (type === 'talent') {
    const obj = {
      nom: g('f-nom'), prenom: g('f-prenom'), sexe: formSexe,
      age: g('f-age') || '', tel: g('f-tel') || '—', mail: g('f-mail') || '—',
      agence: g('f-agence') || '—', pays: g('f-pays') || '—', ville: g('f-ville') || '—',
      insta: g('f-insta'), sport: g('f-sport') || '—',
      photo: g('f-photo'), notes: g('f-notes')
    };
    if (pid) db.talents = db.talents.map(p => p.id === pid ? { ...obj, id: p.id } : p);
    else     db.talents.push({ ...obj, id: uid() });
  } else {
    const obj = {
      nom: g('f-nom'), pays: g('fc-pays') || '—', ville: g('fc-ville') || '—',
      mail: g('f-mail'), lien: g('f-lien'), notes: g('f-notes')
    };
    if (pid) db.clubs = db.clubs.map(c => c.id === pid ? { ...obj, id: c.id } : c);
    else     db.clubs.push({ ...obj, id: uid() });
  }

  saveDb();
  closeForm();
  render();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
render();
