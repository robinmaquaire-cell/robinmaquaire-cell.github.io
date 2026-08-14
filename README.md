# Site personnel de Robin Maquaire

Site vitrine à cinq facettes, écrit à la main en HTML, CSS et JavaScript standard —
aucun framework, aucune étape de compilation, aucune dépendance appelée à distance.

| Facette | Page | Sujet |
|---|---|---|
| **Data** | `index.html` | Ingénieur et business analyst : reporting opérationnel sous SAP, Power BI et Qlik Sense |
| **Kayak** | `kayak.html` | Moniteur kayak : packraft en rivière, kayak-polo, chasse à l'apéro |
| **Partant ?** | `partant.html` | Projet : web app d'organisation de sorties entre amis ([partants.app](https://partants.app)) |
| **Camina** | `camina.html` | Projet : carnets de voyage illustrés posés sur une carte ([caminada.cleverapps.io](https://caminada.cleverapps.io)) |
| **DIDA** | `dida.html` | Cadre de pensée : Données → Information → Décision → Action |

## Navigation

Le bandeau affiche **les cinq vignettes en permanence** : la facette courante en grand,
cernée de l'accent de son thème, les quatre autres en retrait jusqu'au survol. Toute
facette est donc à un clic de n'importe quelle autre. Deux raccourcis s'y ajoutent, de
proche en proche le long du cycle **Data → Kayak → Partant ? → Camina → DIDA → Data** :

- les flèches ← et → du clavier ;
- un glissement horizontal du doigt, sur mobile.

Les vignettes sont de simples liens `<a>` : la navigation fonctionne sans JavaScript.
`js/carousel.js` ne porte que le clavier et le tactile. Pour ajouter une facette, il
faut toucher à quatre endroits : la nouvelle page, le tableau `cycle` du script, le
bandeau des quatre autres pages, et le pied de page.

L'alignement des vignettes se fait par le bas (`align-items: flex-end`), pour que les
libellés restent sur une même ligne malgré la hauteur plus grande de la courante.

## Structure

```
index.html, kayak.html, partant.html, camina.html, dida.html
css/common.css      structure et composants partagés
css/<facette>.css   un thème par facette : couleurs, polices, héros
js/carousel.js      clavier et glissement tactile
assets/             vignettes du carrousel (SVG)
```

Chaque thème ne définit que des variables CSS (`--bg`, `--accent`, `--text`…) que
`common.css` consomme : les cinq univers visuels restent complètement dissociés sans
dupliquer la moindre règle de mise en page.

## Développement

Site statique : n'importe quel serveur HTTP suffit.

```bash
npx --yes serve .
```

## Déploiement

Publié par GitHub Pages depuis la branche `main`, à la racine du dépôt.
