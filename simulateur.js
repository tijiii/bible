// ── Simulateur de vol sur la carte 3D des lieux ────────────────────────────────
// Comme le simulateur de vol de Google Earth : on choisit un avion, on vole
// au-dessus de l'imagerie satellite et du relief à l'échelle réelle.
//
// Physique simplifiée mais réelle : portance et traînée (½·ρ·V²·S·C),
// densité de l'air qui baisse avec l'altitude, poussée selon les gaz,
// décrochage au-delà de l'incidence maximale, virage par l'inclinaison.
// Le manche (↑ ↓) agit sur l'incidence autour de celle qui tient 1 g :
// lâché, l'avion garde à peu près sa trajectoire, et en virage il faut tirer.
//
// Commandes : ← → roulis · ↑ pique · ↓ cabre · Page ↑ / Page ↓ ou + / − gaz
//             Échap pour quitter.
// La caméra est placée à chaque image (position, altitude, cap, tangage,
// roulis) avec calculateCameraOptionsFromCameraLngLatAltRotation.

const SIMU_G = 9.81;
const SIMU_R = 6371008.8;
const simuDeg = Math.PI / 180;
const simuClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIMU_KT = 1.943844;  // m/s → nœuds
const SIMU_FT = 3.28084;   // m → pieds

// Deux avions, comme dans Google Earth
const SIMU_AVIONS = {
  leger: {
    nom: 'Avion léger', sous: 'type SR22 · hélice',
    masse: 1500, surface: 13.5, pousseeMax: 7000,
    cd0: 0.045, k: 0.055, clAlpha: 5.0, alphaDecro: 15, roulisMax: 60,
    vDepart: 90, altDepart: 900, vne: 160,
  },
  chasseur: {
    nom: 'Chasseur', sous: 'type F-16 · réacteur',
    masse: 12000, surface: 28, pousseeMax: 140000,
    cd0: 0.028, k: 0.12, clAlpha: 3.6, alphaDecro: 22, roulisMax: 160,
    vDepart: 250, altDepart: 1800, vne: 650,
  },
};

let simu = null;

function simuAvancer(lng, lat, cap, d) {
  const dLat = d * Math.cos(cap * simuDeg) / SIMU_R / simuDeg;
  const dLng = d * Math.sin(cap * simuDeg) / (SIMU_R * Math.cos(lat * simuDeg)) / simuDeg;
  return [((lng + dLng + 540) % 360) - 180, simuClamp(lat + dLat, -85, 85)];
}

// Altitude du sol (relief à l'échelle réelle pendant le vol)
function simuSol(lng, lat) {
  let e = null;
  try { e = simu.map.queryTerrainElevation([lng, lat]); } catch {}
  if (typeof e === 'number' && isFinite(e)) { simu.dernierSol = e; return e; }
  return simu.dernierSol || 0;
}

// ── Lancement : d'abord le choix de l'avion ───────────────────────────────────
function lancerSimulateur(map) {
  if (!map || simu) return;
  const el = map.getContainer();
  if (el.querySelector('.simu-choix')) return;
  const choix = document.createElement('div');
  choix.className = 'simu-choix';
  choix.innerHTML = `<div class="simu-choix-box">
      <div class="simu-choix-titre">SIMULATEUR DE VOL</div>
      <div class="simu-choix-sous">Départ au-dessus de l'endroit regardé</div>
      ${Object.entries(SIMU_AVIONS).map(([k, a]) => `<button type="button" data-avion="${k}">
        <span>${k === 'leger' ? '🛩' : '✈'} ${a.nom}</span><small>${a.sous}</small></button>`).join('')}
      <div class="simu-choix-aide">← → incliner · ↑ piquer · ↓ cabrer<br>Page ↑ / ↓ ou + / − : gaz · Échap : quitter</div>
      <button type="button" class="simu-choix-annuler">ANNULER</button>
    </div>`;
  choix.addEventListener('click', e => e.stopPropagation());
  choix.querySelector('.simu-choix-annuler').onclick = () => choix.remove();
  choix.querySelectorAll('[data-avion]').forEach(b => {
    b.onclick = () => { choix.remove(); demarrerVol(map, b.dataset.avion); };
  });
  el.appendChild(choix);
}

