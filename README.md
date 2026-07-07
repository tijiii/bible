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
