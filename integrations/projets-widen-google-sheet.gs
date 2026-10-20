/**
 * PROJETS WIDEN → Bible (onglet Production)
 *
 * À ajouter comme NOUVEAU FICHIER dans le projet Apps Script du Google Sheet
 * « PROJETS WIDEN » (Extensions → Apps Script → + → Script), à côté du code
 * qui crée les dossiers et les fiches de suivi. Rien n'est modifié dans ce code.
 *
 * Toutes les 15 minutes (et à la demande avec le menu « Bible »), chaque ligne
 * de l'onglet PROJETS qui a une fiche de suivi est envoyée dans la bible :
 *  - le projet est créé dans l'onglet Production s'il n'y est pas encore
 *    (reconnu par son N°, ex. P05) ;
 *  - client, projet, producer, dates, lieu, usages, livrables et les liens
 *    vers la fiche de suivi et le dossier Dropbox sont mis à jour ;
 *  - le statut est repris quand il change dans le tableau ;
 *  - la liste des personnes de l'onglet OPTIONS TEAM de la fiche (rôle, nom,
 *    téléphone, email, option par date, notes) est recopiée dans le projet.
 * Le calendrier, l'équipe et les notes écrits dans la bible ne sont jamais
 * touchés.
 *
 * Installation : voir README.md, section « Production : lien avec PROJETS WIDEN ».
 */

// Serveur de la bible (dossier worker/ du dépôt), qui garde la base partagée.
var BIBLE_STORE_URL = 'https://bible-ajout-rapide.tom-9dd.workers.dev/store';
var BIBLE_ONGLET_PROJETS = 'PROJETS';
var BIBLE_ONGLET_OPTIONS = 'OPTIONS TEAM';

// Statut du tableau → statut de la bible
var BIBLE_STATUTS = [
  ['devis', 'devis'], ['discussion', 'devis'],
  ['pre-prod', 'prepa'], ['preprod', 'prepa'], ['prepa', 'prepa'],
  ['tournage', 'tournage'], ['shoot', 'tournage'],
  ['post', 'postprod'],
  ['livre', 'livre'],
  ['annule', 'annule'],
  ['confirm', 'confirme'],
];

// ── Installation (une seule fois) ──────────────────────────────────────

// À lancer une fois depuis l'éditeur (sélectionner bibleInstaller → Exécuter).
// Ajoute le menu « Bible » et l'envoi automatique toutes les 15 minutes.
function bibleInstaller() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'bibleEnvoyerProjets' || f === 'bibleMenu') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('bibleEnvoyerProjets').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('bibleMenu').forSpreadsheet(ss).onOpen().create();
  bibleMenu();
  bibleEnvoyerTout();
}

function bibleMenu() {
  SpreadsheetApp.getUi().createMenu('Bible')
    .addItem('Envoyer les projets vers la bible', 'bibleEnvoyerTout')
    .addToUi();
}

// Depuis le menu : relit toutes les fiches, même celles qui n'ont pas bougé.
function bibleEnvoyerTout() {
  PropertiesService.getScriptProperties().deleteProperty('BIBLE_FICHES_VUES');
  var n = bibleEnvoyerProjets();
  try { SpreadsheetApp.getActive().toast(n + ' projet(s) envoyé(s) dans la bible.', 'Bible'); } catch (e) {}
}

// ── Envoi ──────────────────────────────────────────────────────────────

function bibleEnvoyerProjets() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 0;
  try {
    var props = PropertiesService.getScriptProperties();
    var vues = JSON.parse(props.getProperty('BIBLE_FICHES_VUES') || '{}');
    var lignes = bibleLignesProjets();
    var db = bibleLireDb();
    if (!Array.isArray(db.projets)) db.projets = [];
    var change = false;

    lignes.forEach(function (l) {
      var avant = change;
      change = false;
      var p = db.projets.filter(function (x) { return x.code && x.code === l.code; })[0];
      if (!p) {
        p = { id: Date.now() + Math.floor(Math.random() * 9999), etapes: [], equipe: [], notes: '' };
        db.projets.push(p);
        change = true;
      }
      ['code', 'client', 'nom', 'producer', 'datesTexte', 'lieu', 'usages', 'livrables', 'lienFiche', 'lienDropbox'].forEach(function (k) {
        if (l[k] !== undefined && p[k] !== l[k]) { p[k] = l[k]; change = true; }
      });
      // Le statut du tableau est repris seulement quand il change dans le tableau
      if (l.statutTableau !== p.statutTableau) {
        p.statutTableau = l.statutTableau;
        if (l.statut) p.statut = l.statut;
        change = true;
      }
      if (!p.statut) p.statut = 'confirme';

      // OPTIONS TEAM : relu seulement si la fiche a été modifiée depuis le dernier envoi
      if (l.ficheId) {
        var maj = '';
        try { maj = DriveApp.getFileById(l.ficheId).getLastUpdated().toISOString(); } catch (e) {}
        if (!maj || vues[l.ficheId] !== maj || !Array.isArray(p.options)) {
          try {
            var options = bibleLireOptions(l.ficheId);
            if (JSON.stringify(options) !== JSON.stringify(p.options || [])) { p.options = options; change = true; }
            if (maj) vues[l.ficheId] = maj;
          } catch (e) {
            console.warn('OPTIONS TEAM illisible pour ' + l.code + ' : ' + e.message);
          }
        }
      }
      if (change) p.maj = Date.now();
      change = change || avant;
    });

    if (change) bibleEcrireDb(db);
    props.setProperty('BIBLE_FICHES_VUES', JSON.stringify(vues));
    return lignes.length;
  } finally {
    lock.releaseLock();
  }
}