function demarrerVol(map, typeAvion) {
  const av = SIMU_AVIONS[typeAvion] || SIMU_AVIONS.leger;
  const el = map.getContainer();
  const c = map.getCenter();
  simu = {
    map, el, av, typeAvion,
    depart: { lng: c.lng, lat: c.lat, cap: map.getBearing() },
    touches: new Set(),
    avant: {
      maxPitch: map.getMaxPitch(), maxZoom: map.getMaxZoom(),
      fov: map.getVerticalFieldOfView ? map.getVerticalFieldOfView() : null,
      fond: typeof lieuxFond !== 'undefined' ? lieuxFond : null,
      relief: typeof lieuxRelief !== 'undefined' ? lieuxRelief : true,
    },
    pret: false,
  };
  simuReinitialiser();

  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'keyboard', 'boxZoom']
    .forEach(h => { try { map[h].disable(); } catch {} });
  try { map.setMaxPitch(180); map.setMaxZoom(24); } catch {}
  try { if (map.setVerticalFieldOfView) map.setVerticalFieldOfView(55); } catch {}
  el.classList.add('simu-actif');
  try { closeLieuxPopup(); } catch {}
  // Pas de pins pendant le vol (au ras du relief, MapLibre plante en les plaçant)
  simu.pins = (map === lieuxMap ? lieuxMarkers : map === lieuFicheMap ? lieuFicheMarkers : []).slice();
  simu.pins.forEach(m => { try { m.remove(); } catch {} });

  // Imagerie satellite + relief à l'échelle réelle + ciel bleu et brume
  simu.onStyle = () => simuMonde();
  map.on('style.load', simu.onStyle);
  if (typeof lieuxRelief !== 'undefined') lieuxRelief = true;
  if (typeof lieuxFond !== 'undefined' && lieuxFond !== 'satellite') setLieuxFond('satellite');
  else simuMonde();

  // Écran : instruments (canvas), commandes tactiles, quitter
  const hud = document.createElement('div');
  hud.className = 'simu-hud';
  hud.innerHTML = `
    <canvas class="simu-instruments"></canvas>
    <button type="button" class="simu-quitter" title="Quitter (Échap)">✕ QUITTER</button>
    <div class="simu-pad">
      <button type="button" data-k="ArrowUp">▲</button>
      <button type="button" data-k="ArrowLeft">◀</button>
      <button type="button" data-k="ArrowDown">▼</button>
      <button type="button" data-k="ArrowRight">▶</button>
    </div>
    <div class="simu-gaz"><button type="button" data-k="+">＋</button><button type="button" data-k="-">−</button></div>
    <div class="simu-crash" hidden><div><b>CRASH</b><span></span>
      <button type="button" class="simu-repartir">REPARTIR</button>
      <button type="button" class="simu-crash-quitter">QUITTER</button></div></div>`;
  el.appendChild(hud);
  simu.hud = hud;
  simu.cv = hud.querySelector('.simu-instruments');
  hud.addEventListener('click', e => e.stopPropagation());
  hud.querySelector('.simu-quitter').onclick = () => quitterSimulateur();
  hud.querySelector('.simu-crash-quitter').onclick = () => quitterSimulateur();
  hud.querySelector('.simu-repartir').onclick = () => { simuReinitialiser(); hud.querySelector('.simu-crash').hidden = true; };
  hud.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); simu && simu.touches.add(k); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => simu && simu.touches.delete(k)));
  });

  simu.onKeyDown = e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { quitterSimulateur(); return; }
    const k = simuTouche(e);
    if (k) { e.preventDefault(); simu.touches.add(k); }
  };
  simu.onKeyUp = e => { const k = simuTouche(e); if (k && simu) simu.touches.delete(k); };
  simu.onBlur = () => { if (simu) simu.touches.clear(); };
  window.addEventListener('keydown', simu.onKeyDown);
  window.addEventListener('keyup', simu.onKeyUp);
  window.addEventListener('blur', simu.onBlur);
  try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch {}
  simu.onFs = () => setTimeout(() => { try { map.resize(); } catch {} }, 50);
  document.addEventListener('fullscreenchange', simu.onFs);

  simu.t = performance.now();
  simu.anim = requestAnimationFrame(simuImage);
}

