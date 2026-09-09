export const TIME_RANGES = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 24 * 7,
};

/**
 * Nombre d'heures correspondant à une clé de période — envoyé à l'API comme
 * `range_hours` pour que la fenêtre soit ancrée sur la donnée la plus
 * récente réellement en base plutôt que sur l'horloge du navigateur (voir
 * app/routers/readings.py). Préférer cette fonction à `rangeStartTime` pour
 * toute requête au serveur ; `rangeStartTime` reste utile pour des calculs
 * purement côté client (ex. filtrer un tableau déjà chargé).
 */
export function rangeHours(key) {
  return TIME_RANGES[key] ?? TIME_RANGES["24h"];
}

export function rangeStartTime(key, now = new Date()) {
  const hours = rangeHours(key);
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Convertit la valeur d'un <input type="datetime-local"> (heure locale, sans
 * fuseau) en ISO UTC — même logique que le filtre "Depuis"/"Jusqu'à" de la
 * page Alertes, centralisée ici pour être réutilisée par le sélecteur de
 * plage personnalisée des graphiques de mesures (ex. "revenir sur le mois
 * d'août").
 */
export function toIsoFromLocal(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
