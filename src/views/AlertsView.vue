<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchAlerts, fetchAlertsSummary } from "@/api/alerts";
import { fetchSites } from "@/api/sites";
import AlertsSeverityChart from "@/components/AlertsSeverityChart.vue";
import Pagination from "@/components/Pagination.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { SEVERITY_ORDER } from "@/severity";

// Les champs "Depuis"/"Jusqu'à" émettent une valeur à chaque fragment saisi
// (jour, puis mois, puis année…) : sans ce délai, chaque frappe déclenchait
// une requête, dont des dates intermédiaires absurdes.
const FILTER_DEBOUNCE_MS = 350;
// Plusieurs alertes peuvent arriver coup sur coup : on ne recharge qu'une
// fois pour la rafale plutôt qu'une fois par alerte.
const LIVE_RELOAD_DEBOUNCE_MS = 1000;

const props = defineProps({
  site_id: { type: String, default: "" },
  severity: { type: String, default: "" },
});

const { t } = useI18n();

const sites = ref([]);
const items = ref([]);
const total = ref(0);
const severityCounts = ref({});
const loading = ref(true);
const loadError = ref("");
let liveSocket = null;
let filterTimer = null;
let liveReloadTimer = null;
// Jeton de requête : seule la réponse de la requête la plus récente est
// appliquée. Sans ça, une réponse lente lancée avec les filtres précédents
// pouvait écraser celle des filtres courants — les filtres semblaient alors
// « ne plus fonctionner » alors que la requête, elle, était correcte.
let requestToken = 0;

const filters = reactive({
  siteId: props.site_id || "",
  severity: props.severity || "",
  startTime: "",
  endTime: "",
});
const sortBy = ref("timestamp");
const order = ref("desc");
const page = ref(1);
const limit = ref(20);

function severityClass(severity) {
  return `badge badge--${severity ?? "info"}`;
}

/** Convertit une valeur de <input type="datetime-local"> en ISO UTC. */
function toIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function currentQuery() {
  return {
    siteId: filters.siteId || undefined,
    severity: filters.severity || undefined,
    startTime: toIso(filters.startTime),
    endTime: toIso(filters.endTime),
  };
}

async function loadAlerts({ silent = false } = {}) {
  const token = ++requestToken;
  if (!silent) loading.value = true;
  try {
    const data = await fetchAlerts({
      ...currentQuery(),
      sortBy: sortBy.value,
      order: order.value,
      page: page.value,
      limit: limit.value,
    });
    if (token !== requestToken) return; // Réponse périmée : une requête plus récente est en cours.
    items.value = data.items;
    total.value = data.total;
    loadError.value = "";
  } catch {
    if (token !== requestToken) return;
    loadError.value = t("common.error_generic");
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

async function loadSeverityCounts() {
  const { siteId, startTime, endTime } = currentQuery();
  try {
    severityCounts.value = await fetchAlertsSummary({ siteId, startTime, endTime });
  } catch {
    severityCounts.value = {};
  }
}

function reload({ silent = false } = {}) {
  loadAlerts({ silent });
  loadSeverityCounts();
}

function toggleSort(column) {
  if (sortBy.value === column) {
    order.value = order.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = column;
    order.value = "desc";
  }
}

function onLimitChange(newLimit) {
  limit.value = newLimit;
  page.value = 1;
  loadAlerts();
}

// Tout changement de filtre repart de la page 1 : rester sur une page qui
// n'existe plus une fois le filtre appliqué serait déroutant. Le site filtré
// change aussi l'abonnement temps réel.
watch(
  () => [filters.siteId, filters.severity, filters.startTime, filters.endTime],
  (next, previous) => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      page.value = 1;
      reload();
      if (next[0] !== previous?.[0]) connectLive();
    }, FILTER_DEBOUNCE_MS);
  },
);
// Le tri s'applique immédiatement (clic sur un en-tête, pas de saisie).
watch([sortBy, order], () => {
  page.value = 1;
  loadAlerts();
});
watch(page, () => loadAlerts());

/**
 * Une nouvelle alerte arrive en temps réel : on recharge discrètement la
 * page 1 (la plus probable pour repérer du nouveau). Le rechargement est
 * groupé et n'a lieu que si l'alerte correspond aux filtres affichés — sinon
 * la liste se rechargeait pour des alertes qu'elle n'a même pas à montrer,
 * ce qui la faisait clignoter en permanence.
 */
