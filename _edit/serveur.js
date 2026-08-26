/* Écran d'édition local du site — jamais publié (dossier préfixé d'un
   underscore, que GitHub Pages/Jekyll exclut).

   Lancement :  node _edit/serveur.js   puis   http://localhost:4321

   Le serveur sert le site tel quel en injectant _edit/edit.js dans chaque
   page HTML, et expose deux points d'entrée :
     POST /api/save     réécrit dans le fichier HTML les textes modifiés
     POST /api/publish  git add + commit + push (= déploiement GitHub Pages)

   Privé par construction : il n'écoute que sur 127.0.0.1, refuse tout
   autre en-tête Host, et exige l'en-tête X-Edit posé par edit.js. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const RACINE = path.normalize(path.join(__dirname, ".."));
const PORT = 4321;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

/* Seules les pages HTML à la racine du site sont éditables. */
function pagesEditables() {
  return fs.readdirSync(RACINE).filter(function (f) {
    return /^[\w-]+\.html$/.test(f);
  });
}

/* ---------- Remplacement fidèle dans le fichier ----------
   L'éditeur envoie, pour chaque bloc modifié, le HTML d'origine tel que le
   navigateur le sérialise. Le fichier peut écrire certains caractères
   autrement (entités &#8201;…) : le motif de recherche tolère ces
   variantes, et la réécriture ne touche qu'à l'intérieur de la balise,
   jamais à la balise elle-même. \u2009 = espace fine, \u200a = ultrafine,
   \u00a0 = insécable. */

function motifTolerant(s) {
  let m = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  m = m.replace(/&nbsp;/g, "(?:&nbsp;|&#160;|\u00a0)");
  m = m.replace(/\u2009/g, "(?:\u2009|&#8201;|&thinsp;)");
  m = m.replace(/\u200a/g, "(?:\u200a|&#8202;|&hairsp;)");
  return m;
}

