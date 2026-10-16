// ── AJOUT RAPIDE ─────────────────────────────────────────────────────────────
// Petit serveur (Cloudflare Worker) appelé par le bouton « ajout rapide » du site.
// Il reçoit un texte libre, un lien Instagram et/ou une capture d'écran, demande
// à Claude d'en tirer une fiche talent ou lieu, et renvoie les champs à pré-remplir.
// La clé Anthropic reste ici (secret ANTHROPIC_API_KEY), jamais dans le site public.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { handleStore } from './store.js';

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const Talent = z.object({
  nom: z.string().describe('Nom de famille, en MAJUSCULES. Vide si inconnu.'),
  prenom: z.string(),
  sexe: z.enum(['f', 'h', '']),
  age: z.number().int().nullable(),
  cats: z.array(z.string()).describe('Identifiants de catégories, pris uniquement dans la liste fournie.'),
  sports: z.array(z.string()).describe('Sports ou spécialités, pris uniquement dans la liste fournie.'),
  pays: z.array(z.string()).describe('Pays, pris uniquement dans la liste fournie.'),
  ville: z.array(z.string()),
  agence: z.array(z.string()).describe('Agences, prises dans la liste fournie quand elles y figurent.'),
  tel: z.string(),
  mail: z.string(),
  insta: z.string().describe('Pseudo Instagram sans @.'),
  site: z.string(),
  notes: z.string().describe('Infos utiles qui ne rentrent dans aucun autre champ (bio, nombre d\'abonnés...).'),
});

const Lieu = z.object({
  nom: z.string(),
  type: z.string().describe('ex : plage, forêt, rooftop, stade, usine...'),
  adresse: z.string(),
  ville: z.string(),
  pays: z.string().describe('Pris dans la liste fournie.'),
  gps: z.string().describe('« latitude, longitude » si visible ou connu avec certitude, sinon vide.'),
  maps: z.string().describe('Lien Google Maps si fourni.'),
  contact: z.string(),
  tel: z.string(),
  mail: z.string(),
  notes: z.string().describe('Accès, lumière, ambiance, autorisations... tout ce qui aide au repérage.'),
});

const Fiche = z.object({
  type: z.enum(['talent', 'lieu', 'inconnu']),
  talent: Talent.nullable(),
  lieu: Lieu.nullable(),
  remarque: z.string().describe('Une phrase courte en français pour l\'utilisateur : ce qui manque ou est incertain. Vide si rien.'),
});

const SYSTEM = `Tu aides une société de production (Widen) à remplir sa « casting bible » : un annuaire de talents (modèles, athlètes, techniciens) et de lieux de repérage.
On te donne ce que l'utilisateur a collé : un texte libre, un lien (souvent Instagram) et/ou une capture d'écran (profil Instagram, photo d'un lieu, fiche d'agence...).
Décide s'il s'agit d'un talent ou d'un lieu, puis remplis la fiche correspondante (l'autre reste null).
Règles :
- N'invente rien. Un champ que tu ne peux pas lire ou déduire avec confiance reste vide.
- Pour les catégories, sports, pays et agences, utilise exactement les valeurs des listes fournies ; ignore ce qui n'y correspond pas (mets-le dans notes si c'est utile).
- Le sexe se déduit seulement d'un indice explicite (catégorie demandée, pronoms, mention « femme »/« homme ») ; sinon laisse vide.
- Mets le nom de famille en majuscules comme dans le reste de l'annuaire.`;

// ── TRAVEL SHEETS ────────────────────────────────────────────────────────────
// La production colle une confirmation de réservation (texte, capture ou PDF),
// ou seulement un numéro de vol / train et une date : Claude en tire les trajets,
// les hôtels et les bagages, et cherche sur le web les horaires qui manquent.

