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

Les photos importées sont réduites (700 px) puis envoyées au serveur Cloudflare (voir « Base partagée »).

## Lieux (scouting)

Chapitre **LIEUX** : nom, type, adresse, pays/ville, coordonnées GPS (bouton **MA POSITION** sur place), lien Google Maps, coût estimé et détail des coûts, contact, notes, et plusieurs photos. La fiche d'un lieu affiche ses photos, une carte et un bouton pour l'ouvrir dans Google Maps.

La grande carte est un globe 3D (MapLibre GL, gratuit et sans clé) qu'on fait tourner et qu'on zoome, comme dans Plans d'Apple. Deux fonds : **PLAN** (OpenFreeMap, données OpenStreetMap) et **SATELLITE** (imagerie Esri). Le fond choisi est gardé sur l'appareil. Quand des lieux sont trop proches pour être distingués à ce zoom, ils forment un seul pin avec leur nombre : un clic ouvre un cadre qu'on fait défiler avec les flèches ‹ ›, avec **OUVRIR LA FICHE** et **ZOOMER**.

Les infos des lieux sont stockées avec le reste de la base. Les photos importées sont envoyées au serveur Cloudflare, comme celles des talents.

### Carte dans la fiche d'un lieu
La fiche d'un lieu avec des coordonnées GPS a sa propre carte : on zoome, dézoome (jusqu'au globe) et se déplace à la souris ou au doigt, sans passer par Google Maps. Boutons PLAN / SATELLITE, RECENTRER pour revenir sur le lieu, et plein écran (pratique sur téléphone). Les autres lieux y apparaissent en petits points gris : un clic ouvre leur fiche.

### Photo de couverture

Dans la fiche d'un lieu, survoler une photo puis **☆** pour en faire la couverture (celle affichée dans la liste). Aussi possible dans le formulaire avec l'étoile sur chaque photo. Sans choix, c'est la première photo.

### Pays

Les listes de pays des lieux contiennent tous les pays du monde, générés par le navigateur (`ALL_COUNTRIES` dans `geo.js`).

### Sports shootés sur un lieu

Dans le formulaire d'un lieu, cocher les sports ou disciplines déjà shootés là (même liste que les talents, **+ AJOUTER** pour en créer un). Ils s'affichent sur la fiche et le filtre **SPORT** de la liste des lieux permet de trier.

### Projets tournés sur un lieu

Dans le formulaire d'un lieu, **+ AJOUTER UN PROJET** : nom, année et lien Dropbox de la vidéo finale (ou du dossier). La fiche n'affiche le bloc « Projets tournés ici » que s'il y a au moins un projet.

### Catégories

Liste de base dans `LIEU_CATEGORIES` (`app.js`). Les catégories ajoutées depuis le formulaire (**+ AJOUTER**) sont gardées dans la base (`lieuCategories`) et visibles par toute l'équipe.

