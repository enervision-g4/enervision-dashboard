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
import { rangeHours, toIsoFromLocal } from "@/timeRanges";

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
// Plage personnalisée ("Depuis"/"Jusqu'à", ex. revenir sur le mois d'août) :
// dès que `customStart` est renseigné elle prend le pas sur les boutons de
// période 1h/6h/24h/7j. Vider les deux champs (le "×" natif du champ
// datetime-local) revient au bouton de période sélectionné.
const customStart = ref("");
const customEnd = ref("");
const hasCustomRange = computed(() => !!customStart.value);
const readings = ref([]);
const alertsSummary = ref({});
const loading = ref(true);
const loadError = ref("");
let summaryIntervalId = null;
let liveSocket = null;

// Bornes (ms epoch) de ce qui est effectivement chargé en mémoire pour le
// site/la période courante — sert à décider, quand on glisse/zoome sur le
// graphique, s'il faut aller chercher des données supplémentaires auprès de
// l'API (voir onChartRangeChange). Remises à zéro à chaque nouveau chargement
// (changement de site ou de période).
let loadedStartMs = null;
let loadedEndMs = null;

// Bornes explicites transmises à MeasuresChart (voir sa prop xMin/xMax) :
// contrairement à loadedStartMs/loadedEndMs ci-dessus (qui s'étendent au fil
// des glissements pour savoir quoi recharger), celles-ci ne bougent qu'à
// chaque chargement délibéré (changement de site/période) — c'est ce qui
// garantit que l'axe affiché correspond exactement à la période choisie,
// plutôt que de s'aligner sur l'étendue réelle des points reçus (qui peut
// être plus courte, ex. léger retard d'ingestion).
const chartXMin = ref(undefined);
const chartXMax = ref(undefined);

const chartSeries = computed(() => [
  {
    label: t(METRICS.find((m) => m.key === selectedMetric.value)?.labelKey),
    data: readings.value.map((r) => ({ x: r.timestamp, y: r[selectedMetric.value] })),
  },
]);

// Identifie la "fenêtre logique" demandée (période préréglée, ou plage
// personnalisée) : passé à MeasuresChart comme rangeKey pour réinitialiser le
// zoom/pan quand elle change. Ne doit PAS changer quand on charge simplement
// plus de données en glissant sur le graphique (extension de fenêtre), sinon
// le pan en cours serait annulé à chaque chargement.
const windowKey = computed(() =>
  hasCustomRange.value ? `custom|${customStart.value}|${customEnd.value}` : timeRange.value,
);

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

/** Paramètres de fenêtre pour l'API : plage personnalisée si renseignée,
 * sinon la période préréglée (calculée côté serveur, voir plus bas). */
function windowParams() {
  if (hasCustomRange.value) {
    return {
      startTime: toIsoFromLocal(customStart.value),
      endTime: toIsoFromLocal(customEnd.value) || new Date().toISOString(),
    };
  }
  // `rangeHours` : la fenêtre est calculée côté serveur, ancrée sur la
  // donnée la plus récente réellement en base — immunise les périodes
  // courtes (1h, 6h) contre un léger retard d'ingestion ou un décalage
  // d'horloge entre l'ETL et l'API (voir app/routers/readings.py). Une
  // fenêtre calculée ici depuis l'horloge du navigateur pouvait exclure toute
  // donnée existante dès que ce retard dépassait la période choisie — "1h"
  // apparaissait vide alors que "24h" montrait des données du jour même.
  return { rangeHours: rangeHours(timeRange.value) };
}

/** Mémorise la fenêtre effectivement couverte par `data`, pour savoir plus
 * tard s'il faut recharger en glissant sur le graphique (voir
 * onChartRangeChange) — et fixe les bornes explicites du graphique
 * (chartXMin/chartXMax) sur cette même fenêtre, pour que l'axe affiché
 * corresponde à la période demandée dès le chargement. À défaut de donnée, on
 * retombe sur la fenêtre demandée : le graphique reste vide mais on sait déjà
 * ce qui a été essayé, évitant de la redemander en boucle. */
function rememberLoadedBounds(data, params) {
  if (data.length) {
    loadedStartMs = new Date(data[0].timestamp).getTime();
    loadedEndMs = new Date(data[data.length - 1].timestamp).getTime();
  } else if (params.startTime && params.endTime) {
    loadedStartMs = new Date(params.startTime).getTime();
    loadedEndMs = new Date(params.endTime).getTime();
  } else {
    loadedEndMs = Date.now();
    loadedStartMs = loadedEndMs - (params.rangeHours ?? 24) * 60 * 60 * 1000;
  }
  chartXMin.value = new Date(loadedStartMs).toISOString();
  chartXMax.value = new Date(loadedEndMs).toISOString();
}

/** Fusionne de nouvelles lignes dans `readings` (dédoublonnées par
 * horodatage, triées) — utilisé aussi bien par l'extension de fenêtre au
 * glisser que par le flux temps réel. */
