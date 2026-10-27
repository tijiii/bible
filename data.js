// ── DONNÉES INITIALES ────────────────────────────────────────────────────────
// Importé depuis les fichiers Excel (Modèles, Athlètes, Bible Technique, Marques/Clubs/Agences).
// Les photos sont dans le dossier photos/ et référencées en chemin relatif.

const INITIAL_DATA = {

  categories: [
  {
    "id": "modele-f",
    "label": "Modèle Femme",
    "color": "#c8f059"
  },
  {
    "id": "modele-h",
    "label": "Modèle Homme",
    "color": "#59d4f0"
  },
  {
    "id": "athlete-f",
    "label": "Athlète Femme",
    "color": "#c8f059"
  },
  {
    "id": "athlete-h",
    "label": "Athlète Homme",
    "color": "#59d4f0"
  },
  {
    "id": "tech-dop",
    "label": "DOP",
    "color": "#f0a059"
  },
  {
    "id": "tech-elec",
    "label": "Chef Elec",
    "color": "#f0a059"
  },
  {
    "id": "tech-mach",
    "label": "Chef Mach",
    "color": "#f0a059"
  },
  {
    "id": "tech-photo",
    "label": "Photographe",
    "color": "#f0a059"
  },
  {
    "id": "tech-retouche",
    "label": "Retoucheur",
    "color": "#f0a059"
  },
  {
    "id": "tech-montage",
    "label": "Monteur",
    "color": "#f0a059"
  },
  {
    "id": "tech-3d",
    "label": "3D",
    "color": "#f0a059"
  },
  {
    "id": "tech-son",
    "label": "Son",
    "color": "#f0a059"
  },
  {
    "id": "tech-compo",
    "label": "Compositeur",
    "color": "#f0a059"
  },
  {
    "id": "tech-mua",
    "label": "MUA",
    "color": "#d066e0"
  },
  {
    "id": "tech-stylist",
    "label": "Stylist",
    "color": "#d066e0"
  },
  {
    "id": "tech-cadreur",
    "label": "Cadreur",
    "color": "#f0a059"
  },
  {
    "id": "tech-steadicam",
    "label": "Steadicam",
    "color": "#f0a059"
  },
  {
    "id": "tech-filmmaker",
    "label": "Filmmaker",
    "color": "#f0a059"
  },
  {
    "id": "tech-drone",
    "label": "Droniste",
    "color": "#f0a059"
  },
  {
    "id": "tech-colorist",
    "label": "Coloriste",
    "color": "#f0a059"
  },
  {
    "id": "tech-graphiste",
    "label": "Graphiste",
    "color": "#f0a059"
  },
  {
    "id": "tech-ac",
    "label": "AC",
    "color": "#f0a059"
  },
  {
    "id": "tech-digit",
    "label": "DIT / Digit",
    "color": "#f0a059"
  },
  {
    "id": "tech-set",
    "label": "Set Designer",
    "color": "#d066e0"
  },
  {
    "id": "tech-real",
    "label": "Réalisateur",
    "color": "#f0a059"
  },
  {
    "id": "tech-scenariste",
    "label": "Scénariste",
    "color": "#f0a059"
  },
  {
    "id": "tech-da",
    "label": "Directeur Artistique",
    "color": "#d066e0"
  },
  {
    "id": "tech-postprod",
    "label": "Post-Production",
    "color": "#f0a059"
  }
],

  sports: [
  "Running",
  "Trail",
  "Fitness",
  "Yoga",
  "Dance",
  "Natation",
  "Cyclisme",
  "Football",
  "Basketball",
  "Tennis",
  "Escalade",
  "Surf",
  "Ski",
  "Snowboard",
  "Fashion/Posing",
  "Triathlon",
  "CrossFit",
  "Boxe",
  "Athlétisme",
  "Skateboard",
  "Parkour",
  "Road Bike",
  "Trail Running/Bike",
  "Running/Climbing",
  "Running/Cycling",
  "Running/Sport",
  "Running/trail"
],

  agences: [
  {
    "id": 1,
    "nom": "KarinModels",
    "pays": "France",
    "ville": "Paris",
    "mail": "",
    "site": ""
  },
  {
    "id": 2,
    "nom": "Genesis",
    "pays": "Royaume-Uni",
    "ville": "London",
    "mail": "",
    "site": ""
  },
  {
    "id": 3,
    "nom": "Colours",
    "pays": "Royaume-Uni",
    "ville": "Glasgow",
    "mail": "info@coloursagency.com",
    "site": ""
  },
  {
    "id": 4,
    "nom": "Select",
    "pays": "Royaume-Uni",
    "ville": "London",
    "mail": "women@selectmodel.com",
    "site": ""
  },
  {
    "id": 5,
    "nom": "ModelTeam",
    "pays": "Royaume-Uni",
    "ville": "Scotland",
    "mail": "models@modelteam.co.uk",
    "site": ""
  },
  {
    "id": 6,
    "nom": "Base",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "london@basemodels.co.uk",
    "site": ""
  },
  {
    "id": 7,
    "nom": "MMG Models",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@mmgmodels.com",
    "site": ""
  },
  {
    "id": 8,
    "nom": "Elite",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@elitemodel.co.uk",
    "site": ""
  },
  {
    "id": 9,
    "nom": "PRM",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@prm-agency.com",
    "site": ""
  },
  {
    "id": 10,
    "nom": "PremierModel",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@premiermodelmanagement.com",
    "site": ""
  },
  {
    "id": 11,
    "nom": "WManagment",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "",
    "site": ""
  }
],

  marques: [
  {
    "nom": "MNSTRY",
    "site": ""
  },
  {
    "nom": "STYRKR",
    "site": ""
  },
  {
    "nom": "FAR",
    "site": ""
  },
  {
    "nom": "SATISFY",
    "site": ""
  },
  {
    "nom": "BANDIT",
    "site": ""
  },
  {
    "nom": "TRACKSMITH",
    "site": ""
  },
  {
    "nom": "DISTRICTVISION",
    "site": ""
  },
  {
    "nom": "KUTADISTENCIEL",
    "site": ""
  },
  {
    "nom": "MILERUNNUNG",
    "site": ""
  },
  {
    "nom": "SOARRUNNING",
    "site": ""
  },
  {
    "nom": "NORDARUN",
    "site": ""
  },
  {
    "nom": "CIELATHLETIQUE",
    "site": ""
  },
  {
    "nom": "UNNAWORLD",
    "site": ""
  },
  {
    "nom": "BALMORALSSPORT",
    "site": ""
  },
  {
    "nom": "NEAREARTH",
    "site": ""
  },
  {
    "nom": "CADENCE",
    "site": ""
  },
  {
    "nom": "CAYL",
    "site": ""
  },
  {
    "nom": "ERNIOLRUNNING",
    "site": ""
  },
  {
    "nom": "RAD",
    "site": ""
  }
],

  // Les talents (noms, téléphones, mails) ne sont plus dans le code public :
  // ils viennent seulement de la base partagée, réservée à l'équipe.
  talents: [],

  clubs: [
  {
    "id": 1,
    "nom": "BOLD",
    "pays": "Allemagne",
    "ville": "Berlin",
    "lien": "Bold",
    "mail": "",
    "notes": ""
  },
  {
    "id": 2,
    "nom": "MULCH SERIES",
    "pays": "États-Unis",
    "ville": "NYC?",
    "lien": "Mulch Series",
    "mail": "",
    "notes": ""
  },
  {
    "id": 3,
    "nom": "BEANS CLUB",
    "pays": "Royaume-Uni",
    "ville": "London",
    "lien": "Beans",
    "mail": "",
    "notes": ""
  },
  {
    "id": 4,
    "nom": "GOOD VIBES CLUB",
    "pays": "États-Unis",
    "ville": "L.A?",
    "lien": "GoodVibes",
    "mail": "",
    "notes": ""
  },
  {
    "id": 5,
    "nom": "BERLIN BRAVES",
    "pays": "Allemagne",
    "ville": "Berlin",
    "lien": "Berlin Braves",
    "mail": "",
    "notes": ""
  },
  {
    "id": 6,
    "nom": "RUNSMARTNOTHARD",
    "pays": "Allemagne",
    "ville": "Berlin",
    "lien": "Runsmartnothard",
    "mail": "",
    "notes": ""
  },
  {
    "id": 7,
    "nom": "CAPRICOLLECTIVE",
    "pays": "Espagne",
    "ville": "Spain?",
    "lien": "Capricollective",
    "mail": "",
    "notes": ""
  },
  {
    "id": 8,
    "nom": "RUNDEMCREW",
    "pays": "",
    "ville": "",
    "lien": "RunDemCrew",
    "mail": "",
    "notes": ""
  },
  {
    "id": 9,
    "nom": "COLLISIONRUNNING",
    "pays": "France",
    "ville": "Paris",
    "lien": "Collision",
    "mail": "",
    "notes": ""
  },
  {
    "id": 10,
    "nom": "PECKHAMPACERS",
    "pays": "Royaume-Uni",
    "ville": "London",
    "lien": "Peckhampacers",
    "mail": "",
    "notes": ""
  },
  {
    "id": 11,
    "nom": "RUNLIMITED",
    "pays": "Royaume-Uni",
    "ville": "London?",
    "lien": "RunLimited",
    "mail": "",
    "notes": ""
  }
]
};
