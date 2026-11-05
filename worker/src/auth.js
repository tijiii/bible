// ── COMPTES DE L'ÉQUIPE ──────────────────────────────────────────────────────
// Chaque personne de l'équipe a un compte (nom + mot de passe). Dès qu'un compte
// existe, le serveur ne donne plus rien sans être connecté : la base, les photos,
// l'ajout rapide, les travel sheets…
//
//   GET    /auth/comptes                 → les noms des comptes (pour l'écran de connexion)
//   POST   /auth/connexion  {nom, mdp}   → { jeton, nom }
//   GET    /auth/moi                     → { nom } (jeton valide)
//   POST   /auth/comptes    {nom, mdp}   → crée un compte (connecté, ou premier compte avec le code de l'équipe)
//   PUT    /auth/comptes/<id> {mdp, ancien?} → change le mot de passe (le sien : avec l'ancien)
//   DELETE /auth/comptes/<id>            → supprime un compte (pas le sien)
//
// Les comptes sont dans Workers KV (clé « comptes ») : mot de passe haché avec
// PBKDF2-SHA256 et un sel. Le jeton de connexion est signé (HMAC) par le serveur
// et vaut 180 jours. Changer un mot de passe ou supprimer un compte déconnecte
// tous ses appareils. Le site envoie le jeton dans l'en-tête X-Session (« ?s= »
// pour les images). Le script Google Sheets passe toujours avec sa clé BIBLE_KEY.

const COMPTES_KEY = 'comptes';
const SECRET_KEY = 'auth:secret';
const ITERATIONS = 100000;           // le maximum accepté par Cloudflare
const JETON_JOURS = 180;
const ESSAIS_MAX = 8;                // essais ratés avant d'attendre
const ESSAIS_MINUTES = 15;
const CACHE_MS = 20000;              // les comptes sont relus au plus toutes les 20 s

const enc = new TextEncoder();
let memo = null;                     // { comptes, lu } gardé par l'instance du serveur
let secretMemo = null;

