# Architecture

Quatre couches, chacune ne dépend que de celles du dessous.

```
src/ui/        Écrans Preact. Affichent l'état, appellent state/.
src/state/     État global (signaux), connexion au stockage, fonction act().
src/domain/    Règles du jeu : fonctions pures, sans écran ni réseau. Testées.
src/data/      Chargement et validation des fichiers de data/.
src/store/     Stockage interchangeable (base Claude, navigateur, mémoire).
data/          Données de référence (JSON), modifiables sans toucher au code.
```

## Principes

1. **Les règles sont des données quand c'est possible.** Prix, seuils, tables de dés, kill teams : tout est dans `data/`. Les schémas de `src/data/schema.ts` refusent un fichier mal formé au build (`npm run data:check`), et `checkConsistency` vérifie les références croisées (un chef par kill team, actes sans trou, tables d'exploration existantes…).

2. **Le domaine est pur.** Chaque modification d'une bande passe par une fonction de `src/domain/actions.ts` : elle reçoit la bande et renvoie une copie modifiée ou une erreur lisible (`Outcome`), et écrit l'opération au journal. Rien n'est modifié en place, le hasard est injecté (`Rng`) : tout se teste sans navigateur.

3. **L'interface ne calcule rien.** Un écran lit les signaux de `state/app.ts` et appelle `act(band, action)`. `act` relit toujours la version la plus récente de la bande avant d'appliquer l'action, ce qui évite d'écraser une modification arrivée entre-temps.

4. **Le stockage est derrière une interface.** `Store` (dans `src/store/store.ts`) a cinq méthodes. `firebaseStore` parle à la base en ligne, `artifactStore` à la base partagée Claude, `localStore` au navigateur, `memoryStore` sert aux tests. Changer d'hébergement revient à écrire une implémentation de plus.

5. **Les documents sont versionnés.** Chaque bande et chaque partie porte `schemaVersion`. À la lecture, `src/domain/migrations.ts` fait monter les vieux documents version par version, puis le schéma Zod les valide. Un document illisible est signalé dans un bandeau et ignoré, jamais effacé. Il est réécrit au nouveau format à sa prochaine modification.

## Flux d'une action

```
clic → ui (RosterTab) → act(band, A.buyUpgrade)       state/app.ts
                         → A.buyUpgrade(ctx, latest)   domain/actions.ts  (contrôles, prix, journal)
                         → saveBand(nouvelleBande)     mise à jour de l'écran tout de suite
                         → store.saveBand(...)         base partagée
                         ← onSnapshot                  les autres joueurs reçoivent la mise à jour
```

## Trésorerie

Les soldes (RQ, Gloire, points bonus) ne sont jamais enregistrés ni saisis. `src/domain/treasury.ts` les calcule :

- **livre de comptes** de la bande (`band.transactions`) : dotation de départ, achats, ventes, butins, récompenses d'exploration, Gloire des rangs, renforts, corrections motivées ;
- **Gloire des exploits**, recalculée depuis les parties : supprimer ou corriger une partie met les comptes à jour sans rien réécrire dans la bande.

Une action qui coûte appelle `pay()` (refus si le solde ne suffit pas), une action qui rapporte appelle `credit()`. Le relevé de l'onglet « Trésorerie et journal » affiche les deux sources.

## Base partagée

En ligne (Firebase), chaque campagne est rangée sous `campaigns/{code}/` ; le code (12 caractères aléatoires) est dans le lien d'invitation (`#c=…`) et le navigateur le retient (`src/state/campaign.ts`). Les joueurs se connectent en anonyme : cela identifie le navigateur (« Ma bande ») sans créer de compte. `firestore.rules` n'autorise que les connexions anonymes établies, sur `bands` et `games` d'un code donné ; la liste des campagnes n'est pas consultable. Qui a le lien peut modifier la campagne.

Dans la campagne : deux collections, `bands/{id}` et `games/{id}`. Une bande est un seul document (registre, arsenal, journal inclus). Si deux joueurs modifient la même bande à la même seconde, la dernière écriture gagne. Chacun gérant sa propre bande, le risque est faible.

## Fiches techniques

`src/data/sheets.ts` charge les profils Kill Team avec l'appli et les fiches 40k à la demande (un fichier par catalogue, `fetch` relatif à la page). `src/domain/sheets.ts` choisit les armes selon `operative.loadout` (une option par groupe, la première par défaut) et retrouve la définition d'une règle d'arme (« Lethal 5+ » → « Lethal x+ »). `src/ui/components/Tip.tsx` affiche une seule infobulle à la fois, en position fixe, gardée dans l'écran.

## Tests

- `tests/domain.test.ts` : coûts, sélection de base de chaque kill team, contrôles du registre, seuil de renforts, points et classement, traumatismes, exploration, catalogue de recrutement.
- `tests/migrations.test.ts` : reprise des documents de la première version, documents illisibles, version future.
- `scripts/smoke.cjs` : parcours complet dans Chromium sur le fichier construit, y compris des données v1 et l'affichage mobile.
- `scripts/smoke-online.cjs` (`npm run smoke:online`) : deux joueurs sur la même campagne contre les émulateurs Firebase (création, invitation, mise à jour en direct, règles d'accès).
