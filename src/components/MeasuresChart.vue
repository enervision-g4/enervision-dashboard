<script setup>
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useTheme } from "@/composables/useTheme";

Chart.register(...registerables, zoomPlugin);

const DEFAULT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#fb4d63", "#8b5cf6"];

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
});

const { t, locale } = useI18n();
const { theme } = useTheme();
const canvasRef = ref(null);
const visibleRange = ref("");
let chartInstance = null;
let lastShape = null;

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

function buildDatasets() {
  return props.series.map((s, i) => ({
    label: s.label,
    data: normalizeData(s.data),
    borderColor: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    backgroundColor: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    tension: 0.25,
    pointRadius: 2,
    spanGaps: true,
  }));
}

// Une "forme" différente (métrique/site changé, nombre de séries, libellé
// d'axe) impose un vrai rebuild ; une série qui s'allonge simplement (un
// nouveau point poussé par le WebSocket) ne fait que patcher les données en
// place — c'est ce qui évite de reconstruire tout le graphique à chaque mesure.
function shapeKey() {
  return `${props.series.length}|${props.series.map((s) => s.label).join("~")}|${props.yLabel}`;
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
        legend: { display: props.series.length > 1, labels: { color: colors.text } },
        zoom: {
          pan: { enabled: true, mode: "x", onPanComplete: refreshVisibleRange },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: true, backgroundColor: "rgba(59,130,246,0.15)" },
            pinch: { enabled: true },
            mode: "x",
            onZoomComplete: refreshVisibleRange,
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
// Nouvelle période demandée : les données changent ET la fenêtre visible doit
// repartir de zéro, sinon un zoom laissé actif masque la nouvelle plage.
watch(
  () => props.rangeKey,
  () => {
    resetZoom();
    render();
  },
);
onBeforeUnmount(() => {
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
      <button type="button" @click="resetZoom">{{ t("common.reset_zoom") }}</button>
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
