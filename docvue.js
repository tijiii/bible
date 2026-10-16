// ── DOCUMENT À IMPRIMER (export des lieux, travel sheets) ────────────────────
// Le document s'affiche dans la page du site, à la place du site, avec un bouton
// RETOUR. Avant, il s'ouvrait dans un nouvel onglet : dans l'appli installée sur
// téléphone, cet onglet ne se refermait pas et il fallait quitter l'appli.
let docVue = null;

function ouvrirDocument(html) {
  const dejaOuvert = !!docVue;
  fermerDocument(true);
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('.barre, .ex-barre, script').forEach(e => e.remove());
  // Les styles du document ne vivent que le temps de son affichage
  const styles = [...d.head.querySelectorAll('style, link[rel="stylesheet"]')].map(e => {
    const n = document.importNode(e, true);
    n.setAttribute('data-doc-vue', '');
    document.head.appendChild(n);
    return n;
  });
  const vue = document.createElement('div');
  vue.id = 'doc-vue';
  vue.innerHTML = `<div class="doc-vue-barre">
      <button type="button" class="doc-vue-retour" onclick="fermerDocument()">← RETOUR</button>
      <span class="doc-vue-txt">Vérifie le document puis</span>
      <button type="button" onclick="imprimerDocument()"><span class="doc-vue-long">IMPRIMER / </span>ENREGISTRER EN PDF</button>
    </div>${d.body.innerHTML}`;
  document.body.appendChild(vue);
  docVue = { vue, styles, titre: document.title, scroll: window.scrollY };
  if (d.title) document.title = d.title; // nom proposé pour le PDF
  // Le bouton retour du téléphone (ou le geste retour) referme le document
  if (!dejaOuvert) history.pushState({ docVue: true }, '');
  document.body.classList.add('doc-vue-ouvert');
  window.scrollTo(0, 0);
  return vue;
}

function fermerDocument(sansHistorique) {
  if (!docVue) return;
  const { vue, styles, titre, scroll } = docVue;
  docVue = null;
  vue.remove();
  styles.forEach(s => s.remove());
  document.title = titre;
  document.body.classList.remove('doc-vue-ouvert');
  window.scrollTo(0, scroll);
  docVueRetour = scroll;
  if (!sansHistorique && history.state && history.state.docVue) history.back();
}

// Après le retour, le navigateur peut remettre la page en haut : on revient où on était
let docVueRetour = null;
window.addEventListener('popstate', () => {
  if (docVue) fermerDocument(true);
  if (docVueRetour !== null) { window.scrollTo(0, docVueRetour); docVueRetour = null; }
});

// On attend les images (photos, cartes, logos) et les polices avant d'imprimer
async function imprimerDocument() {
  if (!docVue) return;
  const imgs = [...docVue.vue.querySelectorAll('img')].filter(i => !i.complete);
  await Promise.race([
    Promise.all(imgs.map(i => new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); }))),
    new Promise(r => setTimeout(r, 10000)),
  ]);
  try { await document.fonts.ready; } catch {}
  if (docVue) window.print();
}
