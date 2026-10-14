// ── DROPBOX : retrouver la vidéo finale d'un projet ──────────────────────────
// Le site envoie un nom de projet, on cherche le dossier dans les projets Widen
// (DROPBOX_PROJECTS_PATH), puis son dossier LIVRAISON et les vidéos dedans.
// On renvoie des liens dropbox.com/home/... : ils s'ouvrent pour les membres de
// l'équipe qui ont accès au dossier, rien n'est partagé publiquement.
//
// Connexion une seule fois : /dropbox/connect (OAuth PKCE, sans secret d'app).
// Seul un compte du domaine DROPBOX_EMAIL_DOMAIN est accepté. Le jeton de
// renouvellement reste dans KV (clé dropbox:auth).

const API = 'https://api.dropboxapi.com';
const AUTH_KEY = 'dropbox:auth';
const ACCESS_KEY = 'dropbox:access';
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mxf)$/i;
// Fichiers sortis directement d'une caméra : ce ne sont pas des montages
const RUSH_NAME = /^(c\d{4}|dji_|gx\d|gopr|mvi_|img_|a\d{3}c\d{3}|clip\d|\d{8}_)/i;
const FINAL_HINT = /livraison|deliver|export|final|master|diffusion|v\d+\b/i;

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function webUrl(pathDisplay) {
  return 'https://www.dropbox.com/home' + pathDisplay.split('/').map(encodeURIComponent).join('/');
}

function fileUrl(pathDisplay) {
  const i = pathDisplay.lastIndexOf('/');
  return webUrl(pathDisplay.slice(0, i)) + '?preview=' + encodeURIComponent(pathDisplay.slice(i + 1));
}

function page(title, text) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><body style="font-family:Georgia,serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center">
<h1 style="font-weight:400">${title}</h1><p>${text}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function tokenRequest(params) {
  const res = await fetch(API + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || 'Dropbox a refusé la connexion');
  return data;
}

