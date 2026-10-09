/**
 * WIDEN Check-In → Bible
 *
 * Script Google Apps Script à coller dans le Google Sheet des réponses au
 * formulaire de check-in (Extensions → Apps Script). Il relie chaque réponse
 * au bon profil de la bible (par email, puis par nom) et crée le profil s'il
 * n'existe pas encore.
 *
 * Ce qui est copié dans la bible : téléphone, email, âge, nationalité (si vides
 * sur le profil), la photo si le formulaire en demande une, et les infos
 * pratiques (voyage, allergies, intolérances, repas, boissons, logistique,
 * matériel). Les infos médicales, phobies, limitations physiques, mal des
 * transports, altitude et médicaments ne sont PAS copiées : elles restent
 * uniquement dans ce Google Sheet.
 *
 * Installation : voir README.md, section « Check-in → profils ».
 */

var AIRTABLE_BASE = 'app1raCeBH8oqHbY9';
var AIRTABLE_TABLE = 'tblT4pu9h0qaainyT';
var STATUS_HEADER = 'Bible';

// Colonnes du formulaire, reconnues par le début de leur titre.
var COLS = {
  date: 'horodateur',
  nom: 'full name',
  tel: 'phone number',
  mail: 'email',
  naissance: 'date of birth',
  nationalite: 'nationality',
  voyage: 'any travel restrictions',
  allergies: 'allergies',
  intolerances: 'food intolerances',
  plat: 'favorite meal',
  snack: 'favorite snack',
  boisson: 'favorite drink',
  boissonChaude: 'hot drink',
  logistique: 'any logistics questions',
  equipement: 'do you need any specific equipment',
  photo: 'photo',
  sexe: ['gender', 'genre', 'sexe', 'sex']
};

var CHECKIN_FIELDS = ['voyage', 'allergies', 'intolerances', 'plat', 'snack',
  'boisson', 'boissonChaude', 'logistique', 'equipement'];

var NATIONALITES = {
  'fr': 'France', 'france': 'France', 'francaise': 'France', 'francais': 'France', 'french': 'France',
  'suisse': 'Suisse', 'swiss': 'Suisse', 'ch': 'Suisse', 'switzerland': 'Suisse',
  'italienne': 'Italie', 'italien': 'Italie', 'italian': 'Italie', 'it': 'Italie', 'italie': 'Italie',
  'belge': 'Belgique', 'belgian': 'Belgique', 'be': 'Belgique', 'belgique': 'Belgique',
  'espagnole': 'Espagne', 'espagnol': 'Espagne', 'spanish': 'Espagne', 'es': 'Espagne', 'espagne': 'Espagne',
  'allemande': 'Allemagne', 'allemand': 'Allemagne', 'german': 'Allemagne', 'de': 'Allemagne', 'allemagne': 'Allemagne',
  'autrichienne': 'Autriche', 'autrichien': 'Autriche', 'austrian': 'Autriche', 'at': 'Autriche', 'autriche': 'Autriche',
  'britannique': 'Royaume-Uni', 'british': 'Royaume-Uni', 'uk': 'Royaume-Uni', 'anglaise': 'Royaume-Uni', 'anglais': 'Royaume-Uni',
  'americaine': 'États-Unis', 'americain': 'États-Unis', 'american': 'États-Unis', 'us': 'États-Unis', 'usa': 'États-Unis',
  'canadienne': 'Canada', 'canadien': 'Canada', 'canadian': 'Canada', 'ca': 'Canada', 'canada': 'Canada',
  'vietnamienne': 'Vietnam', 'vietnamien': 'Vietnam', 'vietnamese': 'Vietnam', 'vn': 'Vietnam',
  'portugaise': 'Portugal', 'portugais': 'Portugal', 'portuguese': 'Portugal', 'pt': 'Portugal',
  'neerlandaise': 'Pays-Bas', 'neerlandais': 'Pays-Bas', 'dutch': 'Pays-Bas', 'nl': 'Pays-Bas',
  'norvegienne': 'Norvège', 'norvegien': 'Norvège', 'norwegian': 'Norvège', 'no': 'Norvège',
  'suedoise': 'Suède', 'suedois': 'Suède', 'swedish': 'Suède', 'se': 'Suède'
};

