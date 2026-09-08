<script setup>
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useTheme } from "@/composables/useTheme";

Chart.register(...registerables, zoomPlugin);

const DEFAULT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#fb4d63", "#8b5cf6"];
// Opacité d'une courbe non survolée quand on met en avant sa voisine dans la
// légende (ex. "Mesures" vs "Prévision" sur PredictionsView) — assez faible
// pour rester clairement secondaire, sans disparaître complètement (on doit
// pouvoir comparer les deux courbes, pas perdre l'une des deux de vue).
const DIMMED_ALPHA = 0.18;

const props = defineProps({
  // [{ label, color?, data: [{x: Date|string|number, y: number}] }]
  series: { type: Array, required: true },
  yLabel: { type: String, default: "" },
  height: { type: Number, default: 320 },
  // Change quand la plage temporelle demandée change (ex. "24h" -> "1h") :
  // le zoom/pan en cours doit alors être réinitialisé, sinon le graphique
  // reste bloqué sur l'ancienne fenêtre visible et le sélecteur de période
  // semble sans effet.
  rangeKey: { type: String, default: "" },
  // Bornes explicites de l'axe X (ISO ou ms epoch), appliquées à la
  // (re)construction du graphique — voir shapeKey(). Sans elles, Chart.js
  // cadre l'axe sur l'étendue réelle des points reçus, qui ne correspond pas
  // forcément à la période demandée (ex. un léger retard d'ingestion, ou un
  // graphique qui combine un historique de mesures et un horizon de
  // prévision de largeurs différentes) : l'axe affiché semblait alors ne pas
  // correspondre au sélecteur de période choisi.
  xMin: { type: [String, Number], default: undefined },
  xMax: { type: [String, Number], default: undefined },
});

// Émis (avec un léger anti-rebond) chaque fois que la fenêtre visible change
// suite à un glissement (pan) ou un zoom molette/pincement : le parent s'en
// sert pour charger des données supplémentaires quand on approche du bord de
// ce qui est déjà en mémoire (voir onChartRangeChange dans HomeView/
// SiteDetailView). Sans ça, glisser vers des dates plus anciennes affichait
// un graphique vide dès qu'on sortait de la fenêtre initialement chargée.
const emit = defineEmits(["rangeChange"]);

const { t, locale } = useI18n();
const { theme } = useTheme();
const canvasRef = ref(null);
const visibleRange = ref("");
let chartInstance = null;
let lastShape = null;
let rangeChangeTimer = null;
// Couleur "pleine" de chaque dataset, dans l'ordre de props.series — utilisée
// pour restaurer l'opacité normale au survol d'un autre élément de légende
// (voir setEmphasis/clearEmphasis).
let baseColors = [];

function themeColors() {
  // Chart.js ne lit pas les variables CSS : on lui donne les couleurs du
  // thème actif nous-mêmes, sinon la grille/le texte restent illisibles
  // une fois le mode sombre activé.
  return theme.value === "dark"
    ? { text: "#9aa1ac", grid: "#2c3038" }
    : { text: "#5b6270", grid: "#dde1e6" };
}

/**
 * Chart.js tourne ici en `parsing: false` (indispensable au patch incrémental
 * d'un point poussé par le WebSocket) : il n'interprète donc PAS les valeurs,
 * et un `x` sous forme de chaîne ISO reste une chaîne que l'échelle de type
 * "time" ne sait pas placer — plus aucun point ne s'affichait. On convertit
 * donc ici, une bonne fois pour toutes les vues, en millisecondes.
 */
function normalizeData(data) {
  return (data ?? [])
    .map((point) => ({ x: new Date(point.x).getTime(), y: point.y }))
    .filter((point) => Number.isFinite(point.x))
    .sort((a, b) => a.x - b.x);
}

/** "#rgb"/"#rrggbb" -> "rgba(r, g, b, alpha)". Toute autre forme (déjà rgba,
 * nom de couleur CSS...) est renvoyée telle quelle : nos seules sources de
 * couleur (DEFAULT_COLORS, series[].color) sont toujours de l'hexadécimal. */