// Les lignes de l'onglet PROJETS qui ont un N° et une fiche de suivi
function bibleLignesProjets() {
  var sh = SpreadsheetApp.getActive().getSheetByName(BIBLE_ONGLET_PROJETS);
  if (!sh) throw new Error('Onglet « ' + BIBLE_ONGLET_PROJETS + ' » introuvable.');
  var range = sh.getDataRange();
  var vals = range.getDisplayValues();
  var liens = range.getRichTextValues();
  var formules = range.getFormulas();
  var h = vals[0].map(bibleNorm);
  var col = function (nom) { return h.indexOf(bibleNorm(nom)); };
  var c = {
    code: col('N°'), client: col('Client'), projet: col('Projet'), producer: col('Producer'), dates: col('Dates'),
    lieu: col('Lieu'), usages: col('Usages'), livrables: col('Livrables'), statut: col('Statut'),
    dropbox: col('Dossier Dropbox'), fiche: col('Fiche de suivi'),
  };
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var v = vals[r];
    var code = c.code >= 0 ? String(v[c.code]).trim().toUpperCase().replace(/^PO(\d)/, 'P0$1') : '';
    var ficheTxt = c.fiche >= 0 ? String(v[c.fiche]).trim() : '';
    if (!/^P\d+$/.test(code) || !ficheTxt) continue;
    var lienFiche = bibleLien(liens[r][c.fiche], formules[r][c.fiche], ficheTxt);
    var ficheId = bibleIdFichier(lienFiche) || bibleChercherFiche(ficheTxt);
    if (!lienFiche && ficheId) lienFiche = 'https://docs.google.com/spreadsheets/d/' + ficheId + '/edit';
    var statutTxt = c.statut >= 0 ? String(v[c.statut]).trim() : '';
    out.push({
      code: code,
      client: String(v[c.client] || '').trim(),
      nom: String(v[c.projet] || '').trim(),
      producer: c.producer >= 0 ? String(v[c.producer]).trim() : '',
      datesTexte: c.dates >= 0 ? String(v[c.dates]).trim() : '',
      lieu: c.lieu >= 0 ? String(v[c.lieu]).trim() : '',
      usages: c.usages >= 0 ? String(v[c.usages]).trim() : '',
      livrables: c.livrables >= 0 ? String(v[c.livrables]).trim() : '',
      statutTableau: statutTxt,
      statut: bibleStatut(statutTxt),
      lienFiche: lienFiche || '',
      lienDropbox: c.dropbox >= 0 ? bibleLien(liens[r][c.dropbox], formules[r][c.dropbox], String(v[c.dropbox])) : '',
      ficheId: ficheId,
    });
  }
  return out;
}

