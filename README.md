# Casting Bible

Site de gestion de talents pour la production outdoor.  
Aucun serveur requis — tout fonctionne en local dans le navigateur.

## Structure des fichiers

```
casting-bible/
├── index.html   ← page principale
├── style.css    ← design
├── geo.js       ← pays et villes
├── data.js      ← données initiales (talents, clubs, marques, agences)
└── app.js       ← logique de l'app
```

## Déployer sur GitHub Pages (5 minutes)

### 1. Créer le repo GitHub
1. Va sur [github.com](https://github.com) → **New repository**
2. Nom : `casting-bible` (ou ce que tu veux)
3. Mets le repo en **Public** (requis pour GitHub Pages gratuit)
4. Clique **Create repository**

### 2. Uploader les fichiers
**Option A — via l'interface web (plus simple) :**
1. Dans ton repo, clique **Add file → Upload files**
2. Glisse les 5 fichiers (`index.html`, `style.css`, `geo.js`, `data.js`, `app.js`)
3. Clique **Commit changes**

**Option B — via Git en ligne de commande :**
```bash
cd casting-bible
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/casting-bible.git
git push -u origin main
```

### 3. Activer GitHub Pages
1. Dans ton repo → onglet **Settings**
2. Colonne gauche → **Pages**
3. Source : **Deploy from a branch**
4. Branch : **main** / **(root)**
5. Clique **Save**

Ton site sera dispo en quelques minutes à l'adresse :  
`https://TON_USERNAME.github.io/casting-bible/`

---

## Modifier les données initiales

Ouvre `data.js` et édite le tableau `INITIAL_DATA`.  
**Note :** les données modifiées dans l'app (ajouts, suppressions) sont sauvegardées dans le navigateur (localStorage) et persistent entre sessions. Pour réinitialiser depuis `data.js`, il faut vider le localStorage.

## Ajouter des pays ou des villes

Ouvre `geo.js` et ajoute des entrées dans l'objet `GEO` :
```js
"Nouvelle Zélande": ["Auckland","Wellington","Christchurch"],
```
Et son drapeau dans `FLAGS` :
```js
"Nouvelle Zélande": "🇳🇿",
```
