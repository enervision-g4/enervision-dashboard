<script setup>
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useTheme } from "@/composables/useTheme";

Chart.register(...registerables, zoomPlugin);

const DEFAULT_COLORS = ["#2f6feb", "#2f855a", "#b3720a", "#d33", "#805ad5"];

const props = defineProps({
  // [{ label, color?, data: [{x: Date|string, y: number}] }]
  series: { type: Array, required: true },
  yLabel: { type: String, default: "" },
  height: { type: Number, default: 320 },
});

const { t } = useI18n();
const { theme } = useTheme();
const canvasRef = ref(null);
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

function buildDatasets() {
  return props.series.map((s, i) => ({
    label: s.label,
    data: s.data,
    borderColor: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    backgroundColor: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    tension: 0.25,
    pointRadius: 2,
    spanGaps: true,
  }));
}

// Une "forme" différente (métrique/site changé, nombre de séries) impose un
// vrai rebuild du graphique ; une série qui s'allonge simplement (un nouveau
// point poussé par le WebSocket) ne fait que patcher les données en place —
// c'est ce qui évite de "recharger tout le graphique" à chaque mesure.
function shapeKey() {
  return props.series.map((s) => s.label).join("|");
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
      scales: {
        x: {
          type: "time",
          time: { tooltipFormat: "dd/MM/yyyy HH:mm" },
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
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: true, backgroundColor: "rgba(47,111,235,0.15)" },
            pinch: { enabled: true },
            mode: "x",
          },
        },
      },
    },
  });
  lastShape = shapeKey();
}

function patchChart() {
  chartInstance.data.datasets.forEach((ds, i) => {
    ds.data = props.series[i]?.data ?? [];
  });
  chartInstance.update("none");
}

function render() {
  if (!canvasRef.value) return;
  if (!chartInstance || shapeKey() !== lastShape) {
    buildChart();
  } else {
    patchChart();
  }
}

function resetZoom() {
  chartInstance?.resetZoom();
}
defineExpose({ resetZoom });

onMounted(render);
watch(() => props.series, render, { deep: true });
watch(theme, buildChart);
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<template>
  <div class="chart-card">
    <div class="chart-toolbar">
      <button type="button" @click="resetZoom">{{ t("common.reset_zoom") }}</button>
    </div>
    <div class="chart-canvas-wrap" :style="{ height: `${height}px` }">
      <canvas ref="canvasRef"></canvas>
    </div>
    <p v-if="!series.length || !series.some((s) => s.data.length)" class="muted">
      {{ t("common.no_data") }}
    </p>
  </div>
</template>

<style scoped>
.chart-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}
.chart-canvas-wrap {
  position: relative;
  width: 100%;
}
</style>
