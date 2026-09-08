<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchAlertsSummary } from "@/api/alerts";
import { fetchReadings } from "@/api/readings";
import { fetchSites } from "@/api/sites";
import MeasuresChart from "@/components/MeasuresChart.vue";
import TimeRangeSelector from "@/components/TimeRangeSelector.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { SEVERITY_ORDER, severityColor } from "@/severity";
import { rangeHours } from "@/timeRanges";

// Les tuiles de résumé n'ont pas (encore) de flux temps réel dédié côté API :
// un rafraîchissement discret reste nécessaire, mais bien plus espacé que
// l'ancien polling (les mesures, elles, arrivent désormais par WebSocket).
const SUMMARY_REFRESH_INTERVAL_MS = 30_000;

const METRICS = [
  { key: "consumption_kw", labelKey: "home.metric_consumption" },
  { key: "voltage_v", labelKey: "home.metric_voltage" },
  { key: "temperature_celsius", labelKey: "home.metric_temperature" },
  { key: "humidity_percent", labelKey: "home.metric_humidity" },
];

const { t } = useI18n();

const sites = ref([]);
const selectedSiteId = ref("");
const selectedMetric = ref(METRICS[0].key);
const timeRange = ref("24h");
const readings = ref([]);
const alertsSummary = ref({});
const loading = ref(true);
const loadError = ref("");
let summaryIntervalId = null;
let liveSocket = null;

const chartSeries = computed(() => [
  {
    label: t(METRICS.find((m) => m.key === selectedMetric.value)?.labelKey),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r[selectedMetric.value] })),
  },
]);

const severityTiles = computed(() =>
  SEVERITY_ORDER.filter((severity) => severity in alertsSummary.value).map((severity) => ({
    severity,
    count: alertsSummary.value[severity],
    color: severityColor(severity),
  })),
);

const totalAlerts = computed(() =>
  Object.values(alertsSummary.value).reduce((sum, count) => sum + count, 0),
);

// Jeton de requête : une réponse arrivée en retard (site ou période changés
// entre-temps) ne doit pas écraser la série affichée.
let readingsToken = 0;

async function loadReadings() {
  if (!selectedSiteId.value) return;
  const token = ++readingsToken;
  try {
    const data = await fetchReadings({
      siteId: selectedSiteId.value,
      // `rangeHours` : la fenêtre est calculée côté serveur, ancrée sur la
      // donnée la plus récente réellement en base — immunise les périodes
      // courtes (1h, 6h) contre un léger retard d'ingestion ou un décalage
      // d'horloge entre l'ETL et l'API (voir app/routers/readings.py). Une
      // fenêtre calculée ici depuis l'horloge du navigateur pouvait exclure
      // toute donnée existante dès que ce retard dépassait la période
      // choisie — "1h" apparaissait vide alors que "24h" montrait des
      // données du jour même.
      rangeHours: rangeHours(timeRange.value),
      limit: 1000,
    });
    if (token !== readingsToken) return;
    readings.value = data;
    loadError.value = "";
  } catch {
    if (token === readingsToken) loadError.value = t("common.error_generic");
  }
}

/** Mesure la plus récente déjà chargée : point de reprise du flux temps réel. */
function newestReadingTimestamp() {
  return readings.value.length ? readings.value[readings.value.length - 1].timestamp : undefined;
}

async function loadAlertsSummary() {
  try {
    alertsSummary.value = await fetchAlertsSummary();
  } catch {
    alertsSummary.value = {};
  }
}

// Remplace l'ancien "recharger toutes les 20s même sans donnée nouvelle" :
// un seul point poussé par le WebSocket vient s'ajouter à la série existante,
// et MeasuresChart le patche en place sans reconstruire tout le graphique.
function connectLive() {
  liveSocket?.close();
  liveSocket = null;
  if (!selectedSiteId.value) return;
  liveSocket = useLiveSocket(
    "/ws/readings",
    () => ({ site_id: selectedSiteId.value, since: newestReadingTimestamp() }),
    (msg) => {
      if (msg.type !== "reading" || msg.data.site_id !== selectedSiteId.value) return;
      // La fenêtre affichée glisse avec le temps : on écarte au passage les
      // points sortis de la période choisie, sinon la série grossit sans fin.
      // Ancré sur l'horodatage le plus récent des données elles-mêmes (pas
      // sur l'horloge du navigateur, pour la même raison que côté serveur —
      // voir loadReadings ci-dessus) : sans ça, un léger retard d'ingestion
      // pouvait faire disparaître un point tout juste ajouté.
      const next = [...readings.value, msg.data];
      const newest = next.reduce((max, r) => Math.max(max, new Date(r.timestamp).getTime()), 0);
      const floor = newest - rangeHours(timeRange.value) * 60 * 60 * 1000;
      readings.value = next.filter((reading) => new Date(reading.timestamp).getTime() >= floor);
    },
  );
}

watch(selectedSiteId, async () => {
  await loadReadings();
  connectLive();
});
// Nouvelle période : on recharge, et le graphique remet sa fenêtre visible à
// plat (prop rangeKey) — un zoom laissé actif masquerait la nouvelle plage.
watch(timeRange, loadReadings);

onMounted(async () => {
  loading.value = true;
  try {
    sites.value = await fetchSites();
    selectedSiteId.value = sites.value[0]?.site_id ?? "";
    await Promise.all([loadReadings(), loadAlertsSummary()]);
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }

  connectLive();
  summaryIntervalId = setInterval(loadAlertsSummary, SUMMARY_REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => {
  liveSocket?.close();
  clearInterval(summaryIntervalId);
});
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("home.title") }}</h1>

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <section class="stat-grid">
        <RouterLink to="/alerts" class="stat-tile">
          <div class="stat-tile__value">{{ totalAlerts }}</div>
          <div class="stat-tile__label">{{ t("home.total_alerts") }}</div>
        </RouterLink>
        <RouterLink
          v-for="tile in severityTiles"
          :key="tile.severity"
          :to="{ path: '/alerts', query: { severity: tile.severity } }"
          class="stat-tile"
          :style="{ '--tile-accent': tile.color }"
        >
          <div class="stat-tile__value">{{ tile.count }}</div>
          <div class="stat-tile__label">{{ t(`severity.${tile.severity}`) }}</div>
        </RouterLink>
      </section>

      <div class="chart-controls">
        <label class="filter-field">
          {{ t("home.site") }}
          <select v-model="selectedSiteId">
            <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
              {{ site.site_name }}
            </option>
          </select>
        </label>

        <label class="filter-field">
          {{ t("home.metric") }}
          <select v-model="selectedMetric">
            <option v-for="metric in METRICS" :key="metric.key" :value="metric.key">
              {{ t(metric.labelKey) }}
            </option>
          </select>
        </label>

        <label class="filter-field">
          {{ t("home.period") }}
          <TimeRangeSelector v-model="timeRange" />
        </label>
      </div>

      <MeasuresChart
        class="home-chart"
        :series="chartSeries"
        :y-label="t(METRICS.find((m) => m.key === selectedMetric)?.labelKey)"
        :range-key="`${selectedSiteId}|${timeRange}`"
        :height="420"
      />
    </template>
  </main>
</template>

<style scoped>
.home-chart {
  width: 100%;
}
</style>
