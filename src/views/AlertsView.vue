<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchAlerts, fetchAlertsSummary } from "@/api/alerts";
import { fetchSites } from "@/api/sites";
import AlertsSeverityChart from "@/components/AlertsSeverityChart.vue";
import Pagination from "@/components/Pagination.vue";
import { useLiveSocket } from "@/composables/useLiveSocket";
import { SEVERITY_ORDER } from "@/severity";

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

async function loadAlerts({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    const data = await fetchAlerts({
      siteId: filters.siteId || undefined,
      severity: filters.severity || undefined,
      startTime: filters.startTime ? new Date(filters.startTime).toISOString() : undefined,
      endTime: filters.endTime ? new Date(filters.endTime).toISOString() : undefined,
      sortBy: sortBy.value,
      order: order.value,
      page: page.value,
      limit: limit.value,
    });
    items.value = data.items;
    total.value = data.total;
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
}

async function loadSeverityCounts() {
  try {
    severityCounts.value = await fetchAlertsSummary({
      siteId: filters.siteId || undefined,
      startTime: filters.startTime ? new Date(filters.startTime).toISOString() : undefined,
      endTime: filters.endTime ? new Date(filters.endTime).toISOString() : undefined,
    });
  } catch {
    severityCounts.value = {};
  }
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

// Tout changement de filtre/tri repart de la page 1 : rester sur une page
// qui n'existe plus une fois le filtre appliqué serait déroutant.
watch([() => filters.siteId, () => filters.severity, () => filters.startTime, () => filters.endTime, sortBy, order], () => {
  page.value = 1;
  loadAlerts();
  loadSeverityCounts();
});
watch(page, () => loadAlerts());

// Une nouvelle alerte arrive en temps réel : si l'utilisateur regarde la
// première page (la plus probable pour repérer du nouveau), on la
// recharge discrètement plutôt que d'attendre un rafraîchissement manuel.
function connectLive() {
  liveSocket = useLiveSocket("/ws/alerts", { site_id: filters.siteId || undefined }, (msg) => {
    if (msg.type !== "alert") return;
    loadSeverityCounts();
    if (page.value === 1) loadAlerts({ silent: true });
  });
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
onBeforeUnmount(() => liveSocket?.close());
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
    </div>

    <h2>{{ t("alerts.chart_title") }}</h2>
    <AlertsSeverityChart :counts="severityCounts" />

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

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
          <tr v-if="!items.length">
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