// Position de départ (et « Repartir » après un crash)
function simuReinitialiser() {
  const s = simu, av = s.av;
  s.lng = s.depart.lng; s.lat = s.depart.lat;
  s.cap = s.depart.cap;            // cap (degrés)
  s.roulis = 0;                    // inclinaison (degrés, + = à droite)
  s.pente = 0;                     // pente de la trajectoire (radians)
  s.alpha = 0;                     // incidence (radians)
  s.v = av.vDepart;                // vitesse air (m/s)
  s.gaz = 0.75;
  s.manche = 0; s.ailerons = 0;
  s.alt = null;                    // posée à la première image, quand le relief est là
  s.crash = false;
  s.vz = 0;
}

// Le monde de Google Earth : satellite, relief réel, ciel et brume
function simuMonde() {
  if (!simu) return;
  const map = simu.map;
  try { appliquerRelief(map); } catch {}
  try { map.setTerrain({ source: 'relief', exaggeration: 1 }); } catch {}
  try {
    map.setSky({
      'sky-color': '#4f86d6', 'horizon-color': '#cfe1f3', 'fog-color': '#dbe6f1',
      'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.25, 'atmosphere-blend': 0,
    });
  } catch {}
  simu.pret = true;
}

function simuTouche(e) {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) return k;
  if (k === 'PageUp') return '+';
  if (k === 'PageDown') return '-';
  const m = { '+': '+', '=': '+', '-': '-', '_': '-', w: '+', s: '-' };
  return m[k.toLowerCase()] || null;
}

function quitterSimulateur() {
  if (!simu) return;
  const s = simu;
  simu = null;
  cancelAnimationFrame(s.anim);
  window.removeEventListener('keydown', s.onKeyDown);
  window.removeEventListener('keyup', s.onKeyUp);
  window.removeEventListener('blur', s.onBlur);
  document.removeEventListener('fullscreenchange', s.onFs);
  const map = s.map;
  try { map.off('style.load', s.onStyle); } catch {}
  if (s.hud) s.hud.remove();
  s.el.classList.remove('simu-actif');
  try { if (document.fullscreenElement === s.el) document.exitFullscreen().catch(() => {}); } catch {}
  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'keyboard', 'boxZoom']
    .forEach(h => { try { map[h].enable(); } catch {} });
  try { if (s.avant.fov != null && map.setVerticalFieldOfView) map.setVerticalFieldOfView(s.avant.fov); } catch {}
  (s.pins || []).forEach(m => { try { m.addTo(map); } catch {} });
  // On remet la carte comme avant (fond, relief, ciel) et on se pose en vue d'ensemble
  try {
    lieuxRelief = s.avant.relief;
    if (s.avant.fond && s.avant.fond !== lieuxFond) setLieuxFond(s.avant.fond);
    else {
      try { map.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] }); } catch {}
      appliquerRelief(map);
    }
    map.setMaxZoom(s.avant.maxZoom);
    map.easeTo({ center: [s.lng, s.lat], zoom: 12, pitch: 60, bearing: s.cap, roll: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 1200 });
    setTimeout(() => { try { map.setMaxPitch(s.avant.maxPitch); } catch {} }, 1300);
  } catch {}
}

