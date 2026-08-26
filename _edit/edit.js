/* Écran d'édition des textes — injecté par _edit/serveur.js quand le site
   est servi en local sur http://localhost:4321. Jamais présent sur le site
   publié.

   Un bouton passe la page en mode édition : chaque bloc de texte devient
   modifiable en place. « Enregistrer » réécrit les fichiers HTML (via le
   serveur local), « Publier » fait le commit et le push — GitHub Pages
   redéploie le site. */
(function () {
  "use strict";

  var PAGE = location.pathname.replace(/^\//, "") || "index.html";
  var SELECTEURS = "h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, caption, " +
    "figcaption, blockquote, legend, label, a, span, strong, em, small, button";

  var etat = new Map(); /* élément -> { avantExt, avantInt, index } */
  var actif = false;
  var titreAvant = null; /* innerHTML du <title> au moment de l'activation */
  var rechargement = false; /* rechargement volontaire : pas d'avertissement */

  function echapper(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- Barre d'outils ---------- */

  var style = document.createElement("style");
  style.textContent =
    "#edit-barre { position: fixed; right: 16px; bottom: 16px; z-index: 9999;" +
    "  background: #101828; color: #e8eef7; border: 1px solid #33415c;" +
    "  border-radius: 12px; padding: 10px 12px; font: 13px/1.5 system-ui, sans-serif;" +
    "  box-shadow: 0 10px 30px rgba(0,0,0,.45); display: flex; flex-direction: column;" +
    "  gap: 8px; max-width: 330px; }" +
    "#edit-barre .eb-rang { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }" +
    "#edit-barre button { font: inherit; border: 1px solid #33415c; border-radius: 8px;" +
    "  background: #1b2740; color: #e8eef7; padding: 5px 10px; cursor: pointer; }" +
    "#edit-barre button:hover { background: #233252; }" +
    "#edit-barre button:disabled { opacity: .45; cursor: default; }" +
    "#edit-barre .eb-principal { background: #38bdf8; border-color: #38bdf8; color: #062033; font-weight: 600; }" +
    "#edit-barre .eb-principal:hover { background: #5fcbfa; }" +
    "#edit-barre .eb-statut { color: #9fb0c9; white-space: pre-line; max-height: 130px;" +
    "  overflow: auto; max-width: 300px; }" +
    "#edit-barre .eb-titre { display: none; flex-direction: column; gap: 3px; }" +
    "#edit-barre.eb-actif .eb-titre { display: flex; }" +
    "#edit-barre input { font: inherit; background: #0b1220; color: #e8eef7;" +
    "  border: 1px solid #33415c; border-radius: 8px; padding: 4px 8px; width: 100%; }" +
    "[data-edit] { outline: 1px dashed rgba(56,189,248,.5); outline-offset: 2px; cursor: text; }" +
    "[data-edit]:hover { outline-style: solid; }" +
    "[data-edit]:focus { outline: 2px solid #38bdf8; }";
  document.head.appendChild(style);

  var barre = document.createElement("aside");
  barre.id = "edit-barre";
  barre.innerHTML =
    '<div class="eb-rang">' +
    '  <button type="button" class="eb-principal" id="eb-basculer">Éditer les textes</button>' +
    '  <button type="button" id="eb-enregistrer" disabled>Enregistrer</button>' +
    '  <button type="button" id="eb-publier">Publier</button>' +
    "</div>" +
    '<label class="eb-titre">Titre de l’onglet' +
    '  <input type="text" id="eb-titre-champ"></label>' +
    '<div class="eb-statut" id="eb-statut">Écran d’édition — local uniquement.</div>';
  document.body.appendChild(barre);

  var btBasculer = document.getElementById("eb-basculer");
  var btEnregistrer = document.getElementById("eb-enregistrer");
  var btPublier = document.getElementById("eb-publier");
  var champTitre = document.getElementById("eb-titre-champ");
  var zoneStatut = document.getElementById("eb-statut");

  function statut(t) { zoneStatut.textContent = t; }

  /* ---------- Activation / désactivation ---------- */

  function activer() {
    var vus = Object.create(null);
    var candidats = document.querySelectorAll(SELECTEURS);
    candidats.forEach(function (el) {
      if (el.closest("#edit-barre")) return;
      if (el.closest("[data-edit]")) return;      /* déjà couvert par un parent */
      if (el.querySelector("img, svg")) return;   /* on descendra sur ses textes */
      if (!el.textContent.trim()) return;
      var ext = el.outerHTML;                     /* AVANT toute retouche */
      var index = vus[ext] || 0;
      vus[ext] = index + 1;
      etat.set(el, { avantExt: ext, avantInt: el.innerHTML, index: index });
      el.setAttribute("data-edit", "");
      el.setAttribute("contenteditable", "plaintext-only");
    });
    var titre = document.querySelector("title");
    titreAvant = titre ? titre.innerHTML : null;
    champTitre.value = document.title;
    actif = true;
    barre.classList.add("eb-actif");
    btBasculer.textContent = "Terminer";
    statut(etat.size + " blocs éditables. Cliquez un texte et modifiez-le.\n" +
      "Les liens sont désactivés pendant l’édition.");
    majCompteur();
  }

  function desactiver() {
    if (changements() > 0 &&
        !confirm("Abandonner les modifications non enregistrées ?")) return;
    sessionStorage.removeItem("edit-actif");
    if (changements() > 0) { rechargement = true; location.reload(); return; }
    etat.forEach(function (s, el) {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-edit");
    });
    etat.clear();
    titreAvant = null;
    actif = false;
    barre.classList.remove("eb-actif");
    btBasculer.textContent = "Éditer les textes";
    statut("Écran d’édition — local uniquement.");
    majCompteur();
  }

  /* ---------- Suivi des modifications ---------- */

  function titreModifie() {
    return titreAvant !== null && echapper(champTitre.value) !== titreAvant;
  }

  function changements() {
    var n = 0;
    etat.forEach(function (s, el) {
      if (el.innerHTML !== s.avantInt) n += 1;
    });
    if (titreModifie()) n += 1;
    return n;
  }

  function majCompteur() {
    var n = changements();
    btEnregistrer.disabled = n === 0;
    btEnregistrer.textContent = n === 0 ? "Enregistrer" : "Enregistrer (" + n + ")";
  }

  document.addEventListener("input", majCompteur);

  window.addEventListener("beforeunload", function (e) {
    if (!rechargement && actif && changements() > 0) e.preventDefault();
  });

  /* En mode édition : pas de navigation par les liens ni par les flèches
     du carrousel quand on écrit dans un bloc. */
  document.addEventListener("click", function (e) {
    if (actif && e.target.closest("a") && !e.target.closest("#edit-barre")) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (actif && e.target.isContentEditable &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.stopPropagation();
    }
  }, true);

  /* ---------- Appels au serveur ---------- */

  function api(chemin, corps, cb) {
    fetch(chemin, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Edit": "1" },
      body: JSON.stringify(corps)
    }).then(function (r) { return r.json(); })
      .then(cb)
      .catch(function (err) { statut("Erreur : " + err + "\nLe serveur tourne-t-il ?"); });
  }

  function enregistrer() {
    var edits = [];
    etat.forEach(function (s, el) {
      if (el.innerHTML !== s.avantInt) {
        edits.push({ avantExt: s.avantExt, avantInt: s.avantInt,
          apresInt: el.innerHTML, index: s.index });
      }
    });
    if (titreModifie()) {
      var titre = document.querySelector("title");
      edits.push({ avantExt: titre.outerHTML, avantInt: titreAvant,
        apresInt: echapper(champTitre.value), index: 0 });
    }
    if (edits.length === 0) { statut("Aucun texte modifié."); return; }
    statut("Enregistrement…");
    api("/api/save", { page: PAGE, edits: edits }, function (r) {
      if (r.echecs && r.echecs.length) {
        alert("Blocs non enregistrés (la page va se recharger) :\n\n" +
          r.echecs.join("\n"));
      }
      sessionStorage.setItem("edit-actif", "1");
      rechargement = true;
      location.reload();
    });
  }

  function publier() {
    if (actif && changements() > 0) {
      statut("Enregistrez d’abord vos modifications.");
      return;
    }
    var message = prompt("Message du commit :",
      "Textes ajustés depuis l’écran d’édition");
    if (message === null) return;
    statut("Publication…");
    api("/api/publish", { message: message }, function (r) {
      statut(r.sortie || (r.ok ? "Publié." : "Échec de la publication."));
    });
  }

  btBasculer.addEventListener("click", function () {
    if (actif) { desactiver(); } else { activer(); }
  });
  btEnregistrer.addEventListener("click", enregistrer);
  btPublier.addEventListener("click", publier);

  /* Après un enregistrement, la page se recharge : on reprend l'édition. */
  if (sessionStorage.getItem("edit-actif") === "1") {
    sessionStorage.removeItem("edit-actif");
    activer();
    statut("Enregistré. L’édition continue sur la version à jour.");
  }
})();
