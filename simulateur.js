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
// Hauteur minimale au-dessus du relief et distance vérifiée devant le nez (m)
const SIMU_MARGE_SOL = 6;
const SIMU_NEZ = 25;
// Niveaux de zoom à l'écran en vol, et valeurs par défaut de MapLibre à remettre
const SIMU_LOD = [4, 3], SIMU_LOD_HAUT = 3, SIMU_LOD_DEFAUT = [9.314, 3];
const SIMU_RELIEF = 'relief-vol', SIMU_RELIEF_ZOOM = 12;
// Tuiles envoyées à la carte graphique par image (8 par défaut) : moins à la
// fois, c'est un peu plus long à se remplir mais sans à-coups
const SIMU_IMAGES_PAR_IMAGE = 3;
// Image satellite de vol : tuiles déclarées en 512 px (la carte prend le zoom
// du dessous et l'agrandit), soit 4 fois moins de tuiles à télécharger, envoyer
// à la carte graphique et redessiner sur le relief ; et sans fondu d'apparition
// (avec le relief, chaque tuile en train d'apparaître fait tout redessiner).
function simuSatelliteVol(map, actif) {
  try {
    if (actif) {
      if (!map.getLayer('sat') || map.getLayer('sat-vol')) return;
      const src = map.getStyle().sources.sat;
      map.addSource('sat-vol', { ...src, tileSize: 512 });
      map.addLayer({ id: 'sat-vol', type: 'raster', source: 'sat-vol', paint: { 'raster-fade-duration': 0 } }, 'sat');
      map.setLayoutProperty('sat', 'visibility', 'none');
    } else {
      if (map.getLayer('sat-vol')) map.removeLayer('sat-vol');
      if (map.getSource('sat-vol')) map.removeSource('sat-vol');
      if (map.getLayer('sat')) map.setLayoutProperty('sat', 'visibility', 'visible');
    }
  } catch (e) { console.error(e); }
}

// Résolution qui s'adapte : si l'ordinateur passe sous ~45 images/s pendant
// 2 s, on dessine la carte un cran moins fin (jusqu'à 60 %), et on remonte
// quand il y a de la marge. Une image fluide un peu plus douce vaut mieux
// qu'une image nette qui saccade.
const SIMU_RESOLUTIONS = [1, 0.85, 0.7, 0.6];
function simuResolution(t, dt) {
  const s = simu;
  if (!s.map.setPixelRatio || !(dt > 0)) return;
  const P = s.perf || (s.perf = { cran: 0, debut: t, somme: 0, n: 0 });
  P.somme += dt; P.n++;
  if (t - P.debut < 2000) return;
  const moyenne = P.somme / P.n * 1000;
  P.debut = t; P.somme = 0; P.n = 0;
  let cran = P.cran;
  // On remonte seulement après 10 s sans avoir dû baisser, pour ne pas faire le yoyo
  if (moyenne > 22 && cran < SIMU_RESOLUTIONS.length - 1) { cran++; P.bloque = t + 10000; }
  else if (moyenne < 17.5 && cran > 0 && t > (P.bloque || 0)) cran--;
  if (cran === P.cran) return;
  P.cran = cran;
  try { s.map.setPixelRatio(SIMU_RESOLUTIONS[cran]); } catch {}
}

function simuLod(niveaux) {
  if (!simu || simu.lod === niveaux) return;
  simu.lod = niveaux;
  try { if (simu.map.setSourceTileLodParams) simu.map.setSourceTileLodParams(niveaux, SIMU_LOD[1]); } catch {}
}
// Altitude du sol touché sur le segment parcouru, ou null si l'avion passe
function simuContact([lng, lat, alt], longueur, dAlt, dHoriz) {
  const pas = Math.max(1, Math.ceil(longueur / 8));
  for (let i = 1; i <= pas; i++) {
    const d = longueur * i / pas;
    const [x, y] = simuAvancer(lng, lat, simu.cap, d);
    const h = alt + dAlt * Math.min(1, dHoriz > 0 ? d / dHoriz : 1);
    const sol = simuSol(x, y);
    if (h <= sol + SIMU_MARGE_SOL) return sol;
  }
  return null;
}

