// ── Simulateur sur la carte 3D des lieux ───────────────────────────────────────
// Deux modes, sur le relief 3D (comme le simulateur de vol de Google Earth) :
//  · VOL  : un avion. ← → pour s'incliner et tourner, ↑ ↓ pour piquer / monter,
//           + / − (ou W / S) pour les gaz.
//  · SNOW : une planche posée sur la montagne. La pente donne la vitesse,
//           ← → pour tourner, ↑ pour pousser, ↓ pour freiner.
// La caméra est placée à la main à chaque image (position, altitude, cap,
// tangage, roulis) avec calculateCameraOptionsFromCameraLngLatAltRotation.

const SIMU_G = 9.81;
const SIMU_R = 6371008.8; // rayon de la Terre (m)
let simu = null;          // état du simulateur en cours, ou null

const simuDeg = Math.PI / 180;
const simuClamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Avancer de d mètres vers le cap donné (degrés, 0 = nord)
function simuAvancer(lng, lat, cap, d) {
  const dLat = d * Math.cos(cap * simuDeg) / SIMU_R / simuDeg;
  const dLng = d * Math.sin(cap * simuDeg) / (SIMU_R * Math.cos(lat * simuDeg)) / simuDeg;
  return [((lng + dLng + 540) % 360) - 180, simuClamp(lat + dLat, -85, 85)];
}

// Altitude du sol (avec l'exagération du relief, comme il est dessiné)
function simuSol(lng, lat) {
  if (!simu) return 0;
  let e = null;
  try { e = simu.map.queryTerrainElevation([lng, lat]); } catch {}
  if (typeof e === 'number' && isFinite(e)) { simu.dernierSol = e; return e; }
  return simu.dernierSol || 0;
}

function simuExageration() {
  try { const t = simu.map.getTerrain(); return (t && t.exaggeration) || 1; } catch { return 1; }
}

// La direction qui descend le plus fort autour d'un point (pour lancer la planche)
function simuCapDescente(lng, lat) {
  const ici = simuSol(lng, lat);
  let meilleur = 0, pente = 0;
  for (let cap = 0; cap < 360; cap += 15) {
    const [x, y] = simuAvancer(lng, lat, cap, 40);
    const d = ici - simuSol(x, y);
    if (d > pente) { pente = d; meilleur = cap; }
  }
  return meilleur;
}

