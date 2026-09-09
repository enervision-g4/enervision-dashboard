# Documentation — enervision-dashboard

Documentation technique de l'interface web d'EnerVision : ce qu'elle affiche, comment
elle est construite, et comment elle est déployée. Écrite pour quelqu'un qui connaît déjà
le projet EnerVision dans les grandes lignes mais découvre ce dépôt.

1. **[01-introduction.md](01-introduction.md)** — le rôle du dashboard dans EnerVision,
   ce qu'il n'est pas, vocabulaire (SPA, JWT, WebSocket, i18n).
2. **[02-architecture.md](02-architecture.md)** — organisation du code source
   (`api/`, `composables/`, `components/`, `views/`) et pourquoi ce découpage.
3. **[03-authentification.md](03-authentification.md)** — le circuit du JWT, de la
   connexion à la garde de route, et pourquoi ce n'est pas un store Pinia.
4. **[04-navigation-et-vues.md](04-navigation-et-vues.md)** — les routes, ce que chaque
   vue affiche, et pourquoi certaines pollent plutôt que d'écouter un WebSocket.
5. **[05-composants-cles.md](05-composants-cles.md)** — les composants réutilisables, en
   détail pour `MeasuresChart` (Chart.js, patch incrémental, zoom/pan).
6. **[06-temps-reel-websocket.md](06-temps-reel-websocket.md)** — le client WebSocket
   générique : reconnexion, backoff, pause en arrière-plan.
7. **[07-configuration-et-build.md](07-configuration-et-build.md)** — comment l'URL de
   l'API est déterminée selon l'environnement ("build once, configure at runtime").
8. **[08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md)** — l'image
   Docker (build Vite + nginx), et le flux de déploiement via `enervision-devops`.
9. **[09-tests-et-qualite.md](09-tests-et-qualite.md)** — l'outillage de test
   (`vitest`), son état actuel, et ce qui vaudrait le plus la peine d'être testé.

## En une phrase

`enervision-dashboard` est une SPA Vue 3 sans état métier propre, qui affiche les
données de `enervision-api` (REST + deux WebSockets) derrière une authentification JWT
minimaliste, buildée une fois et configurée à chaque démarrage de conteneur via
`enervision-devops`.
