# Casting Bible

App de gestion de talents pour la production outdoor. Aucun serveur requis.

## Fichiers

```
casting-bible/
├── index.html   ← page principale
├── style.css    ← design
├── geo.js       ← pays et villes (~33 pays, ~400 villes)
├── data.js      ← données initiales
└── app.js       ← logique de l'app
```

## Déployer sur GitHub Pages

### 1. Créer le repo
- github.com → **New repository** → nom : `casting-bible` → **Public** → Create

### 2. Uploader les 5 fichiers
- Dans le repo → **Add file → Upload files** → glisse les fichiers → **Commit changes**

### 3. Activer GitHub Pages
- **Settings → Pages → Deploy from branch → main / (root) → Save**

Ton site sera disponible à :
`https://TON_USERNAME.github.io/casting-bible/`

---

## Modifier les données initiales

Édite `data.js` pour changer les données de départ (talents, clubs, agences...).

## Ajouter un pays ou des villes

Dans `geo.js`, ajoute une entrée dans `GEO` et son drapeau dans `FLAGS` :
```js
"Nouvelle Zélande": ["Auckland","Wellington","Christchurch"],
// + dans FLAGS :
"Nouvelle Zélande": "🇳🇿",
```

## Les données persistent

Tout ce que tu ajoutes/modifies dans l'app est sauvegardé dans le localStorage du navigateur.
Pour repartir des données initiales : Paramètres → Réinitialiser.

## Accueil et chapitres

L'accueil liste les chapitres (Modèles, Athlètes, Techniciens, Clubs, Lieux, Marques · Agences…) avec leur nombre de fiches. Clique sur un chapitre pour l'ouvrir, sur **+** pour y ajouter directement quelque chose, ou tape dans la barre de recherche pour chercher dans toute la bible. Le bouton **+ AJOUTER** en haut à droite est disponible partout.

**+ NOUVEAU CHAPITRE** crée un chapitre pour toute l'équipe :
- **Fiches** (comme Clubs) : nom, type, pays/ville, contact, tel, mail, Instagram, site, photo (lien) et notes. Ces chapitres sont stockés dans la base (ligne `db`, liste `chapitres`).
- **Profils** (comme les talents) : crée une catégorie de talents, avec le même formulaire que les talents.

Dans un chapitre que tu as créé, **MODIFIER LE CHAPITRE** permet de le renommer, changer sa couleur ou le supprimer.

## Photos des talents

Dans la fiche d'un talent (ÉDITER ou + NOUVEAU TALENT), deux possibilités, toutes deux visibles par toute l'équipe :
- coller un lien d'image (Google Drive, Imgur…) dans **PHOTO** ;
- ou cliquer **OU IMPORTER DEPUIS CET APPAREIL**, choisir l'image, puis **SAUVEGARDER**.

Les photos importées sont réduites (700 px) puis envoyées dans la table Airtable, sur une ligne `photo:<id du talent>`, colonne **Attachments**. Ne supprime pas ces lignes dans Airtable.

## Lieux (scouting)

Chapitre **LIEUX** : nom, type, adresse, pays/ville, coordonnées GPS (bouton **MA POSITION** sur place), lien Google Maps, coût estimé et détail des coûts, contact, notes, et plusieurs photos. La fiche d'un lieu affiche ses photos, une carte et un bouton pour l'ouvrir dans Google Maps.

Les infos des lieux sont stockées avec le reste de la base (ligne `db`). Les photos importées sont envoyées dans la table Airtable, sur une ligne `lieu:<id du lieu>`, colonne **Attachments** (toutes les photos du lieu sur la même ligne). Ne supprime pas ces lignes dans Airtable.

## Ajout rapide (lien, capture, texte)

Le bouton « ajout rapide » permet à toute l'équipe de coller un lien Instagram, une capture d'écran ou une description : Claude en tire une fiche talent ou lieu, et le formulaire s'ouvre pré-rempli, à vérifier avant d'enregistrer. La clé Anthropic n'est jamais dans le site : elle reste sur un petit serveur Cloudflare (dossier `worker/`).

Mise en place, une seule fois :

1. Créer une clé API sur [console.anthropic.com](https://console.anthropic.com) (et y fixer une limite de dépense mensuelle).
2. Créer un compte gratuit sur [cloudflare.com](https://dash.cloudflare.com), puis un jeton API avec le modèle « Edit Cloudflare Workers ». Noter aussi l'Account ID (page d'accueil Workers).
3. Dans le dépôt GitHub : Settings → Secrets and variables → Actions, ajouter `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
4. Onglet Actions → « Déployer l'ajout rapide » → Run workflow. À la fin, l'adresse du serveur s'affiche (`https://bible-ajout-rapide.<compte>.workers.dev`).
5. Mettre cette adresse dans `QUICK_ADD_URL` (fichier `airtable-config.js`). Le bouton apparaît alors sur le site.

Le serveur n'accepte que les demandes venant de `https://tijiii.github.io` (variable `ALLOWED_ORIGINS` dans `worker/wrangler.toml`).

## Check-in → profils

Le script `integrations/checkin-google-sheet.gs` relie les réponses du formulaire de check-in aux profils de la bible (par email, puis par nom) et crée le profil s'il n'existe pas.

Copié dans la bible : téléphone, email, âge, nationalité (seulement si vides), la photo si le formulaire contient une question « Photo », et les infos pratiques (voyage, allergies, intolérances, repas, boissons, logistique, matériel). Les infos médicales, phobies, limitations physiques, mal des transports, altitude et médicaments restent uniquement dans le Google Sheet.

Installation (une seule fois) :
1. Ouvrir le Google Sheet des réponses → Extensions → Apps Script.
2. Remplacer le contenu par celui de `integrations/checkin-google-sheet.gs`, puis enregistrer.
3. Paramètres du projet (roue dentée) → Propriétés du script → ajouter `AIRTABLE_TOKEN` avec le même token que dans `airtable-config.js`.
4. Recharger le Google Sheet : un menu « Bible » apparaît. Cliquer « Activer l'envoi automatique » et accepter les autorisations Google.

Les réponses déjà présentes sont envoyées tout de suite, puis chaque nouvelle réponse arrive automatiquement. Une colonne « Bible » indique pour chaque ligne le profil lié ou créé ; vider la case d'une ligne pour la renvoyer.