function lancerSimulateur(map, mode) {
  if (!map || simu) return;
  // Le relief doit être là pour voler au-dessus des montagnes ou les descendre
  if (typeof lieuxRelief !== 'undefined' && !lieuxRelief) setLieuxRelief(true);
  const el = map.getContainer();
  const c = map.getCenter();
  const vol = mode === 'vol';
  simu = {
    map, mode, el,
    lng: c.lng, lat: c.lat,
    cap: map.getBearing(),
    tangage: 0,          // angle du nez (degrés, + = monte)
    roulis: 0,           // inclinaison (degrés, + = penche à droite)
    vitesse: vol ? 70 : 0, // m/s
    alt: 0,
    dernierSol: 0,
    touches: new Set(),
    t: 0,
    anim: 0,
    avant: {
      maxPitch: map.getMaxPitch(), maxZoom: map.getMaxZoom(),
      vue: { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), roll: map.getRoll ? map.getRoll() : 0 },
    },
  };
  const sol = simuSol(c.lng, c.lat);
  const ex = simuExageration();
  simu.alt = vol ? sol + 1200 * ex : sol + 2;
  if (!vol) simu.cap = simuCapDescente(c.lng, c.lat);

  // On coupe les gestes de la carte : c'est le simulateur qui tient la caméra
  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'keyboard', 'boxZoom']
    .forEach(h => { try { map[h].disable(); } catch {} });
  try { map.setMaxPitch(180); } catch {}
  try { map.setMaxZoom(24); } catch {}
  el.classList.add('simu-actif');
  // Les pins sont retirés pendant le simulateur : au ras du sol, MapLibre
  // n'arrive plus à les placer sur le relief et la carte se bloque
  simu.pins = (map === lieuxMap ? lieuxMarkers : map === lieuFicheMap ? lieuFicheMarkers : []).slice();
  simu.pins.forEach(m => { try { m.remove(); } catch {} });
  try { closeLieuxPopup(); } catch {}

  // Écran du simulateur : compteurs, aide, commandes tactiles, bouton quitter
  const hud = document.createElement('div');
  hud.className = 'simu-hud' + (vol ? '' : ' snow');
  hud.innerHTML = `
    <div class="simu-haut">
      <span class="simu-titre">${vol ? '✈ VOL' : '🏂 SNOW'}</span>
      <span class="simu-val" data-v="vitesse">0 km/h</span>
      <span class="simu-val" data-v="alt">0 m</span>
      <button type="button" class="simu-quitter" title="Quitter (Échap)">✕ QUITTER</button>
    </div>
    <div class="simu-aide">${vol
      ? '← → tourner · ↑ piquer · ↓ monter · + / − gaz (ou W / S)'
      : '← → tourner · ↑ pousser · ↓ freiner · la pente fait la vitesse'}</div>
    <div class="simu-pad">
      <button type="button" data-k="ArrowUp">▲</button>
      <button type="button" data-k="ArrowLeft">◀</button>
      <button type="button" data-k="ArrowDown">▼</button>
      <button type="button" data-k="ArrowRight">▶</button>
    </div>
    ${vol ? `<div class="simu-gaz"><button type="button" data-k="+">＋</button><button type="button" data-k="-">−</button></div>` : ''}
    ${vol ? '' : '<div class="simu-rider">🏂</div>'}
    <canvas class="simu-neige"></canvas>`;
  el.appendChild(hud);
  simu.hud = hud;
  hud.addEventListener('click', e => e.stopPropagation());
  hud.querySelector('.simu-quitter').onclick = () => quitterSimulateur();
  hud.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); simu && simu.touches.add(k); };
    const off = () => { simu && simu.touches.delete(k); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off));
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

  // Plein écran : plus immersif (si le navigateur le permet)
  try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch {}
  simu.onFs = () => { setTimeout(() => { try { map.resize(); } catch {} }, 50); };
  document.addEventListener('fullscreenchange', simu.onFs);

  if (!vol) simuNeigeInit(hud.querySelector('.simu-neige'));
  simu.t = performance.now();
  simu.anim = requestAnimationFrame(simuImage);
}

function simuTouche(e) {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) return k;
  const m = { z: 'ArrowUp', q: 'ArrowLeft', d: 'ArrowRight', a: 'ArrowLeft', w: '+', s: '-', '+': '+', '=': '+', '-': '-', '_': '-' };
  return m[k.toLowerCase()] || null;
}

function quitterSimulateur() {
  if (!simu) return;
  const s = simu;
  simu = null;
  cancelAnimationFrame(s.anim);
  if (s.neige) cancelAnimationFrame(s.neige.anim);
  window.removeEventListener('keydown', s.onKeyDown);
  window.removeEventListener('keyup', s.onKeyUp);
  window.removeEventListener('blur', s.onBlur);
  document.removeEventListener('fullscreenchange', s.onFs);
  if (s.hud) s.hud.remove();
  s.el.classList.remove('simu-actif');
  (s.pins || []).forEach(m => { try { m.addTo(s.map); } catch {} });
  try { if (document.fullscreenElement === s.el) document.exitFullscreen().catch(() => {}); } catch {}
  const map = s.map;
  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'keyboard', 'boxZoom']
    .forEach(h => { try { map[h].enable(); } catch {} });
  // On se pose doucement là où on s'est arrêté, vu d'un peu plus haut
  try {
    map.setMaxZoom(s.avant.maxZoom);
    map.easeTo({ center: [s.lng, s.lat], zoom: s.mode === 'vol' ? 12 : 14, pitch: 60, bearing: s.cap, roll: 0, duration: 1200 });
    setTimeout(() => { try { map.setMaxPitch(s.avant.maxPitch); } catch {} }, 1300);
  } catch {}
}

