/* Barre de facettes : les cinq vignettes sont toutes affichées dans le header
   et s'atteignent d'un clic, par de simples liens <a> (donc sans JS).
   Ce script n'ajoute que les raccourcis de proche en proche — flèches du
   clavier et glissement tactile — le long du cycle
   Data -> Kayak -> Partant ? -> Camina -> DIDA -> Data. */
(function () {
  "use strict";

  var pages = {
    data: "index.html",
    kayak: "kayak.html",
    partant: "partant.html",
    camina: "camina.html",
    dida: "dida.html"
  };
  var cycle = ["data", "kayak", "partant", "camina", "dida"];
  var n = cycle.length;

  var current = document.body.dataset.facet;
  var i = cycle.indexOf(current);
  if (i === -1) return;

  var prev = cycle[(i + n - 1) % n];
  var next = cycle[(i + 1) % n];

  function go(facet) {
    window.location.href = pages[facet];
  }

  // Flèches gauche/droite du clavier (sans modificateur, hors champs de saisie)
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowLeft") go(prev);
    if (e.key === "ArrowRight") go(next);
  });

  // Glissement tactile horizontal franc, n'importe où sur la page
  var x0 = null;
  var y0 = null;

  document.addEventListener(
    "touchstart",
    function (e) {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      // Seuil volontairement strict pour ne pas gêner le défilement vertical
      if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) {
        if (dx > 0) {
          go(prev);
        } else {
          go(next);
        }
      }
    },
    { passive: true }
  );
})();
