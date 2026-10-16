// ── Export des lieux en PDF pour un client
// On choisit les lieux, le projet et la période ; une page à imprimer s'ouvre
// (Imprimer → Enregistrer en PDF) avec une page par lieu : photos, GPS, carte et météo.
// Météo : Open-Meteo (gratuit, sans clé). Prévisions si la période est dans les
// 15 prochains jours, sinon moyenne des 5 dernières années à la même période.

let exportSel = new Set();
let exportForm = null;
const exportPhotos = {};      // id du lieu → ids des photos choisies pour le PDF
const exportOuverts = new Set(); // lieux dont le réglage (photos, description) est déplié
const EXPORT_MAX_PHOTOS = 7;

// Ce qu'on peut mettre ou non dans le PDF ; le choix est gardé sur cet appareil
const EXPORT_OPTIONS = [
  ['descClient', 'Description client', true],
  ['tags', 'Catégories et sports', true],
  ['photos', 'Photos', true],
  ['gps', 'Point GPS', true],
  ['maps', 'Lien Google Maps', true],
  ['carte', 'Carte', true],
  ['meteo', 'Météo de la période', true],
  ['ville', 'Ville et pays', false],
  ['adresse', 'Adresse', false],
  ['cout', 'Coûts estimés (interne)', false],
  ['contact', 'Contacts sur place (interne)', false],
];

function exportOptionsSauvees() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('exportOptions') || '{}') || {}; } catch {}
  return Object.fromEntries(EXPORT_OPTIONS.map(([k, , def]) => [k, typeof o[k] === 'boolean' ? o[k] : def]));
}

// Photos du lieu, la couverture en premier
function exportPhotosDuLieu(l) {
  const photos = lieuPhotoUrls(l);
  const cover = lieuCoverPhoto(l, photos);
  return cover ? [cover, ...photos.filter(p => p !== cover)] : photos;
}

function exportPhotosChoisies(l) {
  const photos = exportPhotosDuLieu(l);
  if (!exportPhotos[l.id]) exportPhotos[l.id] = photos.slice(0, 4).map(p => String(p.id));
  return photos.filter(p => exportPhotos[l.id].includes(String(p.id)));
}

function openLieuxExport() {
  const list = lieuxFiltered(true);
  if (!exportSel.size) list.forEach(l => exportSel.add(l.id));
  let bg = document.getElementById('export-modal');
  if (!bg) {
    bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.id = 'export-modal';
    document.getElementById('app').appendChild(bg);
  }
  const prev = exportForm || {};
  const opts = exportOptionsSauvees();
  bg.innerHTML = `<div class="modal export-modal">
    <div class="modal-hdr">
      <span class="modal-title">EXPORTER LES LIEUX EN PDF</span>
      <button class="modal-close" onclick="closeLieuxExport()">✕</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>PROJET</label><input id="ex-projet" value="${esc(prev.projet || '')}" placeholder="ex : Scott FW27"></div>
      <div class="field"><label>CLIENT</label><input id="ex-client" value="${esc(prev.client || '')}" placeholder="ex : Scott"></div>
      <div class="field"><label>DU</label><input type="date" id="ex-du" value="${esc(prev.du || '')}"></div>
      <div class="field"><label>AU</label><input type="date" id="ex-au" value="${esc(prev.au || '')}"></div>
      <div class="field full">
        <label>À METTRE DANS LE PDF</label>
        <div class="export-options">${EXPORT_OPTIONS.map(([k, label]) =>
          `<label class="cat-check"><input type="checkbox" id="ex-${k}" ${opts[k] ? 'checked' : ''} onchange="exportOptionChange()"><span>${esc(label)}</span></label>`).join('')}</div>
      </div>
      <div class="field full">
        <div class="export-sel-hdr">
          <label>LIEUX À MONTRER (<span id="ex-count"></span>)</label>
          <span><button type="button" class="export-lien" onclick="exportToutCocher(true)">tout</button> · <button type="button" class="export-lien" onclick="exportToutCocher(false)">aucun</button></span>
        </div>
        <div class="export-liste">${lieuxList().map(exportItemHtml).join('') || '<div class="empty">AUCUN LIEU</div>'}</div>
      </div>
      <div class="field-hint field full">Une page s'ouvre avec le document : choisis « Enregistrer en PDF » dans la fenêtre d'impression.</div>
    </div>
    <div class="modal-footer">
      <div class="spacer"></div>
      <button class="btn-cancel" onclick="closeLieuxExport()">ANNULER</button>
      <button class="btn-save" id="ex-go" onclick="runLieuxExport()">CRÉER LE PDF</button>
    </div>
  </div>`;
  bg.style.display = 'flex';
  exportMajCompte();
}

