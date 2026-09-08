/**
 * Ordre d'affichage et couleur fixe par sévérité (demande produit :
 * critical=violet, high=rouge, medium=orange, low=jaune) — utilisé partout
 * où une sévérité est affichée (tuiles d'accueil, badges de la table
 * d'alertes, graphique en colonnes) pour rester cohérent.
 */
export const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

// Teintes lumineuses : mêmes familles (violet/rouge/orange/jaune), plus
// saturées et plus claires que les précédentes. Doivent rester identiques
// aux variables --color-severity-* de src/style.css.
export const SEVERITY_COLORS = {
  critical: "#8b5cf6",
  high: "#fb4d63",
  medium: "#f97316",
  low: "#f5c518",
};

export const SEVERITY_FALLBACK_COLOR = "#5b6270";

/** Trie un objet {severity: count} selon SEVERITY_ORDER, sévérités inconnues à la fin. */
export function sortSeverityEntries(counts) {
  const known = SEVERITY_ORDER.filter((s) => s in counts).map((s) => [s, counts[s]]);
  const unknown = Object.entries(counts).filter(([s]) => !SEVERITY_ORDER.includes(s));
  return [...known, ...unknown];
}

export function severityColor(severity) {
  return SEVERITY_COLORS[severity] || SEVERITY_FALLBACK_COLOR;
}