function simuImage(t) {
  if (!simu) return;
  const s = simu;
  const dt = Math.min(0.1, Math.max(0, (t - s.t) / 1000));
  s.t = t;
  const T = s.touches;
  const ex = simuExageration();

  if (s.mode === 'vol') {
    // Inclinaison : ← → penchent l'avion, il revient tout seul à plat
    const vRoulis = 60;
    if (T.has('ArrowLeft')) s.roulis -= vRoulis * dt;
    else if (T.has('ArrowRight')) s.roulis += vRoulis * dt;
    else s.roulis -= s.roulis * Math.min(1, 1.5 * dt);
    s.roulis = simuClamp(s.roulis, -60, 60);
    // Tangage : ↑ pique (comme un manche), ↓ monte
    const vTangage = 25;
    if (T.has('ArrowUp')) s.tangage -= vTangage * dt;
    else if (T.has('ArrowDown')) s.tangage += vTangage * dt;
    else s.tangage -= s.tangage * Math.min(1, 0.6 * dt);
    s.tangage = simuClamp(s.tangage, -45, 40);
    // Gaz
    if (T.has('+')) s.vitesse += 40 * dt;
    if (T.has('-')) s.vitesse -= 40 * dt;
    s.vitesse = simuClamp(s.vitesse, 30, 320);
    // Virage : un avion incliné tourne (taux = g·tan(roulis) / v)
    const taux = SIMU_G * Math.tan(s.roulis * simuDeg) / s.vitesse / simuDeg;
    s.cap = (s.cap + taux * dt * 2 + 360) % 360;
    const dHoriz = s.vitesse * Math.cos(s.tangage * simuDeg) * dt;
    [s.lng, s.lat] = simuAvancer(s.lng, s.lat, s.cap, dHoriz);
    s.alt += s.vitesse * Math.sin(s.tangage * simuDeg) * dt * ex;
    // Pas sous le sol (ni dans l'espace)
    const sol = simuSol(s.lng, s.lat);
    const mini = sol + 40 * ex;
    if (s.alt < mini) { s.alt = mini; if (s.tangage < 0) s.tangage *= 0.5; }
    s.alt = Math.min(s.alt, 12000 * ex);
    simuCamera(s.alt, 82 + s.tangage, s.roulis);
    simuHud(s.vitesse, (s.alt - sol) / ex);
  } else {
    // Snow : la pente devant la planche pousse ou freine
    const sol = simuSol(s.lng, s.lat);
    const [ax, ay] = simuAvancer(s.lng, s.lat, s.cap, 12);
    const devant = simuSol(ax, ay);
    const pente = Math.atan2((sol - devant) / ex, 12); // + = ça descend
    let acc = SIMU_G * Math.sin(pente) - 0.06 * SIMU_G * Math.cos(pente) * Math.sign(s.vitesse || 1);
    acc -= 0.0035 * s.vitesse * s.vitesse;            // air
    if (T.has('ArrowUp')) acc += 2.5;                 // on pousse sur le bâton / le pied
    if (T.has('ArrowDown')) acc -= 6;                 // dérapage pour freiner
    // Tourner « casse » un peu la vitesse, comme un vrai virage
    const tourne = T.has('ArrowLeft') ? -1 : T.has('ArrowRight') ? 1 : 0;
    if (tourne) acc -= 0.15 * s.vitesse;
    s.vitesse = simuClamp(s.vitesse + acc * dt, 0, 33);
    s.cap = (s.cap + tourne * 70 * dt + 360) % 360;
    s.roulis += ((tourne * 22) - s.roulis) * Math.min(1, 4 * dt);
    [s.lng, s.lat] = simuAvancer(s.lng, s.lat, s.cap, s.vitesse * dt);
    const solApres = simuSol(s.lng, s.lat);
    s.alt = solApres;
    s.pente = (s.pente || 0) + (pente - (s.pente || 0)) * Math.min(1, 3 * dt);
    // Caméra « à la GoPro sur perche » : un peu derrière et au-dessus du rider,
    // jamais sous la neige (le relief est trop grossier pour filmer au ras du sol)
    const [cx, cy] = simuAvancer(s.lng, s.lat, (s.cap + 180) % 360, 40);
    const camVoulue = Math.max(simuSol(cx, cy), solApres) + 16 * ex;
    s.camAlt = s.camAlt == null ? camVoulue : s.camAlt + (camVoulue - s.camAlt) * Math.min(1, 4 * dt);
    simuCamera(s.camAlt, 76 - s.pente / simuDeg * 0.5, s.roulis * 0.5, [cx, cy]);
    simuHud(s.vitesse, solApres / ex);
    if (s.neige) s.neige.vitesse = s.vitesse;
    const rider = s.hud.querySelector('.simu-rider');
    if (rider) rider.style.transform = `translateX(-50%) rotate(${(s.roulis * 0.8).toFixed(1)}deg)`;
  }
  s.anim = requestAnimationFrame(simuImage);
}

