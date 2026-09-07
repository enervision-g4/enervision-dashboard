<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { fetchAlerts } from "@/api/alerts";
import { fetchReadings } from "@/api/readings";
import { fetchSite } from "@/api/sites";
import AlertList from "@/components/AlertList.vue";
import MeasuresChart from "@/components/MeasuresChart.vue";

const REFRESH_INTERVAL_MS = 20_000;
const RECENT_ALERTS_LIMIT = 5;

const props = defineProps({
  siteId: { type: String, required: true },
});

const site = ref(null);
const readings = ref([]);
const recentAlerts = ref([]);
const loading = ref(true);
const loadError = ref("");
let intervalId = null;

const chartLabels = computed(() =>
  readings.value.map((r) => new Date(r.timestamp).toLocaleString()),
);
const chartSeries = computed(() => [
  { label: "Consommation (kW)", data: readings.value.map((r) => r.consumption_kw) },
]);

async function loadData({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    const [siteResult, readingsResult, alertsResult] = await Promise.all([
      fetchSite(props.siteId),
      fetchReadings({ siteId: props.siteId, limit: 100 }),
      fetchAlerts({ siteId: props.siteId, limit: RECENT_ALERTS_LIMIT }),
    ]);
    site.value = siteResult;
    readings.value = readingsResult;
    recentAlerts.value = alertsResult.items;
    loadError.value = "";
  } catch {
    loadError.value = "Impossible de charger ce site depuis l'API.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  intervalId = setInterval(() => loadData({ silent: true }), REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(intervalId));
</script>

<template>
  <main class="app-shell">
    <RouterLink to="/sites">&larr; Retour aux sites</RouterLink>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <h1>{{ site.site_name }}</h1>
      <p class="muted">
        {{ site.site_type }} · {{ site.location }} · {{ site.capacity_kw }} kW · statut : {{ site.status }}
      </p>

      <MeasuresChart :labels="chartLabels" :series="chartSeries" y-label="Consommation (kW)" />

      <h2>Alertes récentes</h2>
      <AlertList :alerts="recentAlerts" />
      <p>
        <RouterLink :to="{ path: '/alerts', query: { site_id: siteId } }">
          Voir toutes les alertes de ce site &rarr;
        </RouterLink>
      </p>
    </template>
  </main>
</template>
