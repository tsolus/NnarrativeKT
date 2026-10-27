# Faire évoluer l'application

Après chaque modification : `npm run check`, puis pousser sur `main` : GitHub publie la nouvelle version (voir en bas).

## Ajuster un prix ou un seuil

Tout est dans `data/campaign.json` : prix des recrues (`recruit.base`, `leaderMultiplier`), agents, améliorations, équipements, chirurgie, seuils par acte (`acts`), points de victoire (`scoring`), traumatismes de troupe, diviseur du butin. L'écran Règles se met à jour tout seul.

## Ajouter une kill team

Dans `data/killteams.json`, ajouter une entrée :

```json
{
  "id": "kasrkin",
  "name": "Kasrkin",
  "faction": "Astra Militarum",
  "alliance": "Imperium",
  "selectionSize": 10,
  "selectionRule": "1 Sergeant + 9 opérateurs ; chacun une fois sauf Trooper.",
  "operatives": [
    { "name": "Sergeant", "max": 1, "pts40k": 12, "leader": true },
    { "name": "Trooper", "max": null, "pts40k": 12, "leader": false }
  ],
  "factionEquipment": ["…"]
}
```

- `max: null` = « plusieurs » ; c'est la fiche utilisée pour compléter la sélection de base.
- Options : `halfSelection` (compte pour ½), `noUpgrades` (drone, bête : ni amélioration ni promotion), `mandatory` (toujours dans la sélection), `keywords` (un seul opérateur par mot-clé dans la sélection de base, ex. `GRAVIS`), `notes`.
- La faction doit reprendre l'orthographe de `data/units-40k.json` pour que le filtre de recrutement la retrouve.

`npm run data:check` signale les oublis. Les tests vérifient que la sélection de base de chaque kill team est légale.

## Mettre à jour les points 40k

Remplacer `data/sources/points_40k.csv` (export BSData), puis `npm run data:units`.

## Modifier une table de dés

Fichiers de `data/rules/`. Les plages s'écrivent comme dans le livret : `"11"`, `"41-63"`, `"10+"`, `"7 ou moins"`. Pour les séquelles, `kind` dit ce que l'appli fait automatiquement : `dead`, `captured`, `missNextGame`, `robbed`, `gainXpD3`, `trait` (noté, sans cicatrice), `none`, `sequela` (noté, avec cicatrice). Un test vérifie que les 36 résultats du d66 sont couverts.

## Récompenses d'exploration et de rang

Dans `data/rules/exploration.json`, un lieu peut porter `rewards` : une liste de récompenses (s'il y en a plusieurs, le joueur en choisit une). Champs possibles, combinables :

```json
{ "label": "Le revendre (+3 RQ)", "rq": 3, "glory": 1,
  "equipment": { "type": "faction", "count": 1 },
  "relic": { "maxGlory": 3 },
  "xpFieldedElites": 1,
  "gloryToPoints": 5 }
```

`relic.maxGlory: null` = n'importe quelle relique. Un lieu sans `rewards` affiche seulement sa découverte, à appliquer à la main. La Gloire par exploit est dans `data/campaign.json` (`rewards.gloryPerExploit`), celle des rangs dans `data/rules/ranks.json` (`glory`).

## Fiches techniques

- `data/sheets/killteams.json` (profils Kill Team) et `public/sheets-40k/` (unités 40k, chargées à la demande) sont **générés** : ne pas les éditer. Cloner [BSData/wh40k-killteam](https://github.com/BSData/wh40k-killteam) et [BSData/wh40k-10e](https://github.com/BSData/wh40k-10e) à côté du projet, puis `npm run data:sheets`.
- Options d'armes : `data/sheets/loadouts-killteams.json`, recopiées des règles d'équipe officielles. Un groupe = un menu déroulant (ex. « Tir » et « Mêlée ») ; une option = une liste de noms d'armes (« Plasma pistol » couvre ses profils « (standard) » et « (supercharge) ») ; `fixed` = armes toujours portées.
- Écart entre BSData et une mise à jour officielle : ajouter une entrée dans `data/sheets/corrections-killteams.json`.
- Une nouvelle kill team dans `data/killteams.json` doit avoir sa fiche : `npm run data:check` le vérifie.

## Ajouter une règle ou une action

1. Écrire la fonction dans `src/domain/` (une action de bande va dans `actions.ts` et passe par `edit()`, qui gère la copie et le journal).
2. Ajouter un test dans `tests/domain.test.ts`.
3. L'appeler depuis l'écran avec `act(band, (c, b) => A.maFonction(c, b, …))`.

## Changer le format des données enregistrées

Un champ ajouté avec une valeur par défaut (ex. `loadout` des opérateurs) se lit sur les anciens documents sans migration. Pour tout autre changement :

1. Monter `SCHEMA_VERSION` dans `src/domain/model.ts` et modifier les schémas.
2. Ajouter dans `src/domain/migrations.ts` une étape de la version précédente vers la nouvelle (ne jamais modifier une étape existante).
3. Ajouter un test de migration avec un document à l'ancien format.

Les documents sont convertis à la lecture : aucune opération sur la base n'est nécessaire.

## Publier

Le workflow `.github/workflows/pages.yml` lance les tests, construit `dist/index.html` et le publie sur GitHub Pages à chaque push sur `main`. Les données ne bougent pas : elles sont dans Firebase.

Les règles d'accès `firestore.rules` se publient à la main dans la console Firebase (Firestore → Règles) quand elles changent ; `npm run smoke:online` les teste avant.