const Trajet = z.object({
  type: z.enum(['avion', 'train', 'autre']),
  date: z.string().describe('Date du départ, AAAA-MM-JJ. Vide si inconnue.'),
  numero: z.string().describe('Numéro de vol ou de train, ex : « IB 1566 », « TGV 6201 ». Vide si aucun.'),
  compagnie: z.string(),
  depart_lieu: z.string().describe('Aéroport ou gare de départ, en MAJUSCULES, nom court comme sur un panneau : « TENERIFE NORTH », « PARIS GARE DE LYON ».'),
  depart_detail: z.string().describe('Terminal, hall ou voie si connu, ex : « TERMINAL 1 ». Vide sinon.'),
  depart_heure: z.string().describe('Heure locale de départ, HH:MM sur 24 h. Vide si inconnue.'),
  arrivee_lieu: z.string(),
  arrivee_detail: z.string(),
  arrivee_heure: z.string().describe('Heure locale d\'arrivée, HH:MM sur 24 h. Vide si inconnue.'),
  reference: z.string().describe('Référence de réservation (PNR) de ce trajet, si indiquée.'),
  source: z.enum(['document', 'recherche', 'mixte']).describe('« document » si tout vient de ce qu\'on t\'a donné, « recherche » ou « mixte » si tu as complété avec le web.'),
});

const Sejour = z.object({
  nom: z.string().describe('Nom de l\'hôtel ou du logement, ex : « NOVOTEL CENTRE ».'),
  adresse: z.string().describe('Adresse postale complète, une ligne : « 1 Place Marie Curie, 74000 Annecy ». Vide si inconnue.'),
  ville: z.string(),
  pays: z.string(),
  du: z.string().describe('Arrivée, AAAA-MM-JJ.'),
  au: z.string().describe('Départ, AAAA-MM-JJ.'),
  telephone: z.string(),
  reference: z.string(),
});

const Travel = z.object({
  voyageurs: z.array(z.string()).describe('Noms des voyageurs, « Prénom NOM ».'),
  references: z.array(z.string()).describe('Toutes les références de réservation trouvées.'),
  trajets: z.array(Trajet).describe('Chaque vol ou train séparément (une correspondance = deux trajets), dans l\'ordre chronologique.'),
  bagages: z.array(z.string()).describe('Franchise bagages par personne, une ligne par type, en anglais : « Carry-on bag x 1 », « 23kg checked bag x 1 ». Vide si non indiqué.'),
  sejours: z.array(Sejour),
  remarque: z.string().describe('Une ou deux phrases courtes en français : ce que tu as cherché sur le web, ce qui reste incertain ou à vérifier. Vide si rien.'),
});

const TRAVEL_SYSTEM = `Tu aides la production de Widen (société de production photo et vidéo) à préparer les « travel sheets » des personnes qu'elle fait voyager pour un tournage.
On te donne une confirmation de réservation (e-mail collé, capture, PDF), ou seulement quelques infos (« vol IB1566 le 28 septembre », « hôtel Novotel Annecy du 28/09 au 02/10 »).
Remplis la fiche :
- Recopie fidèlement ce qui est dans le document : numéros, horaires, terminaux, références, dates.
- S'il manque des infos sur un vol ou un train dont tu connais le numéro et la date (aéroports, gares, horaires), cherche-les sur le web (site de la compagnie, FlightAware, Flightradar24, SNCF Connect, Trainline…). N'utilise la recherche que pour ça, et seulement si elle donne une réponse claire pour ce numéro ; sinon laisse vide.
- Pour un hôtel dont l'adresse manque, cherche son adresse sur le web.
- Les horaires sont en heure locale, au format HH:MM sur 24 h. Les dates au format AAAA-MM-JJ ; une date sans année est dans les mois qui viennent par rapport à la date du jour donnée.
- N'invente jamais un horaire, un numéro ou une adresse. Un champ incertain reste vide et tu le signales dans « remarque ».`;