// Prénoms courants → sexe. Complété au moment de l'envoi par les prénoms déjà
// présents dans la bible. Les prénoms mixtes (Camille, Dominique…) n'y sont pas.
var PRENOMS = {
  'alice': 'f', 'alix': 'f', 'amandine': 'f', 'amelie': 'f', 'anais': 'f', 'anna': 'f', 'anne': 'f', 'annabelle': 'f',
  'aurelie': 'f', 'axelle': 'f', 'beatrice': 'f', 'capucine': 'f', 'caroline': 'f', 'cassandra': 'f', 'catherine': 'f', 'cecile': 'f',
  'celia': 'f', 'celine': 'f', 'chantal': 'f', 'charlotte': 'f', 'chloe': 'f', 'clara': 'f', 'clarisse': 'f', 'claire': 'f',
  'clemence': 'f', 'constance': 'f', 'coralie': 'f', 'delphine': 'f', 'diane': 'f', 'elena': 'f', 'eleonore': 'f', 'elisa': 'f',
  'elise': 'f', 'eloise': 'f', 'elodie': 'f', 'emilie': 'f', 'emma': 'f', 'estelle': 'f', 'eva': 'f', 'fanny': 'f',
  'faustine': 'f', 'flora': 'f', 'florence': 'f', 'gabrielle': 'f', 'helene': 'f', 'ines': 'f', 'irene': 'f', 'isabelle': 'f',
  'jade': 'f', 'jeanne': 'f', 'josephine': 'f', 'julia': 'f', 'julie': 'f', 'juliette': 'f', 'justine': 'f', 'laetitia': 'f',
  'lara': 'f', 'laura': 'f', 'laure': 'f', 'lea': 'f', 'leila': 'f', 'lena': 'f', 'lina': 'f', 'lisa': 'f',
  'lola': 'f', 'lou': 'f', 'louise': 'f', 'louna': 'f', 'lucie': 'f', 'lucile': 'f', 'luna': 'f', 'lydia': 'f',
  'madeleine': 'f', 'maelle': 'f', 'manon': 'f', 'margaux': 'f', 'margot': 'f', 'marie': 'f', 'marine': 'f', 'marion': 'f',
  'mathilde': 'f', 'maya': 'f', 'melanie': 'f', 'melissa': 'f', 'mia': 'f', 'morgane': 'f', 'nadia': 'f', 'natacha': 'f',
  'nathalie': 'f', 'noemie': 'f', 'oceane': 'f', 'olivia': 'f', 'ophelie': 'f', 'pauline': 'f', 'penelope': 'f', 'rachel': 'f',
  'rebecca': 'f', 'romane': 'f', 'rose': 'f', 'salome': 'f', 'sandra': 'f', 'sara': 'f', 'sarah': 'f', 'selena': 'f',
  'sofia': 'f', 'solene': 'f', 'sophie': 'f', 'stephanie': 'f', 'suzanne': 'f', 'tatiana': 'f', 'valentine': 'f', 'valerie': 'f',
  'vanessa': 'f', 'victoire': 'f', 'victoria': 'f', 'violette': 'f', 'virginie': 'f', 'yasmine': 'f', 'zoe': 'f', 'louliana': 'f',
  'adam': 'h', 'adrien': 'h', 'alexandre': 'h', 'alexis': 'h', 'antoine': 'h', 'anthony': 'h', 'arnaud': 'h', 'arthur': 'h',
  'augustin': 'h', 'aurelien': 'h', 'axel': 'h', 'baptiste': 'h', 'basile': 'h', 'benjamin': 'h', 'benoit': 'h', 'bruno': 'h',
  'cedric': 'h', 'charles': 'h', 'christophe': 'h', 'clement': 'h', 'corentin': 'h', 'cyril': 'h', 'damien': 'h', 'daniel': 'h',
  'david': 'h', 'denis': 'h', 'didier': 'h', 'dylan': 'h', 'edouard': 'h', 'emile': 'h', 'emmanuel': 'h', 'eric': 'h',
  'etienne': 'h', 'fabien': 'h', 'felix': 'h', 'florian': 'h', 'francois': 'h', 'frederic': 'h', 'gabriel': 'h', 'gael': 'h',
  'gaspard': 'h', 'gauthier': 'h', 'geoffrey': 'h', 'gilles': 'h', 'gregoire': 'h', 'guillaume': 'h', 'hugo': 'h', 'jacques': 'h',
  'jean': 'h', 'jeremy': 'h', 'jerome': 'h', 'jonathan': 'h', 'jordan': 'h', 'joseph': 'h', 'jules': 'h', 'julien': 'h',
  'kevin': 'h', 'killian': 'h', 'leo': 'h', 'leon': 'h', 'loic': 'h', 'louis': 'h', 'luc': 'h', 'lucas': 'h',
  'marc': 'h', 'marco': 'h', 'martin': 'h', 'mathieu': 'h', 'matteo': 'h', 'matthieu': 'h', 'maxime': 'h', 'michel': 'h',
  'mickael': 'h', 'nathan': 'h', 'nicolas': 'h', 'noah': 'h', 'olivier': 'h', 'oscar': 'h', 'pascal': 'h', 'patrick': 'h',
  'paul': 'h', 'philippe': 'h', 'pierre': 'h', 'quentin': 'h', 'raphael': 'h', 'remi': 'h', 'robin': 'h', 'romain': 'h',
  'samuel': 'h', 'sebastien': 'h', 'simon': 'h', 'stephane': 'h', 'theo': 'h', 'thibault': 'h', 'thomas': 'h', 'timothee': 'h',
  'tom': 'h', 'tristan': 'h', 'valentin': 'h', 'victor': 'h', 'vincent': 'h', 'william': 'h', 'xavier': 'h', 'yann': 'h',
  'yannick': 'h', 'yves': 'h', 'roger': 'h'
};

