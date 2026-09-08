import { getCurrentInstance, onBeforeUnmount } from "vue";

import { buildWsUrl } from "@/api/client";

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 30000;

/**
 * Ouvre un WebSocket vers `path` (voir enervision-api app/routers/live.py)
 * et appelle `onMessage(payload)` pour chaque message reçu.
 *
 * `params` peut être une fonction : elle est réévaluée à chaque (re)connexion,
 * ce qui permet de passer un `since` à jour (horodatage de la donnée la plus
 * récente déjà affichée) et donc de reprendre le flux sans trou ni rejeu
 * après une coupure réseau.
 *
 * Trois garde-fous côté charge serveur :
 * - reconnexion avec backoff exponentiel (2s, 4s, 8s… plafonné à 30s) plutôt
 *   qu'un retry fixe qui martèle l'API quand elle est down ;
 * - fermeture du socket quand l'onglet passe en arrière-plan, réouverture au
 *   retour : chaque connexion ouverte fait tourner une boucle de lecture côté
 *   API, inutile de la payer pour un onglet que personne ne regarde ;
 * - fermeture explicite au démontage du composant.
 */
export function useLiveSocket(path, params, onMessage) {
  let socket = null;
  let reconnectTimer = null;
  let stopped = false;
  let attempts = 0;

  function currentParams() {
    return typeof params === "function" ? params() : params;
  }

  function connect() {
    if (stopped || document.hidden || socket) return;
    socket = new WebSocket(buildWsUrl(path, currentParams()));

    socket.onopen = () => {
      attempts = 0;
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return; // Message non-JSON inattendu : ignoré plutôt que de casser la connexion.
      }
      // Le "heartbeat" ne sert qu'à garder la connexion vivante à travers les
      // reverse-proxy : il ne concerne pas les vues.
      if (payload?.type === "heartbeat") return;
      onMessage(payload);
    };

    socket.onclose = () => {
      socket = null;
      if (stopped || document.hidden) return;
      attempts += 1;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempts - 1), RECONNECT_MAX_DELAY_MS);
      reconnectTimer = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  function onVisibilityChange() {
    if (stopped) return;
    if (document.hidden) {
      clearTimeout(reconnectTimer);
      socket?.close();
    } else if (!socket) {
      clearTimeout(reconnectTimer);
      attempts = 0;
      connect();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  connect();

  function close() {
    stopped = true;
    clearTimeout(reconnectTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    socket?.close();
    socket = null;
  }

  // `useLiveSocket` est parfois appelée depuis un onMounted asynchrone, donc
  // hors du setup() : onBeforeUnmount n'y est pas enregistrable (avertissement
  // Vue, et surtout hook jamais appelé). Dans ce cas l'appelant ferme lui-même
  // le socket, ce que font toutes les vues.
  if (getCurrentInstance()) onBeforeUnmount(close);

  return { close };
}