// ── Une image : commandes → physique → caméra → instruments ───────────────────
function simuImage(t) {
  if (!simu) return;
  const s = simu, av = s.av, T = s.touches;
  const dt = Math.min(0.1, Math.max(0, (t - s.t) / 1000));
  s.t = t;
  if (!s.pret) { s.anim = requestAnimationFrame(simuImage); return; }

  const sol = simuSol(s.lng, s.lat);
  if (s.alt == null) s.alt = sol + av.altDepart;

  if (!s.crash) {
    // Gouvernes : les touches déplacent manche et ailerons, qui reviennent au neutre
    const vers = (val, cible, vitesse) => val + simuClamp(cible - val, -vitesse * dt, vitesse * dt);
    const tire = T.has('ArrowDown'), pousse = T.has('ArrowUp');
    s.manche = vers(s.manche, tire ? 1 : pousse ? -1 : 0, tire || pousse ? 1.6 : 2.5);
    s.ailerons = vers(s.ailerons, T.has('ArrowRight') ? 1 : T.has('ArrowLeft') ? -1 : 0, 4);
    if (T.has('+')) s.gaz = Math.min(1, s.gaz + 0.4 * dt);
    if (T.has('-')) s.gaz = Math.max(0, s.gaz - 0.4 * dt);

    const rho = 1.225 * Math.exp(-Math.max(0, s.alt) / 8500);
    const qS = Math.max(1, 0.5 * rho * s.v * s.v * av.surface);
    const poids = av.masse * SIMU_G;

    // Incidence : celle qui tient la trajectoire (avec une partie du facteur de charge
    // en virage, comme un avion bien compensé), plus l'action du manche
    const charge = Math.pow(Math.max(0.45, Math.cos(s.roulis * simuDeg)), -0.75);
    const alpha1g = (poids * Math.cos(s.pente) * charge) / (qS * av.clAlpha);
    const alphaVoulu = alpha1g + s.manche * 12 * simuDeg;
    s.alpha += (simuClamp(alphaVoulu, -12 * simuDeg, (av.alphaDecro + 6) * simuDeg) - s.alpha) * Math.min(1, 3 * dt);
    // Portance, avec décrochage au-delà de l'incidence max
    const aDecro = av.alphaDecro * simuDeg;
    let cl = av.clAlpha * s.alpha;
    s.decroche = s.alpha > aDecro;
    if (s.decroche) cl = av.clAlpha * aDecro * Math.max(0.35, 1 - (s.alpha - aDecro) / (10 * simuDeg));
    const portance = qS * cl;
    const trainee = qS * (av.cd0 + av.k * cl * cl);
    // Poussée : l'hélice perd de la force avec la vitesse, le réacteur avec l'altitude
    const poussee = s.gaz * av.pousseeMax * (s.typeAvion === 'leger'
      ? Math.max(0.2, 1 - s.v / 200) * 1.6
      : rho / 1.225 * 1.1);

    // Équations du mouvement : vitesse, pente de la trajectoire, cap
    const fNormale = portance + poussee * Math.sin(s.alpha);
    const dv = (poussee * Math.cos(s.alpha) - trainee) / av.masse - SIMU_G * Math.sin(s.pente);
    const dPente = (fNormale * Math.cos(s.roulis * simuDeg) - poids * Math.cos(s.pente)) / (av.masse * Math.max(s.v, 15));
    const dCap = (fNormale * Math.sin(s.roulis * simuDeg)) / (av.masse * Math.max(s.v, 15) * Math.max(0.2, Math.cos(s.pente)));
    s.v = Math.max(8, s.v + dv * dt);
    s.pente = simuClamp(s.pente + dPente * dt, -85 * simuDeg, 85 * simuDeg);
    s.cap = (s.cap + dCap / simuDeg * dt + 360) % 360;
    // Roulis : vitesse selon les ailerons (moins efficaces à basse vitesse), un peu de stabilité
    const efficacite = simuClamp(s.v / av.vDepart, 0.2, 1.3);
    s.roulis += (s.ailerons * av.roulisMax * efficacite - s.roulis * 0.08) * dt;
    if (s.roulis > 180) s.roulis -= 360;
    if (s.roulis < -180) s.roulis += 360;

    // Déplacement
    s.vz = s.v * Math.sin(s.pente);
    [s.lng, s.lat] = simuAvancer(s.lng, s.lat, s.cap, s.v * Math.cos(s.pente) * dt);
    s.alt += s.vz * dt;

    // Sol : crash
    const solIci = simuSol(s.lng, s.lat);
    if (s.alt <= solIci + 2) {
      s.alt = solIci + 2;
      s.crash = true;
      const box = s.hud.querySelector('.simu-crash');
      box.hidden = false;
      box.querySelector('span').textContent = `à ${Math.round(s.v * 3.6)} km/h`;
    }
  }

  // Caméra du cockpit : dans l'axe de l'avion (pente + incidence)
  const tangage = (s.pente + s.alpha) / simuDeg;
  try {
    // Au-delà de ~85° MapLibre ne charge plus les tuiles devant la caméra :
    // on garde la caméra sous cette limite et on décale l'image (padding haut)
    // pour que le centre de l'écran reste exactement dans l'axe du nez.
    const voulu = simuClamp(90 + tangage, 0, 150);
    const vue = Math.min(voulu, SIMU_PITCH_MAX);
    const H = s.map.getCanvas().clientHeight || 600;
    const f = (H / 2) / Math.tan((s.map.getVerticalFieldOfView ? s.map.getVerticalFieldOfView() : 55) * simuDeg / 2);
    const decalage = Math.min(2 * f * Math.tan((voulu - vue) * simuDeg), H * 0.9);
    const opts = s.map.calculateCameraOptionsFromCameraLngLatAltRotation([s.lng, s.lat], s.alt, s.cap, vue, s.roulis * SIMU_SENS_ROULIS);
    opts.padding = { top: decalage, bottom: 0, left: 0, right: 0 };
    s.map.jumpTo(opts);
  } catch (e) { console.error(e); }
  simuInstruments(tangage, simuSol(s.lng, s.lat));
  s.anim = requestAnimationFrame(simuImage);
}
// Signe du roulis pour MapLibre (vérifié : avion penché à droite = horizon qui penche à gauche)
const SIMU_SENS_ROULIS = 1;
const SIMU_PITCH_MAX = 85;

