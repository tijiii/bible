// ── BASE PARTAGÉE ────────────────────────────────────────────────────────────
// Remplace Airtable : la base de la bible (un seul gros JSON) et les photos
// importées sont rangées dans Cloudflare KV (binding BIBLE).
//
//   GET    /store/db                      → la base (ou null si vide)
//   PUT    /store/db                      → remplace la base
//   GET    /store/photos                  → index des photos
//   PUT    /store/photo/talent/<id>       → photo du talent (corps = image)
//   DELETE /store/photo/talent/<id>
//   POST   /store/photo/lieu/<id>[?kind=iphone&date=AAAA-MM-JJ[THH:MM]] → ajoute une photo au lieu
//   DELETE /store/photo/lieu/<id>/<photo> → retire une photo du lieu
//   DELETE /store/photo/lieu/<id>         → retire toutes les photos du lieu
//   GET    /store/img/t/<id>, /store/img/l/<id>/<photo> → l'image
//
// Le site passe par son origine (ALLOWED_ORIGINS). Le script du check-in
// (Google Apps Script) envoie « Authorization: Bearer <BIBLE_KEY> ».
//
// Code de l'équipe (secret TEAM_CODE) : quand il est défini, le site doit
// l'envoyer (en-tête X-Team-Code, ou « ?k= » pour les images) pour lire ou
// écrire quoi que ce soit. Sans ce secret, rien ne change.

const DB_KEY = 'db';
const INDEX_KEY = 'photos';
const DB_CACHE_SECONDS = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BACKUP_DAYS = 30;

function storeCors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://tijiii.github.io').split(',').map(s => s.trim());
  const ok = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Photo-Source, X-Team-Code',
    'Vary': 'Origin',
    ok,
  };
}

function reply(body, status, cors, extra = {}) {
  const { ok, ...headers } = cors;
  return new Response(body === null || typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', ...extra },
  });
}

function hasKey(request, env) {
  return !!env.BIBLE_KEY && request.headers.get('Authorization') === 'Bearer ' + env.BIBLE_KEY;
}

export function teamOk(request, env, url) {
  if (!env.TEAM_CODE) return true;
  const code = String(env.TEAM_CODE).trim();
  const donne = request.headers.get('X-Team-Code') || url.searchParams.get('k') || '';
  return donne.trim() === code || hasKey(request, env);
}

export const TEAM_REFUS = { error: 'Code de l\'équipe manquant ou faux.', team: true };

async function readIndex(env) {
  const idx = await env.BIBLE.get(INDEX_KEY, 'json');
  return { talents: {}, lieux: {}, dates: {}, ...(idx || {}) };
}

function dbCacheKey(url) {
  return new Request(url.origin + '/store/db');
}

async function readImage(request, env, key) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const { value, metadata } = await env.BIBLE.getWithMetadata(key, 'arrayBuffer');
  if (!value) return new Response('Introuvable', { status: 404 });
  const res = new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
  await cache.put(request, res.clone());
  return res;
}

async function readBody(request) {
  const type = (request.headers.get('Content-Type') || 'image/jpeg').split(';')[0];
  if (!type.startsWith('image/')) throw new Error('Il faut une image.');
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) throw new Error('Image vide.');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image trop lourde.');
  return { bytes, type };
}