function mergeReadings(rows) {
  if (!rows.length) return;
  const byTimestamp = new Map(readings.value.map((r) => [r.timestamp, r]));
  for (const row of rows) byTimestamp.set(row.timestamp, row);
  readings.value = [...byTimestamp.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  // Garde-fou : une session laissée ouverte très longtemps ne doit pas faire
  // grossir la série indéfiniment (flux temps réel + glissements successifs).
  const MAX_POINTS = 20000;
  if (readings.value.length > MAX_POINTS) {
    readings.value = readings.value.slice(readings.value.length - MAX_POINTS);
  }
}

async function loadReadings() {
  if (!selectedSiteId.value) return;
  const token = ++readingsToken;
  try {
    const params = windowParams();
    const data = await fetchReadings({ siteId: selectedSiteId.value, limit: 1000, ...params });
    if (token !== readingsToken) return;
    readings.value = data;
    rememberLoadedBounds(data, params);
    loadError.value = "";
  } catch {
    if (token === readingsToken) loadError.value = t("common.error_generic");
  }
}

// Glisser (pan) ou zoomer sur le graphique peut amener la fenêtre visible en
// dehors de ce qui est chargé en mémoire — sans quoi le graphique paraissait
// vide dès qu'on quittait la fenêtre initiale ("je n'ai pas de valeur
// avant"). On étend alors le chargement d'un "écran" supplémentaire de
// chaque côté qui en a besoin, sans jamais réinitialiser le zoom/pan en
// cours (contrairement à un changement de période) — ni chartXMin/chartXMax,
// qui doivent rester ceux du dernier chargement délibéré.
let extendingBefore = false;
let extendingAfter = false;

async function onChartRangeChange({ min, max }) {
  if (!selectedSiteId.value || loadedStartMs === null) return;
  const span = max - min;
  if (!(span > 0)) return;
  const margin = span * 0.5;

  if (min - margin < loadedStartMs && !extendingBefore) {
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

  if (max + margin > loadedEndMs && !extendingAfter) {
    extendingAfter = true;
    const targetStart = new Date(loadedEndMs).toISOString();
    const targetEnd = new Date(max + span).toISOString();
    try {
      const newer = await fetchReadings({
        siteId: selectedSiteId.value,
        startTime: targetStart,
        endTime: targetEnd,
        limit: 1000,
      });
      mergeReadings(newer);
      loadedEndMs = Math.max(loadedEndMs, new Date(targetEnd).getTime());
    } catch {
      // idem
    } finally {
      extendingAfter = false;
    }
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
      // On ajoute simplement le point, sans retirer les plus anciens : on
      // permet désormais de glisser sur le graphique pour voir des données
      // plus anciennes (voir onChartRangeChange), un filtrage systématique
      // basé sur la période préréglée aurait supprimé ces données pourtant
      // affichées à l'écran après un glissement. `mergeReadings` borne quand
      // même la taille totale de la série (garde-fou mémoire).
      mergeReadings([msg.data]);
      const ts = new Date(msg.data.timestamp).getTime();
      if (loadedEndMs === null || ts > loadedEndMs) loadedEndMs = ts;
    },
  );
}

watch(selectedSiteId, async () => {
  await loadReadings();
  connectLive();
});

/** Sélection d'un bouton de période préréglée : efface toute plage
 * personnalisée en cours, sinon elle resterait prioritaire et le bouton
 * cliqué n'aurait visiblement aucun effet. */
function selectPreset(key) {
  customStart.value = "";
  customEnd.value = "";
  timeRange.value = key;
}

// Nouvelle période (préréglée ou personnalisée) : on recharge, et le
// graphique remet sa fenêtre visible à plat (prop rangeKey) — un zoom laissé
// actif masquerait la nouvelle plage. Anti-rebond léger : la saisie dans les
// champs "Depuis"/"Jusqu'à" ne doit pas déclencher une requête par caractère.
let windowChangeTimer = null;
watch(windowKey, () => {
  clearTimeout(windowChangeTimer);
  windowChangeTimer = setTimeout(loadReadings, 350);
});
onBeforeUnmount(() => clearTimeout(windowChangeTimer));

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
          <TimeRangeSelector
            :model-value="hasCustomRange ? '' : timeRange"
            @update:model-value="selectPreset"
          />
        </label>

        <label class="filter-field">
          {{ t("common.from") }}
          <input v-model="customStart" type="datetime-local" />
        </label>
        <label class="filter-field">
          {{ t("common.to") }}
          <input v-model="customEnd" type="datetime-local" />
        </label>
      </div>

      <MeasuresChart
        class="home-chart"
        :series="chartSeries"
        :y-label="t(METRICS.find((m) => m.key === selectedMetric)?.labelKey)"
        :range-key="`${selectedSiteId}|${windowKey}|${chartXMin}|${chartXMax}`"
        :x-min="chartXMin"
        :x-max="chartXMax"
        :height="420"
        @range-change="onChartRangeChange"
      />
    </template>
  </main>
</template>

<style scoped>
.home-chart {
  width: 100%;
}
</style>
