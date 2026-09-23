# Contribuer à Araponga

## Prérequis

- Node.js ≥ 24
- Yarn (la version est figée par le champ `packageManager` du `package.json` ;
  `corepack enable` suffit à obtenir la bonne)

## Mise en route

```bash
yarn install
cp .env.example .env
yarn dev
```

## Avant d'ouvrir une pull request

Ces quatre commandes doivent passer — ce sont exactement celles de la CI :

```bash
yarn lint
yarn typecheck
yarn test
yarn test:e2e
```

Les navigateurs de Playwright s'installent une fois avec
`yarn playwright install chromium`.

## Conventions

- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Le message est en
  français.
- **Branches** : `main` est protégée, tout passe par une pull request.
- **Versionnage** : sémantique, publication sur tag `v*`.
- **Code** : Vue 3 en Composition API avec `<script setup lang="ts">`,
  TypeScript strict. Un handler Nitro orchestre et valide, la logique métier
  vit dans `server/services/` et reste testable sans requête HTTP.
- **Validation** : les schémas Valibot de `shared/schemas/` sont la seule
  source de vérité ; aucune règle de validation dupliquée ailleurs.
- **i18n** : aucune chaîne en dur dans un composant. `i18n/locales/fr.json` et
  `en.json` ont exactement les mêmes clés — un test unitaire échoue en cas de
  divergence.
- **Style** : Tailwind n'est présent que pour son reset ; les états visuels
  s'accrochent à des attributs `data-*` portés par le balisage.

## Sécurité

Une faille se signale en privé, pas dans une issue publique.
