import { onBeforeUnmount } from "vue";

import { buildWsUrl } from "@/api/client";

const RECONNECT_DELAY_MS = 4000;

/**
 * Ouvre un WebSocket vers `path` (voir enervision-api app/routers/live.py)
 * et appelle `onMessage(payload)` pour chaque message reçu. Remplace le
 * polling HTTP précédent (setInterval + refetch complet) : plus de
 * rafraîchissement "à vide" toutes les 20s, juste les données réellement
 * nouvelles poussées par le serveur.
 *
 * Se reconnecte automatiquement si la connexion tombe (réseau, redémarrage
 * de l'API) — sauf si le composant qui l'utilise a déjà été démonté.
 */
export function useLiveSocket(path, params, onMessage) {
  let socket = null;
  let reconnectTimer = null;
  let stopped = false;

  function connect() {
    if (stopped) return;
    socket = new WebSocket(buildWsUrl(path, params));

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // Message non-JSON inattendu : ignoré plutôt que de casser la connexion.
      }
    };

    socket.onclose = () => {
      if (stopped) return;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  connect();

  function close() {
    stopped = true;
    clearTimeout(reconnectTimer);
    socket?.close();
  }

  onBeforeUnmount(close);

  return { close };
}
