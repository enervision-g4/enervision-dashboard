<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchPredictions } from "@/api/predictions";
import { fetchReadings } from "@/api/readings";
import { fetchSites } from "@/api/sites";
import MeasuresChart from "@/components/MeasuresChart.vue";
import TimeRangeSelector from "@/components/TimeRangeSelector.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { rangeHours } from "@/timeRanges";

// Choix proposés pour la longueur de l'horizon affiché : un nombre fixe
// d'heures, ou "toutes" (limit au maximum accepté par l'API — voir
// enervision-api GET /api/v1/predictions, le lot lui-même ne contenant de
// toute façon jamais plus que ForecastSettings.horizon_hours par site).
const HORIZON_HOUR_OPTIONS = [6, 12, 24, 48];
const HORIZON_ALL_KEY = "all";
const HORIZON_ALL_LIMIT = 1000;
const DEFAULT_HORIZON_KEY = "24";

const { t } = useI18n();

const sites = ref([]);
const selectedSiteId = ref("");
const timeRange = ref("24h");
const horizonKey = ref(DEFAULT_HORIZON_KEY);
const readings = ref([]);
const predictions = ref([]);
const loading = ref(true);
const loadError = ref("");
let liveSocket = null;

const horizonOptions = computed(() => [
  ...HORIZON_HOUR_OPTIONS.map((hours) => ({ key: String(hours), label: `${hours}h` })),
  { key: HORIZON_ALL_KEY, label: t("common.all") },
]);

function horizonLimit() {
  return horizonKey.value === HORIZON_ALL_KEY ? HORIZON_ALL_LIMIT : Number(horizonKey.value);
}

// Bornes (ms epoch) de ce que couvrent réellement les mesures chargées — sert
// à décider, en glissant sur le graphique, s'il faut recharger un historique
// plus ancien (voir onChartRangeChange, même logique que HomeView/
// SiteDetailView). Remises à zéro à chaque nouveau chargement de mesures.
let loadedStartMs = null;
let loadedEndMs = null;

// Bornes explicites transmises à MeasuresChart (voir sa prop xMin/xMax) :
// xMin suit le début de l'historique de mesures chargé ; xMax suit la fin de
// l'horizon de prévision affiché (ou, à défaut de prévision, la fin des
// mesures) — sans ça, Chart.js cadrait l'axe sur l'étendue réelle des points,
// qui ne correspondait pas à la période/l'horizon choisis.
const chartXMin = ref(undefined);
const chartXMax = ref(undefined);

