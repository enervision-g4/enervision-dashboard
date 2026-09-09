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
// d'heures à partir de maintenant, ou "toutes" (l'intégralité de
// l'historique de prévisions du site, passé compris — voir horizonWindow
// ci-dessous pour comment cette fenêtre est appliquée). Pas de "48h" : le
// service ML ne génère pas encore d'horizon aussi long, l'option n'aurait
// jamais rien affiché de plus que "24h".
const HORIZON_HOUR_OPTIONS = [6, 12, 24];
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

/**
 * Fenêtre temporelle de l'horizon sélectionné.
 *
 * Pour un horizon précis (6h/12h/24h), la fenêtre est ancrée sur la mesure
 * la plus récente réellement en base (même logique que loadReadings — voir
 * aussi app/routers/readings.py) plutôt que sur l'horloge du navigateur :
 * rien ne garantit que enervision-ml ait déjà généré une prévision pile pour
 * l'instant où le navigateur est ouvert.
 *
 * "Tous" (HORIZON_ALL_KEY) n'a volontairement AUCUNE borne, ni basse ni
 * haute : contrairement aux horizons précis (qui ne regardent que vers
 * l'avenir), "Tous" doit montrer l'intégralité de l'historique de
 * prévisions enregistré pour ce site, y compris les créneaux désormais
 * passés — utile pour comparer a posteriori une prévision à la mesure
 * réelle qui a suivi.
 *
 * GET /api/v1/predictions trie par target_timestamp croissant sur TOUT
 * l'historique de prévisions du site (latest_only ne déduplique que les
 * runs successifs d'un même créneau, il ne retire pas les créneaux
 * désormais passés) : demander un petit `limit` côté serveur (ex. 6 pour
 * l'horizon "6h") renvoyait donc les 6 prévisions les plus ANCIENNES jamais
 * générées pour ce site — potentiellement plusieurs jours dans le passé —
 * au lieu des 6 prochaines heures à venir. On récupère donc toujours large
 * (voir loadPredictions) et on découpe nous-mêmes sur cette fenêtre.
 */
function horizonWindow() {
  if (horizonKey.value === HORIZON_ALL_KEY) {
    return { startMs: undefined, endMs: undefined };
  }
  const anchor = newestReadingTimestamp();
  const startMs = anchor ? new Date(anchor).getTime() : Date.now();
  const hours = Number(horizonKey.value);
  return { startMs, endMs: startMs + hours * 60 * 60 * 1000 };
}

// Bornes (ms epoch) de ce que couvrent réellement les mesures chargées — sert
// à décider, en glissant sur le graphique, s'il faut recharger un historique
// plus ancien (voir onChartRangeChange, même logique que HomeView/
// SiteDetailView). Remises à zéro à chaque nouveau chargement de mesures.
let loadedStartMs = null;
let loadedEndMs = null;

// Bornes explicites transmises à MeasuresChart (voir sa prop xMin/xMax),
// entièrement recalculées par applyForecastBound() à chaque chargement :
// xMin suit le début de l'historique de mesures chargé (ou d'une prévision
// plus ancienne encore, avec l'horizon "Tous") ; xMax suit la fin de
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

/** Recalcule les bornes explicites du graphique à partir des mesures
 * (`loadedStartMs`/`loadedEndMs`, jamais modifiées par les prévisions), puis
 * les étend si les prévisions chargées vont plus loin : la borne haute
 * jusqu'à la fin de l'horizon affiché, et — seulement pertinent pour "Tous"
 * — la borne basse si des prévisions remontent plus loin dans le passé que
 * l'historique de mesures chargé. Repartir systématiquement de
 * loadedStartMs/loadedEndMs (plutôt que d'étendre chartXMin/chartXMax en
 * place) évite qu'un passage par "Tous" laisse la borne basse élargie même
 * après être revenu à un horizon précis. */
