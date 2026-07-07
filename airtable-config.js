// ── CONFIGURATION AIRTABLE ───────────────────────────────────────────────────
// Ces informations permettent au site de lire/écrire dans votre base Airtable
// partagée, pour que tous les membres de l'équipe voient les mêmes données.

const AIRTABLE_BASE_ID  = 'app1raCeBH8oqHbY9';
const AIRTABLE_TABLE_ID = 'tblT4pu9h0qaainyT';
const AIRTABLE_TOKEN    = 'patnQaTGz94V7HLta.df4792ab5262313f864f193f5ee3b580661b04d87d5299a7f287a4f9ce3d0c52';

// Intervalle de vérification des mises à jour des autres membres (ms)
const SYNC_POLL_INTERVAL = 8000;
