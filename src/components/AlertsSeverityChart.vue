<script setup>
import { Chart, registerables } from "chart.js";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useTheme } from "@/composables/useTheme";
import { severityColor, sortSeverityEntries } from "@/severity";

Chart.register(...registerables);

const props = defineProps({
  // { critical: 3, high: 1, ... }
  counts: { type: Object, required: true },
});

const { t } = useI18n();
const { theme } = useTheme();
const canvasRef = ref(null);
const stepSize = ref(null); // null = Chart.js choisit automatiquement.
const STEP_OPTIONS = [null, 10, 50, 100, 500, 1000, 2000, 5000];
let chartInstance = null;

const entries = computed(() => sortSeverityEntries(props.counts));

function themeColors() {
  return theme.value === "dark"
    ? { text: "#9aa1ac", grid: "#2c3038" }
    : { text: "#5b6270", grid: "#dde1e6" };
}

function chartData() {
  return {
    labels: entries.value.map(([severity]) => t(`severity.${severity}`, severity)),
    data: entries.value.map(([, count]) => count),
    colors: entries.value.map(([severity]) => severityColor(severity)),
  };
}

function buildChart() {
  if (!canvasRef.value) return;
  chartInstance?.destroy();
  const colors = themeColors();
  const { labels, data, colors: bars } = chartData();

  chartInstance = new Chart(canvasRef.value, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: bars }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.text }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { color: colors.text, stepSize: stepSize.value ?? undefined },
          grid: { color: colors.grid },
        },
      },
    },
  });
}

/**
 * Les compteurs sont rechargés régulièrement (arrivée d'une alerte, changement
 * de filtre) et reviennent le plus souvent identiques. Détruire puis
 * reconstruire le graphique à chaque fois faisait disparaître l'infobulle
 * sous le curseur aussitôt affichée : le graphique clignotait dès qu'on
 * survolait une colonne. On ne reconstruit donc que si la structure change
 * (sévérités présentes) et on se contente sinon de patcher les valeurs — et
 * rien du tout si elles n'ont pas bougé.
 */
function render() {
  if (!chartInstance) {
    buildChart();
    return;
  }

  const { labels, data, colors: bars } = chartData();
  const sameStructure =
    chartInstance.data.labels.length === labels.length &&
    chartInstance.data.labels.every((label, i) => label === labels[i]);

  if (!sameStructure) {
    buildChart();
    return;
  }

  const dataset = chartInstance.data.datasets[0];
  if (dataset.data.length === data.length && dataset.data.every((value, i) => value === data[i])) {
    return; // Rien n'a changé : ne pas toucher au graphique (ni à l'infobulle).
  }

  dataset.data = data;
  dataset.backgroundColor = bars;
  chartInstance.update("none");
}

onMounted(buildChart);
watch(entries, render);
// Un changement de thème ou d'échelle touche aux options du graphique :
// reconstruction complète, mais uniquement dans ces cas-là.
watch([theme, stepSize], buildChart);
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<template>
  <div class="chart-card">
    <div class="chart-toolbar">
      <label class="filter-field">
        {{ t("alerts.chart_scale") }}
        <select v-model.number="stepSize">
          <option v-for="option in STEP_OPTIONS" :key="option ?? 'auto'" :value="option">
            {{ option ?? t("common.auto") }}
          </option>
        </select>
      </label>
    </div>
    <div class="chart-canvas-wrap" style="height: 220px">
      <canvas ref="canvasRef"></canvas>
    </div>
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
