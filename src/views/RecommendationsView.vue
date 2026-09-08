<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchRecommendations } from "@/api/recommendations";
import { fetchSites } from "@/api/sites";

// Pas de flux temps réel dédié pour les recommandations (voir README de
// l'API : seuls /ws/readings et /ws/alerts existent) : un rafraîchissement
// discret suffit, même cadence que le résumé des alertes sur l'accueil.
const REFRESH_INTERVAL_MS = 30_000;
const LIMIT_OPTIONS = [10, 25, 50, 100];

// "open" est le seul statut que enervision-ml écrit aujourd'hui
// (RECOMMENDATION_STATUS dans transform/recommendations.py) : aucune route
// ne permet encore de faire évoluer une recommandation vers un autre statut
// (traitée, écartée...). Le filtre reste prêt à en accueillir d'autres le
// jour où ça change.
const STATUS_OPTIONS = ["open"];

const { t } = useI18n();

const sites = ref([]);
const items = ref([]);
const loading = ref(true);
const loadError = ref("");
let refreshIntervalId = null;
// Jeton de requête : une réponse arrivée en retard (filtres changés
// entre-temps) ne doit pas écraser la liste affichée.
let requestToken = 0;

const filters = reactive({ siteId: "", status: "" });
const limit = ref(25);

const siteNamesById = ref({});

function siteName(siteId) {
  return siteNamesById.value[siteId] ?? siteId;
}

function statusBadgeClass(status) {
  return `badge badge--${status === "open" ? "open" : "info"}`;
}

async function loadRecommendations({ silent = false } = {}) {
  const token = ++requestToken;
  if (!silent) loading.value = true;
  try {
    const data = await fetchRecommendations({
      siteId: filters.siteId || undefined,
      status: filters.status || undefined,
      limit: limit.value,
    });
    if (token !== requestToken) return; // Réponse périmée.
    items.value = data;
    loadError.value = "";
  } catch {
    if (token !== requestToken) return;
    loadError.value = t("common.error_generic");
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

function onLimitChange(event) {
  limit.value = Number(event.target.value);
  loadRecommendations();
}

watch(
  () => [filters.siteId, filters.status],
  () => loadRecommendations(),
);

onMounted(async () => {
  try {
    sites.value = await fetchSites();
    siteNamesById.value = Object.fromEntries(sites.value.map((s) => [s.site_id, s.site_name]));
  } catch {
    // Non bloquant : le filtre par site sera juste vide si ça échoue.
  }
  await loadRecommendations();
  refreshIntervalId = setInterval(() => loadRecommendations({ silent: true }), REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(refreshIntervalId));
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("recommendations.title") }}</h1>

    <div class="filters-bar">
      <label class="filter-field">
        {{ t("recommendations.site") }}
        <select v-model="filters.siteId">
          <option value="">{{ t("common.all_sites") }}</option>
          <option v-for="site in sites" :key="site.site_id" :value="site.site_id">
            {{ site.site_name }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        {{ t("recommendations.status") }}
        <select v-model="filters.status">
          <option value="">{{ t("common.all") }}</option>
          <option v-for="status in STATUS_OPTIONS" :key="status" :value="status">
            {{ t(`recommendations.status_${status}`, status) }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        {{ t("common.per_page") }}
        <select :value="limit" @change="onLimitChange">
          <option v-for="option in LIMIT_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <button v-if="filters.siteId || filters.status" type="button" @click="Object.assign(filters, { siteId: '', status: '' })">
        {{ t("common.reset_filters") }}
      </button>
    </div>

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <ul v-if="items.length" class="recommendations-list">
        <li v-for="recommendation in items" :key="recommendation.recommendation_id" class="card">
          <div class="recommendation-row">
            <span :class="statusBadgeClass(recommendation.status)">
              {{ t(`recommendations.status_${recommendation.status}`, recommendation.status ?? "") }}
            </span>
            <span class="muted tabular-nums">{{ new Date(recommendation.timestamp).toLocaleString() }}</span>
          </div>
          <p class="recommendation-description">{{ recommendation.action_description }}</p>
          <p class="muted">{{ siteName(recommendation.site_id) }}</p>
        </li>
      </ul>
      <p v-else class="muted">{{ t("recommendations.none") }}</p>
    </template>
  </main>
</template>

<style scoped>
.recommendations-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.recommendation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.recommendation-description {
  margin: 0 0 0.35rem;
}
</style>