export async function handleStore(request, env, url) {
  const origin = request.headers.get('Origin') || '';
  const cors = storeCors(origin, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: (({ ok, ...h }) => h)(cors) });

  const parts = url.pathname.split('/').filter(Boolean).slice(1); // sans « store »

  // Les images s'affichent dans des <img>, sans origine : le code de l'équipe est dans l'adresse.
  if (request.method === 'GET' && parts[0] === 'img') {
    if (!teamOk(request, env, url)) return new Response('Code de l\'équipe requis', { status: 401 });
    if (parts[1] === 't' && parts[2]) return readImage(request, env, `img:t:${parts[2]}`);
    if (parts[1] === 'l' && parts[2] && parts[3]) return readImage(request, env, `img:l:${parts[2]}:${parts[3]}`);
    return new Response('Introuvable', { status: 404 });
  }

  if (!cors.ok && !hasKey(request, env)) return reply({ error: 'Origine non autorisée' }, 403, cors);
  if (!teamOk(request, env, url)) return reply(TEAM_REFUS, 401, cors);

  try {
    if (parts[0] === 'db' && request.method === 'GET') {
      const cache = caches.default;
      const hit = await cache.match(dbCacheKey(url));
      if (hit) return reply(await hit.text(), 200, cors);
      const raw = (await env.BIBLE.get(DB_KEY)) || 'null';
      await cache.put(dbCacheKey(url), new Response(raw, { headers: { 'Cache-Control': `max-age=${DB_CACHE_SECONDS}` } }));
      return reply(raw, 200, cors);
    }

    if (parts[0] === 'db' && request.method === 'PUT') {
      const raw = await request.text();
      let next;
      try { next = JSON.parse(raw); } catch { return reply({ error: 'Base illisible' }, 400, cors); }
      if (!next || !Array.isArray(next.talents)) return reply({ error: 'Base incomplète' }, 400, cors);

      const current = await env.BIBLE.get(DB_KEY, 'json');
      // Garde-fou : une copie très ancienne ou vide ne peut pas écraser la base.
      const before = current && Array.isArray(current.talents) ? current.talents.length : 0;
      if (before >= 10 && next.talents.length < before / 2) {
        return reply({ error: `Refusé : la base passerait de ${before} à ${next.talents.length} talents.` }, 409, cors);
      }
      if (current) {
        const hour = new Date().toISOString().slice(0, 13);
        const backupKey = `backup:${hour}`;
        if (!(await env.BIBLE.get(backupKey))) {
          await env.BIBLE.put(backupKey, JSON.stringify(current), { expirationTtl: BACKUP_DAYS * 86400 });
        }
      }
      await env.BIBLE.put(DB_KEY, raw);
      await caches.default.delete(dbCacheKey(url));
      return reply({ ok: true }, 200, cors);
    }

    if (parts[0] === 'photos' && request.method === 'GET') {
      return reply(await readIndex(env), 200, cors);
    }

    if (parts[0] === 'photo' && parts[1] === 'talent' && parts[2]) {
      const id = parts[2];
      const idx = await readIndex(env);
      if (request.method === 'PUT') {
        const { bytes, type } = await readBody(request);
        const v = Date.now();
        await env.BIBLE.put(`img:t:${id}`, bytes, { metadata: { type } });
        idx.talents[id] = { v, src: request.headers.get('X-Photo-Source') || 'site' };
        await env.BIBLE.put(INDEX_KEY, JSON.stringify(idx));
        return reply({ ok: true, v }, 200, cors);
      }
      if (request.method === 'DELETE') {
        await env.BIBLE.delete(`img:t:${id}`);
        delete idx.talents[id];
        await env.BIBLE.put(INDEX_KEY, JSON.stringify(idx));
        return reply({ ok: true }, 200, cors);
      }
    }

    if (parts[0] === 'photo' && parts[1] === 'lieu' && parts[2]) {
      const id = parts[2];
      const idx = await readIndex(env);
      const list = idx.lieux[id] || [];
      if (request.method === 'POST' && !parts[3]) {
        const { bytes, type } = await readBody(request);
        // Les photos iPhone ont un identifiant qui commence par « ip », les autres sont les photos de campagne
        const prefix = url.searchParams.get('kind') === 'iphone' ? 'ip' : '';
        const photoId = prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await env.BIBLE.put(`img:l:${id}:${photoId}`, bytes, { metadata: { type } });
        idx.lieux[id] = [...list, photoId];
        // Date de prise de vue (lue dans la photo par le site), facultative
        const date = url.searchParams.get('date') || '';
        if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(date)) idx.dates = { ...(idx.dates || {}), [photoId]: date };
        await env.BIBLE.put(INDEX_KEY, JSON.stringify(idx));
        return reply({ ok: true, photos: idx.lieux[id], dates: idx.dates }, 200, cors);
      }
      if (request.method === 'DELETE') {
        const remove = parts[3] ? [parts[3]] : list;
        await Promise.all(remove.map(p => env.BIBLE.delete(`img:l:${id}:${p}`)));
        const rest = list.filter(p => !remove.includes(p));
        if (rest.length) idx.lieux[id] = rest; else delete idx.lieux[id];
        remove.forEach(p => { if (idx.dates) delete idx.dates[p]; });
        await env.BIBLE.put(INDEX_KEY, JSON.stringify(idx));
        return reply({ ok: true, photos: rest }, 200, cors);
      }
    }
  } catch (e) {
    return reply({ error: e.message || 'Erreur' }, 400, cors);
  }

  return reply({ error: 'Introuvable' }, 404, cors);
}