async function rpc(token, endpoint, body, rootNs) {
  const headers = { Authorization: 'Bearer ' + token };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (rootNs) headers['Dropbox-API-Path-Root'] = JSON.stringify({ '.tag': 'root', root: rootNs });
  const res = await fetch(API + '/2/' + endpoint, { method: 'POST', headers, body: body === undefined ? null : JSON.stringify(body) });
  if (!res.ok) throw new Error(`Dropbox ${endpoint} : ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function accessToken(env, auth) {
  const cached = await env.BIBLE.get(ACCESS_KEY);
  if (cached) return cached;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh, client_id: env.DROPBOX_APP_KEY });
  await env.BIBLE.put(ACCESS_KEY, t.access_token, { expirationTtl: Math.max(60, (t.expires_in || 14400) - 300) });
  return t.access_token;
}

async function connect(env, url) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  await env.BIBLE.put('dropbox:pkce:' + state, verifier, { expirationTtl: 600 });
  const auth = new URL('https://www.dropbox.com/oauth2/authorize');
  auth.search = new URLSearchParams({
    client_id: env.DROPBOX_APP_KEY, response_type: 'code', token_access_type: 'offline',
    code_challenge: challenge, code_challenge_method: 'S256',
    redirect_uri: url.origin + '/dropbox/callback', state,
  });
  return Response.redirect(auth.toString(), 302);
}

async function callback(env, url) {
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const verifier = state && await env.BIBLE.get('dropbox:pkce:' + state);
  if (!code || !verifier) return page('Connexion annulée', 'Retourne sur la bible et clique de nouveau sur « Connecter Dropbox ».');
  await env.BIBLE.delete('dropbox:pkce:' + state);
  let t, account;
  try {
    t = await tokenRequest({ grant_type: 'authorization_code', code, client_id: env.DROPBOX_APP_KEY, redirect_uri: url.origin + '/dropbox/callback', code_verifier: verifier });
    account = await rpc(t.access_token, 'users/get_current_account');
  } catch (e) {
    return page('Connexion impossible', String(e.message || e));
  }
  const domain = (env.DROPBOX_EMAIL_DOMAIN || '').toLowerCase();
  if (domain && !String(account.email || '').toLowerCase().endsWith('@' + domain)) {
    return page('Mauvais compte', `Connecte un compte Dropbox en @${domain}.`);
  }
  await env.BIBLE.put(AUTH_KEY, JSON.stringify({
    refresh: t.refresh_token, rootNs: account.root_info?.root_namespace_id || '', email: account.email,
  }));
  await env.BIBLE.put(ACCESS_KEY, t.access_token, { expirationTtl: Math.max(60, (t.expires_in || 14400) - 300) });
  return page('Dropbox connecté', 'Tu peux fermer cet onglet et relancer la recherche dans la bible.');
}

async function searchNames(token, rootNs, query, path, extra = {}) {
  const data = await rpc(token, 'files/search_v2', {
    query, options: { path, max_results: 50, file_status: 'active', filename_only: true, ...extra },
  }, rootNs);
  return (data.matches || []).map(m => m.metadata && m.metadata.metadata).filter(Boolean);
}

async function listVideos(token, rootNs, path) {
  let data = await rpc(token, 'files/list_folder', { path, recursive: true, limit: 2000 }, rootNs);
  const files = [...data.entries];
  for (let i = 0; i < 2 && data.has_more; i++) {
    data = await rpc(token, 'files/list_folder/continue', { cursor: data.cursor }, rootNs);
    files.push(...data.entries);
  }
  return files.filter(f => f['.tag'] === 'file' && VIDEO_EXT.test(f.name) && !RUSH_NAME.test(f.name));
}

function videoScore(f) {
  return (FINAL_HINT.test(f.path_display) ? 1e13 : 0) + (f.size || 0);
}

// Dossiers intermédiaires qui ne nomment pas le projet (on remonte au-dessus)
const GENERIC_DIR = /^\d*_?\s*(post[ -]?prod(uction)?|videos?|vid[ée]os?|exp|exports?|photos?|montage|edit)$/i;

function projectDirOf(livPath) {
  const parts = livPath.split('/');
  parts.pop();
  while (parts.length > 1 && GENERIC_DIR.test(parts[parts.length - 1])) parts.pop();
  return parts.join('/');
}

// « ARCHIVES/SALOMON/2025/FW25 » → « SALOMON – FW25 » ; « 2026/SCOTT/P02_SCOTT_FW27 » → « P02_SCOTT_FW27 »
let projectsRoot = '';
function projectName(projectPath) {
  const rel = projectsRoot && projectPath.toLowerCase().startsWith(projectsRoot.toLowerCase() + '/') ? projectPath.slice(projectsRoot.length + 1) : projectPath.replace(/^\//, '');
  const segs = rel.split('/').filter(s => s && !/^(archives|20\d\d)$/i.test(s));
  if (!segs.length) return rel.slice(rel.lastIndexOf('/') + 1);
  const client = segs[0], last = segs[segs.length - 1];
  if (segs.length === 1 || last.toLowerCase().includes(client.toLowerCase())) return last;
  return client + ' – ' + segs.slice(1).join(' / ');
}

async function projectEntry(token, rootNs, projectPath, liv) {
  let videos = [];
  try { videos = await listVideos(token, rootNs, liv ? liv.path_display : projectPath); } catch { videos = []; }
  videos.sort((a, b) => videoScore(b) - videoScore(a));
  const year = projectPath.match(/\/(20\d\d)(?=\/|$)/);
  return {
    name: projectName(projectPath),
    path: projectPath,
    url: webUrl(projectPath),
    annee: year ? year[1] : '',
    livraison: liv ? { path: liv.path_display, url: webUrl(liv.path_display) } : null,
    videos: videos.slice(0, 6).map(v => ({ name: v.name, path: v.path_display, url: fileUrl(v.path_display), size: v.size || 0 })),
  };
}

// Un dossier trouvé peut être un client entier (plusieurs projets) : un résultat par dossier LIVRAISON
async function describeProject(token, rootNs, folder) {
  const livs = (await searchNames(token, rootNs, 'livraison', folder.path_display))
    .filter(m => m['.tag'] === 'folder')
    .filter((m, _, all) => !all.some(o => o !== m && m.path_lower.startsWith(o.path_lower + '/')))
    .sort((a, b) => b.path_display.localeCompare(a.path_display))
    .slice(0, 6);
  if (!livs.length) return [await projectEntry(token, rootNs, folder.path_display, null)];
  return Promise.all(livs.map(liv => projectEntry(token, rootNs, projectDirOf(liv.path_display), liv)));
}

async function search(env, q) {
  const raw = await env.BIBLE.get(AUTH_KEY);
  if (!raw) return { error: 'not_connected' };
  const auth = JSON.parse(raw);
  let token;
  try { token = await accessToken(env, auth); } catch { return { error: 'not_connected' }; }
  const root = env.DROPBOX_PROJECTS_PATH || '';
  projectsRoot = root;
  const hits = await searchNames(token, auth.rootNs, q, root);
  // Dossiers trouvés, plus le dossier des fichiers trouvés ; on garde le plus haut de chaque branche
  const paths = new Map();
  for (const h of hits) {
    const p = h['.tag'] === 'folder' ? h.path_display : h.path_display.slice(0, h.path_display.lastIndexOf('/'));
    if (p && p.toLowerCase() !== root.toLowerCase()) paths.set(p.toLowerCase(), { name: p.slice(p.lastIndexOf('/') + 1), path_display: p });
  }
  const keys = [...paths.keys()];
  const top = [...paths.entries()].filter(([k]) => !keys.some(o => o !== k && k.startsWith(o + '/'))).map(([, v]) => v);
  const ql = q.toLowerCase();
  top.sort((a, b) => (b.name.toLowerCase() === ql) - (a.name.toLowerCase() === ql) || b.path_display.localeCompare(a.path_display));
  const results = await Promise.all(top.slice(0, 5).map(f => describeProject(token, auth.rootNs, f).catch(() => [])));
  // Les projets avec une vidéo montée d'abord, les plus récents en premier
  const flat = results.flat().sort((a, b) => (b.videos.length > 0) - (a.videos.length > 0) || b.annee.localeCompare(a.annee));
  return { results: flat.slice(0, 10) };
}

export async function handleDropbox(request, env, url, cors, json) {
  if (!env.DROPBOX_APP_KEY) {
    return url.pathname === '/dropbox/search' ? json({ error: 'not_configured' }, 200, cors) : page('Pas encore prêt', 'La connexion Dropbox n\'est pas encore configurée.');
  }
  if (url.pathname === '/dropbox/connect') return connect(env, url);
  if (url.pathname === '/dropbox/callback') return callback(env, url);
  if (url.pathname === '/dropbox/search') {
    if (!cors.ok) return json({ error: 'Origine non autorisée' }, 403, cors);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    if (!q) return json({ error: 'Tape le nom du projet.' }, 400, cors);
    try { return json(await search(env, q), 200, cors); }
    catch (e) { return json({ error: 'Dropbox ne répond pas : ' + String(e.message || e).slice(0, 200) }, 502, cors); }
  }
  return json({ error: 'Introuvable' }, 404, cors);
}
