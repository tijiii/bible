// ── DONNÉES INITIALES ────────────────────────────────────────────────────────
// Modifie ce fichier pour pré-charger tes données.
// Les ajouts faits dans l'app sont sauvegardés en localStorage et persistent.

const INITIAL_DATA = {
  talents: [
    { id: 1, nom: "TRAMINI",  prenom: "Palmyre",  sexe: "f", age: 24, tel: "+33 7 70 19 36 81", mail: "palmyretramini@hotmail.fr", agence: "Her/Supreme", pays: "France",       ville: "Paris",      insta: "Palmyre",  sport: "Running",       photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80", notes: "" },
    { id: 2, nom: "ARSAN",    prenom: "Charlie",   sexe: "f", age: "",  tel: "—",                 mail: "—",                        agence: "—",           pays: "France",       ville: "Paris",      insta: "Charlie",  sport: "Fashion/Posing", photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80", notes: "Site" },
    { id: 3, nom: "BRAY",     prenom: "Eden",      sexe: "f", age: 21,  tel: "—",                 mail: "—",                        agence: "immmodels",   pays: "France",       ville: "Paris",      insta: "Eden",     sport: "Running",       photo: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=400&q=80", notes: "" },
    { id: 4, nom: "LIPA",     prenom: "Sona",      sexe: "f", age: 26,  tel: "—",                 mail: "—",                        agence: "—",           pays: "Royaume-Uni",  ville: "London",     insta: "Sona",     sport: "Dance",         photo: "", notes: "" },
    { id: 5, nom: "AKIYOSHI", prenom: "Umi",       sexe: "f", age: 23,  tel: "—",                 mail: "—",                        agence: "Muse",        pays: "États-Unis",   ville: "New York",   insta: "Umi",      sport: "Yoga",          photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80", notes: "" },
    { id: 6, nom: "JUNG",     prenom: "Arianne",   sexe: "f", age: 25,  tel: "—",                 mail: "—",                        agence: "KarinModels", pays: "France",       ville: "Paris",      insta: "Arianne",  sport: "Running",       photo: "", notes: "" },
    { id: 7, nom: "BECKO",    prenom: "Noah",      sexe: "h", age: 27,  tel: "—",                 mail: "—",                        agence: "—",           pays: "France",       ville: "Paris",      insta: "Noah",     sport: "Fashion/Posing", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80", notes: "" },
    { id: 8, nom: "NAAR",     prenom: "Karim",     sexe: "h", age: 29,  tel: "+33 6 06 79 72 80", mail: "—",                        agence: "—",           pays: "France",       ville: "Marseille",  insta: "Karim",    sport: "Dance",         photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", notes: "" },
    { id: 9, nom: "DERRIEN",  prenom: "Jeremy",    sexe: "h", age: 28,  tel: "+33 6 89 08 17 86", mail: "m.jeremyderrien@gmail.com", agence: "—",           pays: "France",       ville: "Paris",      insta: "Jeremy",   sport: "Running",       photo: "", notes: "" },
    { id:10, nom: "SANNI",    prenom: "Kolawole",  sexe: "h", age: 24,  tel: "—",                 mail: "—",                        agence: "—",           pays: "France",       ville: "Lyon",       insta: "Kolawole", sport: "Fitness",       photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80", notes: "" },
    { id:11, nom: "SALMON",   prenom: "Cesar",     sexe: "h", age: 26,  tel: "—",                 mail: "—",                        agence: "genesismodel",pays: "Royaume-Uni",  ville: "London",     insta: "cez_sal",  sport: "Running",       photo: "", notes: "" },
    { id:12, nom: "CHIEF",    prenom: "Ohni",      sexe: "h", age: 30,  tel: "—",                 mail: "—",                        agence: "TalomeAgency",pays: "États-Unis",   ville: "New York",   insta: "Ohni",     sport: "Running",       photo: "", notes: "" },
  ],
  clubs: [
    { id: 1, nom: "BOLD",              pays: "Allemagne",   ville: "Berlin",    lien: "bold.run",         mail: "", notes: "" },
    { id: 2, nom: "MULCH SERIES",      pays: "États-Unis",  ville: "New York",  lien: "mulchseries",      mail: "", notes: "" },
    { id: 3, nom: "BEANS CLUB",        pays: "Royaume-Uni", ville: "London",    lien: "beansclub",        mail: "", notes: "" },
    { id: 4, nom: "GOOD VIBES CLUB",   pays: "États-Unis",  ville: "Los Angeles",lien: "goodvibesclub",   mail: "", notes: "" },
    { id: 5, nom: "BERLIN BRAVES",     pays: "Allemagne",   ville: "Berlin",    lien: "berlinbraves",     mail: "", notes: "" },
    { id: 6, nom: "RUNSMARTNOTHARD",   pays: "Allemagne",   ville: "Berlin",    lien: "runsmartnothard",  mail: "", notes: "" },
    { id: 7, nom: "CAPRICOLLECTIVE",   pays: "Espagne",     ville: "Barcelona", lien: "capricollective",  mail: "", notes: "" },
    { id: 8, nom: "RUNDEMCREW",        pays: "Royaume-Uni", ville: "London",    lien: "rundemcrew",       mail: "", notes: "" },
    { id: 9, nom: "COLLISION RUNNING", pays: "France",      ville: "Paris",     lien: "collisionrunning", mail: "", notes: "" },
    { id:10, nom: "PECKHAM PACERS",    pays: "Royaume-Uni", ville: "London",    lien: "peckhampacers",    mail: "", notes: "" },
    { id:11, nom: "RUNLIMITED",        pays: "Royaume-Uni", ville: "London",    lien: "runlimited",       mail: "", notes: "" },
  ],
  marques: [
    "MNSTRY","STYRKR","FAR","SATISFY","BANDIT","TRACKSMITH","DISTRICTVISION",
    "KUTADISTENCIEL","SOARRUNNING","NORDARUN","CIELATLETIQUE","CADENCE","CAYL","RAD",
    "MILERUNNUNG","NEAREARTH","BALMORSPORT","ERNIOLRUNNING","UNNAWORLD"
  ],
  agences: [
    { nom: "KarinModels",   pays: "France",       ville: "Paris",      mail: "" },
    { nom: "Her/Supreme",   pays: "France",       ville: "Paris",      mail: "" },
    { nom: "genesismodel",  pays: "Royaume-Uni",  ville: "London",     mail: "" },
    { nom: "immmodels",     pays: "France",       ville: "Paris",      mail: "" },
    { nom: "Muse",          pays: "États-Unis",   ville: "New York",   mail: "" },
    { nom: "TalomeAgency",  pays: "États-Unis",   ville: "New York",   mail: "" },
    { nom: "Colours",       pays: "Royaume-Uni",  ville: "Glasgow",    mail: "info@coloursagency.com" },
    { nom: "Select",        pays: "Royaume-Uni",  ville: "London",     mail: "women@selectmodel.com" },
    { nom: "ModelTeam",     pays: "Royaume-Uni",  ville: "Edinburgh",  mail: "models@modelteam.co.uk" },
    { nom: "Base",          pays: "Royaume-Uni",  ville: "London",     mail: "london@basemodels.co.uk" },
    { nom: "Elite",         pays: "Royaume-Uni",  ville: "London",     mail: "info@elitemodel.co.uk" },
  ],
  sports: [
    "Running","Trail","Fitness","Dance","Yoga","Natation","Cyclisme",
    "Football","Basketball","Tennis","Escalade","Surf","Ski","Fashion/Posing",
    "Triathlon","CrossFit","Boxe","Athlétisme","Skateboard","Parkour"
  ],
  agencesCustom: []
};
