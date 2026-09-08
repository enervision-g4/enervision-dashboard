<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchPredictions } from "@/api/predictions";
import { fetchReadings } from "@/api/readings";
import { fetchSites } from "@/api/sites";
import MeasuresChart from "@/components/MeasuresChart.vue";
import TimeRangeSelector from "@/components/TimeRangeSelector.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { rangeStartTime } from "@/timeRanges";

// Horizon fixe du modèle (voir enervision-ml ForecastSettings.horizon_hours
// et enervision-api GET /api/v1/predictions) : chaque lot de prévision
// couvre toujours 24 points, un par heure, à partir de la prochaine heure
// pleine suivant sa génération — donc, en pratique, à partir de la dernière
// mesure connue puisque le lot est régénéré toutes les heures.
const FORECAST_HORIZON_HOURS = 24;

const { t } = useI18n();

const sites = ref([]);
const selectedSiteId = ref("");
const timeRange = ref("24h");
const readings = ref([]);
const predictions = ref([]);
const loading = ref(true);
const loadError = ref("");
let liveSocket = null;

const chartSeries = computed(() => [
  {
    label: t("predictions.measures_series"),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r.consumption_kw })),
  },
  {
    label: t("predictions.forecast_series"),
    color: "#d33",
    data: predictions.value.map((p) => ({ x: p.target_timestamp, y: p.predicted_consumption_kw })),
  },
]);

// Toutes les lignes d'un même lot de prévision partagent le même timestamp
// de génération et la même model_version (voir build_prediction_rows côté
// enervision-ml) : la première ligne suffit pour les afficher toutes les deux.
const generatedAt = computed(() => predictions.value[0]?.timestamp);
const modelVersion = computed(() => predictions.value[0]?.model_version);

function newestReadingTimestamp() {
  return readings.value.length ? readings.value[readings.value.length - 1].timestamp : undefined;
}

async function loadReadings() {
  readings.value = await fetchReadings({
    siteId: selectedSiteId.value,
    startTime: rangeStartTime(timeRange.value),
    limit: 1000,
  });
}

// limit=FORECAST_HORIZON_HOURS : avec latest_only (défaut de l'API), les
// lignes du dernier lot sont déjà triées par target_timestamp croissant,
// donc les FORECAST_HORIZON_HOURS premières sont exactement les 24
// prochaines heures prédites.
async function loadPredictions() {
  predictions.value = await fetchPredictions({
    siteId: selectedSiteId.value,
    limit: FORECAST_HORIZON_HOURS,
  });
}

async function loadData() {
  loading.value = true;
  try {
    await Promise.all([loadReadings(), loadPredictions()]);
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
}

// Les nouvelles mesures poussées par le WebSocket font glisser en direct la
// courbe "mesures" ; les prévisions, elles, ne changent qu'au rythme du
// prochain lot ML (horaire) et ne valent pas la peine d'un flux dédié.
function connectLive() {
  liveSocket?.close();
  liveSocket = null;
  if (!selectedSiteId.value) return;
  liveSocket = useLiveSocket(
    "/ws/readings",
    () => ({ site_id: selectedSiteId.value, since: newestReadingTimestamp() }),
    (msg) => {
      if (msg.type !== "reading" || msg.data.site_id !== selectedSiteId.value) return;
      const floor = new Date(rangeStartTime(timeRange.value)).getTime();
      readings.value = [...readings.value, msg.data].filter(
        (reading) => new Date(reading.timestamp).getTime() >= floor,
      );
    },
  );
}

watch(selectedSiteId, async () => {
  await loadData();
  connectLive();
});
// Changer la période affichée ne recharge que les mesures : la fenêtre de
// prévision (les 24 prochaines heures du dernier lot) n'en dépend pas.
watch(timeRange, () => {
  loadReadings().catch(() => {
    loadError.value = t("common.error_generic");
  });
});

onMounted(async () => {
  loading.value = true;
  try {
    sites.value = await fetchSites();
    selectedSiteId.value = sites.value[0]?.site_id ?? "";
    // loadData() gère loadError lui-même (succès comme échec) : ne pas
    // l'écraser après coup, sinon un échec y serait aussitôt remplacé par "".
    if (selectedSiteId.value) {
      await loadData();
    } else {
      loadError.value = "";
    }
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
  connectLive();
});
onBeforeUnmount(() => {
  liveSocket?.close();
});
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("predictions.title") }}</h1>

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>
    <p v-else-if="!sites.length" class="muted">{{ t("common.no_data") }}</p>

    <template v-else>
      <div class="chart-controls">
        <label class="filter-field">
          {{ t("predictions.site") }}
          <select v-model="selectedSiteId">
            <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
              {{ site.site_name }}
            </option>
          </select>
        </label>

        <label class="filter-field">
          {{ t("predictions.history") }}
          <TimeRangeSelector v-model="timeRange" />
        </label>
      </div>

      <p v-if="generatedAt" class="muted">
        {{ t("predictions.generated_at", { date: new Date(generatedAt).toLocaleString() }) }}
        <template v-if="modelVersion">· {{ modelVersion }}</template>
      </p>

      <MeasuresChart
        class="predictions-chart"
        :series="chartSeries"
        :y-label="t('home.metric_consumption')"
        :range-key="`${selectedSiteId}|${timeRange}`"
        :height="420"
      />
    </template>
  </main>
</template>

<style scoped>
.predictions-chart {
  width: 100%;
}
</style>
