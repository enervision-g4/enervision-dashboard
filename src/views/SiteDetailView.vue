<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchAlerts } from "@/api/alerts";
import { fetchReadings } from "@/api/readings";
import { fetchSite } from "@/api/sites";
import AlertList from "@/components/AlertList.vue";
import MeasuresChart from "@/components/MeasuresChart.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";

const RECENT_ALERTS_LIMIT = 5;

const props = defineProps({
  siteId: { type: String, required: true },
});

const { t } = useI18n();

const site = ref(null);
const readings = ref([]);
const recentAlerts = ref([]);
const loading = ref(true);
const loadError = ref("");
let liveReadingsSocket = null;
let liveAlertsSocket = null;

const chartSeries = computed(() => [
  {
    label: t("site_detail.consumption_chart"),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r.consumption_kw })),
  },
]);

async function loadData() {
  loading.value = true;
  try {
    const [siteResult, readingsResult, alertsResult] = await Promise.all([
      fetchSite(props.siteId),
      fetchReadings({ siteId: props.siteId, limit: 500 }),
      fetchAlerts({ siteId: props.siteId, limit: RECENT_ALERTS_LIMIT }),
    ]);
    site.value = siteResult;
    readings.value = readingsResult;
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
  liveReadingsSocket = useLiveSocket("/ws/readings", { site_id: props.siteId }, (msg) => {
    if (msg.type !== "reading" || msg.data.site_id !== props.siteId) return;
    readings.value = [...readings.value, msg.data];
  });
}

// Nouvelles alertes de ce site : ajoutées en tête de la liste "récentes",
// tronquée à RECENT_ALERTS_LIMIT.
function connectLiveAlerts() {
  liveAlertsSocket?.close();
  liveAlertsSocket = useLiveSocket("/ws/alerts", { site_id: props.siteId }, (msg) => {
    if (msg.type !== "alert" || msg.data.site_id !== props.siteId) return;
    recentAlerts.value = [msg.data, ...recentAlerts.value].slice(0, RECENT_ALERTS_LIMIT);
  });
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

      <MeasuresChart :series="chartSeries" :y-label="t('site_detail.consumption_chart')" :height="360" />

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