// ── Instruments verts façon Google Earth ──────────────────────────────────────
function simuInstruments(tangage, sol) {
  const s = simu, cv = s.cv;
  if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const vert = '#5dff7a';
  const police = (px, g = 600) => `${g} ${px}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.strokeStyle = vert; ctx.fillStyle = vert; ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3;
  ctx.font = police(13);
  ctx.textBaseline = 'middle';
  const cx = W / 2, cy = H / 2;
  const fov = s.map.getVerticalFieldOfView ? s.map.getVerticalFieldOfView() : 37;
  const focale = (H / 2) / Math.tan(fov * simuDeg / 2);
  // Échelle conforme : chaque barreau tombe pile sur l'angle réel dans la vue
  const ecart = d => focale * Math.tan(simuClamp(d, -80, 80) * simuDeg);

  // Échelle de tangage et horizon, tournées avec le roulis
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - 170, cy - H * 0.3, 340, H * 0.6); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-s.roulis * simuDeg);
  for (let d = -90; d <= 90; d += 5) {
    const y = ecart(tangage - d);
    if (Math.abs(y) > H) continue;
    const large = d === 0 ? 150 : d % 10 === 0 ? 60 : 30;
    ctx.setLineDash(d < 0 ? [6, 5] : []);
    ctx.beginPath();
    ctx.moveTo(-large, y); ctx.lineTo(-large * 0.35, y);
    ctx.moveTo(large * 0.35, y); ctx.lineTo(large, y);
    if (d === 0) { ctx.moveTo(-large * 0.35, y); ctx.lineTo(large * 0.35, y); }
    ctx.stroke();
    if (d !== 0 && d % 10 === 0) { ctx.textAlign = 'left'; ctx.fillText(String(Math.abs(d)), large + 6, y); }
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Maquette de l'avion au centre
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy); ctx.lineTo(cx - 14, cy); ctx.lineTo(cx - 7, cy + 8); ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 7, cy + 8); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx + 40, cy);
  ctx.stroke();

  // Indicateur de roulis (arc en haut)
  const r = H * 0.33;
  ctx.beginPath(); ctx.arc(cx, cy, r, (-90 - 45) * simuDeg, (-90 + 45) * simuDeg); ctx.stroke();
  [-45, -30, -20, -10, 0, 10, 20, 30, 45].forEach(a => {
    const ang = (-90 + a) * simuDeg, l = a % 30 === 0 ? 10 : 6;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.lineTo(cx + Math.cos(ang) * (r + l), cy + Math.sin(ang) * (r + l)); ctx.stroke();
  });
  const ar = (-90 - s.roulis) * simuDeg, rr = r - 4;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ar) * rr, cy + Math.sin(ar) * rr);
  ctx.lineTo(cx + Math.cos(ar + 0.04) * (rr - 12), cy + Math.sin(ar + 0.04) * (rr - 12));
  ctx.lineTo(cx + Math.cos(ar - 0.04) * (rr - 12), cy + Math.sin(ar - 0.04) * (rr - 12));
  ctx.closePath(); ctx.fill();

  // Cap (bande en haut)
  const capY = 28;
  ctx.textAlign = 'center';
  for (let d = -30; d <= 30; d += 5) {
    const c = Math.round((s.cap + d) / 5) * 5;
    const x = cx + (c - s.cap) * 6;
    if (Math.abs(x - cx) > 180) continue;
    const cc = ((c % 360) + 360) % 360;
    ctx.beginPath(); ctx.moveTo(x, capY + 10); ctx.lineTo(x, capY + (cc % 10 === 0 ? 2 : 6)); ctx.stroke();
    if (cc % 30 === 0) ctx.fillText(({ 0: 'N', 90: 'E', 180: 'S', 270: 'O' })[cc] || String(cc / 10), x, capY - 6);
  }
  ctx.strokeRect(cx - 24, capY + 14, 48, 18);
  ctx.fillText(String(Math.round(s.cap) % 360).padStart(3, '0'), cx, capY + 23);

  // Vitesse (gauche) et altitude (droite)
  const gx = Math.max(16, cx - 270), dx = Math.min(W - 126, cx + 160);
  const boite = (x, y, w, txt, etiquette, align) => {
    const tx = align === 'right' ? x + w - 8 : x + 8;
    ctx.strokeRect(x, y - 13, w, 26);
    ctx.textAlign = align; ctx.fillText(txt, tx, y);
    ctx.font = police(11); ctx.fillText(etiquette, tx, y - 24); ctx.font = police(13);
  };
  boite(gx, cy, 110, Math.round(s.v * SIMU_KT) + ' kt', 'VITESSE', 'left');
  ctx.textAlign = 'left';
  ctx.fillText(Math.round(s.v * 3.6) + ' km/h', gx + 8, cy + 26);
  boite(dx, cy, 110, Math.round(s.alt * SIMU_FT).toLocaleString('fr-FR') + ' ft', 'ALTITUDE', 'right');
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(s.alt).toLocaleString('fr-FR') + ' m', dx + 102, cy + 26);
  ctx.fillText('VS ' + Math.round(s.vz * SIMU_FT * 60).toLocaleString('fr-FR') + ' ft/min', dx + 102, cy + 44);
  ctx.fillText('SOL ' + Math.max(0, Math.round((s.alt - sol) * SIMU_FT)).toLocaleString('fr-FR') + ' ft', dx + 102, cy + 62);

  // Gaz (en bas à gauche)
  const bx = gx, by = H - 160, bh = 90;
  ctx.strokeRect(bx, by, 14, bh);
  ctx.fillRect(bx + 2, by + bh - 2 - (bh - 4) * s.gaz, 10, (bh - 4) * s.gaz);
  ctx.textAlign = 'left';
  ctx.fillText('GAZ ' + Math.round(s.gaz * 100) + '%', bx + 22, by + bh - 6);
  ctx.fillText(s.av.nom.toUpperCase(), bx + 22, by + 8);

  // Alarmes
  ctx.textAlign = 'center';
  const alarme = (txt, couleur) => { ctx.fillStyle = couleur; ctx.font = police(17, 700); ctx.fillText(txt, cx, cy + H * 0.2); };
  if (s.crash) return;
  if (s.decroche) alarme('DÉCROCHAGE', '#ff5d5d');
  else if (s.v > s.av.vne) alarme('SURVITESSE', '#ffc75d');
  else if (s.alt - sol < 150 && s.vz < -5) alarme('TERRAIN — REMONTE', '#ffc75d');
}

// Le bouton ✈ de la barre de la carte
function boutonsSimulateur(map) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'simu-btn';
  b.title = 'Simulateur de vol';
  b.textContent = '✈';
  b.onclick = e => { e.stopPropagation(); lancerSimulateur(map); };
  return b;
}
