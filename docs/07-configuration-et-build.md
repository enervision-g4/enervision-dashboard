# Configuration et build : "build once, configure at runtime"

## Le problème que ce mécanisme résout

Une SPA Vite est buildée en fichiers statiques (HTML/JS/CSS) : normalement, toute valeur
lue via `import.meta.env.VITE_*` est **figée dans le bundle au moment du build**. Si
l'URL de l'API devait passer par une variable Vite classique, il faudrait rebuilder une
image Docker différente pour chaque environnement (dev on-prem, prod on-prem, un futur
déploiement cloud...) — contraire au principe retenu pour tout le projet : une seule
image par service, poussée une fois, redéployée telle quelle partout (voir
[08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md) et le même principe
côté [enervision-etl](../../enervision-etl/docs) / `enervision-ml`).

Le dashboard contourne ça en injectant l'URL de l'API **au démarrage du conteneur**,
pas au build.

## Résolution de l'URL de l'API, par ordre de priorité

```js
function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && window.APP_CONFIG?.API_URL) {
    return window.APP_CONFIG.API_URL;      // 1. injecté en prod, voir plus bas
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;   // 2. dev local, sans passer par le proxy Vite
  }
  return "/api-proxy";                      // 3. dev local via le proxy Vite
}
```

Cette fonction (`src/api/client.js`) est la seule source de vérité pour l'URL de l'API,
utilisée à la fois par `apiClient` (axios) et par `buildWsUrl` (WebSocket) — voir
[06-temps-reel-websocket.md](06-temps-reel-websocket.md).

## En production : injection au démarrage du conteneur

```mermaid
sequenceDiagram
    participant Compose as compose/dashboard.yml
    participant Entry as docker/entrypoint.sh
    participant Nginx as nginx
    participant Browser as Navigateur

    Compose->>Entry: démarre le conteneur avec API_URL=... (variable d'env)
    Entry->>Entry: écrit /usr/share/nginx/html/config.js<br/>window.APP_CONFIG = { API_URL: "..." }
    Entry->>Nginx: exec nginx -g "daemon off;"
    Browser->>Nginx: GET /config.js (chargé avant le bundle Vue)
    Nginx-->>Browser: window.APP_CONFIG.API_URL = "..."
    Browser->>Browser: resolveApiBaseUrl() lit window.APP_CONFIG.API_URL
```

`docker/entrypoint.sh` :

```sh
cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  API_URL: "${API_URL:-}"
};
EOF
exec nginx -g "daemon off;"
```

La **même image Docker**, non reconstruite, sert n'importe quel environnement : seule la
variable `API_URL` du conteneur change, portée par `enervision-devops/compose/dashboard.yml`
(voir [08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md)). C'est ce
`config.js`, généré à chaque démarrage de conteneur et chargé par `index.html` **avant**
le bundle applicatif, qui rend `window.APP_CONFIG` disponible dès le premier appel de
`resolveApiBaseUrl()`.

## En développement local

Deux façons de travailler en local, sans jamais toucher à `config.js` (qui n'existe pas
en dev, seulement généré au démarrage du conteneur de prod) :

- **Avec `VITE_API_URL`** (`.env` local, voir `.env.example`) : pointe directement vers
  une API FastAPI lancée sur `localhost:3000`. Simple, mais expose aux problèmes de CORS
  si l'API n'autorise pas explicitement l'origine du serveur Vite
  (`cors_allowed_origins`, voir
  [enervision-api/docs/02-architecture.md](../../enervision-api/docs/02-architecture.md)).
- **Sans variable, via le proxy Vite** (`/api-proxy`) : `vite.config.js` redirige tout
  appel `/api-proxy/*` vers `http://localhost:3000`, en réécrivant le préfixe. Le
  navigateur voit alors une seule origine (`localhost:5173`), donc aucun souci de CORS —
  c'est le mode par défaut si aucune variable n'est positionnée.

```js
// vite.config.js
proxy: {
  "/api-proxy": {
    target: "http://localhost:3000",
    changeOrigin: true,
    ws: true,   // le proxy relaie aussi les WebSockets (/ws/readings, /ws/alerts)
    rewrite: (path) => path.replace(/^\/api-proxy/, ""),
  },
},
```

`ws: true` est nécessaire : sans lui, seuls les appels REST passeraient par le proxy, les
WebSockets échoueraient à se connecter en dev.

## Le build lui-même

```json
"scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" }
```

`npm run build` produit un dossier `dist/` de fichiers statiques, servis ensuite par
nginx (voir [08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md)).
L'alias `@` (`vite.config.js` → `src/`) est utilisé partout dans le code
(`@/composables/useAuth`, `@/api/client`...) pour éviter les chemins relatifs fragiles
(`../../composables/...`).

## Suite

- [08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md) — l'image Docker,
  nginx, et le flux de déploiement complet via `enervision-devops`.
