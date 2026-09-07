<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { fetchAlertsSummary } from "@/api/alerts";
import { fetchReadings } from "@/api/readings";
import { fetchSites } from "@/api/sites";
import MeasuresChart from "@/components/MeasuresChart.vue";

const REFRESH_INTERVAL_MS = 20_000;

const METRICS = [
  { key: "consumption_kw", label: "Consommation (kW)" },
  { key: "voltage_v", label: "Tension (V)" },
  { key: "temperature_celsius", label: "Température (°C)" },
  { key: "humidity_percent", label: "Humidité (%)" },
];

const sites = ref([]);
const selectedSiteId = ref("");
const selectedMetric = ref(METRICS[0].key);
const readings = ref([]);
const alertsSummary = ref({});
const loading = ref(true);
const loadError = ref("");
let intervalId = null;

const chartLabels = computed(() =>
  readings.value.map((r) => new Date(r.timestamp).toLocaleString()),
);
const chartSeries = computed(() => [
  {
    label: METRICS.find((m) => m.key === selectedMetric.value)?.label,
    data: readings.value.map((r) => r[selectedMetric.value]),
  },
]);

const totalAlerts = computed(() =>
  Object.values(alertsSummary.value).reduce((sum, count) => sum + count, 0),
);

async function loadReadings({ silent = false } = {}) {
  if (!selectedSiteId.value) return;
  try {
    readings.value = await fetchReadings({ siteId: selectedSiteId.value, limit: 200 });
  } catch {
    if (!silent) loadError.value = "Impossible de charger les mesures depuis l'API.";
  }
}

async function loadAlertsSummary() {
  try {
    alertsSummary.value = await fetchAlertsSummary();
  } catch {
    alertsSummary.value = {};
  }
}

watch(selectedSiteId, () => loadReadings());
watch(selectedMetric, () => {}); // le graphique se recalcule via les computed, rien à recharger.

onMounted(async () => {
  loading.value = true;
  try {
    sites.value = await fetchSites();
    selectedSiteId.value = sites.value[0]?.site_id ?? "";
    await Promise.all([loadReadings(), loadAlertsSummary()]);
    loadError.value = "";
  } catch {
    loadError.value = "Impossible de charger les données depuis l'API.";
  } finally {
    loading.value = false;
  }

  intervalId = setInterval(() => {
    loadReadings({ silent: true });
    loadAlertsSummary();
  }, REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(intervalId));
</script>

<template>
  <main class="app-shell">
    <h1>Vue d'ensemble</h1>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <section class="stat-grid">
        <RouterLink to="/alerts" class="stat-tile">
          <div class="stat-tile__value">{{ totalAlerts }}</div>
          <div class="stat-tile__label">Alertes au total</div>
        </RouterLink>
        <RouterLink
          v-for="(count, severity) in alertsSummary"
          :key="severity"
          :to="{ path: '/alerts', query: { severity } }"
          class="stat-tile"
        >
          <div class="stat-tile__value">{{ count }}</div>
          <div class="stat-tile__label">{{ severity }}</div>
        </RouterLink>
      </section>

      <div class="chart-controls">
        <label class="filter-field">
          Site
          <select v-model="selectedSiteId">
            <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
              {{ site.site_name }}
            </option>
          </select>
        </label>

        <label class="filter-field">
          Mesure
          <select v-model="selectedMetric">
            <option v-for="metric in METRICS" :key="metric.key" :value="metric.key">
              {{ metric.label }}
            </option>
          </select>
        </label>
      </div>

      <MeasuresChart
        :labels="chartLabels"
        :series="chartSeries"
        :y-label="METRICS.find((m) => m.key === selectedMetric)?.label"
      />
    </template>
  </main>
</template>
