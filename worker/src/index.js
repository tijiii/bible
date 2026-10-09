// ── AJOUT RAPIDE ─────────────────────────────────────────────────────────────
// Petit serveur (Cloudflare Worker) appelé par le bouton « ajout rapide » du site.
// Il reçoit un texte libre, un lien Instagram et/ou une capture d'écran, demande
// à Claude d'en tirer une fiche talent ou lieu, et renvoie les champs à pré-remplir.
// La clé Anthropic reste ici (secret ANTHROPIC_API_KEY), jamais dans le site public.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: (({ ok, ...h }) => h)(cors) });
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