async function handleTravel(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405, cors);
  if (!cors.ok) return json({ error: 'Origine non autorisée' }, 403, cors);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return json({ error: 'Fichiers trop lourds' }, 413, cors);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête illisible' }, 400, cors); }
  const text = String(body.text || '').slice(0, 20000);
  const files = (Array.isArray(body.files) ? body.files : []).slice(0, 5)
    .filter(f => f && typeof f.data === 'string' && (IMAGE_TYPES.includes(f.media_type) || f.media_type === 'application/pdf'));
  if (!text.trim() && !files.length) return json({ error: 'Colle une réservation, ou donne au moins un numéro de vol ou de train.' }, 400, cors);

  const content = files.map(f => f.media_type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
    : { type: 'image', source: { type: 'base64', media_type: f.media_type, data: f.data } });
  const today = new Date().toISOString().slice(0, 10);
  content.push({ type: 'text', text: `Date du jour : ${today}\n\n<colle_par_utilisateur>\n${text || '(seulement des fichiers)'}\n</colle_par_utilisateur>` });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const messages = [{ role: 'user', content }];
  try {
    let response;
    // La recherche web tourne côté Anthropic ; si elle s'arrête en route (pause_turn), on la relance
    for (let tour = 0; tour < 4; tour++) {
      response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(Travel) },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        system: TRAVEL_SYSTEM,
        messages,
      });
      if (response.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: response.content });
    }
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({ error: 'Impossible de lire ces infos, remplis la travel sheet à la main.' }, 422, cors);
    }
    return json(response.parsed_output, 200, cors);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Trop de demandes, réessaie dans une minute.' }, 429, cors);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'Clé Anthropic invalide côté serveur.' }, 500, cors);
    if (err instanceof Anthropic.APIError) return json({ error: `Erreur du service IA (${err.status ?? 'réseau'}).` }, 502, cors);
    throw err;
  }
}

// ── LOGO DU CLIENT ───────────────────────────────────────────────────────────
// Pour l'en-tête des travel sheets : on cherche le logo officiel d'une marque
// (Claude + recherche web, et l'image de sa page Wikipédia), ou on récupère une
// image dont on a collé le lien. Le site reçoit les images elles-mêmes (base64),
// car il ne peut pas les télécharger directement chez les autres sites.

const LOGO_TYPES = [...IMAGE_TYPES, 'image/svg+xml'];
const LOGO_MAX_BYTES = 3 * 1024 * 1024;

const Logos = z.object({
  logos: z.array(z.object({
    url: z.string().describe('Adresse directe du fichier image (se termine en général par .svg, .png, .jpg ou .webp), pas une page web.'),
    description: z.string().describe('Quelques mots : « logo noir sur fond transparent », « version blanche »…'),
  })).describe('De 1 à 4 fichiers du logo officiel, le meilleur d\'abord.'),
});

const LOGO_SYSTEM = `Tu trouves le logo officiel d'une marque ou d'une entreprise, pour l'en-tête d'un document imprimé sur fond blanc.
- Cherche sur le web, puis ouvre les pages pour lire l'adresse exacte du fichier image : Wikimedia Commons (upload.wikimedia.org), Wikipédia, le site officiel de la marque, son kit presse.
- Donne uniquement des adresses de fichiers image que tu as vues dans une page ou un résultat (jamais une adresse devinée).
- Préfère le logo actuel, en version sombre ou en couleur sur fond transparent ou blanc, en SVG ou en PNG assez grand. Pas de photo de boutique, pas d'icône d'application, pas de favicon minuscule.
- Si la marque est ambiguë, prends la marque de mode, sport ou lifestyle la plus connue de ce nom, celle avec qui une société de production photo/vidéo travaillerait.`;

async function fetchImage(u) {
  let url;
  try { url = new URL(u); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'WidenBible/1.0 (https://tijiii.github.io/bible)', 'Accept': 'image/*' },
      redirect: 'follow', signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    let type = (res.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (type === 'image/jpg') type = 'image/jpeg';
    if (!LOGO_TYPES.includes(type) && /\.svg(\?|$)/i.test(url.pathname)) type = 'image/svg+xml';
    if (!LOGO_TYPES.includes(type)) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > LOGO_MAX_BYTES) return null;
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { media_type: type, data: btoa(bin), source: url.toString() };
  } catch { return null; }
}

