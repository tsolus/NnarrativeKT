# Kill Team · Campagne

Application de gestion d'une campagne narrative Kill Team, avec une phase de campagne inspirée de Trench Crusade : bandes, recrutement (toutes armées), améliorations, seuil de renforts, parties, classement, traumatismes, honneurs et exploration.

L'application est une seule page HTML publiée comme page Claude. Elle utilise la base partagée de la page, donc tous les joueurs à qui elle est partagée voient les mêmes bandes en direct. Ouverte hors de claude.ai, elle garde ses données dans le navigateur (mode local).

## Démarrer

```bash
npm install
npm run dev        # serveur de développement (mode local)
npm run check      # types + tests + build + test navigateur
```

Le build produit `dist/index.html`, un fichier autonome à publier.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Développement avec rechargement à chaud |
| `npm test` | Tests unitaires (règles, migrations) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run data:check` | Valide les fichiers de `data/` |
| `npm run data:units` | Régénère `data/units-40k.json` depuis le CSV BSData |
| `npm run build` | Valide les données, vérifie les types, construit `dist/index.html` |
| `npm run smoke` | Parcours complet dans Chromium (Playwright requis) |

## Où modifier quoi

| Je veux… | Fichier |
| --- | --- |
| Changer un prix, un seuil, les points de victoire | `data/campaign.json` |
| Ajouter ou corriger une kill team | `data/killteams.json` |
| Modifier une table (séquelles, honneurs, exploration, reliques…) | `data/rules/*.json` |
| Changer une règle de calcul | `src/domain/` (+ un test dans `tests/`) |
| Changer un écran | `src/ui/` |

Le détail est dans [docs/EVOLUTIONS.md](docs/EVOLUTIONS.md), l'organisation du code dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Sources

- Règles de campagne : livret « Kill Team – Campagne narrative » (adaptation de la phase de campagne de Trench Crusade).
- Fiches des kill teams : règles d'équipe Games Workshop.
- Points Warhammer 40k par figurine : jeu de données communautaire [BSData wh40k-10e](https://github.com/BSData/wh40k-10e).
