# Carte des vins — moteur de recherche interne

App de recherche de la carte des vins du restaurant, sur le même modèle que `monarque-alcool`.
512 vins avec fiche de dégustation complète, installable sur iPad (PWA), fonctionne hors ligne.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | interface (structure + styles) |
| `app.js` | moteur de recherche et rendu |
| `data.js` | **les 512 vins** (généré depuis l'Excel) |
| `vins.json` | mêmes données en JSON, si jamais utile ailleurs |
| `build_data.py` | script d'extraction Excel → `data.js` |
| `fiches/lot*.json` | les 512 fiches de dégustation (nez, bouche, finale, accords, service) |
| `merge_fiches.py` | injecte les fiches dans `vins.json` et `data.js` |
| `manifest.webmanifest`, `sw.js`, `icons/` | installation iPad + hors ligne |

## Publier sur GitHub Pages

1. Sur github.com (compte `anthonyberg9-commits`) → **New repository** → nom `monarque-vin` → Public → Create.
2. **Add file → Upload files** → glisser tous les fichiers **et le dossier `icons`** → Commit.
3. **Settings → Pages** → Source : `Deploy from a branch` → Branch : `main` / `/ (root)` → Save.
4. Après ~1 minute : `https://anthonyberg9-commits.github.io/monarque-vin/`

## Installer sur iPad

Ouvrir l'adresse dans Safari → bouton Partager → **Sur l'écran d'accueil**.
L'app s'ouvre ensuite en plein écran et fonctionne sans réseau.

## Comment chercher

La barre de recherche comprend le langage courant, en une seule ligne :

- **cépage / producteur / appellation** : `chenin`, `nebbiolo`, `selosse`, `sancerre`
- **prix** : `sous 100`, `moins de 80`, `entre 60 et 90`, `rouge 150 $` (± 20 %)
- **verre** : `bulles au verre`, ou le bouton *Au verre*
- **millésime** : `chablis 2020`
- **style** : `nature`, `bio`, `magnum`, `demi-sec`, `fût`, `amphore`
- **agence ou code SAQ** : `rézin`, `maitre de chai`, `15431399`
- **accord mets-vins** : `huîtres`, `ris de veau`, `morilles`, `agneau`, `truffe` — la recherche
  fouille aussi les fiches de dégustation, ce qui en fait un outil de suggestion en salle

Les filtres (couleur, pays, région, tri) se combinent avec la recherche.
Toucher une fiche affiche les notes techniques, l'agence et le code SAQ.

## Mettre à jour la carte

Quand l'Excel change, il suffit de régénérer les données :

```bash
pip install openpyxl
python3 build_data.py "Vin Monarque OG.xlsx"
```

Le script réécrit `vins.json` **et** `data.js`. Si des fiches existent, relancer ensuite :

```bash
python3 merge_fiches.py
```

Pour corriger une fiche, éditer le bon `fiches/lotXX.json` (repérer le vin par son `id`)
puis relancer `merge_fiches.py`.

⚠️ Les fiches de dégustation ont été rédigées à partir du producteur, de l'appellation,
du millésime, des cépages et de l'élevage — **ce ne sont pas des notes de dégustation
des bouteilles elles-mêmes**. À valider et corriger au fil des dégustations.

Puis remplacer `data.js` dans le dépôt et incrémenter `CACHE` dans `sw.js`
(`carte-vins-v1` → `v2`) pour que les iPads récupèrent la nouvelle version.

## Structure attendue de l'Excel

Le script se fie à la mise en forme du fichier d'origine :

- colonne A : code SAQ · B : libellé du vin · C : cépages et notes · D : agence ·
  E : prix formule · F : **prix carte** (bouteille, ou prix du verre dans la section *Vins au verre*)
- les titres de section sont reconnus par la taille de police en colonne B :
  **24 pt** = catégorie (Vin rouge), **18 pt** = région, **14 pt** = sous-région.

Les colonnes de **coût et de prix formule ne sont pas publiées** dans l'app : le site
est public sur GitHub Pages, seules les informations utiles en service s'y trouvent
(prix carte, agence, code SAQ).
