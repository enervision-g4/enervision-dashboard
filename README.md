# enervision-dashboard

Dashboard Vue 3 (Vite) qui consomme `enervision-api` pour afficher les sites,
leurs mesures et les alertes actives. Authentification par token JWT
(obtenu via `POST /auth/login` sur l'API).

## Lancer en local

Prérequis : `enervision-api` doit tourner sur `http://localhost:3000` (voir
son README), lui-même connecté à une instance TimescaleDB locale.

```bash
npm install
cp .env.example .env   # VITE_API_URL, par défaut http://localhost:3000
npm run dev
```

L'app est servie sur `http://localhost:5173`. En dev, `vite.config.js`
proxifie aussi `/api-proxy/*` vers l'API pour éviter les soucis de CORS
si vous préférez ne pas renseigner `VITE_API_URL`.

## Structure

```
src/
├── main.js              # bootstrap Vue + Pinia + router
├── App.vue                # layout (header + déconnexion)
├── router/index.js         # routes + garde d'authentification
├── api/
│   ├── client.js            # instance axios : résout l'URL API, injecte le JWT
│   ├── auth.js               # POST /auth/login
│   └── sites.js               # GET /api/v1/sites, /readings, /alerts
├── composables/useAuth.js    # état d'auth (token en localStorage)
├── views/
│   ├── LoginView.vue           # formulaire de connexion
│   ├── DashboardView.vue        # liste des sites + alertes actives
│   └── SiteDetailView.vue        # détail d'un site + dernières mesures
└── components/
    ├── SiteCard.vue
    └── AlertList.vue
```

## Comment l'app trouve l'URL de l'API

- **En dev** (`npm run dev`) : `VITE_API_URL` (fichier `.env`), ou le proxy
  Vite `/api-proxy` si non défini.
- **En production** (image Docker) : la variable d'environnement `API_URL`
  injectée par `enervision-devops/compose/dashboard.yml` est écrite dans
  `config.js` par `docker/entrypoint.sh` **au démarrage du conteneur**
  (`window.APP_CONFIG.API_URL`) — c'est ce qui permet à la même image
  buildée une seule fois de pointer vers l'API `onprem`, `azure` ou `ovh`
  selon l'environnement de déploiement, sans rebuild.

`src/api/client.js` essaie ces sources dans cet ordre :
`window.APP_CONFIG.API_URL` → `VITE_API_URL` → `/api-proxy`.

## Déploiement

Comme pour `enervision-api` : un workflow `.github/workflows/ci-cd.yml`
(fourni séparément, à ajouter manuellement) build l'image, la pousse sur
`ghcr.io/enervision-g4/enervision-dashboard`, puis appelle le workflow
réutilisable `deploy.yml` de `enervision-devops` avec `service: dashboard`.
Pensez à configurer `DASHBOARD_PORT` et `API_URL` dans le `.env` de chaque
environnement (`enervision-devops/envs/*.env.example`).
