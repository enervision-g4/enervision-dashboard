# enervision-dashboard

Interface web (Vue 3 + Vite) du projet EnerVision : affiche les sites, leurs mesures,
les alertes, les prévisions et les recommandations exposés par `enervision-api`, avec
mise à jour en quasi-temps réel via WebSocket. Authentification par token JWT (`POST
/auth/login` sur l'API).

📖 **Documentation complète : [`docs/`](docs/README.md)** — architecture, authentification,
navigation, composants (dont le graphique `MeasuresChart`), temps réel côté client,
configuration/build, déploiement, tests. Ce README ne donne que les points essentiels
pour démarrer ; `docs/` explique le *pourquoi* derrière chaque choix.

## Lancer en local

Prérequis : `enervision-api` doit tourner sur `http://localhost:3000` (voir
[son README](../enervision-api/README.md)), lui-même connecté à une instance
TimescaleDB locale.

```bash
npm install
cp .env.example .env   # VITE_API_URL, par défaut http://localhost:3000
npm run dev
```

L'app est servie sur `http://localhost:5173`. En dev, `vite.config.js`
proxifie aussi `/api-proxy/*` vers l'API pour éviter les soucis de CORS
si vous préférez ne pas renseigner `VITE_API_URL`. Détail des deux options et
de leur ordre de priorité : [docs/07-configuration-et-build.md](docs/07-configuration-et-build.md).

## Développement

```bash
npm run test        # vitest run
npm run test:watch  # vitest en mode watch
```

État actuel de la couverture de test et pistes prioritaires :
[docs/09-tests-et-qualite.md](docs/09-tests-et-qualite.md).

## Structure

```
src/
├── main.js                 # bootstrap Vue + Pinia + router + i18n
├── App.vue                 # layout conditionnel (sidebar/topbar une fois authentifié)
├── router/index.js         # routes + garde d'authentification
├── api/
│   ├── client.js            # instance axios : résout l'URL API, injecte le JWT
│   ├── auth.js               # POST /auth/login
│   └── sites.js, readings.js, alerts.js, predictions.js, recommendations.js
├── composables/
│   ├── useAuth.js            # état d'auth (token en localStorage)
│   ├── useLiveSocket.js       # client WebSocket générique (reconnexion, backoff)
│   ├── useSidebar.js, useTheme.js
├── views/
│   ├── LoginView.vue, HomeView.vue, SitesListView.vue, SiteDetailView.vue
│   └── AlertsView.vue, PredictionsView.vue, RecommendationsView.vue
└── components/
    ├── MeasuresChart.vue      # graphique Chart.js (le composant le plus dense du projet)
    ├── AlertsSeverityChart.vue, SiteCard.vue, AlertList.vue, Pagination.vue
    └── Sidebar.vue, Topbar.vue, ProfileMenu.vue, TimeRangeSelector.vue
```

Détail architecture et raisonnement : [docs/02-architecture.md](docs/02-architecture.md).
Détail de chaque vue et composant : [docs/04-navigation-et-vues.md](docs/04-navigation-et-vues.md)
et [docs/05-composants-cles.md](docs/05-composants-cles.md).

## Comment l'app trouve l'URL de l'API

- **En dev** (`npm run dev`) : `VITE_API_URL` (fichier `.env`), ou le proxy
  Vite `/api-proxy` si non défini.
- **En production** (image Docker) : la variable d'environnement `API_URL`
  injectée par `enervision-devops/compose/dashboard.yml` est écrite dans
  `config.js` par `docker/entrypoint.sh` **au démarrage du conteneur**
  (`window.APP_CONFIG.API_URL`) — c'est ce qui permet à la même image
  buildée une seule fois de pointer vers n'importe quel environnement de
  déploiement, sans rebuild.

`src/api/client.js` essaie ces sources dans cet ordre :
`window.APP_CONFIG.API_URL` → `VITE_API_URL` → `/api-proxy`. Explication complète du
principe "build once, configure at runtime" :
[docs/07-configuration-et-build.md](docs/07-configuration-et-build.md).

## Temps réel

`HomeView`, `SiteDetailView` et `PredictionsView` s'abonnent aux WebSockets
`/ws/readings`/`/ws/alerts` de l'API via le composable `useLiveSocket` : reconnexion à
backoff exponentiel, pause quand l'onglet est en arrière-plan, reprise sans trou après
coupure. Détail : [docs/06-temps-reel-websocket.md](docs/06-temps-reel-websocket.md).

## Déploiement

L'image Docker build l'app Vue (`npm run build`) puis la sert avec nginx (mode SPA,
fallback sur `index.html`). Le déploiement effectif est délégué, comme pour
`enervision-api`, au workflow réutilisable de `enervision-devops` (`deploy.yml`,
`compose/dashboard.yml`) sur le serveur on-premise. Détail complet :
[docs/08-deploiement-et-flux-devops.md](docs/08-deploiement-et-flux-devops.md).