export function normNom(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function idDe(nom) { return normNom(nom).replace(/ /g, '-'); }

function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function b64url(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function aleatoire(n) { return crypto.getRandomValues(new Uint8Array(n)); }

async function hacher(mdp, sel) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(mdp), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sel), iterations: ITERATIONS }, cle, 256);
  return hex(bits);
}
// Comparaison qui prend le même temps quelle que soit la différence
function pareil(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function lireComptes(env, frais = false) {
  if (!frais && memo && Date.now() - memo.lu < CACHE_MS) return memo.comptes;
  const comptes = (await env.BIBLE.get(COMPTES_KEY, 'json')) || {};
  memo = { comptes, lu: Date.now() };
  return comptes;
}
async function ecrireComptes(env, comptes) {
  await env.BIBLE.put(COMPTES_KEY, JSON.stringify(comptes));
  memo = { comptes, lu: Date.now() };
}

// Clé de signature des jetons : créée au premier besoin, gardée dans KV
async function cleSignature(env) {
  if (secretMemo) return secretMemo;
  let s = await env.BIBLE.get(SECRET_KEY);
  if (!s) { s = hex(aleatoire(32)); await env.BIBLE.put(SECRET_KEY, s); }
  secretMemo = await crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return secretMemo;
}

async function creerJeton(env, id, compte) {
  const corps = b64url(enc.encode(JSON.stringify({ id, v: compte.v, e: Date.now() + JETON_JOURS * 86400000 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await cleSignature(env), enc.encode(corps)));
  return corps + '.' + sig;
}

// Le compte connecté (ou null) d'après le jeton envoyé
export async function compteDuJeton(request, env, url) {
  const jeton = request.headers.get('X-Session') || url.searchParams.get('s') || '';
  const [corps, sig] = jeton.split('.');
  if (!corps || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await cleSignature(env), deB64url(sig), enc.encode(corps));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(deB64url(corps)));
    if (!p.e || p.e < Date.now()) return null;
    let c = (await lireComptes(env))[p.id];
    // Compte tout juste créé ou mot de passe tout juste changé ailleurs : on relit
    if (!c || c.v !== p.v) c = (await lireComptes(env, true))[p.id];
    if (!c || c.v !== p.v) return null;
    return { id: p.id, ...c };
  } catch { return null; }
}

export async function ilYaDesComptes(env) {
  return Object.keys(await lireComptes(env)).length > 0;
}

function liste(comptes) {
  return Object.entries(comptes).map(([id, c]) => ({ id, nom: c.nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

// teamOk : le code de l'équipe (ou la clé BIBLE_KEY), pour créer le premier compte
export async function handleAuth(request, env, url, cors, reply, teamOk) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // sans « auth »
  if (!cors.ok) return reply({ error: 'Origine non autorisée' }, 403, cors);
  let body = {};
  if (request.method === 'POST' || request.method === 'PUT') {
    try { body = await request.json(); } catch { return reply({ error: 'Requête illisible' }, 400, cors); }
  }

  if (parts[0] === 'comptes' && !parts[1] && request.method === 'GET') {
    return reply({ comptes: liste(await lireComptes(env, true)) }, 200, cors);
  }

  if (parts[0] === 'connexion' && request.method === 'POST') {
    const id = idDe(body.nom);
    const mdp = String(body.mdp || '');
    const comptes = await lireComptes(env, true);
    const c = comptes[id];
    const cleEssais = `auth:essais:${id || 'vide'}`;
    const essais = Number(await env.BIBLE.get(cleEssais)) || 0;
    if (essais >= ESSAIS_MAX) return reply({ error: `Trop d'essais. Réessaie dans ${ESSAIS_MINUTES} minutes.` }, 429, cors);
    if (!c || !pareil(await hacher(mdp, c.sel), c.hash)) {
      await env.BIBLE.put(cleEssais, String(essais + 1), { expirationTtl: ESSAIS_MINUTES * 60 });
      return reply({ error: 'Nom ou mot de passe incorrect.' }, 401, cors);
    }
    if (essais) await env.BIBLE.delete(cleEssais);
    return reply({ jeton: await creerJeton(env, id, c), nom: c.nom, id }, 200, cors);
  }

  const moi = await compteDuJeton(request, env, url);

  if (parts[0] === 'moi' && request.method === 'GET') {
    if (!moi) return reply({ error: 'Pas connecté.', login: true }, 401, cors);
    return reply({ nom: moi.nom, id: moi.id }, 200, cors);
  }

  if (parts[0] !== 'comptes') return reply({ error: 'Introuvable' }, 404, cors);

  const comptes = await lireComptes(env, true);
  const premier = !Object.keys(comptes).length;
  // Le tout premier compte se crée avec le code de l'équipe ; ensuite il faut être connecté
  if (!moi && !(premier && teamOk(request, env, url))) return reply({ error: 'Connecte-toi d\'abord.', login: true }, 401, cors);

  if (!parts[1] && request.method === 'POST') {
    const nom = String(body.nom || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const mdp = String(body.mdp || '');
    const id = idDe(nom);
    if (!id) return reply({ error: 'Écris le prénom et le nom.' }, 400, cors);
    if (mdp.length < 6) return reply({ error: 'Le mot de passe doit faire 6 caractères au moins.' }, 400, cors);
    if (comptes[id]) return reply({ error: `${comptes[id].nom} a déjà un compte.` }, 409, cors);
    const sel = hex(aleatoire(16));
    comptes[id] = { nom, sel, hash: await hacher(mdp, sel), v: 1, le: new Date().toISOString().slice(0, 10), par: moi ? moi.nom : '' };
    await ecrireComptes(env, comptes);
    const r = { ok: true, comptes: liste(comptes) };
    // Premier compte : on est connecté tout de suite
    if (premier) Object.assign(r, { jeton: await creerJeton(env, id, comptes[id]), nom, id });
    return reply(r, 200, cors);
  }

  const id = parts[1];
  const c = id && comptes[id];
  if (!c) return reply({ error: 'Ce compte n\'existe pas.' }, 404, cors);

  if (request.method === 'PUT') {
    const mdp = String(body.mdp || '');
    if (mdp.length < 6) return reply({ error: 'Le mot de passe doit faire 6 caractères au moins.' }, 400, cors);
    const lui = moi && moi.id === id;
    if (lui && !pareil(await hacher(String(body.ancien || ''), c.sel), c.hash)) {
      return reply({ error: 'Le mot de passe actuel est incorrect.' }, 403, cors);
    }
    c.sel = hex(aleatoire(16));
    c.hash = await hacher(mdp, c.sel);
    c.v = (c.v || 1) + 1;            // ses autres appareils sont déconnectés
    c.change = new Date().toISOString().slice(0, 10);
    await ecrireComptes(env, comptes);
    const r = { ok: true };
    if (lui) Object.assign(r, { jeton: await creerJeton(env, id, c) }); // cet appareil reste connecté
    return reply(r, 200, cors);
  }

  if (request.method === 'DELETE') {
    if (moi && moi.id === id) return reply({ error: 'Tu ne peux pas supprimer ton propre compte.' }, 400, cors);
    delete comptes[id];
    await ecrireComptes(env, comptes);
    return reply({ ok: true, comptes: liste(comptes) }, 200, cors);
  }

  return reply({ error: 'Méthode non autorisée' }, 405, cors);
}