function applyForecastBound() {
  chartXMin.value = loadedStartMs === null ? undefined : new Date(loadedStartMs).toISOString();
  chartXMax.value = loadedEndMs === null ? undefined : new Date(loadedEndMs).toISOString();
  if (!predictions.value.length) return;

  const first = predictions.value[0];
  const last = predictions.value[predictions.value.length - 1];
  chartXMax.value = last.target_timestamp;
  const firstMs = new Date(first.target_timestamp).getTime();
  if (loadedStartMs === null || firstMs < loadedStartMs) {
    chartXMin.value = first.target_timestamp;
  }
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

// Jetons de requête : "Historique affiché" et "Horizon de prévision" sont
// deux sélecteurs indépendants qui déclenchent chacun leur propre fetch
// (voir les watchers plus bas) — enchaîner deux clics rapprochés sur l'un ou
// l'autre lance deux requêtes en vol, sans garantie qu'elles se résolvent
// dans l'ordre où elles ont été envoyées. Sans ce garde-fou, une réponse
// plus lente pour un réglage déjà abandonné (ex. "7d" cliqué puis vite
// changé pour "6h") pouvait arriver APRÈS la réponse du réglage actuel et
// écraser readings/predictions avec des données périmées — les boutons
// affichaient le bon filtre sélectionné, mais le graphique montrait les
// données d'un réglage précédent. Même mécanisme que `readingsToken` dans
// SiteDetailView.vue / `requestToken` dans RecommendationsView.vue.
let readingsRequestToken = 0;
let predictionsRequestToken = 0;

async function loadReadings() {
  const token = ++readingsRequestToken;
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
  if (token !== readingsRequestToken) return; // Réponse périmée, voir plus haut.
  readings.value = data;
  rememberMeasuresBounds(data, hours);
}

// latest_only (défaut de l'API) : uniquement le dernier lot généré pour ce
// site. On demande toujours large (HORIZON_ALL_LIMIT dépasse déjà largement
// ce qu'un lot peut contenir) puis on découpe nous-mêmes sur la fenêtre de
// l'horizon choisi (voir horizonWindow) — un `limit` serveur plus petit
// aurait tronqué sur les prévisions les plus anciennes, pas les prochaines.
async function loadPredictions() {
  const token = ++predictionsRequestToken;
  const all = await fetchPredictions({
    siteId: selectedSiteId.value,
    limit: HORIZON_ALL_LIMIT,
  });
  if (token !== predictionsRequestToken) return; // Réponse périmée, voir plus haut.
  const { startMs, endMs } = horizonWindow();
  predictions.value = all.filter((p) => {
    const targetMs = new Date(p.target_timestamp).getTime();
    return (startMs === undefined || targetMs >= startMs) && (endMs === undefined || targetMs <= endMs);
  });
}

async function loadData() {
  loading.value = true;
  try {
    // loadPredictions() ancre la fenêtre d'horizon sur la dernière mesure
    // chargée (voir horizonWindow) : doit donc s'exécuter après
    // loadReadings(), pas en parallèle avec elle.
    await loadReadings();
    await loadPredictions();
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

  // Capturé (sans l'incrémenter : cette extension est additive, pas
  // autoritaire comme un chargement principal) pour vérifier après l'attente
  // qu'aucun changement de filtre n'a entre-temps rendu cette extension
  // obsolète. Sans ce garde-fou : glisser/zoomer déclenche cette extension,
  // puis basculer rapidement "Historique affiché" vers un réglage plus
  // court relance loadReadings() (readings.value proprement remplacé) — si
  // CETTE extension met plus longtemps à répondre, son résultat arrivait
  // ensuite et se fusionnait quand même dans readings.value via
  // mergeReadings (additif, jamais un remplacement) : plusieurs semaines de
  // mesures anciennes réapparaissaient alors, reliées au segment récent par
  // une ligne traversant tout le vide entre les deux (mergeReadings ne
  // comble aucun trou, Chart.js relie simplement les points consécutifs).
  const token = readingsRequestToken;
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
    if (token !== readingsRequestToken) return; // Un autre chargement a eu lieu entretemps : cette extension est périmée.
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
