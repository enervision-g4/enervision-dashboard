<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { fetchAlerts } from "@/api/alerts";
import { fetchSites } from "@/api/sites";
import Pagination from "@/components/Pagination.vue";

const REFRESH_INTERVAL_MS = 20_000;

const props = defineProps({
  site_id: { type: String, default: "" },
  severity: { type: String, default: "" },
});

const sites = ref([]);
const items = ref([]);
const total = ref(0);
const loading = ref(true);
const loadError = ref("");
let intervalId = null;

const filters = reactive({
  siteId: props.site_id || "",
  severity: props.severity || "",
  startTime: "",
  endTime: "",
});
const sortBy = ref("timestamp");
const order = ref("desc");
const page = ref(1);
const limit = 20;

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
      limit,
    });
    items.value = data.items;
    total.value = data.total;
    loadError.value = "";
  } catch {
    loadError.value = "Impossible de charger les alertes depuis l'API.";
  } finally {
    loading.value = false;
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

// Tout changement de filtre/tri repart de la page 1 : rester sur une page
// qui n'existe plus une fois le filtre appliqué serait déroutant.
watch([() => filters.siteId, () => filters.severity, () => filters.startTime, () => filters.endTime, sortBy, order], () => {
  page.value = 1;
  loadAlerts();
});
watch(page, () => loadAlerts());

onMounted(async () => {
  try {
    sites.value = await fetchSites();
  } catch {
    // Non bloquant : le filtre par site sera juste vide si ça échoue.
  }
  await loadAlerts();
  intervalId = setInterval(() => loadAlerts({ silent: true }), REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(intervalId));
</script>

<template>
  <main class="app-shell">
    <h1>Alertes</h1>

    <div class="filters-bar">
      <label class="filter-field">
        Site
        <select v-model="filters.siteId">
          <option value="">Tous les sites</option>
          <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
            {{ site.site_name }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        Sévérité
        <select v-model="filters.severity">
          <option value="">Toutes</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>

      <label class="filter-field">
        Depuis
        <input v-model="filters.startTime" type="datetime-local" />
      </label>

      <label class="filter-field">
        Jusqu'à
        <input v-model="filters.endTime" type="datetime-local" />
      </label>
    </div>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <table>
        <thead>
          <tr>
            <th class="sortable" @click="toggleSort('severity')">
              Sévérité <span v-if="sortBy === 'severity'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
            <th class="sortable" @click="toggleSort('site_id')">
              Site <span v-if="sortBy === 'site_id'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
            <th>Message</th>
            <th class="sortable" @click="toggleSort('timestamp')">
              Horodatage <span v-if="sortBy === 'timestamp'">{{ order === "asc" ? "▲" : "▼" }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!items.length">
            <td colspan="4" class="muted">Aucune alerte pour ces filtres.</td>
          </tr>
          <tr v-for="alert in items" :key="alert.alert_id">
            <td><span :class="severityClass(alert.severity)">{{ alert.severity }}</span></td>
            <td>{{ alert.site_id }}</td>
            <td>{{ alert.message }}</td>
            <td>{{ new Date(alert.timestamp).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>

      <Pagination :page="page" :total="total" :limit="limit" @update:page="(p) => (page = p)" />
    </template>
  </main>
</template>
