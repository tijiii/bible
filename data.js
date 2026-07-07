// ── DONNÉES INITIALES ────────────────────────────────────────────────────────
// Modifie ce fichier pour changer les données de départ.
// Les ajouts/modifications faits dans l'app sont sauvegardés en localStorage.

const INITIAL_DATA = {

  // Catégories de talents (librement extensibles dans Paramètres)
  categories: [
    { id: "modele-f",    label: "Modèle Femme",   color: "#c8f059" },
    { id: "modele-h",    label: "Modèle Homme",   color: "#59d4f0" },
    { id: "athlete-f",   label: "Athlète Femme",  color: "#c8f059" },
    { id: "athlete-h",   label: "Athlète Homme",  color: "#59d4f0" },
    { id: "tech-dop",    label: "DOP",            color: "#f0a059" },
    { id: "tech-elec",   label: "Chef Elec",      color: "#f0a059" },
    { id: "tech-mach",   label: "Chef Mach",      color: "#f0a059" },
    { id: "tech-photo",  label: "Photographe",    color: "#f0a059" },
    { id: "tech-retouche",label:"Retoucheur",     color: "#f0a059" },
    { id: "tech-montage",label: "Monteur",        color: "#f0a059" },
    { id: "tech-3d",     label: "3D",             color: "#f0a059" },
    { id: "tech-son",    label: "Son",            color: "#f0a059" },
    { id: "tech-compo",  label: "Compositeur",    color: "#f0a059" },
    { id: "tech-mua",    label: "MUA",            color: "#d066e0" },
    { id: "tech-stylist",label: "Stylist",        color: "#d066e0" },
  ],

  sports: [
    "Running","Trail","Fitness","Yoga","Dance","Natation","Cyclisme",
    "Football","Basketball","Tennis","Escalade","Surf","Ski","Snowboard",
    "Fashion/Posing","Triathlon","CrossFit","Boxe","Athlétisme","Skateboard","Parkour"
  ],

  agences: [
    { id: 1, nom: "KarinModels",  pays: "France",      ville: "Paris",     mail: "" },
    { id: 2, nom: "Her/Supreme",  pays: "France",      ville: "Paris",     mail: "" },
    { id: 3, nom: "genesismodel", pays: "Royaume-Uni", ville: "London",    mail: "" },
    { id: 4, nom: "immmodels",    pays: "France",      ville: "Paris",     mail: "" },
    { id: 5, nom: "Muse",         pays: "États-Unis",  ville: "New York",  mail: "" },
    { id: 6, nom: "TalomeAgency", pays: "États-Unis",  ville: "New York",  mail: "" },
    { id: 7, nom: "Colours",      pays: "Royaume-Uni", ville: "Glasgow",   mail: "info@coloursagency.com" },
    { id: 8, nom: "Select",       pays: "Royaume-Uni", ville: "London",    mail: "women@selectmodel.com" },
    { id: 9, nom: "Elite",        pays: "Royaume-Uni", ville: "London",    mail: "info@elitemodel.co.uk" },
  ],

  marques: [
    "MNSTRY","STYRKR","FAR","SATISFY","BANDIT","TRACKSMITH","DISTRICTVISION",
    "SOARRUNNING","NORDARUN","CIELATLETIQUE","CADENCE","CAYL","RAD",
    "MILERUNNUNG","NEAREARTH","BALMORSPORT","ERNIOLRUNNING","UNNAWORLD"
  ],

  talents: [
    { id:1,  nom:"TRAMINI",  prenom:"Palmyre",  sexe:"f", age:24, cats:["modele-f","athlete-f"], tel:"+33 7 70 19 36 81", mail:"palmyretramini@hotmail.fr", agence:"Her/Supreme", pays:"France",      ville:"Paris",    insta:"Palmyre",  sport:"Running",        photo:"", notes:"" },
    { id:2,  nom:"ARSAN",    prenom:"Charlie",  sexe:"f", age:"", cats:["modele-f"],              tel:"",                  mail:"",                          agence:"",             pays:"France",      ville:"Paris",    insta:"Charlie",  sport:"Fashion/Posing", photo:"", notes:"Site" },
    { id:3,  nom:"BRAY",     prenom:"Eden",     sexe:"f", age:21, cats:["modele-f","athlete-f"], tel:"",                  mail:"",                          agence:"immmodels",    pays:"France",      ville:"Paris",    insta:"Eden",     sport:"Running",        photo:"", notes:"" },
    { id:4,  nom:"LIPA",     prenom:"Sona",     sexe:"f", age:26, cats:["modele-f"],              tel:"",                  mail:"",                          agence:"",             pays:"Royaume-Uni", ville:"London",   insta:"Sona",     sport:"Dance",          photo:"", notes:"" },
    { id:5,  nom:"AKIYOSHI", prenom:"Umi",      sexe:"f", age:23, cats:["modele-f"],              tel:"",                  mail:"",                          agence:"Muse",         pays:"États-Unis",  ville:"New York", insta:"Umi",      sport:"Yoga",           photo:"", notes:"" },
    { id:6,  nom:"JUNG",     prenom:"Arianne",  sexe:"f", age:25, cats:["modele-f","athlete-f"], tel:"",                  mail:"",                          agence:"KarinModels",  pays:"France",      ville:"Paris",    insta:"Arianne",  sport:"Running",        photo:"", notes:"" },
    { id:7,  nom:"BECKO",    prenom:"Noah",     sexe:"h", age:27, cats:["modele-h"],              tel:"",                  mail:"",                          agence:"",             pays:"France",      ville:"Paris",    insta:"Noah",     sport:"Fashion/Posing", photo:"", notes:"" },
    { id:8,  nom:"NAAR",     prenom:"Karim",    sexe:"h", age:29, cats:["modele-h","athlete-h"], tel:"+33 6 06 79 72 80", mail:"",                          agence:"",             pays:"France",      ville:"Marseille",insta:"Karim",    sport:"Dance",          photo:"", notes:"" },
    { id:9,  nom:"DERRIEN",  prenom:"Jeremy",   sexe:"h", age:28, cats:["modele-h","athlete-h"], tel:"+33 6 89 08 17 86", mail:"m.jeremyderrien@gmail.com", agence:"",             pays:"France",      ville:"Paris",    insta:"Jeremy",   sport:"Running",        photo:"", notes:"" },
    { id:10, nom:"SANNI",    prenom:"Kolawole", sexe:"h", age:24, cats:["modele-h"],              tel:"",                  mail:"",                          agence:"",             pays:"France",      ville:"Lyon",     insta:"Kolawole", sport:"Fitness",        photo:"", notes:"" },
    { id:11, nom:"SALMON",   prenom:"Cesar",    sexe:"h", age:26, cats:["modele-h","athlete-h"], tel:"",                  mail:"",                          agence:"genesismodel", pays:"Royaume-Uni", ville:"London",   insta:"cez_sal",  sport:"Running",        photo:"", notes:"" },
  ],

  clubs: [
    { id:1,  nom:"BOLD",              pays:"Allemagne",   ville:"Berlin",     lien:"bold.run",         mail:"", notes:"" },
    { id:2,  nom:"MULCH SERIES",      pays:"États-Unis",  ville:"New York",   lien:"mulchseries",      mail:"", notes:"" },
    { id:3,  nom:"BEANS CLUB",        pays:"Royaume-Uni", ville:"London",     lien:"beansclub",        mail:"", notes:"" },
    { id:4,  nom:"GOOD VIBES CLUB",   pays:"États-Unis",  ville:"Los Angeles",lien:"goodvibesclub",    mail:"", notes:"" },
    { id:5,  nom:"BERLIN BRAVES",     pays:"Allemagne",   ville:"Berlin",     lien:"berlinbraves",     mail:"", notes:"" },
    { id:6,  nom:"RUNSMARTNOTHARD",   pays:"Allemagne",   ville:"Berlin",     lien:"runsmartnothard",  mail:"", notes:"" },
    { id:7,  nom:"CAPRICOLLECTIVE",   pays:"Espagne",     ville:"Barcelona",  lien:"capricollective",  mail:"", notes:"" },
    { id:8,  nom:"RUNDEMCREW",        pays:"Royaume-Uni", ville:"London",     lien:"rundemcrew",       mail:"", notes:"" },
    { id:9,  nom:"COLLISION RUNNING", pays:"France",      ville:"Paris",      lien:"collisionrunning", mail:"", notes:"" },
    { id:10, nom:"PECKHAM PACERS",    pays:"Royaume-Uni", ville:"London",     lien:"peckhampacers",    mail:"", notes:"" },
  ]
};
