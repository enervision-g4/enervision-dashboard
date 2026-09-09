# Navigation et vues

## Table des routes

| Route | Vue | Contenu | Temps réel |
|---|---|---|---|
| `/login` | `LoginView` | Formulaire de connexion. Seule route publique. | non |
| `/` | `HomeView` | Vue d'ensemble : résumé des alertes, graphique de consommation. | `/ws/readings`, `/ws/alerts` |
| `/sites` | `SitesListView` | Liste des sites, statut de chacun. | non (polling 30s) |
| `/sites/:siteId` | `SiteDetailView` | Détail d'un site : mesures, alertes, prévisions du site. | `/ws/readings`, `/ws/alerts` |
| `/alerts` | `AlertsView` | Liste paginée et filtrable de toutes les alertes. | non (polling) |
| `/predictions` | `PredictionsView` | Courbe mesures + prévisions ML pour un site choisi. | `/ws/readings` |
| `/recommendations` | `RecommendationsView` | Liste paginée des recommandations générées par `enervision-ml`. | non (polling 30s) |

## Pourquoi certaines vues pollent plutôt que d'écouter un WebSocket

`enervision-api` n'expose que deux endpoints temps réel :
[`/ws/readings` et `/ws/alerts`](../../enervision-api/docs/05-temps-reel-websocket.md)
— rien pour les sites ni pour les recommandations. Deux raisons à ça, documentées côté
dashboard directement dans le code :

- Le **statut d'un site** change rarement (`SitesListView`) : un `setInterval` de 30
  secondes est largement suffisant, ouvrir un WebSocket dédié pour une donnée aussi peu
  volatile serait une connexion serveur payée pour rien.
- Les **recommandations** (`RecommendationsView`) sont produites par lot par
  `enervision-ml`, au rythme du pipeline ML (pas ligne à ligne) — un flux "push" n'aurait
  presque jamais d'événement à envoyer.

`AlertsView` est un cas un peu différent : les alertes sont bien couvertes par
`/ws/alerts`, mais la vue liste (paginée, filtrable, triable) ne s'y abonne pas — un flux
temps réel sur une pagination server-side compliquerait l'affichage (où insérer une
nouvelle ligne dans une page triée ?) pour un bénéfice limité. C'est `HomeView` et
`SiteDetailView`, qui affichent un résumé non paginé, qui utilisent `/ws/alerts`.

## Motif commun aux vues avec graphique

`HomeView`, `SiteDetailView` et `PredictionsView` partagent la même mécanique, détaillée
dans [05-composants-cles.md](05-composants-cles.md) et
[06-temps-reel-websocket.md](06-temps-reel-websocket.md) :

1. chargement initial des mesures sur une période (`TimeRangeSelector`) ;
2. mémorisation des bornes réellement couvertes (`loadedStartMs`/`loadedEndMs`) ;
3. extension de l'historique quand l'utilisateur glisse/zoome vers le passé
   (`onChartRangeChange`, rappel de `fetchReadings` avec une fenêtre plus ancienne) ;
4. fusion incrémentale des nouvelles mesures poussées par `/ws/readings`
   (`mergeReadings`, dédoublonnage par horodatage).

## `AlertsView` : filtres synchronisés avec l'URL

Contrairement aux autres vues de liste, la route d'`AlertsView` déclare
`props: (route) => ({ ...route.query })` : ses filtres (site, sévérité, statut, tri,
page) vivent dans la query string de l'URL plutôt que dans un état interne isolé. Deux
conséquences utiles : l'URL est partageable/copiable telle quelle (un lien vers "les
alertes critiques du site X" fonctionne), et le bouton retour du navigateur revient bien
à l'état de filtre précédent.

## `LoginView`

La plus simple des vues : un formulaire, un appel à `useAuth().login()`, et une
redirection vers `route.query.redirect ?? "/"` posée par la garde de route (voir
[03-authentification.md](03-authentification.md)). Aucune route de type "mot de passe
oublié" : cohérent avec un compte de service unique configuré par variable
d'environnement côté API, pas un système multi-utilisateur.

## Suite

- [05-composants-cles.md](05-composants-cles.md) — le détail des composants partagés,
  en particulier `MeasuresChart`.