### Exporter des lieux en PDF pour un client
Le bouton **EXPORTER EN PDF** (barre des Lieux) ouvre une fenêtre : nom du projet, client, période (du / au), ce qu'on met dans le PDF, et les lieux à montrer (cochés d'avance : ceux de la liste filtrée). Le document s'ouvre dans un nouvel onglet, puis la fenêtre d'impression : choisir **Enregistrer en PDF**.
**À mettre dans le PDF** : description client, catégories et sports, photos, point GPS, lien Google Maps, carte, météo, ville et pays, adresse, coûts et contacts (ces deux-là sont internes). Chaque case est gardée sur l'appareil pour le prochain export. Par défaut, ville, pays, adresse, coûts et contacts ne sont pas mis.
**PHOTOS ET TEXTE** (à côté d'un lieu coché) : on choisit les photos du PDF (7 au plus, la première en grand, la couverture est en tête) et on écrit la **description pour le client**. Elle est enregistrée sur le lieu (aussi modifiable dans la fiche) et sert aux exports suivants ; la description interne ne part jamais dans le PDF.
La météo vient d'Open-Meteo (gratuit, sans clé) : prévisions jour par jour si la période est dans les 15 prochains jours, sinon la moyenne des 5 dernières années à la même période (températures, jours de pluie, lever et coucher du soleil).

## Ajout rapide (lien, capture, texte)

Le bouton « ajout rapide » permet à toute l'équipe de coller un lien Instagram, une capture d'écran ou une description : Claude en tire une fiche talent ou lieu, et le formulaire s'ouvre pré-rempli, à vérifier avant d'enregistrer. La clé Anthropic n'est jamais dans le site : elle reste sur un petit serveur Cloudflare (dossier `worker/`).

Mise en place, une seule fois :

1. Créer une clé API sur [console.anthropic.com](https://console.anthropic.com) (et y fixer une limite de dépense mensuelle).
2. Créer un compte gratuit sur [cloudflare.com](https://dash.cloudflare.com), puis un jeton API avec le modèle « Edit Cloudflare Workers ». Noter aussi l'Account ID (page d'accueil Workers).
3. Dans le dépôt GitHub : Settings → Secrets and variables → Actions, ajouter `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
4. Onglet Actions → « Déployer l'ajout rapide » → Run workflow. À la fin, l'adresse du serveur s'affiche (`https://bible-ajout-rapide.<compte>.workers.dev`).
5. Mettre cette adresse dans `SERVER_URL` (fichier `config.js`). Le bouton apparaît alors sur le site.

Le serveur n'accepte que les demandes venant de `https://tijiii.github.io` (variable `ALLOWED_ORIGINS` dans `worker/wrangler.toml`).

## Base partagée

La base (talents, clubs, lieux…) et les photos importées sont gardées par le même serveur Cloudflare, dans un espace Workers KV appelé `BIBLE`, créé automatiquement au premier déploiement (plan gratuit : 100 000 lectures par jour). Le site relit la base toutes les 30 secondes, seulement quand l'onglet est visible.

- Une copie de sécurité de la base est gardée chaque heure pendant 30 jours (clés `backup:<date>` dans Workers KV, visibles dans le tableau de bord Cloudflare).
- Le serveur refuse une sauvegarde qui ferait perdre plus de la moitié des talents d'un coup.
- Si la base du serveur est vide, le premier appareil qui ouvre le site et en a une copie l'y envoie.

Le script du check-in écrit aussi dans cette base. Il utilise une clé : choisir un mot de passe long, l'ajouter dans GitHub (Settings → Secrets and variables → Actions) sous le nom `BIBLE_KEY`, relancer « Déployer l'ajout rapide », et mettre la même valeur dans les propriétés du script Apps Script (`BIBLE_KEY`).

## Check-in → profils

Le script `integrations/checkin-google-sheet.gs` relie les réponses du formulaire de check-in aux profils de la bible (par email, puis par nom) et crée le profil s'il n'existe pas.

Copié dans la bible : téléphone, email, âge, nationalité (seulement si vides), la photo si le formulaire contient une question « Photo » ou « Polas », et les infos pratiques (voyage, allergies, intolérances, repas, boissons, logistique, matériel). Les infos médicales, phobies, limitations physiques, mal des transports, altitude et médicaments restent uniquement dans le Google Sheet.

Installation (une seule fois) :
1. Ouvrir le Google Sheet des réponses → Extensions → Apps Script.
2. Remplacer le contenu par celui de `integrations/checkin-google-sheet.gs`, puis enregistrer.
3. Paramètres du projet (roue dentée) → Propriétés du script → ajouter `BIBLE_KEY` avec la même valeur que le secret GitHub `BIBLE_KEY` (voir « Base partagée »).
4. Recharger le Google Sheet : un menu « Bible » apparaît. Cliquer « Activer l'envoi automatique » et accepter les autorisations Google.

Les réponses déjà présentes sont envoyées tout de suite, puis chaque nouvelle réponse arrive automatiquement. Une colonne « Bible » indique pour chaque ligne le profil lié ou créé ; vider la case d'une ligne pour la renvoyer.