function occurrences(texte, motif) {
  const re = new RegExp(motif, "g");
  const liste = [];
  let m;
  while ((m = re.exec(texte)) !== null) {
    liste.push({ debut: m.index, fin: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return liste;
}

/* Style « fichier » pour le nouveau texte : on garde les entités que le
   site écrit à la main. */
function versFichier(s) {
  return s.replace(/\u2009/g, "&#8201;").replace(/\u200a/g, "&#8202;");
}

function appliquer(page, edits) {
  const chemin = path.join(RACINE, page);
  const brut = fs.readFileSync(chemin, "utf8");
  const crlf = brut.includes("\r\n");
  let texte = crlf ? brut.replace(/\r\n/g, "\n") : brut;
  const echecs = [];
  let appliques = 0;

  /* Pour des blocs identiques édités en même temps, on remplace du dernier
     vers le premier : les positions des occurrences précédentes restent
     valables. */
  const tri = edits.slice().sort(function (a, b) {
    if (a.avantExt === b.avantExt) return b.index - a.index;
    return a.avantExt < b.avantExt ? -1 : 1;
  });

  tri.forEach(function (e) {
    const trouve = occurrences(texte, motifTolerant(String(e.avantExt)));
    const occ = trouve[e.index];
    if (!occ) {
      echecs.push("Bloc introuvable dans " + page + " : « " +
        String(e.avantInt).replace(/<[^>]*>/g, "").slice(0, 60) + "… »");
      return;
    }
    const region = texte.slice(occ.debut, occ.fin);
    const finBaliseOuvrante = region.indexOf(">") + 1;
    const debutBaliseFermante = region.lastIndexOf("</");
    if (finBaliseOuvrante <= 0 || debutBaliseFermante < finBaliseOuvrante) {
      echecs.push("Bloc illisible dans " + page);
      return;
    }
    const remplacement =
      region.slice(0, finBaliseOuvrante) +
      versFichier(String(e.apresInt)) +
      region.slice(debutBaliseFermante);
    texte = texte.slice(0, occ.debut) + remplacement + texte.slice(occ.fin);
    appliques += 1;
  });

  if (appliques > 0) {
    fs.writeFileSync(chemin, crlf ? texte.replace(/\n/g, "\r\n") : texte, "utf8");
  }
  return { ok: echecs.length === 0, appliques: appliques, echecs: echecs };
}

/* ---------- Publication : commit + push ---------- */

function git(args, cb) {
  execFile("git", args, { cwd: RACINE }, function (err, stdout, stderr) {
    cb(err, String(stdout) + String(stderr));
  });
}

function publier(message, cb) {
  const pages = pagesEditables();
  git(["add", "--"].concat(pages), function (err, sortie) {
    if (err) return cb({ ok: false, sortie: sortie });
    git(["diff", "--cached", "--quiet"], function (errDiff) {
      if (!errDiff) return cb({ ok: false, sortie: "Rien à publier : aucun texte ne diffère de la dernière version." });
      git(["commit", "-m", message], function (errCommit, sortieCommit) {
        if (errCommit) return cb({ ok: false, sortie: sortieCommit });
        git(["push"], function (errPush, sortiePush) {
          cb({
            ok: !errPush,
            sortie: sortieCommit + sortiePush +
              (errPush ? "" : "\nPublié : GitHub Pages met le site à jour d'ici une à deux minutes.")
          });
        });
      });
    });
  });
}

/* ---------- Serveur ---------- */

function repondreJson(res, code, objet) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(objet));
}

function lireCorps(req, cb) {
  let corps = "";
  req.on("data", function (c) {
    corps += c;
    if (corps.length > 5e6) req.destroy();
  });
  req.on("end", function () { cb(corps); });
}

const serveur = http.createServer(function (req, res) {
  const hote = String(req.headers.host || "").split(":")[0];
  if (hote !== "localhost" && hote !== "127.0.0.1") {
    res.writeHead(403);
    return res.end();
  }

  if (req.method === "POST") {
    if (req.headers["x-edit"] !== "1") return repondreJson(res, 403, { ok: false });
    return lireCorps(req, function (corps) {
      let donnees;
      try {
        donnees = JSON.parse(corps);
      } catch (e) {
        return repondreJson(res, 400, { ok: false, echecs: ["Requête illisible."] });
      }
      if (req.url === "/api/save") {
        const page = String(donnees.page || "");
        if (!/^[\w-]+\.html$/.test(page) || !fs.existsSync(path.join(RACINE, page))) {
          return repondreJson(res, 400, { ok: false, echecs: ["Page inconnue."] });
        }
        try {
          return repondreJson(res, 200, appliquer(page, donnees.edits || []));
        } catch (e) {
          return repondreJson(res, 500, { ok: false, echecs: [String(e)] });
        }
      }
      if (req.url === "/api/publish") {
        const message = String(donnees.message || "").trim() ||
          "Textes ajustés depuis l'écran d'édition";
        return publier(message, function (resultat) {
          repondreJson(res, 200, resultat);
        });
      }
      repondreJson(res, 404, { ok: false });
    });
  }

  /* Fichiers statiques, avec injection de l'éditeur dans les pages. */
  let chemin = decodeURIComponent(req.url.split("?")[0]);
  if (chemin === "/") chemin = "/index.html";
  const cible = path.normalize(path.join(RACINE, chemin));
  if (!cible.startsWith(RACINE) || cible.includes("..")) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(cible, function (err, contenu) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Introuvable : " + chemin);
    }
    const ext = path.extname(cible).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (ext === ".html" && path.dirname(cible) === RACINE) {
      return res.end(String(contenu).replace(
        "</body>",
        '<script src="/_edit/edit.js"></script>\n</body>'
      ));
    }
    res.end(contenu);
  });
});

serveur.listen(PORT, "127.0.0.1", function () {
  console.log("Écran d'édition : http://localhost:" + PORT);
  console.log("Pages éditables : " + pagesEditables().join(", "));
});
