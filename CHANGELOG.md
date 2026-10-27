# Journal des versions

## 2.0.0 — 27/10/2026

Réécriture en projet maintenable, mêmes fonctions que la 1.0.

- Code TypeScript découpé en couches : données, règles, stockage, état, écrans (Preact).
- Données de référence dans `data/` (kill teams, unités 40k, tables, paramètres de campagne), validées au build.
- Règles de campagne en fonctions pures, couvertes par des tests.
- Documents versionnés avec migration automatique depuis la 1.0.
- Documents illisibles signalés au lieu de bloquer l'application.
- Les actions s'appliquent toujours à la version la plus récente d'une bande.

## 1.0.0 — 26/10/2026

Première webapp : bandes avec sélection de base préremplie, recrutement parmi toutes les fiches et unités 40k avec filtre de faction, améliorations, seuil de renforts, parties, classement, phase de campagne.