var MIXTES = ['camille', 'dominique', 'claude', 'alex', 'charlie', 'sacha', 'sasha', 'andrea',
  'eden', 'noa', 'morgan', 'yael', 'ange', 'jo', 'sam', 'kim', 'robin'];

var EMPTY_ANSWERS = ['', 'non', 'no', 'none', 'aucun', 'aucune', 'rien', 'nc', 'n/a', 'na',
  '-', '/', '?', 'nope', 'pas de', 'nothing', 'no thanks', 'non merci', 'ras',
  'idk', 'je sais pas', 'all good', 'tout roule', 'rien de special'];

// ── Menu et déclencheur ────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bible')
    .addItem('Envoyer les nouvelles réponses vers la bible', 'syncCheckins')
    .addItem('Activer l\'envoi automatique', 'installTrigger')
    .addItem('Renvoyer toutes les réponses', 'resyncAll')
    .addToUi();
}

function installTrigger() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncCheckins') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncCheckins').forSpreadsheet(ss).onFormSubmit().create();
  syncCheckins();
  SpreadsheetApp.getUi().alert('Envoi automatique activé : chaque nouvelle réponse arrivera dans la bible.');
}

// ── Synchronisation ────────────────────────────────────────────────────

// Vide la colonne « Bible » puis renvoie tout (met à jour les profils déjà liés).
function resyncAll() {
  var sheet = SpreadsheetApp.getActive().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var statusCol = headers.indexOf(STATUS_HEADER);
  if (statusCol !== -1 && sheet.getLastRow() > 1) {
    sheet.getRange(2, statusCol + 1, sheet.getLastRow() - 1, 1).clearContent();
  }
  syncCheckins();
}

function syncCheckins() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActive().getSheets()[0];
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(String);
    var statusCol = headers.indexOf(STATUS_HEADER);
    if (statusCol === -1) {
      statusCol = headers.length;
      sheet.getRange(1, statusCol + 1).setValue(STATUS_HEADER);
    }
    var cols = findColumns(headers);

    var pending = [];
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][statusCol] || '').trim()) continue;
      if (!String(values[r][cols.nom] || '').trim() && !String(values[r][cols.mail] || '').trim()) continue;
      pending.push(r);
    }
    if (!pending.length) return;

    var rec = fetchDb();
    var db = rec.db;
    var statuses = [];
    pending.forEach(function (r) {
      var row = rowToAnswer(values[r], cols);
      if (row.photo) shareDrivePhoto(row.photo);
      statuses.push({ r: r, msg: applyCheckin(db, row) });
    });
    saveDb(rec.id, db);
    statuses.forEach(function (s) { sheet.getRange(s.r + 1, statusCol + 1).setValue(s.msg); });
  } finally {
    lock.releaseLock();
  }
}

function findColumns(headers) {
  var cols = {};
  var lower = headers.map(function (h) { return norm(h); });
  Object.keys(COLS).forEach(function (k) {
    var prefixes = [].concat(COLS[k]).map(norm);
    for (var i = 0; i < lower.length && cols[k] === undefined; i++) {
      prefixes.forEach(function (prefix) { if (lower[i].indexOf(prefix) === 0) cols[k] = i; });
    }
  });
  return cols;
}

function rowToAnswer(values, cols) {
  var row = {};
  Object.keys(cols).forEach(function (k) { row[k] = values[cols[k]]; });
  return row;
}

