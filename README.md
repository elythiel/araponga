# Araponga

Soundboard web auto-hébergée : une grille de sons qui se déclenchent au clic ou
au raccourci clavier, installable comme application et utilisable hors ligne.

> **État du projet** : en construction. Le socle technique est posé, les
> fonctionnalités arrivent progressivement.

## Démarrage

```bash
yarn install
cp .env.example .env
yarn dev
```

L'application est servie sur <http://localhost:3000>.

## Commandes

| Commande | Effet |
| --- | --- |
| `yarn dev` | Serveur de développement |
| `yarn build` | Build de production |
| `yarn lint` | ESLint |
| `yarn typecheck` | `vue-tsc --noEmit` via `nuxt typecheck` |
| `yarn test` | Tests unitaires (Vitest) |
| `yarn test:e2e` | Tests de bout en bout (Playwright) |

## Pile

Nuxt 4 (SSR + Nitro), TypeScript strict, Tailwind CSS 4, Drizzle sur SQLite,
Valibot, Vitest, Playwright, Yarn. Un seul projet, un seul conteneur, un seul
volume.

## Contribuer

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

[MIT](./LICENSE)