function exportItemHtml(l) {
  const cover = lieuCoverPhoto(l)?.url;
  const ou = [l.ville, l.pays].filter(Boolean).join(', ');
  const on = exportSel.has(l.id);
  return `<div class="export-item-wrap" data-id="${l.id}">
    <div class="export-item">
      <label class="export-item-main">
        <input type="checkbox" value="${l.id}" ${on ? 'checked' : ''} onchange="exportCocher(${l.id}, this.checked)">
        ${cover ? `<img src="${esc(cover)}" alt="">` : '<span class="export-item-ph"></span>'}
        <span class="export-item-txt"><b>${esc(l.nom)}</b>${ou ? `<small>${esc(ou)}</small>` : ''}</span>
      </label>
      <button type="button" class="export-regler" ${on ? '' : 'hidden'} onclick="exportOuvrir(${l.id})">${exportOuverts.has(l.id) ? 'FERMER' : 'PHOTOS ET TEXTE'}</button>
    </div>
    ${on && exportOuverts.has(l.id) ? exportReglageHtml(l) : ''}
  </div>`;
}

function exportReglageHtml(l) {
  const photos = exportPhotosDuLieu(l);
  exportPhotosChoisies(l);
  const choix = exportPhotos[l.id];
  const rang = photos.filter(p => choix.includes(String(p.id)));
  return `<div class="export-reglage">
    <div class="export-reglage-lbl">PHOTOS DU PDF <small>${choix.length ? `${rang.length} choisie${rang.length > 1 ? 's' : ''}, la première en grand` : 'aucune'} · ${EXPORT_MAX_PHOTOS} au plus</small></div>
    ${photos.length ? `<div class="export-photos">${photos.map(p => {
      const n = rang.indexOf(p);
      return `<button type="button" class="export-photo${n >= 0 ? ' on' : ''}" data-pid="${esc(String(p.id))}" onclick="exportPhoto(${l.id}, this.dataset.pid)">
        <img src="${esc(p.url)}" alt="" loading="lazy">${n >= 0 ? `<span>${n + 1}</span>` : ''}</button>`;
    }).join('')}</div>` : '<div class="field-hint">Ce lieu n\'a pas encore de photo.</div>'}
    <div class="export-reglage-lbl">DESCRIPTION POUR LE CLIENT
      ${l.description ? `<button type="button" class="export-lien" onclick="exportReprendreDesc(${l.id})">reprendre la description interne</button>` : ''}</div>
    <textarea rows="3" id="ex-desc-${l.id}" placeholder="${esc(l.description || 'Le texte que verra le client. Vide = pas de description.')}"
      onchange="exportDescClient(${l.id}, this.value)">${esc(l.descClient || '')}</textarea>
  </div>`;
}

function exportRedessinerLieu(id) {
  const wrap = document.querySelector(`.export-item-wrap[data-id="${id}"]`);
  const l = lieuxList().find(x => x.id === id);
  if (wrap && l) wrap.outerHTML = exportItemHtml(l);
}

function exportOuvrir(id) {
  if (exportOuverts.has(id)) exportOuverts.delete(id); else exportOuverts.add(id);
  exportRedessinerLieu(id);
}

