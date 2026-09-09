# Tests et qualité

## Outillage en place

```json
"scripts": { "test": "vitest run", "test:watch": "vitest" },
"devDependencies": {
  "@vue/test-utils": "^2.4.0",
  "jsdom": "^25.0.0",
  "vitest": "^2.1.0"
}
```

`enervision-dashboard` est équipé pour tester ses composants Vue :

- **Vitest** comme lanceur de tests — cohérent avec Vite (même moteur de transformation,
  pas de configuration séparée à maintenir entre le build et les tests).
- **`jsdom`** simule un DOM en Node.js, nécessaire pour monter un composant Vue hors
  navigateur.
- **`@vue/test-utils`** est la bibliothèque officielle pour monter et interagir avec des
  composants Vue en test (`mount()`, déclenchement d'événements, assertions sur le DOM
  rendu).

À date, ce dossier ne contient pas encore de suite de tests écrite : l'outillage est
posé et prêt à l'emploi (`npm test` fonctionne dès qu'un fichier `*.test.js` existe),
mais la couverture reste à construire. C'est un point à mentionner tel quel plutôt qu'à
maquiller — contrairement à `enervision-api`, dont
[09-tests-et-qualite.md](../../enervision-api/docs/09-tests-et-qualite.md) documente une
suite `pytest` déjà en place.

## Ce qui vaudrait le plus la peine d'être testé en premier

Par ordre de valeur probable, si une suite de tests devait être amorcée :

- **`useLiveSocket`** (voir [06-temps-reel-websocket.md](06-temps-reel-websocket.md)) :
  la logique de backoff exponentiel et de pause sur `visibilitychange` est pure logique
  JS, testable sans monter de composant, avec un `WebSocket` simulé.
- **`MeasuresChart.shapeKey()`** et la distinction reconstruction/patch (voir
  [05-composants-cles.md](05-composants-cles.md)) : un test qui vérifie qu'un changement
  de `rangeKey` force bien un rebuild, et qu'une simple extension de `series` ne fait
  qu'un patch, protégerait contre une régression de performance silencieuse (un
  graphique qui se remettrait à clignoter à chaque mesure temps réel).
- **La garde de route** (`router/index.js`, voir
  [03-authentification.md](03-authentification.md)) : vérifier qu'une route non publique
  redirige bien vers `/login` avec le bon paramètre `redirect` en l'absence de token.
- **`resolveApiBaseUrl()`** (voir
  [07-configuration-et-build.md](07-configuration-et-build.md)) : vérifier l'ordre de
  priorité `window.APP_CONFIG` > `VITE_API_URL` > `/api-proxy` avec différentes
  combinaisons de globals/env simulées.

## Absence de linter configuré

Aucun fichier de configuration ESLint/Prettier n'est présent dans ce dépôt à ce jour —
la cohérence de style repose pour l'instant sur la relecture humaine plutôt que sur un
outil automatisé en CI, contrairement à `enervision-api` (`ruff` + `mypy`, voir la doc
API). C'est un axe d'amélioration possible du projet, pas un choix documenté.

## Suite

Ce fichier clôt la documentation `docs/` d'`enervision-dashboard`. Voir le
[README.md](README.md) du dossier pour la vue d'ensemble, et le
[README.md](../README.md) à la racine du dépôt pour le résumé destiné à un premier
contact avec le projet.
