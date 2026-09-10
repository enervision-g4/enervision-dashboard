# Composants clés

## `MeasuresChart.vue` : le composant le plus dense du projet

Utilisé par `HomeView`, `SiteDetailView` et `PredictionsView`, ce composant encapsule
tout Chart.js derrière une interface simple : une prop `series` (tableau de courbes),
et rien de plus à connaître pour l'utiliser. Toute la complexité ci-dessous existe pour
que les vues appelantes n'aient, elles, presque rien à gérer.

### "Forme" vs "patch" : ne pas reconstruire le graphique à chaque mesure

```js
function shapeKey() {
  return `${props.series.length}|${props.series.map((s) => s.label).join("~")}|${props.yLabel}|${props.xMin}|${props.xMax}`;
}

function render() {
  if (!chartInstance || shapeKey() !== lastShape) {
    buildChart();   // reconstruction complète
  } else {
    patchChart();    // remplace juste les données, `update("none")`
  }
}
```

Avec le flux temps réel (voir [06-temps-reel-websocket.md](06-temps-reel-websocket.md)),
`MeasuresChart` peut recevoir une nouvelle mesure toutes les quelques secondes. Détruire
et recréer l'instance Chart.js à chaque fois serait visible (clignotement) et coûteux.
`shapeKey()` résume ce qui **doit** déclencher une reconstruction — nombre de courbes,
libellés, bornes d'axe explicites — tout le reste (une série qui s'allonge simplement)
ne fait que patcher les données existantes avec `chartInstance.update("none")`, qui met
à jour sans ré-animer.

### Bornes d'axe explicites (`xMin`/`xMax`)

Sans bornes explicites, Chart.js cadre l'axe X sur l'étendue réelle des points reçus.
Problème concret : sur `PredictionsView`, la courbe "mesures" (passé) et la courbe
"prévision" (futur) n'ont pas la même étendue — l'axe se cadrait alors sur l'union des
deux au lieu de respecter la période/l'horizon choisis dans les sélecteurs. Les vues
appelantes calculent donc elles-mêmes `xMin`/`xMax` (bornes des mesures chargées, bornes
étendues à la fin de l'horizon de prévision) et les passent en props.

### `parsing: false` et la conversion en millisecondes

```js
function normalizeData(data) {
  return (data ?? [])
    .map((point) => ({ x: new Date(point.x).getTime(), y: point.y }))
    .filter((point) => Number.isFinite(point.x))
    .sort((a, b) => a.x - b.x);
}
```

`parsing: false` est indispensable au patch incrémental (`update("none")` sans repasser
par le parseur Chart.js) mais a un effet de bord : Chart.js n'interprète plus les `x` du
tout, une chaîne ISO reste une chaîne pour l'échelle `type: "time"`, qui ne sait alors
plus rien placer. `normalizeData` convertit donc systématiquement en millisecondes avant
de donner les points à Chart.js.

### Survol de légende : mise en avant d'une courbe

```js
function setEmphasis(activeIndex) {
  chartInstance.data.datasets.forEach((dataset, i) => {
    dataset.borderColor = i === activeIndex ? baseColors[i] : withAlpha(baseColors[i], DIMMED_ALPHA);
  });
  chartInstance.update("none");
}
```

Utile sur `PredictionsView`, où mesures passées et prévision future se chevauchent
parfois visuellement : survoler un élément de légende estompe l'autre courbe (opacité
`0.18`, pas invisible — on doit pouvoir comparer, pas perdre l'autre courbe de vue).

### Overlay "aucune donnée"

```js
const hasData = computed(() =>
  props.series.some((s) => (s.data ?? []).some((point) => Number.isFinite(point.y))),
);
```

Un point peut exister (horodatage valide) avec une valeur `null` — capteur en panne,
qualité dégradée. Compter les points ne suffit donc pas : sans ce contrôle explicite sur
`y`, le graphique affichait un cadre vide avec un axe par défaut 0–1, ce qui donnait
l'impression trompeuse qu'aucune donnée n'avait été chargée. `hasData` distingue ce cas
d'un vrai chargement vide et affiche un message explicite par-dessus le canevas masqué.

### `interaction: { mode: "nearest", intersect: false }`

Choix corrigé après coup (voir commentaire dans le code) : avec `axis: "x"`, Chart.js ne
comparait que la distance horizontale au curseur, donc sur un graphique à deux courbes le
tooltip restait parfois "collé" à la mauvaise série. Retirer `axis` fait comparer la
distance réelle (x et y), et le tooltip suit correctement la courbe effectivement sous le
curseur.

### Pan/zoom : glisser fait défiler, la molette zoome

Le zoom par rectangle de sélection (`drag`) est désactivé au profit de la molette et du
pincement, jugés plus prévisibles. Glisser sur le graphique (`pan`) fait défiler la
période plutôt que sélectionner une zone. `onPanComplete`/`onZoomComplete` appellent
`handleRangeChange`, anti-rebondi à 250 ms (la molette déclenche plusieurs événements
très rapprochés), qui émet `rangeChange` vers le parent — c'est ce signal qui déclenche
le chargement d'historique supplémentaire dans les vues (voir
[04-navigation-et-vues.md](04-navigation-et-vues.md)).

## Autres composants

| Composant | Rôle |
|---|---|
| `AlertsSeverityChart.vue` | Graphique en barres du nombre d'alertes par sévérité, alimente le résumé de `HomeView`. |
| `SiteCard.vue` | Carte résumé d'un site (nom, statut) sur `SitesListView`. |
| `AlertList.vue` | Liste compacte d'alertes (utilisée en résumé, pas en liste paginée complète). |
| `Pagination.vue` | Contrôles page/limite, réutilisés par `AlertsView` et `RecommendationsView` (même contrat `AlertPage`/`RecommendationPage` que l'API — voir [enervision-api/docs/04-routes-rest.md](../../enervision-api/docs/04-routes-rest.md)). |
| `TimeRangeSelector.vue` | Sélecteur de période/horizon générique, réutilisé pour l'historique **et** pour l'horizon de prévision sur `PredictionsView` (via une prop `options` personnalisée). |
| `Sidebar.vue` / `Topbar.vue` / `ProfileMenu.vue` | Chrome de l'application, montés uniquement une fois authentifié (voir `App.vue` dans [02-architecture.md](02-architecture.md)). |

## Suite

- [06-temps-reel-websocket.md](06-temps-reel-websocket.md) — le client WebSocket
  générique et sa logique de reconnexion.