// Image principale de la page Wikipédia de la marque (souvent son logo)
async function wikipediaLogoUrls(client) {
  const urls = [];
  for (const lang of ['fr', 'en']) {
    try {
      const api = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(client)}`;
      const r = await fetch(api, { headers: { 'User-Agent': 'WidenBible/1.0 (https://tijiii.github.io/bible)' }, signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      for (const p of Object.values(d?.query?.pages || {})) if (p?.original?.source) urls.push(p.original.source);
    } catch {}
  }
  return urls;
}

async function claudeLogoUrls(client, env) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const messages = [{ role: 'user', content: `Marque : ${client}` }];
  let response;
  for (let tour = 0; tour < 4; tour++) {
    response = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Logos) },
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
      ],
      system: LOGO_SYSTEM,
      messages,
    });
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  return (response.parsed_output?.logos || []).map(l => l.url);
}

async function handleLogo(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405, cors);
  if (!cors.ok) return json({ error: 'Origine non autorisée' }, 403, cors);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête illisible' }, 400, cors); }
  const client = String(body.client || '').trim().slice(0, 100);
  const lien = String(body.url || '').trim().slice(0, 2000);

  if (lien) {
    const img = await fetchImage(lien);
    if (!img) return json({ error: 'Ce lien ne donne pas une image (colle le lien de l\'image elle-même).' }, 422, cors);
    return json({ logos: [img] }, 200, cors);
  }
  if (!client) return json({ error: 'Écris d\'abord le nom du client.' }, 400, cors);

  try {
    const [deClaude, deWiki] = await Promise.all([
      claudeLogoUrls(client, env).catch(err => { if (err instanceof Anthropic.APIError) return []; throw err; }),
      wikipediaLogoUrls(client),
    ]);
    const urls = [...new Set([...deClaude, ...deWiki])].slice(0, 6);
    const logos = (await Promise.all(urls.map(fetchImage))).filter(Boolean).slice(0, 4);
    if (!logos.length) return json({ error: `Pas de logo trouvé pour « ${client} ». Ajoute-le à la main ou colle son lien.` }, 404, cors);
    return json({ logos }, 200, cors);
  } catch (err) {
    console.error(err);
    return json({ error: 'La recherche du logo a échoué.' }, 502, cors);
  }
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://tijiii.github.io').split(',').map(s => s.trim());
  const ok = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    ok,
  };
}

function json(body, status, cors) {
  const { ok, ...headers } = cors;
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// Instagram bloque souvent les profils sans compte connecté ; on tente quand même
// de lire les balises de partage (nom, bio, abonnés), sans bloquer si ça échoue.
async function instagramHints(text) {
  const m = (text || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!m || ['p', 'reel', 'reels', 'stories', 'explore'].includes(m[1].toLowerCase())) return '';
  try {
    const res = await fetch(`https://www.instagram.com/${m[1]}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return `Pseudo Instagram : ${m[1]}`;
    const html = (await res.text()).slice(0, 200000);
    const meta = name => (html.match(new RegExp(`<meta[^>]+property="og:${name}"[^>]+content="([^"]*)"`, 'i')) || [])[1] || '';
    const parts = [`Pseudo Instagram : ${m[1]}`, meta('title') && `Titre du profil : ${meta('title')}`, meta('description') && `Description : ${meta('description')}`];
    return parts.filter(Boolean).join('\n');
  } catch {
    return `Pseudo Instagram : ${m[1]}`;
  }
}

// ── LIENS GOOGLE MAPS ────────────────────────────────────────────────────────
// Un lien court (maps.app.goo.gl/…) ne contient pas les coordonnées : on suit
// ses redirections, sans télécharger les pages, jusqu'à trouver l'adresse longue.
const MAPS_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i;

