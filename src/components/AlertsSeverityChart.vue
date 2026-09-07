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
const STEP_OPTIONS = [null, 10, 50, 100, 500];
let chartInstance = null;

const entries = computed(() => sortSeverityEntries(props.counts));

function themeColors() {
  return theme.value === "dark"
    ? { text: "#9aa1ac", grid: "#2c3038" }
    : { text: "#5b6270", grid: "#dde1e6" };
}

function render() {
  if (!canvasRef.value) return;
  chartInstance?.destroy();
  const colors = themeColors();
  const labels = entries.value.map(([severity]) => t(`severity.${severity}`, severity));
  const data = entries.value.map(([, count]) => count);
  const colorsBySeverity = entries.value.map(([severity]) => severityColor(severity));

  chartInstance = new Chart(canvasRef.value, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: colorsBySeverity }] },
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

onMounted(render);
watch([entries, theme, stepSize], render, { deep: true });
onBeforeUnmount(() => chartInstance?.destroy());
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