// L'onglet OPTIONS TEAM d'une fiche de suivi : une ligne par personne
function bibleLireOptions(ficheId) {
  var ss = SpreadsheetApp.openById(ficheId);
  var sh = ss.getSheetByName(BIBLE_ONGLET_OPTIONS);
  if (!sh) return [];
  var tz = bibleFuseau(ss);
  var vals = sh.getDataRange().getValues();
  // Ligne d'en-tête : celle qui contient « Name »
  var hr = -1, cNom = -1;
  for (var r = 0; r < Math.min(vals.length, 10) && hr < 0; r++) {
    for (var i = 0; i < vals[r].length; i++) if (bibleNorm(vals[r][i]) === 'name') { hr = r; cNom = i; break; }
  }
  if (hr < 0) return [];
  var h = vals[hr];
  var trouve = function (debut) {
    for (var i = 0; i < h.length; i++) if (bibleNorm(h[i]).indexOf(debut) === 0) return i;
    return -1;
  };
  var cTel = trouve('phone'), cMail = trouve('email'), cNotes = trouve('rates'), cAdresse = trouve('address'), cRegime = trouve('diet');
  var cRole = cNom - 1;
  // Colonnes de dates : entre l'email (ou le nom) et « Rates & notes »
  var debut = Math.max(cNom, cTel, cMail) + 1, fin = cNotes > debut ? cNotes : h.length;
  var dates = [];
  for (var j = debut; j < fin; j++) {
    var d = h[j];
    if (d instanceof Date) dates.push({ c: j, date: Utilities.formatDate(d, tz, 'yyyy-MM-dd') });
    else if (String(d).trim()) dates.push({ c: j, date: '', label: String(d).trim() });
  }
  var out = [], horsPersonnes = false;
  for (var r2 = hr + 1; r2 < vals.length; r2++) {
    var v = vals[r2];
    var role = cRole >= 0 ? String(v[cRole]).trim() : '';
    var nom = String(v[cNom]).trim();
    if (!nom) {
      // Titre de section en majuscules : les studios et la cantine ne sont pas des personnes
      if (role && role === role.toUpperCase() && /[A-Z]/.test(role)) horsPersonnes = /^(STUDIOS?|CATERING|LOCATIONS?|LIEUX?)$/.test(role);
      continue;
    }
    if (horsPersonnes) continue;
    var dispos = [];
    dates.forEach(function (d) {
      var s = String(v[d.c]).trim();
      if (s && s !== '-') dispos.push(d.date ? { date: d.date, statut: s } : { label: d.label, statut: s });
    });
    out.push({
      role: role, nom: nom,
      tel: cTel >= 0 ? String(v[cTel]).trim() : '',
      mail: cMail >= 0 ? String(v[cMail]).trim() : '',
      notes: cNotes >= 0 ? String(v[cNotes]).trim() : '',
      adresse: cAdresse >= 0 ? String(v[cAdresse]).trim().replace(/^-$/, '') : '',
      regime: cRegime >= 0 ? String(v[cRegime]).trim().replace(/^-$/, '') : '',
      dispos: dispos,
    });
  }
  return out;
}

// ── Outils ─────────────────────────────────────────────────────────────

// Fuseau horaire pour lire les dates : celui de la fiche, sinon du script, sinon Paris
function bibleFuseau(ss) {
  var tz = '';
  try { tz = ss.getSpreadsheetTimeZone(); } catch (e) {}
  if (typeof tz !== 'string' || !tz) { try { tz = Session.getScriptTimeZone(); } catch (e) {} }
  return typeof tz === 'string' && tz ? tz : 'Europe/Paris';
}

function bibleNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function bibleStatut(txt) {
  var n = bibleNorm(txt).replace(/[^a-z-]/g, '');
  for (var i = 0; i < BIBLE_STATUTS.length; i++) if (n.indexOf(BIBLE_STATUTS[i][0]) >= 0) return BIBLE_STATUTS[i][1];
  return '';
}

// Lien d'une case : lien posé sur le texte, formule =HYPERLINK, ou texte qui est une adresse
function bibleLien(rich, formule, texte) {
  try {
    if (rich) {
      var u = rich.getLinkUrl();
      if (!u) rich.getRuns().forEach(function (run) { if (!u && run.getLinkUrl()) u = run.getLinkUrl(); });
      if (u) return u;
    }
  } catch (e) {}
  var m = String(formule || '').match(/HYPERLINK\(\s*"([^"]+)"/i);
  if (m) return m[1];
  return /^https?:\/\//.test(String(texte).trim()) ? String(texte).trim() : '';
}

function bibleIdFichier(lien) {
  var m = String(lien || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(lien || '').match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : '';
}

// Fiche sans lien dans la case : on la cherche par son nom dans le Drive
function bibleChercherFiche(nom) {
  try {
    var it = DriveApp.getFilesByName(nom);
    while (it.hasNext()) {
      var f = it.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && !f.isTrashed()) return f.getId();
    }
  } catch (e) {}
  return '';
}

// ── Base partagée (serveur Cloudflare) ─────────────────────────────────

function bibleEntetes() {
  var key = PropertiesService.getScriptProperties().getProperty('BIBLE_KEY');
  if (!key) throw new Error('Ajoute la propriété de script BIBLE_KEY (Paramètres du projet → Propriétés du script).');
  return { Authorization: 'Bearer ' + String(key).replace(/\s/g, '') };
}

function bibleLireDb() {
  var res = UrlFetchApp.fetch(BIBLE_STORE_URL + '/db', { headers: bibleEntetes() });
  var db = JSON.parse(res.getContentText());
  if (!db) throw new Error('La base de la bible est vide : ouvre d\'abord le site une fois.');
  return db;
}

function bibleEcrireDb(db) {
  UrlFetchApp.fetch(BIBLE_STORE_URL + '/db', {
    method: 'put',
    contentType: 'application/json',
    headers: bibleEntetes(),
    payload: JSON.stringify(db)
  });
}