// Les photos envoyées via le formulaire sont privées : on les rend visibles
// par lien pour que la bible puisse les afficher.
function shareDrivePhoto(link) {
  var m = String(link).match(/[?&]id=([a-zA-Z0-9_-]+)/) || String(link).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return;
  try {
    DriveApp.getFileById(m[1]).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* pas bloquant : la photo ne s'affichera simplement pas */ }
}

// ── Airtable ───────────────────────────────────────────────────────────

function airtableToken() {
  var token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN');
  if (!token) throw new Error('Ajoute la propriété de script AIRTABLE_TOKEN (Paramètres du projet → Propriétés du script).');
  return token;
}

function fetchDb() {
  var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE + '/' + AIRTABLE_TABLE +
    '?filterByFormula=' + encodeURIComponent("{key}='db'") + '&maxRecords=1';
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + airtableToken() } });
  var rec = JSON.parse(res.getContentText()).records[0];
  if (!rec) throw new Error('Base de la bible introuvable sur Airtable.');
  return { id: rec.id, db: JSON.parse(rec.fields.value) };
}

function saveDb(recordId, db) {
  UrlFetchApp.fetch('https://api.airtable.com/v0/' + AIRTABLE_BASE + '/' + AIRTABLE_TABLE + '/' + recordId, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + airtableToken() },
    payload: JSON.stringify({ fields: { value: JSON.stringify(db) } })
  });
}

// ── Logique (testable hors Google) ─────────────────────────────────────

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function nameTokens(s) {
  return norm(s).replace(/[^a-z0-9 -]/g, ' ').split(/[\s-]+/).filter(Boolean).sort();
}

function meaningful(v) {
  if (v instanceof Date) return true;
  var s = norm(v).replace(/[.!]+$/, '');
  return EMPTY_ANSWERS.indexOf(s) === -1;
}

function clean(v) { return String(v == null ? '' : v).trim(); }

function parseDate(v) {
  if (v instanceof Date) return v;
  var m = clean(v).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\D|$)/);
  if (!m) return null;
  var y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000;
  return new Date(y, +m[2] - 1, +m[1]);
}

