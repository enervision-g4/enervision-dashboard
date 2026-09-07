<script setup>
import { Chart, registerables } from "chart.js";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useTheme } from "@/composables/useTheme";

Chart.register(...registerables);

const DEFAULT_COLORS = ["#2f6feb", "#2f855a", "#b3720a", "#d33", "#805ad5"];

const props = defineProps({
  labels: { type: Array, required: true },
  // [{ label, data: number[], color? }]
  series: { type: Array, required: true },
  yLabel: { type: String, default: "" },
});

const { theme } = useTheme();
const canvasRef = ref(null);
let chartInstance = null;

function themeColors() {
  // Suit le thème clair/sombre : évite un texte/grille illisible une fois
  // le mode sombre activé (Chart.js ne lit pas les variables CSS tout seul).
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

function render() {
  if (!canvasRef.value) return;
  const colors = themeColors();

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(canvasRef.value, {
    type: "line",
    data: { labels: props.labels, datasets: buildDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: colors.text,
      scales: {
        x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
        y: {
          ticks: { color: colors.text },
          grid: { color: colors.grid },
          title: { display: !!props.yLabel, text: props.yLabel, color: colors.text },
        },
      },
      plugins: {
        legend: { display: props.series.length > 1, labels: { color: colors.text } },
      },
    },
  });
}

onMounted(render);
watch(() => [props.labels, props.series, theme.value], render, { deep: true });
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<template>
  <div class="chart-card">
    <canvas ref="canvasRef" height="280"></canvas>
    <p v-if="!series.length || !series.some((s) => s.data.length)" class="muted">
      Aucune mesure à afficher pour cette sélection.
    </p>
  </div>
</template>
