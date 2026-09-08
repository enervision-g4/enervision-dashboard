<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchAlerts } from "@/api/alerts";
import { fetchReadings } from "@/api/readings";
import { fetchSite } from "@/api/sites";
import AlertList from "@/components/AlertList.vue";
import MeasuresChart from "@/components/MeasuresChart.vue";
import TimeRangeSelector from "@/components/TimeRangeSelector.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { rangeHours } from "@/timeRanges";

const RECENT_ALERTS_LIMIT = 5;

// Mêmes mesures et mêmes clés de libellé que HomeView.vue : garder les deux
// synchronisées si une mesure est ajoutée/retirée d'un côté. Affichées ici
// en plus de la consommation — certains sites n'ont pas de consommation
// exploitable à un instant donné (capteur en défaut, `data_quality`
// dégradée) alors que leurs autres mesures sont bien remontées par
// l'ETL/ML ; ne montrer que la consommation donnait l'impression à tort
// qu'un site n'avait "aucune donnée".
const METRICS = [
  { key: "consumption_kw", labelKey: "home.metric_consumption" },
  { key: "voltage_v", labelKey: "home.metric_voltage" },
  { key: "temperature_celsius", labelKey: "home.metric_temperature" },
  { key: "humidity_percent", labelKey: "home.metric_humidity" },
];

const props = defineProps({
  siteId: { type: String, required: true },
});

const { t } = useI18n();

const site = ref(null);
const readings = ref([]);
const recentAlerts = ref([]);
const selectedMetric = ref(METRICS[0].key);
const timeRange = ref("24h");
const loading = ref(true);
const loadError = ref("");
let liveReadingsSocket = null;
let liveAlertsSocket = null;
let readingsToken = 0;

const chartSeries = computed(() => [
  {
    label: t(METRICS.find((m) => m.key === selectedMetric.value)?.labelKey),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r[selectedMetric.value] })),
  },
]);

function newestReadingTimestamp() {
  return readings.value.length ? readings.value[readings.value.length - 1].timestamp : undefined;
}

function newestAlertTimestamp() {
  return recentAlerts.value.reduce(
    (newest, alert) => (!newest || alert.timestamp > newest ? alert.timestamp : newest),
    undefined,
  );
}

async function loadReadings() {
  const token = ++readingsToken;
  const data = await fetchReadings({
    siteId: props.siteId,
    // Fenêtre calculée côté serveur, ancrée sur la donnée la plus récente
    // réellement en base — voir le même commentaire dans HomeView.vue et
    // app/routers/readings.py. Corrige le cas où "1h" n'affichait rien alors
    // que "24h" montrait des données du jour même (léger retard d'ingestion
    // dépassant la période choisie).
    rangeHours: rangeHours(timeRange.value),
    limit: 1000,
  });
  if (token === readingsToken) readings.value = data;
}

async function loadData() {
  loading.value = true;
  try {
    const [siteResult, alertsResult] = await Promise.all([
      fetchSite(props.siteId),
      fetchAlerts({ siteId: props.siteId, limit: RECENT_ALERTS_LIMIT }),
      loadReadings(),
    ]);
    site.value = siteResult;
    recentAlerts.value = alertsResult.items;
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
}

// Nouvelles mesures poussées par le WebSocket : ajoutées à la série (patch
// incrémental côté MeasuresChart), sans recharger toute la page.
function connectLiveReadings() {
  liveReadingsSocket?.close();
  liveReadingsSocket = useLiveSocket(
    "/ws/readings",
    () => ({ site_id: props.siteId, since: newestReadingTimestamp() }),
    (msg) => {
      if (msg.type !== "reading" || msg.data.site_id !== props.siteId) return;
      // Ancré sur l'horodatage le plus récent des données elles-mêmes, pas
      // sur l'horloge du navigateur — même raison que loadReadings ci-dessus.
      const next = [...readings.value, msg.data];
      const newest = next.reduce((max, r) => Math.max(max, new Date(r.timestamp).getTime()), 0);
      const floor = newest - rangeHours(timeRange.value) * 60 * 60 * 1000;
      readings.value = next.filter((reading) => new Date(reading.timestamp).getTime() >= floor);
    },
  );
}

// Nouvelles alertes de ce site : ajoutées en tête de la liste "récentes",
// tronquée à RECENT_ALERTS_LIMIT.
function connectLiveAlerts() {
  liveAlertsSocket?.close();
  liveAlertsSocket = useLiveSocket(
    "/ws/alerts",
    () => ({ site_id: props.siteId, since: newestAlertTimestamp() }),
    (msg) => {
      if (msg.type !== "alert" || msg.data.site_id !== props.siteId) return;
      recentAlerts.value = [msg.data, ...recentAlerts.value].slice(0, RECENT_ALERTS_LIMIT);
    },
  );
}

// Vue Router réutilise ce composant en naviguant d'une fiche site à l'autre
// (même route) : sans ce watcher, les données du site précédent resteraient
// affichées. La mesure sélectionnée revient à la consommation par défaut à
// chaque changement de site, plutôt que de garder un choix qui pourrait ne
// rien afficher pour le nouveau site.
watch(
  () => props.siteId,
  async () => {
    selectedMetric.value = METRICS[0].key;
    await loadData();
    connectLiveReadings();
    connectLiveAlerts();
  },
);
watch(timeRange, () => {
  loadReadings().catch(() => {
    loadError.value = t("common.error_generic");
  });
});

onMounted(async () => {
  await loadData();
  connectLiveReadings();
  connectLiveAlerts();
});
onBeforeUnmount(() => {
  liveReadingsSocket?.close();
  liveAlertsSocket?.close();
});
</script>

<template>
  <main class="app-shell">
    <RouterLink to="/sites">&larr; {{ t("common.back_to_sites") }}</RouterLink>

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <h1>{{ site.site_name }}</h1>
      <p class="muted">
        {{ t(`site_type.${site.site_type}`, site.site_type) }} · {{ site.location }} ·
        {{ site.capacity_kw }} kW · {{ t(`status.${site.status}`, site.status) }}
      </p>

      <div class="chart-controls">
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
        :series="chartSeries"
        :y-label="t(METRICS.find((m) => m.key === selectedMetric)?.labelKey)"
        :range-key="`${siteId}|${timeRange}`"
        :height="360"
      />

      <h2>{{ t("site_detail.recent_alerts") }}</h2>
      <AlertList :alerts="recentAlerts" />
      <p>
        <RouterLink :to="{ path: '/alerts', query: { site_id: siteId } }">
          {{ t("site_detail.see_all_alerts") }} &rarr;
        </RouterLink>
      </p>
    </template>
  </main>
</template>
