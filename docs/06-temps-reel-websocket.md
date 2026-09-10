# Temps réel côté client : `useLiveSocket`

Contrepartie côté dashboard de
[enervision-api/docs/05-temps-reel-websocket.md](../../enervision-api/docs/05-temps-reel-websocket.md).
Une seule fonction composable, `useLiveSocket`, porte toute la logique de connexion —
`HomeView`, `SiteDetailView` et `PredictionsView` s'y abonnent chacune sans dupliquer la
gestion de reconnexion.

## Utilisation

```js
liveSocket = useLiveSocket(
  "/ws/readings",
  () => ({ site_id: selectedSiteId.value, since: newestReadingTimestamp() }),
  (msg) => {
    if (msg.type !== "reading") return;
    mergeReadings([msg.data]);
  },
);
```

Le deuxième argument (`params`) est **une fonction**, pas un objet figé : elle est
réévaluée à chaque (re)connexion. C'est ce qui permet de transmettre un `since` à jour
(l'horodatage de la donnée la plus récente déjà affichée) — après une coupure réseau, la
reconnexion reprend le flux là où il s'est arrêté, sans trou ni doublon rejoué depuis le
début.

## Construction de l'URL et authentification

```js
export function buildWsUrl(path, params = {}) {
  const base = resolveApiBaseUrl();
  const token = localStorage.getItem("enervision_token") || "";
  const url = new URL(/* ... */);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  // ... params
  return url.toString();
}
```

`buildWsUrl` réutilise la même résolution d'URL de base que les appels REST
(`resolveApiBaseUrl`, voir [07-configuration-et-build.md](07-configuration-et-build.md))
et convertit `http(s)` en `ws(s)`. Le token est passé en query string plutôt qu'en
en-tête `Authorization` : un WebSocket natif du navigateur ne permet pas de poser
d'en-têtes personnalisés à l'ouverture de la connexion — c'est pour cette raison que
`enervision-api` (`app/routers/live.py`) accepte spécifiquement le token par ce canal
pour ses deux routes WebSocket.

## Reconnexion avec backoff exponentiel

```js
socket.onclose = () => {
  socket = null;
  if (stopped || document.hidden) return;
  attempts += 1;
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempts - 1), RECONNECT_MAX_DELAY_MS);
  reconnectTimer = setTimeout(connect, delay);
};
```

2 s, 4 s, 8 s, 16 s, plafonné à 30 s. Un simple `setInterval` de reconnexion à intervalle
fixe martèlerait `enervision-api` si elle est indisponible ou en cours de redéploiement
(voir [08-deploiement-et-flux-devops.md](08-deploiement-et-flux-devops.md)) ; le backoff
exponentiel espace les tentatives à mesure qu'elles échouent.

## Pause quand l'onglet est en arrière-plan

```js
function onVisibilityChange() {
  if (document.hidden) {
    socket?.close();
  } else if (!socket) {
    connect();
  }
}
document.addEventListener("visibilitychange", onVisibilityChange);
```

Chaque WebSocket ouvert fait tourner une boucle de polling interne côté API
(`POLL_INTERVAL_SECONDS`, voir la doc API) — la payer pour un onglet que personne ne
regarde ne sert à rien, et `enervision-api` plafonne de toute façon le nombre de
connexions simultanées (`MAX_CONCURRENT_CONNECTIONS`). Fermer la connexion en arrière-plan
et rouvrir au retour évite de consommer ce quota pour rien, et allège la charge côté API
quand plusieurs opérateurs laissent le dashboard ouvert dans un onglet inactif.

## Le heartbeat est filtré, jamais transmis à la vue

```js
if (payload?.type === "heartbeat") return;
onMessage(payload);
```

Le heartbeat émis par l'API (`HEARTBEAT_INTERVAL_SECONDS=25`) sert uniquement à garder
la connexion ouverte à travers d'éventuels reverse-proxy qui coupent les connexions
inactives — il n'a aucun sens pour une vue, qui ne reçoit donc jamais que des messages
`reading`/`alert` réels.

## Fermeture explicite au démontage

```js
if (getCurrentInstance()) onBeforeUnmount(close);
```

`useLiveSocket` est parfois appelée depuis un `onMounted` asynchrone (après un premier
`await`), donc **hors** de la fonction `setup()` elle-même — Vue n'accepterait alors pas
d'y enregistrer `onBeforeUnmount` (avertissement, hook jamais appelé). Dans ce cas,
chaque vue appelante ferme explicitement le socket dans son propre `onBeforeUnmount`
(`liveSocket?.close()`), pour ne jamais laisser un WebSocket ouvert après avoir quitté la
page.

## Suite

- [07-configuration-et-build.md](07-configuration-et-build.md) — comment l'URL de l'API
  est déterminée selon l'environnement, et le principe "build once, configure at
  runtime".
