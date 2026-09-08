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
import { rangeHours, toIsoFromLocal } from "@/timeRanges";

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
// Plage personnalisée ("Depuis"/"Jusqu'à", ex. revenir sur le mois d'août) :
// dès que `customStart` est renseigné elle prend le pas sur les boutons de
// période 1h/6h/24h/7j. Vider les deux champs (le "×" natif du champ
// datetime-local) revient au bouton de période sélectionné.
const customStart = ref("");
const customEnd = ref("");
const hasCustomRange = computed(() => !!customStart.value);
const loading = ref(true);
const loadError = ref("");
let liveReadingsSocket = null;
let liveAlertsSocket = null;
let readingsToken = 0;

// Bornes (ms epoch) de ce qui est effectivement chargé en mémoire pour la
// période courante — sert à décider, quand on glisse/zoome sur le graphique,
// s'il faut aller chercher des données supplémentaires (voir
// onChartRangeChange). Remises à zéro à chaque nouveau chargement.
let loadedStartMs = null;
let loadedEndMs = null;

// Bornes explicites transmises à MeasuresChart (voir sa prop xMin/xMax) :
// contrairement à loadedStartMs/loadedEndMs (qui s'étendent au fil des
// glissements pour savoir quoi recharger), celles-ci ne bougent qu'à chaque
// chargement délibéré (changement de période) — c'est ce qui garantit que
// l'axe affiché correspond exactement à la période choisie.
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
// zoom/pan quand elle change, mais PAS quand on charge simplement plus de
// données en glissant sur le graphique (extension de fenêtre).
const windowKey = computed(() =>
  hasCustomRange.value ? `custom|${customStart.value}|${customEnd.value}` : timeRange.value,
);

function newestReadingTimestamp() {
  return readings.value.length ? readings.value[readings.value.length - 1].timestamp : undefined;
}

function newestAlertTimestamp() {
  return recentAlerts.value.reduce(
    (newest, alert) => (!newest || alert.timestamp > newest ? alert.timestamp : newest),
    undefined,
  );
}

/** Paramètres de fenêtre pour l'API : plage personnalisée si renseignée,
 * sinon la période préréglée (calculée côté serveur, voir plus bas). */
function windowParams() {
  if (hasCustomRange.value) {
    return {
      startTime: toIsoFromLocal(customStart.value),
      endTime: toIsoFromLocal(customEnd.value) || new Date().toISOString(),
    };
  }
  // Fenêtre calculée côté serveur, ancrée sur la donnée la plus récente
  // réellement en base — voir le même commentaire dans HomeView.vue et
  // app/routers/readings.py. Corrige le cas où "1h" n'affichait rien alors
  // que "24h" montrait des données du jour même (léger retard d'ingestion
  // dépassant la période choisie).
  return { rangeHours: rangeHours(timeRange.value) };
}

/** Mémorise la fenêtre effectivement couverte par `data` (voir
 * onChartRangeChange) et fixe les bornes explicites du graphique
 * (chartXMin/chartXMax) sur cette même fenêtre, pour que l'axe affiché
 * corresponde à la période demandée dès le chargement. À défaut de donnée,
 * on retombe sur la fenêtre demandée, pour ne pas la redemander en boucle. */
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
  const MAX_POINTS = 20000;
  if (readings.value.length > MAX_POINTS) {
    readings.value = readings.value.slice(readings.value.length - MAX_POINTS);
  }
}

async function loadReadings() {
  const token = ++readingsToken;
  const params = windowParams();
  const data = await fetchReadings({ siteId: props.siteId, limit: 1000, ...params });
  if (token !== readingsToken) return;
  readings.value = data;
  rememberLoadedBounds(data, params);
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
  if (loadedStartMs === null) return;
  const span = max - min;
  if (!(span > 0)) return;
  const margin = span * 0.5;

  if (min - margin < loadedStartMs && !extendingBefore) {
    extendingBefore = true;
    const targetStart = new Date(min - span).toISOString();
    const targetEnd = new Date(loadedStartMs).toISOString();
    try {
      const older = await fetchReadings({
        siteId: props.siteId,
        startTime: targetStart,
        endTime: targetEnd,
        limit: 1000,
      });
      mergeReadings(older);
      loadedStartMs = Math.min(loadedStartMs, new Date(targetStart).getTime());
    } catch {
      // Le glissement reste utilisable même si cette extension échoue.
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
        siteId: props.siteId,
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
/** Sélection d'un bouton de période préréglée : efface toute plage
 * personnalisée en cours, sinon elle resterait prioritaire et le bouton
 * cliqué n'aurait visiblement aucun effet. */
function selectPreset(key) {
  customStart.value = "";
  customEnd.value = "";
  timeRange.value = key;
}

// Nouvelle période (préréglée ou personnalisée) : on recharge. Anti-rebond
// léger : la saisie dans les champs "Depuis"/"Jusqu'à" ne doit pas
// déclencher une requête par caractère.
let windowChangeTimer = null;
watch(windowKey, () => {
  clearTimeout(windowChangeTimer);
  windowChangeTimer = setTimeout(() => {
    loadReadings().catch(() => {
      loadError.value = t("common.error_generic");
    });
  }, 350);
});
onBeforeUnmount(() => clearTimeout(windowChangeTimer));

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
        :series="chartSeries"
        :y-label="t(METRICS.find((m) => m.key === selectedMetric)?.labelKey)"
        :range-key="`${siteId}|${windowKey}|${chartXMin}|${chartXMax}`"
        :x-min="chartXMin"
        :x-max="chartXMax"
        :height="360"
        @range-change="onChartRangeChange"
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
