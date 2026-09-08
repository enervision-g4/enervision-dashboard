import apiClient from "./client";

/**
 * GET /api/v1/predictions (voir enervision-api/app/routers/predictions.py).
 *
 * latest_only n'est pas passé explicitement : le défaut de l'API (true) est
 * exactement ce qu'il faut ici — ne garder que le dernier lot généré par le
 * modèle ML pour chaque heure visée, pas l'historique des runs successifs
 * qui réécrivent la même heure au fil du temps.
 */
export async function fetchPredictions({ siteId, modelVersion, limit = 24 } = {}) {
  const { data } = await apiClient.get("/api/v1/predictions", {
    params: { site_id: siteId, model_version: modelVersion, limit },
  });
  return data;
}