// Altitude du sol. MapLibre remonte d'office la caméra quand il la croit sous
// le relief, en mesurant le sol avec une tuile parfois plus grossière que la
// nôtre : l'avion « bougeait tout seul ». On prend donc la plus haute des deux
// mesures, pour que notre sol ne soit jamais plus bas que celui de MapLibre.
function simuSol(lng, lat) {
  const map = simu.map;
  let e = null;
  try { e = map.queryTerrainElevation([lng, lat]); } catch {}
  try {
    if (map.terrain && map.terrain.getElevationForLngLatZoom) {
      const e2 = map.terrain.getElevationForLngLatZoom(new maplibregl.LngLat(lng, lat), map.transform.zoom);
      if (isFinite(e2) && (!isFinite(e) || e2 > e)) e = e2;
    }
  } catch {}
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
      <div class="simu-choix-aide">← → incliner · ↑ piquer · ↓ cabrer<br>Page ↑ / ↓ ou + / − : gaz · I : images/s · Échap : quitter</div>
      <button type="button" class="simu-choix-annuler">ANNULER</button>
    </div>`;
  choix.addEventListener('click', e => e.stopPropagation());
  choix.querySelector('.simu-choix-annuler').onclick = () => choix.remove();
  choix.querySelectorAll('[data-avion]').forEach(b => {
    b.onclick = () => { choix.remove(); demarrerVol(map, b.dataset.avion); };
  });
  el.appendChild(choix);
}

const simuMouvementReduit = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// Caméra du cockpit pour une attitude donnée. Au-delà de ~85° MapLibre ne charge
// plus les tuiles devant la caméra : on garde la caméra sous cette limite et on
// décale l'image (padding haut) pour que le centre de l'écran reste dans l'axe du nez.
function simuVue(lng, lat, alt, cap, tangage, roulis) {
  const map = simu.map;
  const voulu = simuClamp(90 + tangage, 0, 150);
  const vue = Math.min(voulu, SIMU_PITCH_MAX);
  const H = map.getCanvas().clientHeight || 600;
  const f = (H / 2) / Math.tan((map.getVerticalFieldOfView ? map.getVerticalFieldOfView() : 55) * simuDeg / 2);
  const decalage = Math.min(2 * f * Math.tan((voulu - vue) * simuDeg), H * 0.9);
  const opts = map.calculateCameraOptionsFromCameraLngLatAltRotation([lng, lat], alt, cap, vue, roulis * SIMU_SENS_ROULIS);
  opts.padding = { top: decalage, bottom: 0, left: 0, right: 0 };
  return opts;
}

// Écran de chargement : la caméra est déjà posée dans le cockpit (invisible
// derrière l'écran) pour que les bonnes tuiles se chargent, et on ne décolle
// qu'une fois le relief et l'image satellite là. Sinon l'avion naissait dans la
// montagne et les premières secondes saccadaient pendant le téléchargement.
const SIMU_CHARGEMENT_MAX = 15000;
function simuChargement(t) {
  const s = simu, I = s.intro;
  if (I.t0 == null) I.t0 = t;
  let e = null;
  try { e = s.map.queryTerrainElevation([s.depart.lng, s.depart.lat]); } catch {}
  if (typeof e === 'number' && isFinite(e)) s.dernierSol = e;
  s.alt = Math.max(s.dernierSol || 0, simuSol(s.lng, s.lat)) + s.av.altDepart;
  try { s.map.jumpTo(simuVue(s.lng, s.lat, s.alt, s.cap, 0, 0)); } catch (err) { console.error(err); }
  let pret = false;
  try { pret = typeof e === 'number' && isFinite(e) && s.map.isSourceLoaded(SIMU_RELIEF) && s.map.areTilesLoaded(); } catch {}
  // On attend que tout reste chargé un court instant (les tuiles arrivent par vagues)
  if (!pret) I.stable = null; else if (I.stable == null) I.stable = t;
  const ecoule = t - I.t0;
  const fini = (I.stable != null && t - I.stable > 400 && ecoule > 700) || ecoule > SIMU_CHARGEMENT_MAX;
  const barre = s.hud.querySelector('.simu-chargement i');
  if (barre) barre.style.transform = `scaleX(${fini ? 1 : Math.min(0.92, 1 - Math.exp(-ecoule / 3000))})`;
  if (!fini) return true;
  const ecran = s.hud.querySelector('.simu-chargement');
  if (ecran) { ecran.classList.add('fini'); setTimeout(() => ecran.remove(), 400); }
  s.intro = null;
  s.t = t;   // la physique repart de cet instant, sans rattraper le temps de chargement
  return false;
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
      clampSol: map.getCenterClampedToGround ? map.getCenterClampedToGround() : null,
      pixelRatio: map._overridePixelRatio != null ? map._overridePixelRatio : null,
      imagesParImage: window.maplibregl && maplibregl.config ? maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME : null,
    },
    pret: false,
    intro: { t0: null, stable: null },
  };
  simuReinitialiser();

  ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'touchPitch', 'doubleClickZoom', 'keyboard', 'boxZoom']
    .forEach(h => { try { map[h].disable(); } catch {} });
  try { map.setMaxPitch(180); map.setMaxZoom(24); } catch {}
  try { if (map.setVerticalFieldOfView) map.setVerticalFieldOfView(55); } catch {}
  // Le centre de la vue est loin devant (vue rasante) : si MapLibre le recolle au
  // relief à chaque tuile reçue, la caméra saute de haut en bas. On le laisse libre.
  try { if (map.setCenterClampedToGround) map.setCenterClampedToGround(false); } catch {}
  try { if (maplibregl.config) maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME = SIMU_IMAGES_PAR_IMAGE; } catch {}
  // Plein écran sur écran Retina = 4 fois plus de pixels à dessiner avec le relief
  // à chaque image : on vole en résolution normale, bien plus fluide.
  try { if (map.setPixelRatio && (window.devicePixelRatio || 1) > 1) map.setPixelRatio(1); } catch {}
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
    <div class="simu-chargement"><div><b>CHARGEMENT DU RELIEF</b><span>${av.nom} · image satellite et montagnes</span><div class="simu-chargement-barre"><i></i></div></div></div>
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
    if (e.key.toLowerCase() === 'i' && !e.repeat) { simu.ips = simu.ips ? null : { v: 60 }; return; }
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
  s.crashT = null;
  s.vz = 0;
}

// Le monde de Google Earth : satellite, relief réel, ciel et brume
function simuMonde() {
  if (!simu) return;
  const map = simu.map;
  try { appliquerRelief(map); } catch {}
  // L'image satellite a déjà ses ombres : pas d'ombrage en vol, ce qui évite
  // de télécharger une deuxième fois toutes les tuiles d'altitude
  try { map.setLayoutProperty('relief-ombre', 'visibility', 'none'); } catch {}
  // Relief de vol moins détaillé (zoom 12, ~40 m par point) : chaque tuile de
  // relief oblige la carte à redessiner tout ce qui est posé dessus, et en
  // montant ou en faisant demi-tour il en arrivait des dizaines d'un coup.
  try {
    if (!map.getSource(SIMU_RELIEF)) map.addSource(SIMU_RELIEF, { ...RELIEF_TUILES, maxzoom: SIMU_RELIEF_ZOOM });
    map.setTerrain({ source: SIMU_RELIEF, exaggeration: 1 });
  } catch {}
  // Vue rasante : par défaut MapLibre empile jusqu'à 9 niveaux de zoom jusqu'à
  // l'horizon, soit des centaines de tuiles. On en garde 4 (3 en altitude),
  // comme Google Earth : détaillé devant, flou au loin.
  simu.lod = null;
  simuLod(SIMU_LOD[0]);
  try {
    map.setSky({
      'sky-color': '#4f86d6', 'horizon-color': '#cfe1f3', 'fog-color': '#dbe6f1',
      'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.25, 'atmosphere-blend': 0,
    });
  } catch {}
  simuSatelliteVol(map, true);
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
  try { if (s.avant.clampSol != null) map.setCenterClampedToGround(s.avant.clampSol); } catch {}
  try { if (map.setPixelRatio) map.setPixelRatio(s.avant.pixelRatio); } catch {}   // null = celle de l'écran
  try { if (map.setSourceTileLodParams) map.setSourceTileLodParams(SIMU_LOD_DEFAUT[0], SIMU_LOD_DEFAUT[1]); } catch {}
  try { if (s.avant.imagesParImage != null) maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME = s.avant.imagesParImage; } catch {}
  (s.pins || []).forEach(m => { try { m.addTo(map); } catch {} });
  // On remet la carte comme avant (fond, relief, ciel) et on se pose en vue d'ensemble
  try {
    lieuxRelief = s.avant.relief;
    if (s.avant.fond && s.avant.fond !== lieuxFond) setLieuxFond(s.avant.fond);
    else {
      try { map.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] }); } catch {}
      appliquerRelief(map);
      try { if (map.getSource(SIMU_RELIEF)) map.removeSource(SIMU_RELIEF); } catch {}
      simuSatelliteVol(map, false);
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
  if (!s.intro) simuResolution(t, dt);
  if (s.ips && dt > 0) s.ips.v += (1 / dt - s.ips.v) * 0.1;
  if (s.intro && simuChargement(t)) { s.anim = requestAnimationFrame(simuImage); return; }

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
    const avant = [s.lng, s.lat, s.alt];
    const dHoriz = s.v * Math.cos(s.pente) * dt;
    [s.lng, s.lat] = simuAvancer(s.lng, s.lat, s.cap, dHoriz);
    s.alt += s.vz * dt;

    // Sol : crash. On vérifie tout le trajet de l'image (à 2 000 km/h l'avion
    // fait plus de 10 m par image et sautait par-dessus une crête), plus un peu
    // devant le nez, pour que la caméra ne rentre jamais dans le relief.
    const contact = simuContact(avant, dHoriz + SIMU_NEZ, s.alt - avant[2], dHoriz);
    if (contact !== null) {
      s.alt = contact + SIMU_MARGE_SOL;
      s.crash = true;
      s.crashT = t;
      const box = s.hud.querySelector('.simu-crash');
      box.hidden = false;
      box.querySelector('span').textContent = `à ${Math.round(s.v * 3.6)} km/h`;
    }
  }

  // Caméra du cockpit : dans l'axe de l'avion (pente + incidence)
  const tangage = (s.pente + s.alpha) / simuDeg;
  // Au crash : secousse brève qui s'amortit (0,5 s), sauf si le mouvement est réduit
  let sc = 0, st = 0, sr = 0;
  if (s.crashT != null && t - s.crashT < 500 && !simuMouvementReduit()) {
    const a = 1 - (t - s.crashT) / 500;
    sc = Math.sin(t * 0.09) * 1.4 * a; st = Math.cos(t * 0.11) * 1.2 * a; sr = Math.sin(t * 0.13) * 2.5 * a;
  }
  try { s.map.jumpTo(simuVue(s.lng, s.lat, s.alt, s.cap + sc, tangage + st, s.roulis + sr)); } catch (e) { console.error(e); }
  const solSous = simuSol(s.lng, s.lat);
  // Haut dans le ciel, on voit beaucoup plus loin : un niveau de détail en moins
  // (avec une marge entre 2 000 et 3 000 m pour ne pas basculer sans arrêt)
  const hauteur = s.alt - solSous;
  if (hauteur > 3000) simuLod(SIMU_LOD_HAUT); else if (hauteur < 2000) simuLod(SIMU_LOD[0]);
  simuInstruments(tangage, solSous);
  s.anim = requestAnimationFrame(simuImage);
}
// Signe du roulis pour MapLibre (vérifié : avion penché à droite = horizon qui penche à gauche)
const SIMU_SENS_ROULIS = 1;
const SIMU_PITCH_MAX = 85;

// ── Instruments verts façon Google Earth ──────────────────────────────────────
function simuInstruments(tangage, sol) {
  const s = simu, cv = s.cv;
  if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = 1;   // HUD en résolution normale : redessiné à chaque image
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const vert = '#5dff7a';
  const police = (px, g = 600) => `${g} ${px}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.strokeStyle = vert; ctx.fillStyle = vert; ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; // ombre nette : un flou par trait coûtait cher à chaque image
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

  // Images par seconde (touche I)
  if (s.ips) {
    ctx.textAlign = 'right'; ctx.font = police(12, 600); ctx.fillStyle = s.ips.v < 40 ? '#ffc75d' : '#9effa8';
    const res = s.perf ? SIMU_RESOLUTIONS[s.perf.cran] : 1;
    ctx.fillText(Math.round(s.ips.v) + ' IMG/S · RÉSOL. ' + Math.round(res * 100) + '%', W - 14, 18);
  }

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
