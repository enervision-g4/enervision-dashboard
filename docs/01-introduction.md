# Introduction

Ce dossier documente `enervision-dashboard`, l'interface web du projet EnerVision : une
application monopage (SPA) en Vue 3 qui affiche les données exposées par
`enervision-api` (sites, mesures, alertes, prévisions, recommandations) à un opérateur
humain, avec une portion de ces données rafraîchie en quasi-temps réel.

## Le rôle exact du dashboard

Le dashboard **ne calcule et ne stocke rien lui-même**. Il ne fait que :

1. s'authentifier auprès de `enervision-api` (JWT) ;
2. lire les routes REST de l'API pour afficher listes, graphiques et pages ;
3. écouter deux WebSockets (`/ws/readings`, `/ws/alerts`) pour mettre à jour l'affichage
   sans que l'utilisateur ait à recharger la page.

Toute la logique métier (calcul des alertes, génération des prévisions, agrégation des
mesures) vit côté `enervision-api`/`enervision-etl`/`enervision-ml`. Le dashboard se
contente de la présenter — voir
[enervision-api/docs/01-introduction.md](../../enervision-api/docs/01-introduction.md)
pour ce qui se passe de l'autre côté de ces appels.

## Ce que le dashboard N'EST PAS

- Ce n'est **pas** un serveur applicatif : une fois buildé, c'est un ensemble de
  fichiers statiques (HTML/JS/CSS) servis par nginx — voir
  [08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md).
- Il ne fait **aucune** validation métier : les erreurs (401, 422...) renvoyées par
  l'API sont affichées ou traitées, jamais anticipées côté client.
- L'authentification est volontairement minimale (voir
  [03-authentification.md](03-authentification.md)) : un unique compte de service, pas
  de gestion multi-utilisateur.

## Vocabulaire utile

| Terme | Sens dans ce projet |
|---|---|
| SPA | Single Page Application : une seule page HTML, le contenu change en JavaScript sans rechargement (`vue-router`). |
| JWT | Le jeton renvoyé par `enervision-api` après connexion, stocké en `localStorage`, renvoyé dans l'en-tête `Authorization` de chaque requête. |
| WebSocket | Connexion persistante bidirectionnelle utilisée pour recevoir les nouvelles mesures/alertes sans repoller manuellement. |
| i18n | Internationalisation (`vue-i18n`) : tous les textes affichés passent par `t("clé")`, pas de chaîne en dur dans les templates. |
| "Build once, configure at runtime" | La même image Docker sert n'importe quel environnement ; seule l'URL de l'API change, injectée au démarrage du conteneur — voir [07-configuration-et-build.md](07-configuration-et-build.md). |

## Stack technique en un coup d'œil

- **Vue 3** avec Composition API et `<script setup>` (pas d'Options API dans ce projet).
- **Vite** pour le dev server et le build.
- **vue-router** pour la navigation, avec garde d'authentification globale.
- **vue-i18n** pour les traductions.
- **Pinia** est installée mais l'authentification n'y passe pas : c'est une simple
  fonction composable (`useAuth`) au-dessus d'une `ref` module-scope — voir
  [03-authentification.md](03-authentification.md) pour pourquoi.
- **axios** pour les appels REST, **Chart.js** (+ plugin zoom/pan) pour les graphiques.
- **nginx** pour servir les fichiers statiques en production.

## Suite

- [02-architecture.md](02-architecture.md) — organisation du code source.
