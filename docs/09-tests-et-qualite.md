# Tests et qualité

## Une vraie suite de tests, avec Vitest

```json
"scripts": { "test": "vitest run", "test:watch": "vitest" },
"devDependencies": {
  "@vue/test-utils": "^2.4.0",
  "jsdom": "^25.0.0",
  "vitest": "^2.1.0"
}
```

`enervision-dashboard` est testé avec **Vitest** (cohérent avec Vite : même moteur de
transformation, aucune configuration séparée à maintenir entre le build et les tests),
**`@vue/test-utils`** pour monter les composants Vue et interagir avec eux, et **`jsdom`**
pour simuler un DOM en Node.js. `npm test` (= `vitest run`) tourne dans la CI à chaque
push.

## Ce que couvre `tests/`

| Fichier | Ce qu'il vérifie |
|---|---|
| `api/client.spec.js` | `resolveApiBaseUrl()` (ordre de priorité `window.APP_CONFIG` > `VITE_API_URL` > `/api-proxy`), injection du JWT, redirection sur 401. |
| `composables/useAuth.spec.js` | Connexion/déconnexion, persistance du token en `localStorage`. |
| `composables/useTheme.spec.js` | Bascule clair/sombre, persistance du choix. |
| `components/AlertList.spec.js` | Affichage des alertes, et **une couleur de badge distincte par sévérité** (voir plus bas). |
| `components/MeasuresChart.spec.js` | Le composant le plus testé (11 tests) : construction/patch du graphique, bornes d'axe, overlay "aucune donnée". |
| `components/Pagination.spec.js` | Navigation page/limite. |
| `components/SiteCard.spec.js` | Rendu d'une carte de site. |
| `views/LoginView.spec.js` | Formulaire de connexion. |
| `views/PredictionsView.spec.js` | Chargement mesures/prévisions, bornes du graphique, changement d'horizon/de site, et **le filtrage de la fenêtre de prévision** (voir plus bas). |
| `views/RecommendationsView.spec.js` | Chargement paginé des recommandations. |

## Deux régressions couvertes par des tests ajoutés depuis

Deux défauts signalés par un opérateur du dashboard ont été corrigés, et chacun a reçu
un test qui l'aurait détecté :

- **`AlertList.spec.js`** — *"distingue visuellement chaque sévérité par sa propre
  couleur de badge"*. Avant correction, `AlertList.vue` (utilisé pour les alertes
  récentes d'un site, voir [04-navigation-et-vues.md](04-navigation-et-vues.md)) ne
  distinguait que `critical` du reste : `high`, `medium` et `low` recevaient tous la
  même classe CSS, donc la même couleur — faible et moyenne étaient visuellement
  indiscernables. Le composant utilise désormais le même badge `badge--{severity}` que
  le reste de l'application (voir [05-composants-cles.md](05-composants-cles.md)), et le
  test vérifie explicitement que chaque sévérité porte sa propre classe.

- **`PredictionsView.spec.js`** — *"exclut les prévisions passées et celles au-delà de
  l'horizon sélectionné"*. `GET /api/v1/predictions` trie par `target_timestamp`
  croissant sur **tout** l'historique de prévisions du site, y compris des créneaux
  désormais passés (`latest_only` déduplique les runs successifs d'un même créneau, il
  ne retire pas les créneaux échus). Demander un `limit` égal à l'horizon choisi (ex. 6
  pour "6h") renvoyait donc les prévisions les plus **anciennes** jamais générées, pas
  les prochaines heures à venir — un utilisateur pouvait voir une prévision datée de la
  veille alors qu'il consultait le dashboard aujourd'hui. Le correctif récupère toujours
  un lot large et découpe côté client sur une fenêtre ancrée sur la dernière mesure
  connue (voir `horizonWindow()` dans
  [06-temps-reel-websocket.md](06-temps-reel-websocket.md) n'en parle pas — voir plutôt
  le composant lui-même, `src/views/PredictionsView.vue`) ; le test fournit des
  prévisions volontairement hors fenêtre (une passée, une trop lointaine) et vérifie
  qu'elles n'apparaissent pas dans la série tracée.

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