const chartSeries = computed(() => [
  {
    label: t("predictions.measures_series"),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r.consumption_kw })),
  },
  {
    label: t("predictions.forecast_series"),
    color: "#fb4d63",
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

/** Mémorise la fenêtre effectivement couverte par les mesures reçues, et fixe
 * la borne basse explicite du graphique sur cette fenêtre. La borne haute est
 * provisoirement calée sur la fin des mesures ; applyForecastBound() la
 * remplace par la fin de l'horizon de prévision dès que celui-ci est connu. */
function rememberMeasuresBounds(data, requestedHours) {
  if (data.length) {
    loadedStartMs = new Date(data[0].timestamp).getTime();
    loadedEndMs = new Date(data[data.length - 1].timestamp).getTime();
  } else {
    loadedEndMs = Date.now();
    loadedStartMs = loadedEndMs - requestedHours * 60 * 60 * 1000;
  }
  chartXMin.value = new Date(loadedStartMs).toISOString();
  chartXMax.value = new Date(loadedEndMs).toISOString();
}

/** Étend la borne haute du graphique jusqu'à la fin de l'horizon de
 * prévision affiché, quand des prévisions sont chargées — sinon elle reste
 * celle des mesures (voir rememberMeasuresBounds). */
function applyForecastBound() {
  const last = predictions.value[predictions.value.length - 1];
  if (last) chartXMax.value = last.target_timestamp;
}

/** Fusionne de nouvelles lignes dans `readings` (dédoublonnées par
 * horodatage, triées) — utilisé par l'extension d'historique au glissement
 * et par le flux temps réel, même logique que HomeView/SiteDetailView. */
function mergeReadings(rows) {
  if (!rows.length) return;
  const byTimestamp = new Map(readings.value.map((r) => [r.timestamp, r]));
  for (const row of rows) byTimestamp.set(row.timestamp, row);
  readings.value = [...byTimestamp.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const MAX_POINTS = 20000;
  if (readings.value.length > MAX_POINTS) {
    readings.value = readings.value.slice(readings.value.length - MAX_POINTS);
  }
}

async function loadReadings() {
  // `rangeHours` : fenêtre calculée côté serveur, ancrée sur la donnée la
  // plus récente réellement en base (voir app/routers/readings.py et le même
  // commentaire dans HomeView.vue) — sinon un léger retard d'ingestion
  // suffisait à vider les périodes courtes ("1h" n'affichait presque rien).
  const hours = rangeHours(timeRange.value);
  const data = await fetchReadings({
    siteId: selectedSiteId.value,
    rangeHours: hours,
    limit: 1000,
  });
  readings.value = data;
  rememberMeasuresBounds(data, hours);
}

// latest_only (défaut de l'API) : uniquement le dernier lot généré pour ce
// site. `limit` vient du sélecteur d'horizon — 1000 ("Tout") dépasse déjà
// largement ce qu'un lot peut contenir, ce qui revient à tout afficher.
async function loadPredictions() {
  predictions.value = await fetchPredictions({
    siteId: selectedSiteId.value,
    limit: horizonLimit(),
  });
}

async function loadData() {
  loading.value = true;
  try {
    await Promise.all([loadReadings(), loadPredictions()]);
    applyForecastBound();
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
}

// Glisser (pan) ou zoomer vers des dates plus anciennes que l'historique
// chargé : on étend d'un "écran" supplémentaire, sans jamais réinitialiser le
// zoom/pan en cours (contrairement à un changement de période/horizon). Pas
// de symétrique côté futur : l'horizon de prévision est borné par le dernier
// lot ML, il n'y a rien de plus à charger au-delà.
let extendingBefore = false;

async function onChartRangeChange({ min, max }) {
  if (loadedStartMs === null) return;
  const span = max - min;
  if (!(span > 0) || min - span * 0.5 >= loadedStartMs || extendingBefore) return;

  extendingBefore = true;
  const targetStart = new Date(min - span).toISOString();
  const targetEnd = new Date(loadedStartMs).toISOString();
  try {
    const older = await fetchReadings({
      siteId: selectedSiteId.value,
      startTime: targetStart,
      endTime: targetEnd,
      limit: 1000,
    });
    mergeReadings(older);
    loadedStartMs = Math.min(loadedStartMs, new Date(targetStart).getTime());
  } catch {
    // Le glissement reste utilisable même si cette extension échoue ; on
    // retentera au prochain glissement.
  } finally {
    extendingBefore = false;
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
      mergeReadings([msg.data]);
      const ts = new Date(msg.data.timestamp).getTime();
      if (loadedEndMs === null || ts > loadedEndMs) loadedEndMs = ts;
    },
  );
}

watch(selectedSiteId, async () => {
  await loadData();
  connectLive();
});
// Changer la période historique ne recharge que les mesures ; changer
// l'horizon ne recharge que les prévisions — chacun retouche ensuite la
// borne haute du graphique (applyForecastBound), au cas où l'autre l'aurait
// dépassée entre-temps.
watch(timeRange, () => {
  loadReadings()
    .then(applyForecastBound)
    .catch(() => {
      loadError.value = t("common.error_generic");
    });
});
watch(horizonKey, () => {
  loadPredictions()
    .then(applyForecastBound)
    .catch(() => {
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

        <label class="filter-field">
          {{ t("predictions.horizon") }}
          <TimeRangeSelector v-model="horizonKey" :options="horizonOptions" />
        </label>
      </div>

      <MeasuresChart
        class="predictions-chart"
        :series="chartSeries"
        :y-label="t('home.metric_consumption')"
        :range-key="`${selectedSiteId}|${timeRange}|${horizonKey}|${chartXMin}|${chartXMax}`"
        :x-min="chartXMin"
        :x-max="chartXMax"
        :height="420"
        @range-change="onChartRangeChange"
      >
        <template v-if="modelVersion" #badge>
          <span class="badge badge--type" :title="t('predictions.generated_at', { date: new Date(generatedAt).toLocaleString() })">
            {{ modelVersion }}
          </span>
        </template>
      </MeasuresChart>
    </template>
  </main>
</template>

<style scoped>
.predictions-chart {
  width: 100%;
}
</style>
