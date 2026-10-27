# Journal des versions

## 2.2.0 — 27/10/2026

Appli web publique, sans compte Claude.

- Base en ligne Firebase : chaque campagne a un code secret, partagé par un lien d'invitation (bouton « Inviter »).
- Accueil pour rejoindre une campagne (lien ou code) ou en créer une ; le navigateur retient la campagne.
- Connexion anonyme : « Ma bande » reconnaît le navigateur, sans compte.
- Publication automatique sur GitHub Pages à chaque mise à jour.
- Test à deux joueurs contre les émulateurs Firebase (`npm run smoke:online`).

## 2.1.0 — 27/10/2026

Trésorerie automatique : plus aucune saisie des Réquisitions ni de la Gloire.

- Livre de comptes par bande : chaque achat, vente, butin, récompense et correction est un mouvement daté.
- Gloire des exploits créditée depuis les parties enregistrées (supprimer une partie la retire).
- Récompenses d'exploration appliquées : RQ, Gloire, équipements et reliques gratuits, XP des Élites, échange Gloire → points (Faveur du commandement).
- Rang Légendaire : +1 ☼ versé automatiquement.
- Renforts : les RQ sont vidées par un mouvement.
- Corrections exceptionnelles avec motif obligatoire, visibles dans le relevé.
- Onglet « Trésorerie et journal » avec relevé et solde après chaque mouvement.
- Format v3 : les soldes des versions précédentes sont repris en mouvement d'ouverture.

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