export function coordsFromMapsUrl(link) {
  let s = link;
  try { s = decodeURIComponent(link); } catch {}
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const tries = [
    new RegExp(`!3d${num}!4d${num}`),                      // le point exact du lieu
    new RegExp(`[?&](?:q|query|ll|destination|center)=${num},\\s*\\+?${num}`),
    new RegExp(`/search/${num},\\s*\\+?${num}`),
    new RegExp(`@${num},${num}`),                           // le centre de la vue
  ];
  for (const re of tries) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function placeNameFromMapsUrl(link) {
  const m = link.match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return '';
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch { return ''; }
}

async function resolveMapsLink(link) {
  let current = String(link || '').trim();
  for (let hop = 0; hop < 6; hop++) {
    let u;
    try { u = new URL(current); } catch { return { error: "Ce n'est pas un lien." }; }
    if (!MAPS_HOSTS.test(u.hostname)) return { error: "Ce n'est pas un lien Google Maps." };
    // La page de consentement cache le vrai lien dans « continue »
    if (/^consent\./i.test(u.hostname) && u.searchParams.get('continue')) { current = u.searchParams.get('continue'); continue; }
    const coords = coordsFromMapsUrl(current);
    if (coords) return { ...coords, nom: placeNameFromMapsUrl(current), url: current };
    let res;
    try {
      res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
    } catch { return { error: 'Google Maps ne répond pas.' }; }
    const next = res.headers.get('Location');
    if (!next) {
      // Page finale sans coordonnées dans l'adresse : Google les met dans l'aperçu de la page
      if (!res.ok) break;
      const html = (await res.text()).slice(0, 400000);
      const m = html.match(/center=(-?\d{1,3}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/) || html.match(/\[null,null,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/);
      if (m) return { lat: Number(m[1]), lng: Number(m[2]), nom: placeNameFromMapsUrl(current), url: current };
      break;
    }
    current = new URL(next, current).toString();
  }
  return { error: 'Pas de coordonnées dans ce lien. Ouvre le lieu dans Google Maps, puis « Partager » et copie le lien.' };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/store' || url.pathname.startsWith('/store/')) return handleStore(request, env, url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: (({ ok, ...h }) => h)(cors) });
    if (url.pathname === '/maps' && request.method === 'GET') {
      if (!cors.ok) return json({ error: 'Origine non autorisée' }, 403, cors);
      return json(await resolveMapsLink(url.searchParams.get('url') || ''), 200, cors);
    }
    if (url.pathname === '/travel') return handleTravel(request, env, cors);
    if (url.pathname === '/logo') return handleLogo(request, env, cors);
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405, cors);
    if (!cors.ok) return json({ error: 'Origine non autorisée' }, 403, cors);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return json({ error: 'Image trop lourde' }, 413, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête illisible' }, 400, cors); }
    const text = String(body.text || '').slice(0, 4000);
    const image = body.image && IMAGE_TYPES.includes(body.image.media_type) && typeof body.image.data === 'string' ? body.image : null;
    if (!text.trim() && !image) return json({ error: 'Colle un lien, un texte ou une image.' }, 400, cors);

    const vocab = body.vocab || {};
    const listes = [
      `Catégories (id : libellé) :\n${(vocab.categories || []).map(c => `${c.id} : ${c.label}`).join('\n')}`,
      `Sports / spécialités : ${(vocab.sports || []).join(', ')}`,
      `Pays : ${(vocab.pays || []).join(', ')}`,
      `Agences : ${(vocab.agences || []).join(', ')}`,
    ].join('\n\n');

    const hints = await instagramHints(text);
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } });
    content.push({ type: 'text', text: `<listes>\n${listes}\n</listes>\n\n<colle_par_utilisateur>\n${text || '(aucun texte, seulement une image)'}\n</colle_par_utilisateur>${hints ? `\n\n<infos_instagram>\n${hints}\n</infos_instagram>` : ''}` });

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(Fiche) },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        return json({ error: 'Impossible de lire ces infos, remplis la fiche à la main.' }, 422, cors);
      }
      return json(response.parsed_output, 200, cors);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'Trop de demandes, réessaie dans une minute.' }, 429, cors);
      if (err instanceof Anthropic.AuthenticationError) return json({ error: 'Clé Anthropic invalide côté serveur.' }, 500, cors);
      if (err instanceof Anthropic.APIError) return json({ error: `Erreur du service IA (${err.status ?? 'réseau'}).` }, 502, cors);
      throw err;
    }
  },
};