function ageFrom(v, now) {
  var d = parseDate(v);
  if (!d || isNaN(d)) return null;
  now = now || new Date();
  var age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

function countryFrom(v) {
  var parts = clean(v).split(/[\/,&+]| et | and /i).map(function (p) { return p.trim(); }).filter(Boolean);
  return parts.map(function (p) {
    var k = norm(p).replace(/[^a-z]/g, '');
    return NATIONALITES[k] || (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  });
}

// "Julia CATTIN" → nom CATTIN ; sinon le dernier mot est le nom.
function splitName(full) {
  var words = clean(full).split(/\s+/).filter(Boolean);
  if (!words.length) return { prenom: '', nom: '' };
  var caps = words.filter(function (w) { return w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w); });
  if (caps.length && caps.length < words.length) {
    return {
      nom: caps.join(' '),
      prenom: words.filter(function (w) { return caps.indexOf(w) === -1; }).map(capitalize).join(' ')
    };
  }
  if (words.length === 1) return { prenom: '', nom: words[0].toUpperCase() };
  // "zanella sebastien" : si le dernier mot est un prénom connu, il passe devant.
  var lastKey = norm(words[words.length - 1]).replace(/[^a-z]/g, '');
  var firstKey = norm(words[0]).replace(/[^a-z]/g, '');
  if (PRENOMS[lastKey] && !PRENOMS[firstKey]) {
    return { nom: words.slice(0, -1).join(' ').toUpperCase(), prenom: capitalize(words[words.length - 1]) };
  }
  return {
    nom: words[words.length - 1].toUpperCase(),
    prenom: words.slice(0, -1).map(capitalize).join(' ')
  };
}

function capitalize(w) {
  return w.toLowerCase().replace(/(^|[-'])(\p{L})/gu, function (_, a, b) { return a + b.toUpperCase(); });
}

function findTalent(talents, row) {
  var mail = norm(row.mail);
  if (mail) {
    var byMail = talents.filter(function (t) { return norm(t.mail) === mail; });
    if (byMail.length === 1) return byMail[0];
  }
  var tokens = nameTokens(row.nom);
  if (!tokens.length) return null;
  var key = tokens.join(' ');
  var exact = talents.filter(function (t) {
    return nameTokens((t.prenom || '') + ' ' + (t.nom || '')).join(' ') === key;
  });
  if (exact.length === 1) return exact[0];
  // Nom incomplet ("Pittoni") ou plus long que dans la bible ("Pham Roger Tan") :
  // le nom de famille doit y être, et l'un des deux doit contenir l'autre.
  var has = function (list, sub) { return sub.every(function (x) { return list.indexOf(x) !== -1; }); };
  var partial = talents.filter(function (t) {
    var nom = nameTokens(t.nom);
    var full = nameTokens((t.prenom || '') + ' ' + (t.nom || ''));
    return nom.length && has(tokens, nom) && (has(full, tokens) || has(tokens, full));
  });
  return partial.length === 1 ? partial[0] : null;
}

// Devine le sexe à partir du prénom ; '' si inconnu ou ambigu.
function sexeFromPrenom(db, prenom) {
  var known = {};
  (db.talents || []).forEach(function (t) {
    var tokens = nameTokens(t.prenom);
    var p = tokens.length === 1 ? tokens[0] : '';
    if (!p || !t.sexe || MIXTES.indexOf(p) !== -1) return;
    known[p] = known[p] && known[p] !== t.sexe ? '?' : t.sexe;
  });
  var found = '';
  var words = norm(prenom).replace(/[^a-z -]/g, ' ').split(/[\s-]+/).filter(Boolean);
  for (var i = 0; i < words.length; i++) {
    if (MIXTES.indexOf(words[i]) !== -1) continue;
    var sx = known[words[i]] || PRENOMS[words[i]] || '';
    if (sx === 'f' || sx === 'h') { found = sx; break; }
  }
  return found;
}

function sexeFrom(v) {
  var s = norm(v);
  if (!s) return '';
  if (/^(f|fem|wom|nana)/.test(s)) return 'f';
  if (/^(h|m|man|male|gar)/.test(s)) return 'h';
  return '';
}

// Le formulaire est envoyé aux modèles : Modèle Femme / Homme selon le sexe,
// sinon « Modèle à classer » (créée si besoin) pour qu'il apparaisse dans Modèles.
function modelCategory(db, sexe) {
  if (sexe) return 'modele-' + sexe;
  db.categories = db.categories || [];
  var id = 'modele-a-classer';
  if (!db.categories.some(function (c) { return c.id === id; })) {
    db.categories.push({ id: id, label: 'Modèle à classer', color: '#9a9a96' });
  }
  return id;
}

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function applyCheckin(db, row, now) {
  db.talents = db.talents || [];
  var t = findTalent(db.talents, row);
  var created = false;
  if (!t) {
    var n = splitName(row.nom);
    t = { id: newId(), nom: n.nom, prenom: n.prenom, sexe: '', cats: [], agence: [], pays: [],
      ville: [], sports: [], insta: '', site: '', photo: '', tel: '', mail: '',
      notes: 'Ajouté depuis le check-in.' };
    db.talents.push(t);
    created = true;
  }

  var sexe = sexeFrom(row.sexe) || sexeFromPrenom(db, (t.prenom || '') + ' ' + clean(row.nom));
  if (!t.sexe && sexe) t.sexe = sexe;
  if (!t.cats || !t.cats.length) t.cats = [modelCategory(db, t.sexe)];

  if (!clean(t.tel) && meaningful(row.tel)) t.tel = clean(row.tel);
  if (!clean(t.mail) && meaningful(row.mail)) t.mail = clean(row.mail).toLowerCase();
  var age = ageFrom(row.naissance, now);
  if (age) t.age = age;
  var pays = Array.isArray(t.pays) ? t.pays : (t.pays ? [t.pays] : []);
  if (!pays.length && meaningful(row.nationalite)) t.pays = countryFrom(row.nationalite);
  if (!clean(t.photo) && meaningful(row.photo)) t.photo = clean(String(row.photo).split(',')[0]);

  var checkin = {};
  var d = row.date instanceof Date ? row.date : parseDate(row.date);
  if (d && !isNaN(d)) checkin.date = d.toISOString().slice(0, 10);
  CHECKIN_FIELDS.forEach(function (k) {
    if (meaningful(row[k])) checkin[k] = clean(row[k]);
  });
  t.checkin = checkin;

  var who = [t.prenom, t.nom].filter(Boolean).join(' ');
  return created ? 'Nouveau talent créé (' + who + ')' : 'Lié à ' + who;
}

if (typeof module !== 'undefined') {
  module.exports = { applyCheckin: applyCheckin, findTalent: findTalent, splitName: splitName,
    countryFrom: countryFrom, sexeFrom: sexeFrom, ageFrom: ageFrom, meaningful: meaningful, findColumns: findColumns };
}
