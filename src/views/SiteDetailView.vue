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
import { rangeStartTime } from "@/timeRanges";

const RECENT_ALERTS_LIMIT = 5;

const props = defineProps({
  siteId: { type: String, required: true },
});

const { t } = useI18n();

const site = ref(null);
const readings = ref([]);
const recentAlerts = ref([]);
const timeRange = ref("24h");
const loading = ref(true);
const loadError = ref("");
let liveReadingsSocket = null;
let liveAlertsSocket = null;
let readingsToken = 0;

const chartSeries = computed(() => [
  {
    label: t("site_detail.consumption_chart"),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r.consumption_kw })),
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
    startTime: rangeStartTime(timeRange.value),
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
      const floor = new Date(rangeStartTime(timeRange.value)).getTime();
      readings.value = [...readings.value, msg.data].filter(
        (reading) => new Date(reading.timestamp).getTime() >= floor,
      );
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
// affichées.
watch(
  () => props.siteId,
  async () => {
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
          {{ t("home.period") }}
          <TimeRangeSelector v-model="timeRange" />
        </label>
      </div>

      <MeasuresChart
        :series="chartSeries"
        :y-label="t('site_detail.consumption_chart')"
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