function exportPhoto(id, photoId) {
  const l = lieuxList().find(x => x.id === id);
  if (!l) return;
  exportPhotosChoisies(l);
  const choix = exportPhotos[id];
  const i = choix.indexOf(photoId);
  if (i >= 0) choix.splice(i, 1);
  else if (choix.length >= EXPORT_MAX_PHOTOS) { alert(`${EXPORT_MAX_PHOTOS} photos au plus par lieu.`); return; }
  else choix.push(photoId);
  exportRedessinerLieu(id);
}

// La description client est gardée sur le lieu (elle resservira au prochain export)
function exportDescClient(id, texte) {
  const l = lieuxList().find(x => x.id === id);
  if (!l || (l.descClient || '') === texte.trim()) return;
  l.descClient = texte.trim();
  saveDb();
}

function exportReprendreDesc(id) {
  const l = lieuxList().find(x => x.id === id);
  const ta = document.getElementById('ex-desc-' + id);
  if (!l || !ta) return;
  ta.value = l.description || '';
  exportDescClient(id, ta.value);
}

function exportOptionChange() {
  const o = Object.fromEntries(EXPORT_OPTIONS.map(([k]) => [k, !!document.getElementById('ex-' + k)?.checked]));
  try { localStorage.setItem('exportOptions', JSON.stringify(o)); } catch {}
}

function closeLieuxExport() {
  const bg = document.getElementById('export-modal');
  if (bg) bg.style.display = 'none';
}

function exportCocher(id, on) {
  if (on) exportSel.add(id); else exportSel.delete(id);
  exportRedessinerLieu(id);
  exportMajCompte();
}

function exportToutCocher(on) {
  lieuxList().forEach(l => { if (on) exportSel.add(l.id); else exportSel.delete(l.id); exportRedessinerLieu(l.id); });
  exportMajCompte();
}

function exportMajCompte() {
  const n = lieuxList().filter(l => exportSel.has(l.id)).length;
  const el = document.getElementById('ex-count');
  if (el) el.textContent = n + ' sélectionné' + (n > 1 ? 's' : '');
}

// ── Météo
const METEO_CODES = {
  0: 'Ciel dégagé', 1: 'Plutôt dégagé', 2: 'Partiellement nuageux', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte', 56: 'Bruine verglaçante', 57: 'Bruine verglaçante',
  61: 'Pluie faible', 63: 'Pluie', 65: 'Pluie forte', 66: 'Pluie verglaçante', 67: 'Pluie verglaçante',
  71: 'Neige faible', 73: 'Neige', 75: 'Neige forte', 77: 'Grains de neige', 80: 'Averses', 81: 'Averses', 82: 'Fortes averses',
  85: 'Averses de neige', 86: 'Fortes averses de neige', 95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage avec grêle',
};

const isoJour = d => d.toISOString().slice(0, 10);
const ajoutJours = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoJour(d); };
const ajoutAns = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + n); return isoJour(d); };
const heure = s => (String(s || '').split('T')[1] || '').replace(':', 'h').replace(/^0(?=\d)/, '');
const minutesDe = s => { const [h, m] = (String(s).split('T')[1] || '0:0').split(':').map(Number); return h * 60 + m; };
const heureDeMinutes = m => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;