function matchesFilters(alert) {
  if (filters.severity && alert.severity !== filters.severity) return false;
  // Comparaison sur des dates, pas sur les chaînes ISO : l'API et le champ
  // datetime-local ne les écrivent pas avec la même précision.
  const at = new Date(alert.timestamp).getTime();
  if (filters.startTime && at < new Date(filters.startTime).getTime()) return false;
  if (filters.endTime && at > new Date(filters.endTime).getTime()) return false;
  return true;
}

/** Alerte la plus récente déjà affichée (l'ordre du tableau suit le tri
 *  choisi, qui n'est pas forcément chronologique). */
function newestLoadedTimestamp() {
  return items.value.reduce(
    (newest, alert) => (!newest || alert.timestamp > newest ? alert.timestamp : newest),
    undefined,
  );
}

function connectLive() {
  liveSocket?.close();
  liveSocket = useLiveSocket(
    "/ws/alerts",
    () => ({
      site_id: filters.siteId || undefined,
      // Reprend le flux à l'alerte la plus récente déjà affichée : ni trou,
      // ni rejeu de tout l'historique à chaque (re)connexion.
      since: newestLoadedTimestamp(),
    }),
    (msg) => {
      if (msg.type !== "alert" || !matchesFilters(msg.data)) return;
      clearTimeout(liveReloadTimer);
      liveReloadTimer = setTimeout(() => {
        loadSeverityCounts();
        if (page.value === 1) loadAlerts({ silent: true });
      }, LIVE_RELOAD_DEBOUNCE_MS);
    },
  );
}

onMounted(async () => {
  try {
    sites.value = await fetchSites();
  } catch {
    // Non bloquant : le filtre par site sera juste vide si ça échoue.
  }
  await Promise.all([loadAlerts(), loadSeverityCounts()]);
  connectLive();
});
onBeforeUnmount(() => {
  liveSocket?.close();
  clearTimeout(filterTimer);
  clearTimeout(liveReloadTimer);
});
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("alerts.title") }}</h1>

    <div class="filters-bar">
      <label class="filter-field">
        {{ t("alerts.site") }}
        <select v-model="filters.siteId">
          <option value="">{{ t("common.all_sites") }}</option>
          <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
            {{ site.site_name }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        {{ t("alerts.severity") }}
        <select v-model="filters.severity">
          <option value="">{{ t("common.all_severities") }}</option>
          <option v-for="severity in SEVERITY_ORDER" :key="severity" :value="severity">
            {{ t(`severity.${severity}`) }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        {{ t("common.from") }}
        <input v-model="filters.startTime" type="datetime-local" />
      </label>

      <label class="filter-field">
        {{ t("common.to") }}
        <input v-model="filters.endTime" type="datetime-local" />
      </label>

      <button v-if="filters.siteId || filters.severity || filters.startTime || filters.endTime" type="button" @click="Object.assign(filters, { siteId: '', severity: '', startTime: '', endTime: '' })">
        {{ t("common.reset_filters") }}
      </button>
    </div>

    <h2>{{ t("alerts.chart_title") }}</h2>
    <AlertsSeverityChart :counts="severityCounts" />

    <p v-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <table>
        <thead>
          <tr>
            <th class="sortable" @click="toggleSort('severity')">
              {{ t("alerts.severity") }} <span v-if="sortBy === 'severity'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
            <th class="sortable" @click="toggleSort('site_id')">
              {{ t("alerts.site") }} <span v-if="sortBy === 'site_id'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
            <th>{{ t("alerts.message") }}</th>
            <th class="sortable" @click="toggleSort('timestamp')">
              {{ t("alerts.timestamp") }} <span v-if="sortBy === 'timestamp'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !items.length">
            <td colspan="4" class="muted">{{ t("common.loading") }}</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="4" class="muted">{{ t("alerts.none") }}</td>
          </tr>
          <tr v-for="alert in items" :key="alert.alert_id">
            <td><span :class="severityClass(alert.severity)">{{ t(`severity.${alert.severity}`, alert.severity) }}</span></td>
            <td>{{ alert.site_id }}</td>
            <td>{{ alert.message }}</td>
            <td class="tabular-nums">{{ new Date(alert.timestamp).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>

      <Pagination
        :page="page"
        :total="total"
        :limit="limit"
        @update:page="(p) => (page = p)"
        @update:limit="onLimitChange"
      />
    </template>
  </main>
</template>
