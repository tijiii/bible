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
    "mail": ""
  },
  {
    "id": 2,
    "nom": "Genesis",
    "pays": "Royaume-Uni",
    "ville": "London",
    "mail": ""
  },
  {
    "id": 3,
    "nom": "Colours",
    "pays": "Royaume-Uni",
    "ville": "Glasgow",
    "mail": "info@coloursagency.com"
  },
  {
    "id": 4,
    "nom": "Select",
    "pays": "Royaume-Uni",
    "ville": "London",
    "mail": "women@selectmodel.com"
  },
  {
    "id": 5,
    "nom": "ModelTeam",
    "pays": "Royaume-Uni",
    "ville": "Scotland",
    "mail": "models@modelteam.co.uk"
  },
  {
    "id": 6,
    "nom": "Base",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "london@basemodels.co.uk"
  },
  {
    "id": 7,
    "nom": "MMG Models",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@mmgmodels.com"
  },
  {
    "id": 8,
    "nom": "Elite",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@elitemodel.co.uk"
  },
  {
    "id": 9,
    "nom": "PRM",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@prm-agency.com"
  },
  {
    "id": 10,
    "nom": "PremierModel",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": "info@premiermodelmanagement.com"
  },
  {
    "id": 11,
    "nom": "WManagment",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "mail": ""
  }
],

  marques: [
  "MNSTRY",
  "STYRKR",
  "FAR",
  "SATISFY",
  "BANDIT",
  "TRACKSMITH",
  "DISTRICTVISION",
  "KUTADISTENCIEL",
  "MILERUNNUNG",
  "SOARRUNNING",
  "NORDARUN",
  "CIELATHLETIQUE",
  "UNNAWORLD",
  "BALMORALSSPORT",
  "NEAREARTH",
  "CADENCE",
  "CAYL",
  "ERNIOLRUNNING",
  "RAD"
],

  talents: [
  {
    "id": 1,
    "nom": "TRAMINI",
    "prenom": "Palmyre",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "+33 7 70 19 36 81",
    "mail": "palmyretramini@hotmail.fr",
    "agence": "Her/Supreme",
    "pays": "France",
    "ville": "Paris",
    "insta": "Palmyre",
    "sport": "",
    "photo": "photos/modelf_TRAMINI_Palmyre.png",
    "notes": ""
  },
  {
    "id": 2,
    "nom": "ARSAN",
    "prenom": "Charlie",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Charlie",
    "sport": "",
    "photo": "photos/modelf_ARSAN_Charlie.png",
    "notes": "Site"
  },
  {
    "id": 3,
    "nom": "ZHILKINA",
    "prenom": "Sofia",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "genesismodel",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "photos/modelf_ZHILKINA_Sofia.png",
    "notes": ""
  },
  {
    "id": 4,
    "nom": "BRAY",
    "prenom": "Eden",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "immmodels",
    "pays": "France",
    "ville": "Paris",
    "insta": "Eden",
    "sport": "",
    "photo": "photos/modelf_BRAY_Eden.png",
    "notes": ""
  },
  {
    "id": 5,
    "nom": "LIPA",
    "prenom": "Sona",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "London",
    "insta": "Sona",
    "sport": "",
    "photo": "photos/modelf_LIPA_Sona.jpg",
    "notes": ""
  },
  {
    "id": 6,
    "nom": "AKIYOSHI",
    "prenom": "Umi",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "Muse",
    "pays": "États-Unis",
    "ville": "NYC",
    "insta": "Umi",
    "sport": "",
    "photo": "photos/modelf_AKIYOSHI_Umi.png",
    "notes": ""
  },
  {
    "id": 7,
    "nom": "KRINSKY",
    "prenom": "Lucy",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "NYC",
    "insta": "Umi",
    "sport": "",
    "photo": "photos/modelf_KRINSKY_Lucy.png",
    "notes": "Site"
  },
  {
    "id": 8,
    "nom": "TATE",
    "prenom": "Page",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "Opt1",
    "pays": "États-Unis",
    "ville": "US",
    "insta": "Polly",
    "sport": "",
    "photo": "photos/modelf_TATE_Page.png",
    "notes": ""
  },
  {
    "id": 9,
    "nom": "JUNG",
    "prenom": "Arianne",
    "sexe": "f",
    "age": "",
    "cats": [
      "modele-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "KarineModels",
    "pays": "France",
    "ville": "Paris",
    "insta": "Arianne",
    "sport": "",
    "photo": "photos/modelf_JUNG_Arianne.png",
    "notes": ""
  },
  {
    "id": 10,
    "nom": "BECKO",
    "prenom": "Noah",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Noah",
    "sport": "Fashion/Posing",
    "photo": "photos/modelh_Becko_Noah.png",
    "notes": ""
  },
  {
    "id": 11,
    "nom": "NAAR",
    "prenom": "Karim",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "+33 6 06 79 72 80",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Marseille",
    "insta": "Karim",
    "sport": "Dance",
    "photo": "photos/modelh_Naar_Karim.png",
    "notes": ""
  },
  {
    "id": 12,
    "nom": "DERRIEN",
    "prenom": "Jeremy",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "+33 6 89 08 17 86",
    "mail": "m.jeremyderrien@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Jeremy",
    "sport": "",
    "photo": "photos/modelh_DERRIEN_Jeremy.png",
    "notes": ""
  },
  {
    "id": 13,
    "nom": "SANNI",
    "prenom": "Kolawole",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris / Lyon",
    "insta": "Kolawole",
    "sport": "",
    "photo": "photos/modelh_SANNI_Kolawole.png",
    "notes": ""
  },
  {
    "id": 14,
    "nom": "MERUEM",
    "prenom": "Sana",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "+33 6 16 61 01 93",
    "mail": "",
    "agence": "https://www.girlmgmt.com/models/women/image",
    "pays": "France",
    "ville": "Paris",
    "insta": "sana_dng",
    "sport": "",
    "photo": "photos/modelh_MERUEM_Sana.png",
    "notes": ""
  },
  {
    "id": 15,
    "nom": "SALMON",
    "prenom": "Cesar",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "genesismodel",
    "pays": "",
    "ville": "Londres",
    "insta": "cez_sal",
    "sport": "",
    "photo": "photos/modelh_SALMON_Cesar.png",
    "notes": ""
  },
  {
    "id": 16,
    "nom": "LOA-IN",
    "prenom": "Anulpat",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "genesismodel",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "photos/modelh_LOA-IN_Anulpat.png",
    "notes": ""
  },
  {
    "id": 17,
    "nom": "WIDDOWSON",
    "prenom": "Isaac",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "genesismodel",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "photos/modelh_WIDDOWSON_Isaac.png",
    "notes": ""
  },
  {
    "id": 18,
    "nom": "BAKARE",
    "prenom": "Lekan",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "genesismodel",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "photos/modelh_BAKARE_Lekan.png",
    "notes": ""
  },
  {
    "id": 19,
    "nom": "CHIEF",
    "prenom": "Ohni",
    "sexe": "h",
    "age": "",
    "cats": [
      "modele-h"
    ],
    "tel": "",
    "mail": "TalomeAgency",
    "agence": "Running",
    "pays": "",
    "ville": "",
    "insta": "Ohni",
    "sport": "",
    "photo": "photos/modelh_CHIEF_Ohni.png",
    "notes": ""
  },
  {
    "id": 20,
    "nom": "GARDENT",
    "prenom": "Camille",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris/Biarritz",
    "insta": "Camille",
    "sport": "Trail Running/Bike",
    "photo": "photos/athletef_GARDENT_Camille.png",
    "notes": ""
  },
  {
    "id": 21,
    "nom": "VELASQUEZ",
    "prenom": "Yuli",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "+34 628 42 66 91",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Tenerife/Spain",
    "insta": "Yuli",
    "sport": "Running",
    "photo": "photos/athletef_VELASQUEZ_Yuli.png",
    "notes": ""
  },
  {
    "id": 22,
    "nom": "TARENNE",
    "prenom": "Aurore",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Aurore",
    "sport": "Trail Running",
    "photo": "photos/athletef_TARENNE_Aurore.png",
    "notes": ""
  },
  {
    "id": 23,
    "nom": "FISHER",
    "prenom": "Agnès Christine",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Suisse",
    "ville": "Suisse ?",
    "insta": "Agnès",
    "sport": "Trail Running",
    "photo": "photos/athletef_FISHER_Agnès_Christine.png",
    "notes": ""
  },
  {
    "id": 24,
    "nom": "IVANOVA",
    "prenom": "Masha",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Masha",
    "sport": "Cycling",
    "photo": "photos/athletef_IVANOVA_Masha.png",
    "notes": ""
  },
  {
    "id": 25,
    "nom": "ARSAN",
    "prenom": "Charlie",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Charlie",
    "sport": "Running",
    "photo": "photos/athletef_ARSAN_Charlie.png",
    "notes": "Site"
  },
  {
    "id": 26,
    "nom": "GALVEZ",
    "prenom": "Brenda",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "+33 660 91 95 01",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Brenda",
    "sport": "Running",
    "photo": "photos/athletef_GALVEZ_Brenda.png",
    "notes": ""
  },
  {
    "id": 27,
    "nom": "PLA",
    "prenom": "Marta",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "+34 664 87 17 30",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Marta",
    "sport": "Running",
    "photo": "photos/athletef_PLA_Marta.png",
    "notes": ""
  },
  {
    "id": 28,
    "nom": "FIERROS",
    "prenom": "Sofia",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Sofia",
    "sport": "Running",
    "photo": "photos/athletef_FIERROS_Sofia.png",
    "notes": ""
  },
  {
    "id": 29,
    "nom": "MONREAL",
    "prenom": "Lucia",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Lucia",
    "sport": "Running",
    "photo": "photos/athletef_MONREAL_Lucia.png",
    "notes": ""
  },
  {
    "id": 30,
    "nom": "PUIG",
    "prenom": "Judith",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Judith",
    "sport": "Running/Cycling",
    "photo": "photos/athletef_PUIG_Judith.png",
    "notes": ""
  },
  {
    "id": 31,
    "nom": "ICANOVA",
    "prenom": "Masha",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Masha",
    "sport": "Running/Cycling",
    "photo": "",
    "notes": ""
  },
  {
    "id": 32,
    "nom": "",
    "prenom": "Jade",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "France / London ?",
    "insta": "Jade",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 33,
    "nom": "ISIS",
    "prenom": "Nour",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Nour",
    "sport": "Running",
    "photo": "photos/athletef_ISIS_Nour.png",
    "notes": ""
  },
  {
    "id": 34,
    "nom": "XALLI",
    "prenom": "Maria",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Danemark",
    "ville": "Danmark",
    "insta": "Maria",
    "sport": "Running",
    "photo": "photos/athletef_XALLI_Maria.png",
    "notes": ""
  },
  {
    "id": 35,
    "nom": "TY",
    "prenom": "B",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "manchester",
    "insta": "TY",
    "sport": "Running",
    "photo": "photos/athletef_TY_B.png",
    "notes": ""
  },
  {
    "id": 36,
    "nom": "MASON",
    "prenom": "Olivia",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "manchester",
    "insta": "Olivia",
    "sport": "Running",
    "photo": "photos/athletef_MASON_Olivia.png",
    "notes": ""
  },
  {
    "id": 37,
    "nom": "K",
    "prenom": "Larissa",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Germany ?",
    "insta": "Larissa",
    "sport": "Running",
    "photo": "photos/athletef_K_Larissa.png",
    "notes": ""
  },
  {
    "id": 38,
    "nom": "HOLT",
    "prenom": "Lily",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK ?",
    "insta": "Lily",
    "sport": "Running",
    "photo": "photos/athletef_HOLT_Lily.png",
    "notes": ""
  },
  {
    "id": 39,
    "nom": "ZANOGUERA",
    "prenom": "Inma",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK ?",
    "insta": "Inma",
    "sport": "Running",
    "photo": "photos/athletef_ZANOGUERA_Inma.png",
    "notes": ""
  },
  {
    "id": 40,
    "nom": "RASSA",
    "prenom": "Anna",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Berlin",
    "insta": "t",
    "sport": "Running",
    "photo": "photos/athletef_RASSA_Anna.png",
    "notes": ""
  },
  {
    "id": 41,
    "nom": "",
    "prenom": "Sophie",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Berlin",
    "insta": "Sophie",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 42,
    "nom": "HONG ANH PHAM",
    "prenom": "Hong Anh Pham",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Berlin ?",
    "insta": "Hong Anh",
    "sport": "Running",
    "photo": "photos/athletef_Hong_Anh_Pham_Hong_Anh_Pham.png",
    "notes": ""
  },
  {
    "id": 43,
    "nom": "BOLTE",
    "prenom": "Sophia",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Berlin ?",
    "insta": "Sofia",
    "sport": "Running",
    "photo": "photos/athletef_BOLTE_Sophia.png",
    "notes": ""
  },
  {
    "id": 44,
    "nom": "BLOVAD",
    "prenom": "Keaton",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "US - UTAH",
    "insta": "kekekaea",
    "sport": "Running",
    "photo": "photos/athletef_BLOVAD_Keaton.jpg",
    "notes": ""
  },
  {
    "id": 45,
    "nom": "CORONA",
    "prenom": "Virginia",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "BCN / Zurich",
    "insta": "Virginia",
    "sport": "Running",
    "photo": "photos/athletef_CORONA_Virginia.png",
    "notes": ""
  },
  {
    "id": 46,
    "nom": "VAIDA",
    "prenom": "Mary Jane",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "SATISFY !",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Mary Jane",
    "sport": "Running",
    "photo": "photos/athletef_VAIDA_Mary_Jane.png",
    "notes": ""
  },
  {
    "id": 47,
    "nom": "AKIYOSHI",
    "prenom": "Umi",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "NYC",
    "insta": "Umi",
    "sport": "Running",
    "photo": "photos/athletef_AKIYOSHI_Umi.png",
    "notes": ""
  },
  {
    "id": 48,
    "nom": "MALTESDOTTER",
    "prenom": "Agnes",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Suède",
    "ville": "Suède",
    "insta": "",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 49,
    "nom": "SMITH",
    "prenom": "Molly",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK?",
    "insta": "Molly",
    "sport": "Running",
    "photo": "photos/athletef_SMITH_Molly.png",
    "notes": ""
  },
  {
    "id": 50,
    "nom": "",
    "prenom": "Jodie",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Jodie",
    "sport": "Running/Climbing",
    "photo": "",
    "notes": "Site"
  },
  {
    "id": 51,
    "nom": "",
    "prenom": "Maud",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK/FR",
    "insta": "Maud",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 52,
    "nom": "",
    "prenom": "Cherelle",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK/FR",
    "insta": "",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 53,
    "nom": "VANS?",
    "prenom": "Pollye?",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK/FR",
    "insta": "Polly",
    "sport": "Running",
    "photo": "photos/athletef_VANS_Pollye.png",
    "notes": ""
  },
  {
    "id": 54,
    "nom": "TATE",
    "prenom": "Page",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "US",
    "insta": "Polly",
    "sport": "Running",
    "photo": "photos/athletef_TATE_Page.png",
    "notes": ""
  },
  {
    "id": 55,
    "nom": "PREVOT",
    "prenom": "Marie",
    "sexe": "f",
    "age": "",
    "cats": [
      "athlete-f"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "PARIS/MILAN",
    "insta": "Marie",
    "sport": "Running",
    "photo": "photos/athletef_PREVOT_Marie.png",
    "notes": ""
  },
  {
    "id": 56,
    "nom": "MÜLLER",
    "prenom": "Lauro",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Suisse",
    "ville": "Suisse ?",
    "insta": "Lauro",
    "sport": "Road Bike",
    "photo": "photos/athleteh_MÜLLER_Lauro.png",
    "notes": ""
  },
  {
    "id": 57,
    "nom": "DERRIEN",
    "prenom": "Jeremy",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "+33 6 89 08 17 86",
    "mail": "m.jeremyderrien@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Jeremy",
    "sport": "Running",
    "photo": "photos/athleteh_DERRIEN_Jeremy.png",
    "notes": ""
  },
  {
    "id": 58,
    "nom": "SANNI",
    "prenom": "Kolawole",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris / Lyon",
    "insta": "Kolawole",
    "sport": "Running / Sport",
    "photo": "",
    "notes": ""
  },
  {
    "id": 59,
    "nom": "PINTADO RUIZ",
    "prenom": "Jaime",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "+34 647 79 26 70",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Jaime",
    "sport": "Running/Cycling",
    "photo": "photos/athleteh_PINTADO_RUIZ__Jaime.png",
    "notes": ""
  },
  {
    "id": 60,
    "nom": "CAFASSO",
    "prenom": "Adil",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "+33 6 52 21 34 42",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "France",
    "insta": "Adil",
    "sport": "Running",
    "photo": "photos/athleteh_CAFASSO__Adil.png",
    "notes": ""
  },
  {
    "id": 61,
    "nom": "CASABLANCAS",
    "prenom": "Alex",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain",
    "insta": "Alex",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 62,
    "nom": "BALIRUNO",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Baliruno",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 63,
    "nom": "",
    "prenom": "Essi",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Essi",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 64,
    "nom": "C",
    "prenom": "Daniel",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "BERLIN@INDEEDMODELS.COM",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Daniel",
    "sport": "Running",
    "photo": "photos/athleteh_c_Daniel.png",
    "notes": ""
  },
  {
    "id": 65,
    "nom": "GRIERSON",
    "prenom": "Flurry",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "insta": "Flurry",
    "sport": "Running",
    "photo": "photos/athleteh_GRIERSON_Flurry.png",
    "notes": ""
  },
  {
    "id": 66,
    "nom": "",
    "prenom": "Biel ?",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Biel",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 67,
    "nom": "",
    "prenom": "Sehanism",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Sehanism",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 68,
    "nom": "LYNOTT",
    "prenom": "Josh",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "AUS",
    "insta": "Josh",
    "sport": "Running",
    "photo": "photos/athleteh_LYNOTT_Josh.png",
    "notes": ""
  },
  {
    "id": 69,
    "nom": "MITCHHART",
    "prenom": "Keith",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "klmitchhart@gmail.com",
    "agence": "",
    "pays": "États-Unis",
    "ville": "US",
    "insta": "Keith",
    "sport": "Running",
    "photo": "photos/athleteh_MITCHHART_Keith.png",
    "notes": ""
  },
  {
    "id": 70,
    "nom": "WYNDAELE",
    "prenom": "Romain",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Romain",
    "sport": "Running",
    "photo": "photos/athleteh_WYNDAELE_Romain.png",
    "notes": ""
  },
  {
    "id": 71,
    "nom": "URQUHART",
    "prenom": "Victor",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "CHEZ BROOKS",
    "agence": "",
    "pays": "Suède",
    "ville": "Suède?",
    "insta": "Victor",
    "sport": "Running",
    "photo": "photos/athleteh_URQUHART_Victor.png",
    "notes": ""
  },
  {
    "id": 72,
    "nom": "GUARDIA",
    "prenom": "Marc",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain?",
    "insta": "Marc",
    "sport": "Running",
    "photo": "photos/athleteh_GUARDIA_Marc.png",
    "notes": ""
  },
  {
    "id": 73,
    "nom": "SANCHEZ",
    "prenom": "Marc",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Espagne",
    "ville": "Spain ?",
    "insta": "Marc",
    "sport": "Running",
    "photo": "photos/athleteh_SANCHEZ_Marc.png",
    "notes": ""
  },
  {
    "id": 74,
    "nom": "DAHL\nSOMMERSETH",
    "prenom": "Stian",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "SATISFY !",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Stian",
    "sport": "Running",
    "photo": "photos/athleteh_DAHL\nSOMMERSETH_Stian.png",
    "notes": ""
  },
  {
    "id": 75,
    "nom": "YOHO",
    "prenom": "Alan",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "alan@yoho.nyc",
    "agence": "",
    "pays": "États-Unis",
    "ville": "NYC",
    "insta": "Alan",
    "sport": "Running",
    "photo": "photos/athleteh_YOHO_Alan.png",
    "notes": ""
  },
  {
    "id": 76,
    "nom": "",
    "prenom": "MaJeed",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "CA",
    "insta": "MaJeed",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 77,
    "nom": "JIN",
    "prenom": "Kyu",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Japon",
    "ville": "Japan?",
    "insta": "Kyu",
    "sport": "Running",
    "photo": "photos/athleteh_JIN_Kyu.png",
    "notes": ""
  },
  {
    "id": 78,
    "nom": "CHAPIN",
    "prenom": "Alex",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "USA?",
    "insta": "Alex",
    "sport": "Running",
    "photo": "photos/athleteh_CHAPIN_Alex.png",
    "notes": ""
  },
  {
    "id": 79,
    "nom": "VERSAM?",
    "prenom": "Ellis",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK?",
    "insta": "Ellis",
    "sport": "Running",
    "photo": "photos/athleteh_VERSAM_Ellis.png",
    "notes": ""
  },
  {
    "id": 80,
    "nom": "JUSTIE",
    "prenom": "Brian",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "US",
    "insta": "Brian",
    "sport": "Running",
    "photo": "photos/athleteh_JUSTIE_Brian.png",
    "notes": ""
  },
  {
    "id": 81,
    "nom": "",
    "prenom": "Tom",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "Tom",
    "sport": "Running",
    "photo": "",
    "notes": ""
  },
  {
    "id": 82,
    "nom": "JOSE",
    "prenom": "Marc",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "Running",
    "photo": "photos/athleteh_JOSE_Marc.png",
    "notes": ""
  },
  {
    "id": 83,
    "nom": "FINSTAD",
    "prenom": "Lasse",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Norvège",
    "ville": "Norvège",
    "insta": "Finstad",
    "sport": "Running/trail",
    "photo": "photos/athleteh_Finstad_Lasse.png",
    "notes": ""
  },
  {
    "id": 84,
    "nom": "DAMGAARD",
    "prenom": "Thomas",
    "sexe": "h",
    "age": "",
    "cats": [
      "athlete-h"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Danemark",
    "ville": "Danmark",
    "insta": "Thomas",
    "sport": "Running/trail",
    "photo": "photos/athleteh_DAMGAARD_Thomas.png",
    "notes": ""
  },
  {
    "id": 85,
    "nom": "CADREURS",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 86,
    "nom": "BIEZ",
    "prenom": "Antonin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33620683099",
    "mail": "antoninbiez@gmail.com",
    "agence": "FOCAL77",
    "pays": "France",
    "ville": "Annecy",
    "insta": "focal_77",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 87,
    "nom": "RAVO",
    "prenom": "Evan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33676667660",
    "mail": "evan@widenproduction.fr",
    "agence": "Widen Production",
    "pays": "France",
    "ville": "Paris, Annecy",
    "insta": "evanravo",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 88,
    "nom": "SORTON",
    "prenom": "Keryan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33698298706",
    "mail": "sorton.keryan@gmail.com",
    "agence": "KRYNDS",
    "pays": "France",
    "ville": "Chamonix",
    "insta": "krynds",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 89,
    "nom": "MOULIN",
    "prenom": "Maxime",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33614716165",
    "mail": "maxime@maximemoulin.com",
    "agence": "Maxime Moulin Filmaker",
    "pays": "France",
    "ville": "Annecy",
    "insta": "maximemoulin",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 90,
    "nom": "BAZZARINI",
    "prenom": "JB",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33645599754",
    "mail": "jb@creaturagency.com",
    "agence": "La Baze",
    "pays": "France",
    "ville": "Annecy",
    "insta": "la_baze",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 91,
    "nom": "PERREARD",
    "prenom": "Alan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33647957599",
    "mail": "",
    "agence": "La Clé Production",
    "pays": "France",
    "ville": "Paris, Annecy",
    "insta": "alanperreard",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 92,
    "nom": "RUFFRAY",
    "prenom": "Mathieu",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33617201482",
    "mail": "",
    "agence": "Pango Visual",
    "pays": "France",
    "ville": "Fréjus",
    "insta": "mathieu_ruffray",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 93,
    "nom": "CLAUDE",
    "prenom": "Antonin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33647909703",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "St-Gervais",
    "insta": "anto.claude",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 94,
    "nom": "HENNI",
    "prenom": "Pierre",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33678739964",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Annecy",
    "insta": "pierrehenni",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 95,
    "nom": "FAUCHILLE",
    "prenom": "Baptiste",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33786054065",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "baptistefauchille",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 96,
    "nom": "RICHARD",
    "prenom": "Théo",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "richard@heed-production.com",
    "agence": "HeedProduction",
    "pays": "France",
    "ville": "Bordeaux",
    "insta": "richard.theo",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 97,
    "nom": "REYNAUD",
    "prenom": "Vincent",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33750804863",
    "mail": "",
    "agence": "Vincentr",
    "pays": "France",
    "ville": "Annecy",
    "insta": "vincentreynaud_",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 98,
    "nom": "STANUS",
    "prenom": "Lucas",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33648350528",
    "mail": "lucas.stanus@gmail.com",
    "agence": "Lucas Stanus",
    "pays": "France",
    "ville": "Les Gets",
    "insta": "lucas_stanus_videos",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 99,
    "nom": "ROSIER COULHON",
    "prenom": "Nelson",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "+33612394587",
    "mail": "nelson.rosier@gmail.com",
    "agence": "TomNelson",
    "pays": "France",
    "ville": "Paris",
    "insta": "nelson_rosier",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 100,
    "nom": "FROMONT",
    "prenom": "Clément",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "clement_fromont",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 101,
    "nom": "GRIMAULT",
    "prenom": "Jonathan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "Involvd.films",
    "pays": "France",
    "ville": "Paris, Lyon, Genève",
    "insta": "jogrimo",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 102,
    "nom": "REDSK",
    "prenom": "Tom",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "tomredsk",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 103,
    "nom": "LE LONS",
    "prenom": "Tom",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "tomlelons",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 104,
    "nom": "PETIT",
    "prenom": "Alex",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "STEADICAM",
    "pays": "",
    "ville": "",
    "insta": "ca_va_cool",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 105,
    "nom": "STEADICAM",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 106,
    "nom": "LANA",
    "prenom": "Jackson",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "Steadicam",
    "pays": "Royaume-Uni",
    "ville": "London",
    "insta": "Jackson",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 107,
    "nom": "AC",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 108,
    "nom": "CHEZE",
    "prenom": "Hugo",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Hugo",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 109,
    "nom": "REYDELLET",
    "prenom": "Mahery",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Mahery",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 110,
    "nom": "TRAVET",
    "prenom": "Jules",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-cadreur"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Lyon/Paris",
    "insta": "Jules",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 111,
    "nom": "FILMMAKER",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-filmmaker"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 112,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-filmmaker"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 113,
    "nom": "PETIT",
    "prenom": "Antoine",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-filmmaker"
    ],
    "tel": "06.49.63.69.35",
    "mail": "petitmedias@gmail.com",
    "agence": "www.petitmedias.com",
    "pays": "",
    "ville": "",
    "insta": "Antoine",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 114,
    "nom": "DRONISTES",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 115,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 116,
    "nom": "ROUSSEAU",
    "prenom": "Fred",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "+33683393911",
    "mail": "contact@fredrousseau.fr",
    "agence": "",
    "pays": "France",
    "ville": "Chamonix",
    "insta": "fred.rousseau",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 117,
    "nom": "BOURGEOIS",
    "prenom": "Mathieu",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "+33633104035",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Chamonix",
    "insta": "matbourgeois",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 118,
    "nom": "CRETINON",
    "prenom": "Robin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "+33633572658",
    "mail": "robin.cretinon@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Grenoble",
    "insta": "robin_cretinon",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 119,
    "nom": "DUPONT",
    "prenom": "Pierre",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "+33662029798",
    "mail": "",
    "agence": "Cinematic Flow",
    "pays": "France",
    "ville": "Lyon",
    "insta": "cinematicflow",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 120,
    "nom": "BENDJAMA",
    "prenom": "Augustin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "+33670265447",
    "mail": "",
    "agence": "DAPE Prod",
    "pays": "",
    "ville": "Chambery",
    "insta": "dape_prod",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 121,
    "nom": "MONDE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-drone"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 122,
    "nom": "PHOTOGRAPHES",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 123,
    "nom": "FOULONNEAU",
    "prenom": "Paul",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33604143124",
    "mail": "paul@3so-lagence.com",
    "agence": "3SO L'AGENCE",
    "pays": "",
    "ville": "Aix-les-Bains (73)",
    "insta": "polphe_photo",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 124,
    "nom": "RICHARD",
    "prenom": "Ugo",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33620855793",
    "mail": "ugo@ugorichard.fr",
    "agence": "",
    "pays": "France",
    "ville": "Lyon, Paris, Milan",
    "insta": "ugorichardphoto",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 125,
    "nom": "SIGAUD",
    "prenom": "Greg",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33613770027",
    "mail": "gsigaudphoto@gmail.com",
    "agence": "GREGSIGAUD PHOTOGRAPHIE",
    "pays": "",
    "ville": "",
    "insta": "greg_sigaud",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 126,
    "nom": "SIEGFRIED",
    "prenom": "Clément",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33781556345",
    "mail": "",
    "agence": "clsiegfried",
    "pays": "France",
    "ville": "Lille, Besançon",
    "insta": "clement.siegfried",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 127,
    "nom": "PICARD",
    "prenom": "Hadrien",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33633545273",
    "mail": "hadrien.picard@gmail.com",
    "agence": "HP",
    "pays": "",
    "ville": "",
    "insta": "hadrienpicard",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 128,
    "nom": "ALLIN",
    "prenom": "Boris",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33637636638",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 129,
    "nom": "BALLET",
    "prenom": "Pauline",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "ballet.pauline@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 130,
    "nom": "FORSYTHE",
    "prenom": "Jake",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "jakeforsythe",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 131,
    "nom": "GORHAM",
    "prenom": "Jack",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "Londres, UK",
    "insta": "jackgorham1",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 132,
    "nom": "WOJACZKOVA",
    "prenom": "Nela",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Berlin, ALL",
    "insta": "nwjczk",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 133,
    "nom": "MARSHALL",
    "prenom": "George",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "Hastings, UK",
    "insta": "georgemarshallphoto",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 134,
    "nom": "GRENAA",
    "prenom": "Oliver",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "Cornwall, UK",
    "insta": "olivergrenaa",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 135,
    "nom": "CHAN",
    "prenom": "Thompson",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "thompsoncphoto",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 136,
    "nom": "BEALE",
    "prenom": "Jackie",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "LA, USA",
    "insta": "jacbeale",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 137,
    "nom": "BÉNARD",
    "prenom": "Sam",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "FR, UK",
    "insta": "sambenard",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 138,
    "nom": "SAUNDERS",
    "prenom": "Will",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "https://www.instagram.com/quitzenelson/",
    "pays": "",
    "ville": "",
    "insta": "willsaundersphoto",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 139,
    "nom": "UNRATH",
    "prenom": "Carolin",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Munich + Alps",
    "insta": "carounrath",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 140,
    "nom": "COX",
    "prenom": "Si",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "insta": "sic0x",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 141,
    "nom": "ELLIES",
    "prenom": "Max",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "+33 6 10 79 01 39",
    "mail": "contact@maximeellies.com",
    "agence": "Obvious",
    "pays": "",
    "ville": "FR",
    "insta": "maks.ellies",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 142,
    "nom": "HUDRY",
    "prenom": "Clément",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "FR",
    "insta": "clement_hudry",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 143,
    "nom": "MONDE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-photo"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 144,
    "nom": "MONTEURS",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-montage"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 145,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-montage"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 146,
    "nom": "CRETINON",
    "prenom": "Robin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-montage"
    ],
    "tel": "+33633572658",
    "mail": "robin.cretinon@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Grenoble",
    "insta": "robin_cretinon",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 147,
    "nom": "MONDE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-montage"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 148,
    "nom": "HUBER",
    "prenom": "Cornelia",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-montage"
    ],
    "tel": "+436704041049",
    "mail": "cornelia_huber@hotmail.com",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Autriche",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 149,
    "nom": "IAN CAIRNS",
    "prenom": "Lukas",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-colorist"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Suisse",
    "ville": "Vienne / Tyrol",
    "insta": "Lukas",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 150,
    "nom": "ELI",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-colorist"
    ],
    "tel": "+47 454 35 186",
    "mail": "eli@tmls.tv",
    "agence": "TMLS",
    "pays": "Norvège",
    "ville": "Norvège",
    "insta": "TLMS",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 151,
    "nom": "BOURQUE PERRINO",
    "prenom": "Mary Elizabeth",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-colorist"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "États-Unis",
    "ville": "NYC",
    "insta": "Mary",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 152,
    "nom": "RETUSCHERIET",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-retouche"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Suède",
    "ville": "Suède",
    "insta": "RETUSCHERIER",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 153,
    "nom": "SOUNDESIGNER",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-son"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 154,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-son"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 155,
    "nom": "ROCHE",
    "prenom": "Thomas",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-son"
    ],
    "tel": "+33473192200",
    "mail": "thomas@mixetmouse.com",
    "agence": "Mix&Mouse",
    "pays": "France",
    "ville": "Clermont Ferrand",
    "insta": "mixetmouse",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 156,
    "nom": "ALLEAUME",
    "prenom": "Jeremy",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-3d"
    ],
    "tel": "+33633905846",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Toulouse",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 157,
    "nom": "GRAPHISTES",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 158,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 159,
    "nom": "DUNANT",
    "prenom": "Yann",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "+33618896709",
    "mail": "yann@wearebandits.love",
    "agence": "We are bandits",
    "pays": "France",
    "ville": "Annecy",
    "insta": "wearebandits.agency",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 160,
    "nom": "FAUCHILLE",
    "prenom": "Baptiste",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "+33786054065",
    "mail": "baptiste.fauchille@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Lyon",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 161,
    "nom": "MONDE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 162,
    "nom": "SACKL",
    "prenom": "Fabian",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-graphiste"
    ],
    "tel": "",
    "mail": "fabian.sackl@clubnord.at",
    "agence": "",
    "pays": "Allemagne",
    "ville": "Autriche",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 163,
    "nom": "MOREL DE FAUCAUCOURT",
    "prenom": "Arnaud",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33673091414",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 164,
    "nom": "PEREZ",
    "prenom": "Antoine",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33 6 29 51 28 01",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Lyon",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 165,
    "nom": "LESCOP",
    "prenom": "Matthieu",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33 6 37 37 37 73",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 166,
    "nom": "MAINDRAULT",
    "prenom": "Guillaume",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33 7 68 66 63 13",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Montagne",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 167,
    "nom": "CRT",
    "prenom": "Nathan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Lyon",
    "insta": "Nathan",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 168,
    "nom": "SALESSES",
    "prenom": "Emilie",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris/lyon",
    "insta": "Emilie",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 169,
    "nom": "FIGUEROLA",
    "prenom": "Clement",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris/lyon",
    "insta": "Clement",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 170,
    "nom": "RENOUX",
    "prenom": "Antoine",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-mach"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Lyon",
    "insta": "Antoine",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 171,
    "nom": "GAYRAUD",
    "prenom": "Kylian",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-mach"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Kylian",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 172,
    "nom": "KARAYAN",
    "prenom": "Anthony",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "anthonykarayan",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 173,
    "nom": "GODINEAU",
    "prenom": "Valentin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33 7 85 51 93 79",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 174,
    "nom": "",
    "prenom": "Charles",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "+33 7 81 48 34 50",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 175,
    "nom": "CHOLLET",
    "prenom": "Max",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-elec"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 176,
    "nom": "",
    "prenom": "Ethan",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-ac"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "ethanzerrr",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 177,
    "nom": "PAUMIER",
    "prenom": "Willian",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-ac"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 178,
    "nom": "DIGIT",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-digit"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 179,
    "nom": "CASEAU",
    "prenom": "Jules",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-digit"
    ],
    "tel": "+33 6 44 09 50 17",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 180,
    "nom": "TARAUD",
    "prenom": "Vincent",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-digit"
    ],
    "tel": "+33 6 43 32 40 69",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 181,
    "nom": "PEDROSA",
    "prenom": "Gabin",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-digit"
    ],
    "tel": "+33 6 42 80 84 94",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 182,
    "nom": "KARAYAN",
    "prenom": "Anthony",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-digit"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "anthonykarayan",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 183,
    "nom": "GIOVANNIDIS",
    "prenom": "Alexandra",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-stylist"
    ],
    "tel": "+33 6 16 07 05 94",
    "mail": "",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "Alexandra",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 184,
    "nom": "ARCHER",
    "prenom": "Yui",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-stylist"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "UK",
    "insta": "Yui",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 185,
    "nom": "HORLIN",
    "prenom": "Amanda",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-stylist"
    ],
    "tel": "",
    "mail": "amandahorlin@gmail.com",
    "agence": "MauMauCollective",
    "pays": "",
    "ville": "",
    "insta": "Amanda",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 186,
    "nom": "LANA",
    "prenom": "Jackson",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-dop"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Royaume-Uni",
    "ville": "London",
    "insta": "Jackson",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 187,
    "nom": "",
    "prenom": "Hannah",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "787755476",
    "mail": "hannahmua@live.fr",
    "agence": "",
    "pays": "",
    "ville": "Genève",
    "insta": "HANNAHNATHALIE.COM",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 188,
    "nom": "PIMENTAO",
    "prenom": "Vera",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "786552290",
    "mail": "vera.pimentao@gmail.com",
    "agence": "",
    "pays": "Suisse",
    "ville": "St Prex / Suisse",
    "insta": "verapimentao",
    "sport": "Mode",
    "photo": "",
    "notes": ""
  },
  {
    "id": 189,
    "nom": "RODRIGUEZ",
    "prenom": "Jade",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "06 61 57 23 13",
    "mail": "Jade-rodriguez@live.fr",
    "agence": "",
    "pays": "France",
    "ville": "Lyon/Paris",
    "insta": "jade_r__makeup",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 190,
    "nom": "",
    "prenom": "Elodie",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "07 45 21 67 80",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 191,
    "nom": "",
    "prenom": "Marine",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "06 38 14 61 38",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 192,
    "nom": "LE JEHAN",
    "prenom": "Aurélia",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "06 02 13 83 60",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 193,
    "nom": "",
    "prenom": "Anna",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-mua"
    ],
    "tel": "06 43 28 83 53",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 194,
    "nom": "SET DESIGNER",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 195,
    "nom": "FRANCE",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 196,
    "nom": "MORAND",
    "prenom": "Alice",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "06 09 91 30 87",
    "mail": "alicemoranddd@gmail.com",
    "agence": "",
    "pays": "France",
    "ville": "Paris",
    "insta": "alicemorandd",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 197,
    "nom": "GUERBOIS",
    "prenom": "Chloé",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "07 62 68 14 02",
    "mail": "chloguerbois@gmail.com",
    "agence": "Quadriga Management",
    "pays": "France",
    "ville": "Paris",
    "insta": "chloeguerbois",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 198,
    "nom": "PALLE",
    "prenom": "Prudence",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "",
    "mail": "emma@orso.paris",
    "agence": "Orso Paris",
    "pays": "France",
    "ville": "Paris",
    "insta": "prudencepalle",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 199,
    "nom": "ARMANDIN",
    "prenom": "Marine",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "",
    "mail": "marine.armandin@live.fr caroline@lambert-lambert.com\njules@lambert-lambert.com",
    "agence": "Lambert Lambert",
    "pays": "France",
    "ville": "Paris",
    "insta": "marinearmandin",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 200,
    "nom": "LEE",
    "prenom": "Nara",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-set"
    ],
    "tel": "",
    "mail": "caroline@lambert-lambert.com\njules@lambert-lambert.com",
    "agence": "Lambert Lambert",
    "pays": "France",
    "ville": "Paris",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": "https://lambert-lambert.com/talents/nara-lee"
  },
  {
    "id": 201,
    "nom": "ROHART",
    "prenom": "Julie",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-scenariste"
    ],
    "tel": "",
    "mail": "",
    "agence": "https://www.instagram.com/agencelisearif/",
    "pays": "France",
    "ville": "Paris / Londres",
    "insta": "julierohart",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 202,
    "nom": "D.A",
    "prenom": "",
    "sexe": "h",
    "age": "",
    "cats": [
      "tech-da"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "",
    "ville": "",
    "insta": "",
    "sport": "",
    "photo": "",
    "notes": ""
  },
  {
    "id": 203,
    "nom": "VAN DER MEER",
    "prenom": "Sevi",
    "sexe": "f",
    "age": "",
    "cats": [
      "tech-da"
    ],
    "tel": "",
    "mail": "",
    "agence": "",
    "pays": "Norvège",
    "ville": "Norway?",
    "insta": "Sevi",
    "sport": "",
    "photo": "",
    "notes": ""
  }
],

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