function formatJour(iso, court) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', court ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function meteoLieu(c, du, au) {
  const daily = 'temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset';
  const today = isoJour(new Date());
  // Prévisions : seulement dans les 15 prochains jours
  if (du >= today && au <= ajoutJours(today, 15)) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&daily=${daily},weather_code,precipitation_probability_max&timezone=auto&start_date=${du}&end_date=${au}`;
    const d = (await (await fetch(url)).json()).daily;
    if (!d || !d.time) throw new Error('météo indisponible');
    return { mode: 'prevision', jours: d.time.map((t, i) => ({
      date: t, tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i], pluie: d.precipitation_probability_max?.[i],
      desc: METEO_CODES[d.weather_code?.[i]] || '', lever: heure(d.sunrise[i]), coucher: heure(d.sunset[i]),
    })) };
  }
  // Sinon : la même période les 5 dernières années (archives)
  const ansPasses = [];
  for (let n = 1; ansPasses.length < 5; n++) {
    const fin = ajoutAns(au, -n);
    if (fin < ajoutJours(today, -6)) ansPasses.push([ajoutAns(du, -n), fin]);
  }
  const res = await Promise.all(ansPasses.map(([a, b]) =>
    fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lng}&daily=${daily}&timezone=auto&start_date=${a}&end_date=${b}`)
      .then(r => r.json()).then(j => j.daily).catch(() => null)));
  const jours = res.filter(Boolean).flatMap(d => d.time.map((t, i) => ({
    tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i], pluie: d.precipitation_sum[i], lever: d.sunrise[i], coucher: d.sunset[i],
  }))).filter(j => j.tmax !== null && j.tmin !== null);
  if (!jours.length) throw new Error('météo indisponible');
  const moy = k => jours.reduce((s, j) => s + j[k], 0) / jours.length;
  return {
    mode: 'moyenne', ans: res.filter(Boolean).length,
    tmin: moy('tmin'), tmax: moy('tmax'),
    joursPluie: Math.round(100 * jours.filter(j => j.pluie >= 1).length / jours.length),
    lever: heureDeMinutes(jours.reduce((s, j) => s + minutesDe(j.lever), 0) / jours.length),
    coucher: heureDeMinutes(jours.reduce((s, j) => s + minutesDe(j.coucher), 0) / jours.length),
  };
}

function meteoHtml(m, du, au) {
  const periode = du === au ? formatJour(du, true) : `du ${formatJour(du, true)} au ${formatJour(au, true)}`;
  if (!m) return '';
  if (m.erreur) return `<div class="ex-meteo"><div class="ex-lbl">MÉTÉO ${esc(periode)}</div><p class="ex-muted">Météo indisponible pour ce lieu.</p></div>`;
  if (m.mode === 'prevision') {
    return `<div class="ex-meteo"><div class="ex-lbl">PRÉVISIONS MÉTÉO</div>
      <table>${m.jours.map(j => `<tr><td>${esc(formatJour(j.date))}</td><td>${esc(j.desc)}</td>
        <td class="ex-num">${Math.round(j.tmin)}° / ${Math.round(j.tmax)}°</td>
        <td class="ex-num">${j.pluie !== undefined && j.pluie !== null ? `pluie ${j.pluie} %` : ''}</td>
        <td class="ex-num">☀ ${esc(j.lever)} → ${esc(j.coucher)}</td></tr>`).join('')}</table></div>`;
  }
  return `<div class="ex-meteo"><div class="ex-lbl">MÉTÉO ${esc(periode.toUpperCase())}</div>
    <div class="ex-meteo-grille">
      <div><b>${Math.round(m.tmin)}° / ${Math.round(m.tmax)}°</b><small>min / max</small></div>
      <div><b>${m.joursPluie} %</b><small>des jours avec pluie</small></div>
      <div><b>${esc(m.lever)}</b><small>lever du soleil</small></div>
      <div><b>${esc(m.coucher)}</b><small>coucher du soleil</small></div>
    </div>
    <p class="ex-muted">Moyenne des ${m.ans} dernières années à la même période (Open-Meteo).</p></div>`;
}