function simuCamera(alt, pitch, roulis, pos) {
  const s = simu;
  try {
    const opts = s.map.calculateCameraOptionsFromCameraLngLatAltRotation(pos || [s.lng, s.lat], alt, s.cap, simuClamp(pitch, 0, 179), roulis);
    s.map.jumpTo(opts);
  } catch (e) { console.error(e); quitterSimulateur(); }
}

function simuHud(vitesse, alt) {
  const h = simu && simu.hud;
  if (!h) return;
  h.querySelector('[data-v="vitesse"]').textContent = Math.round(vitesse * 3.6) + ' km/h';
  h.querySelector('[data-v="alt"]').textContent = (simu.mode === 'vol' ? '↥ ' : '⛰ ') + Math.round(alt).toLocaleString('fr-FR') + ' m';
}

// Flocons qui passent plus vite quand on prend de la vitesse
function simuNeigeInit(cv) {
  if (!cv || !simu) return;
  const n = { cv, ctx: cv.getContext('2d'), flocons: [], vitesse: 0, anim: 0 };
  simu.neige = n;
  const taille = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
  taille();
  for (let i = 0; i < 140; i++) n.flocons.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2, v: 0.2 + Math.random() * 0.6 });
  let avant = performance.now();
  const dessine = t => {
    if (!simu || simu.neige !== n) return;
    const dt = Math.min(0.05, (t - avant) / 1000); avant = t;
    if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) taille();
    const { ctx } = n, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const vite = n.vitesse / 33;
    n.flocons.forEach(f => {
      f.y += (f.v * 0.15 + vite * 0.9 * f.v) * dt;
      f.x += ((f.x - 0.5) * vite * 1.2 + Math.sin(t / 900 + f.r) * 0.01) * dt;
      if (f.y > 1 || f.x < 0 || f.x > 1) { f.y = Math.random() * 0.2; f.x = Math.random(); }
      ctx.beginPath(); ctx.arc(f.x * W, f.y * H, f.r * (1 + vite), 0, Math.PI * 2); ctx.fill();
    });
    n.anim = requestAnimationFrame(dessine);
  };
  n.anim = requestAnimationFrame(dessine);
}

// Les deux boutons ✈ et 🏂 de la barre de la carte
function boutonsSimulateur(map) {
  const frag = document.createDocumentFragment();
  [['vol', '✈', 'Simulateur de vol au-dessus du relief'], ['snow', '🏂', 'Descendre la montagne en snow']].forEach(([mode, txt, titre]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'simu-btn';
    b.title = titre;
    b.textContent = txt;
    b.onclick = e => { e.stopPropagation(); lancerSimulateur(map, mode); };
    frag.appendChild(b);
  });
  return frag;
}