function withAlpha(color, alpha) {
  const hex = color.startsWith("#") ? color.slice(1) : null;
  if (!hex) return color;
  const normalized = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (normalized.length !== 6 || Number.isNaN(Number.parseInt(normalized, 16))) return color;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildDatasets() {
  baseColors = props.series.map((s, i) => s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
  return props.series.map((s, i) => ({
    label: s.label,
    data: normalizeData(s.data),
    borderColor: baseColors[i],
    backgroundColor: baseColors[i],
    tension: 0.25,
    pointRadius: 2,
    spanGaps: true,
  }));
}

// Survol d'un élément de la légende (ex. "Mesures" ou "Prévision") : on met
// sa courbe en avant en estompant les autres, plutôt que de les laisser
// toutes à la même intensité — plus lisible dès que deux courbes se
// chevauchent (mesures passées + prévision future sur le même graphique).
function setEmphasis(activeIndex) {
  if (!chartInstance) return;
  chartInstance.data.datasets.forEach((dataset, i) => {
    const color = i === activeIndex ? baseColors[i] : withAlpha(baseColors[i], DIMMED_ALPHA);
    dataset.borderColor = color;
    dataset.backgroundColor = color;
  });
  chartInstance.update("none");
}

function clearEmphasis() {
  if (!chartInstance) return;
  chartInstance.data.datasets.forEach((dataset, i) => {
    dataset.borderColor = baseColors[i];
    dataset.backgroundColor = baseColors[i];
  });
  chartInstance.update("none");
}

// Une "forme" différente (métrique/site changé, nombre de séries, libellé
// d'axe, bornes explicites) impose un vrai rebuild ; une série qui s'allonge
// simplement (un nouveau point poussé par le WebSocket) ne fait que patcher
// les données en place — c'est ce qui évite de reconstruire tout le
// graphique à chaque mesure.
function shapeKey() {
  return `${props.series.length}|${props.series.map((s) => s.label).join("~")}|${props.yLabel}|${props.xMin}|${props.xMax}`;
}

/**
 * Libellé du jour (ou de la plage de jours) réellement visible à l'écran.
 * L'axe X n'affiche que des heures dès qu'on zoome sur une courte période :
 * sans ce repère, impossible de savoir de quel jour il s'agit.
 */
function formatVisibleRange() {
  const scale = chartInstance?.scales?.x;
  if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return "";

  const start = new Date(scale.min);
  const end = new Date(scale.max);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat(locale.value, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  const short = new Intl.DateTimeFormat(locale.value, { day: "numeric", month: "short" });
  const long = new Intl.DateTimeFormat(locale.value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${short.format(start)} - ${long.format(end)}`;
}

function refreshVisibleRange() {
  visibleRange.value = formatVisibleRange();
}

// Un seul point d'entrée pour "la fenêtre visible a bougé" (fin de
// glissement, molette, pincement) : met à jour le libellé de période
// immédiatement, et prévient le parent (anti-rebond 250ms, car la molette
// déclenche plusieurs événements très rapprochés) pour qu'il charge la
// donnée manquante autour du nouveau bord visible.
function handleRangeChange() {
  refreshVisibleRange();
  const scale = chartInstance?.scales?.x;
  if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return;
  clearTimeout(rangeChangeTimer);
  const min = scale.min;
  const max = scale.max;
  rangeChangeTimer = setTimeout(() => emit("rangeChange", { min, max }), 250);
}

function buildChart() {
  if (!canvasRef.value) return;
  chartInstance?.destroy();
  const colors = themeColors();

  chartInstance = new Chart(canvasRef.value, {
    type: "line",
    data: { datasets: buildDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      scales: {
        x: {
          type: "time",
          // Bornes explicites plutôt que laissées à l'étendue des données :
          // voir le commentaire de la prop xMin/xMax. `undefined` laisse
          // Chart.js déduire la borne de l'étendue réelle, comme avant.
          min: props.xMin,
          max: props.xMax,
          time: {
            tooltipFormat: "dd/MM/yyyy HH:mm",
            // Le jour complet est porté par le libellé au-dessus du graphique
            // (voir formatVisibleRange) : les graduations restent courtes.
            displayFormats: {
              minute: "HH:mm",
              hour: "HH:mm",
              day: "dd/MM",
              week: "dd/MM",
              month: "MM/yyyy",
            },
          },
          // autoSkip + une seule ligne d'étiquettes : l'axe reste lisible
          // quel que soit le nombre de points, Chart.js choisit lui-même
          // l'unité (minute/heure/jour) selon la plage affichée/zoomée.
          ticks: { color: colors.text, maxRotation: 0, autoSkip: true, autoSkipPadding: 16 },
          grid: { color: colors.grid },
        },
        y: {
          ticks: { color: colors.text },
          grid: { color: colors.grid },
          title: { display: !!props.yLabel, text: props.yLabel, color: colors.text },
        },
      },
      plugins: {
        legend: {
          display: props.series.length > 1,
          labels: { color: colors.text },
          // Survol d'un rectangle de légende : met sa courbe en avant et
          // estompe les autres (voir setEmphasis) ; onLeave restaure tout.
          onHover: (_event, legendItem) => setEmphasis(legendItem.datasetIndex),
          onLeave: () => clearEmphasis(),
        },
        zoom: {
          // Glisser sur le graphique fait défiler la période (pan), ça ne
          // zoome pas sur la zone surlignée : le zoom par rectangle de
          // sélection (drag) est désactivé au profit de la molette/pincement,
          // plus prévisible et moins facile à déclencher par erreur.
          pan: { enabled: true, mode: "x", onPanComplete: handleRangeChange },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: false },
            pinch: { enabled: true },
            mode: "x",
            onZoomComplete: handleRangeChange,
          },
        },
      },
    },
  });
  lastShape = shapeKey();
  refreshVisibleRange();
}

function patchChart() {
  chartInstance.data.datasets.forEach((ds, i) => {
    ds.data = normalizeData(props.series[i]?.data);
  });
  chartInstance.update("none");
  refreshVisibleRange();
}

function render() {
  if (!canvasRef.value) return;
  if (!chartInstance || shapeKey() !== lastShape) {
    buildChart();
  } else {
    patchChart();
  }
}

// Un point existe (un x valide) mais sa valeur peut être `null` — capteur en
// panne, `data_quality` dégradée (voir app_mock/API : les NULL ne sont jamais
// filtrés, ils sont conservés tels quels). Compter les points ne suffit donc
// pas à savoir si le graphique a quelque chose à montrer : sans ce contrôle
// sur `y`, le site affichait un cadre vide (axe 0-1 par défaut) plutôt que le
// message "aucune donnée", ce qui donnait l'impression à tort que rien n'avait
// été chargé.
const hasData = computed(() =>
  props.series.some((s) => (s.data ?? []).some((point) => Number.isFinite(point.y))),
);

function resetZoom() {
  chartInstance?.resetZoom();
  refreshVisibleRange();
}
defineExpose({ resetZoom });

onMounted(render);
watch(() => props.series, render, { deep: true });
watch(theme, buildChart);
watch(locale, refreshVisibleRange);
// Nouvelle période demandée (ou nouvelles bornes explicites, déjà incluses
// dans shapeKey) : les données changent ET la fenêtre visible doit repartir
// de zéro, sinon un zoom laissé actif masque la nouvelle plage.
watch(
  () => props.rangeKey,
  () => {
    resetZoom();
    render();
  },
);
// Bornes explicites changées seules (sans que rangeKey bouge) : shapeKey()
// les inclut déjà, render() route alors correctement vers buildChart() (et
// donc de nouvelles bornes de zoom "maison") au lieu d'un simple patch qui
// aurait laissé passer le changement inaperçu.
watch(() => [props.xMin, props.xMax], render);
onBeforeUnmount(() => {
  clearTimeout(rangeChangeTimer);
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<template>
  <div class="chart-card">
    <div class="chart-toolbar">
      <span v-if="visibleRange" class="chart-period" :title="t('common.visible_period')">
        {{ visibleRange }}
      </span>
      <div class="chart-toolbar__end">
        <slot name="badge" />
        <button type="button" @click="resetZoom">{{ t("common.reset_zoom") }}</button>
      </div>
    </div>
    <div class="chart-canvas-wrap" :style="{ height: `${height}px` }" :class="{ 'chart-canvas-wrap--empty': !hasData }">
      <canvas ref="canvasRef"></canvas>
      <p v-if="!hasData" class="muted chart-empty-overlay">{{ t("common.no_data") }}</p>
    </div>
  </div>
</template>

<style scoped>
.chart-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.chart-toolbar__end {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.chart-period {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chart-canvas-wrap {
  position: relative;
  width: 100%;
}

/* Aucune valeur exploitable (mesure en panne, data_quality dégradée) : le
   canevas Chart.js reste techniquement affiché (axe par défaut 0-1, sans
   courbe) mais visuellement masqué au profit d'un message explicite, plutôt
   que de laisser un cadre vide qui donne l'impression qu'aucune donnée n'a
   été chargée. */
.chart-canvas-wrap--empty canvas {
  visibility: hidden;
}

.chart-empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}
</style>