// ── Petite carte : tuiles OpenStreetMap assemblées autour du point.
// Le cadre de tuiles est plus grand que la place disponible et centré sur le point :
// la carte remplit le bas de la colonne, quelle que soit la hauteur restante.
function miniCarteHtml(c, large) {
  const z = 14, W = large ? 1100 : 480, H = 620, n = Math.pow(2, z);
  const x = (c.lng + 180) / 360 * n;
  const rad = c.lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  const px = x * 256 - W / 2, py = y * 256 - H / 2; // coin haut gauche, en pixels du monde
  const tiles = [];
  for (let tx = Math.floor(px / 256); tx <= Math.floor((px + W) / 256); tx++)
    for (let ty = Math.floor(py / 256); ty <= Math.floor((py + H) / 256); ty++)
      tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png" style="left:${Math.round(tx * 256 - px)}px;top:${Math.round(ty * 256 - py)}px" alt="">`);
  return `<div class="ex-carte"><div class="ex-tuiles" style="width:${W}px;height:${H}px">${tiles.join('')}</div><span class="ex-pin"></span>
    <span class="ex-osm">© OpenStreetMap</span></div>`;
}

function exportDocHtml(opts, lieux, meteos) {
  const base = location.href.replace(/[^/]*$/, '');
  const periode = opts.du ? (opts.au && opts.au !== opts.du ? `Du ${formatJour(opts.du, true)} au ${formatJour(opts.au, true)}` : formatJour(opts.du, true)) : '';
  const titre = opts.projet || 'Repérages';
  const pages = lieux.map((l, i) => {
    const c = parseGps(l.gps);
    const photos = opts.photos ? exportPhotosChoisies(l) : [];
    const [grande, ...autres] = photos;
    const ou = opts.ville ? [l.ville, l.pays].filter(Boolean).join(', ') : '';
    const tags = opts.tags ? [...lieuCats(l), ...lieuSports(l)] : [];
    const maps = opts.maps ? lieuMapsLink(l) : '';
    const rows = [
      opts.adresse && l.adresse ? `<div><span>ADRESSE</span>${esc(l.adresse)}</div>` : '',
      opts.gps && c ? `<div><span>GPS</span>${esc(formatGps(c))}</div>` : '',
      maps ? `<div><span>GOOGLE MAPS</span><a href="${esc(maps)}">Ouvrir le lieu dans Google Maps</a></div>` : '',
      opts.cout && l.cout !== '' && l.cout !== undefined ? `<div><span>COÛT ESTIMÉ</span>${esc(formatCout(l.cout))}${l.coutDetail ? ` · ${esc(l.coutDetail)}` : ''}</div>` : '',
      opts.contact && (l.contact || l.tel || l.mail) ? `<div><span>CONTACT</span>${esc([l.contact, l.tel, l.mail].filter(Boolean).join(' · '))}</div>` : '',
    ].join('');
    return `<section class="ex-page ex-lieu${grande ? '' : ' sans-photo'}">
      <div class="ex-col-info">
        <div class="ex-numero">${String(i + 1).padStart(2, '0')}</div>
        <h2>${esc(l.nom)}</h2>
        ${ou ? `<div class="ex-ou">${esc(ou)}</div>` : ''}
        ${tags.length ? `<div class="ex-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        ${opts.descClient && l.descClient ? `<p class="ex-desc">${esc(l.descClient)}</p>` : ''}
        ${rows ? `<div class="ex-rows">${rows}</div>` : ''}
        ${opts.meteo && opts.du ? meteoHtml(meteos[l.id], opts.du, opts.au || opts.du) : ''}
        ${opts.carte && c ? miniCarteHtml(c, !grande) : ''}
      </div>
      ${grande ? `<div class="ex-col-photos ${autres.length > 3 ? 'deux-rangs' : autres.length ? 'un-rang' : ''}">
        <img class="ex-cover" src="${esc(grande.full || grande.url)}" alt="">
        ${autres.length ? `<div class="ex-autres" style="grid-template-columns:repeat(${Math.min(autres.length, 3)}, 1fr)">${autres.map(p => `<img src="${esc(p.full || p.url)}" alt="">`).join('')}</div>` : ''}
      </div>` : ''}
    </section>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}${opts.client ? ' · ' + esc(opts.client) : ''} · Lieux</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'EB Garamond', Garamond, 'Times New Roman', serif; color: #111; background: #e9e9e7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ex-barre { position: sticky; top: 0; z-index: 5; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 12px; background: #111; color: #fff; font-size: 15px; }
  .ex-barre button { font: inherit; padding: 6px 14px; border: 1px solid #fff; background: #fff; color: #111; cursor: pointer; }
  .ex-page { width: 297mm; height: 210mm; margin: 10mm auto; background: #fff; padding: 14mm 16mm; overflow: hidden; page-break-after: always; break-after: page; position: relative; }
  .ex-page:last-child { page-break-after: auto; break-after: auto; }
  .ex-couv { display: flex; flex-direction: column; justify-content: space-between; }
  .ex-couv img.ex-logo { height: 34px; width: auto; align-self: flex-start; }
  .ex-couv h1 { font-weight: 400; font-size: 54px; line-height: 1.05; letter-spacing: .01em; }
  .ex-couv .ex-sous { font-size: 20px; color: #6d6d6a; margin-top: 10px; }
  .ex-sommaire { columns: 2; column-gap: 18mm; font-size: 16px; }
  .ex-sommaire div { break-inside: avoid; display: flex; gap: 10px; padding: 5px 0; border-bottom: 1px solid #e4e4e2; }
  .ex-sommaire b { font-weight: 500; min-width: 26px; color: #8a8a87; }
  .ex-sommaire small { color: #8a8a87; margin-left: auto; font-size: 14px; }
  .ex-pied { position: absolute; left: 16mm; right: 16mm; bottom: 7mm; display: flex; justify-content: space-between; font-size: 11px; color: #8a8a87; letter-spacing: .04em; }
  .ex-lieu { display: grid; grid-template-columns: 112mm 1fr; gap: 10mm; }
  .ex-col-info { display: flex; flex-direction: column; gap: 3.5mm; min-width: 0; overflow: hidden; }
  .ex-numero { font-size: 13px; color: #8a8a87; letter-spacing: .08em; }
  .ex-lieu h2 { font-weight: 400; font-size: 32px; line-height: 1.05; }
  .ex-ou { font-size: 16px; color: #6d6d6a; margin-top: -2mm; }
  .ex-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .ex-tags span { font-size: 11.5px; border: 1px solid #e4e4e2; padding: 1px 6px; text-transform: lowercase; }
  .ex-desc { font-size: 14.5px; line-height: 1.4; white-space: pre-wrap; }
  .ex-rows div { display: flex; gap: 10px; font-size: 13px; padding: 3px 0; border-bottom: 1px solid #efefed; }
  .ex-rows span, .ex-lbl { font-size: 10.5px; letter-spacing: .08em; color: #8a8a87; min-width: 24mm; padding-top: 2px; }
  .ex-rows a { color: #111; }
  .ex-meteo { border: 1px solid #e4e4e2; padding: 3mm 4mm; }
  .ex-meteo .ex-lbl { margin-bottom: 2mm; }
  .ex-meteo-grille { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; }
  .ex-meteo-grille b { display: block; font-weight: 500; font-size: 17px; }
  .ex-meteo-grille small { font-size: 10.5px; color: #8a8a87; }
  .ex-meteo table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .ex-meteo td { padding: 1.5px 3px 1.5px 0; border-bottom: 1px solid #f1f1ef; white-space: nowrap; }
  .ex-num { text-align: right; }
  .ex-muted { font-size: 10.5px; color: #8a8a87; margin-top: 1.5mm; }
  .ex-carte { position: relative; overflow: hidden; border: 1px solid #e4e4e2; flex: 1 1 0; min-height: 45mm; background: #f4f4f3; }
  .ex-tuiles { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
  .ex-carte img { position: absolute; width: 256px; height: 256px; }
  .ex-pin { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: #111; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
  .ex-osm { position: absolute; right: 0; bottom: 0; font-size: 9px; background: rgba(255,255,255,.8); padding: 1px 4px; }
  .ex-lieu.sans-photo { grid-template-columns: 1fr; }
  .ex-lieu.sans-photo .ex-desc { max-width: 190mm; }
  .ex-col-photos { display: grid; gap: 3mm; min-height: 0; grid-template-rows: 1fr; }
  .ex-col-photos.un-rang { grid-template-rows: 2fr 1fr; }
  .ex-col-photos.deux-rangs { grid-template-rows: 3fr 2fr; }
  .ex-col-photos img { width: 100%; height: 100%; object-fit: cover; display: block; min-height: 0; }
  .ex-cover { min-height: 0; }
  .ex-autres { display: grid; grid-auto-rows: 1fr; gap: 3mm; min-height: 0; }
  .ex-sans-photo { display: flex; align-items: center; justify-content: center; background: #f4f4f3; color: #8a8a87; font-size: 15px; }
  @media print { body { background: #fff; } .ex-barre { display: none; } .ex-page { margin: 0; } }
  @media screen and (max-width: 1150px) { .ex-page { zoom: .5; } }
</style></head><body>
<div class="ex-barre">Vérifie le document puis <button onclick="window.print()">IMPRIMER / ENREGISTRER EN PDF</button></div>
<section class="ex-page ex-couv">
  <img class="ex-logo" src="${base}widen-logo.png" alt="WIDEN">
  <div>
    <h1>${esc(titre)}</h1>
    <div class="ex-sous">${[opts.client, periode, `${lieux.length} lieu${lieux.length > 1 ? 'x' : ''}`].filter(Boolean).map(esc).join(' · ')}</div>
  </div>
  <div class="ex-sommaire">${lieux.map((l, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b>${esc(l.nom)}${opts.ville ? `<small>${esc([l.ville, l.pays].filter(Boolean).join(', '))}</small>` : ''}</div>`).join('')}</div>
  <div class="ex-pied"><span>WIDEN PRODUCTION</span><span>widenproduction.fr</span></div>
</section>
${pages}
</body></html>`;
}

async function runLieuxExport() {
  const g = id => (document.getElementById(id) || {}).value?.trim() || '';
  const opts = {
    projet: g('ex-projet'), client: g('ex-client'), du: g('ex-du'), au: g('ex-au') || g('ex-du'),
    ...Object.fromEntries(EXPORT_OPTIONS.map(([k]) => [k, !!document.getElementById('ex-' + k)?.checked])),
  };
  // Une description en cours de frappe est enregistrée avant de créer le PDF
  document.querySelectorAll('.export-reglage textarea').forEach(ta => exportDescClient(Number(ta.id.replace('ex-desc-', '')), ta.value));
  if (opts.meteo && !opts.du) { alert('Choisis les dates pour avoir la météo, ou décoche « Météo de la période ».'); return; }
  if (opts.du && opts.au < opts.du) { alert('La date de fin est avant la date de début.'); return; }
  if (opts.du && ajoutJours(opts.du, 31) < opts.au) { alert('Choisis une période d\'un mois au plus.'); return; }
  const lieux = lieuxList().filter(l => exportSel.has(l.id));
  if (!lieux.length) { alert('Coche au moins un lieu.'); return; }
  exportForm = opts;

  const btn = document.getElementById('ex-go');
  btn.disabled = true; btn.textContent = 'PRÉPARATION…';

  const meteos = {};
  if (opts.meteo && opts.du) {
    await Promise.all(lieux.map(async l => {
      const c = parseGps(l.gps);
      if (!c) return;
      try { meteos[l.id] = await meteoLieu(c, opts.du, opts.au); }
      catch { meteos[l.id] = { erreur: true }; }
    }));
  }
  btn.disabled = false; btn.textContent = 'CRÉER LE PDF';
  closeLieuxExport();

  // Le document s'affiche à la place du site (bouton RETOUR), puis l'impression
  ouvrirDocument(exportDocHtml(opts, lieux, meteos));
  await imprimerDocument();
}
