<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { fetchRecommendations } from "@/api/recommendations";
import { fetchSites } from "@/api/sites";
import Pagination from "@/components/Pagination.vue";

// Pas de flux temps réel dédié pour les recommandations (voir README de
// l'API : seuls /ws/readings et /ws/alerts existent) : un rafraîchissement
// discret suffit, même cadence que le résumé des alertes sur l'accueil.
const REFRESH_INTERVAL_MS = 30_000;

// "open" est le seul statut que enervision-ml écrit aujourd'hui
// (RECOMMENDATION_STATUS dans transform/recommendations.py) : aucune route
// ne permet encore de faire évoluer une recommandation vers un autre statut
// (traitée, écartée...). Le filtre reste prêt à en accueillir d'autres le
// jour où ça change.
const STATUS_OPTIONS = ["open"];

// La description ("action_description") est générée côté enervision-ml sous
// la forme fixe "... a YYYY-MM-DD HH:MM UTC, ..." (voir
// transform/recommendations.py, `_build_recommendation`) : on repère cette
// sous-chaîne pour la reformater dans un format lisible selon la langue
// choisie (ex. JJ/MM/AAAA HH:mm en français), plutôt que de la laisser telle
// quelle. On ne convertit pas le fuseau horaire (l'heure reste celle donnée
// par l'API, en UTC) : seule la mise en forme change avec la langue.
const EMBEDDED_DATE_RE = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC/;

const { t, locale } = useI18n();

const sites = ref([]);
const items = ref([]);
const total = ref(0);
const loading = ref(true);
const loadError = ref("");
let refreshIntervalId = null;
// Jeton de requête : une réponse arrivée en retard (filtres changés
// entre-temps) ne doit pas écraser la liste affichée.
let requestToken = 0;

const filters = reactive({ siteId: "", status: "" });
const order = ref("desc");
const page = ref(1);
const limit = ref(25);

const siteNamesById = ref({});

function siteName(siteId) {
  return siteNamesById.value[siteId] ?? siteId;
}

function statusBadgeClass(status) {
  return `badge badge--${status === "open" ? "open" : "info"}`;
}

function formatActionDescription(description) {
  if (!description) return description;
  const match = description.match(EMBEDDED_DATE_RE);
  if (!match) return description;
  const date = new Date(`${match[1]}T${match[2]}:00Z`);
  if (Number.isNaN(date.getTime())) return description;
  const formatted = new Intl.DateTimeFormat(locale.value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
  return description.replace(match[0], `${formatted} UTC`);
}

async function loadRecommendations({ silent = false } = {}) {
  const token = ++requestToken;
  if (!silent) loading.value = true;
  try {
    const data = await fetchRecommendations({
      siteId: filters.siteId || undefined,
      status: filters.status || undefined,
      sortBy: "timestamp",
      order: order.value,
      page: page.value,
      limit: limit.value,
    });
    if (token !== requestToken) return; // Réponse périmée.
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

function toggleOrder() {
  order.value = order.value === "asc" ? "desc" : "asc";
}

function onLimitChange(newLimit) {
  limit.value = newLimit;
  page.value = 1;
  loadRecommendations();
}

// Tout changement de filtre ou de tri repart de la page 1 : rester sur une
// page qui n'existe plus une fois le filtre/tri appliqué serait déroutant.
watch(
  () => [filters.siteId, filters.status, order.value],
  () => {
    page.value = 1;
    loadRecommendations();
  },
);
watch(page, () => loadRecommendations());

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

      <button type="button" class="sort-toggle" @click="toggleOrder">
        {{ t("recommendations.sort_by_date") }} {{ order === "asc" ? "▲" : "▼" }}
      </button>

      <button v-if="filters.siteId || filters.status" type="button" @click="Object.assign(filters, { siteId: '', status: '' })">
        {{ t("common.reset_filters") }}
      </button>
    </div>

    <p v-if="loading && !items.length">{{ t("common.loading") }}</p>
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
          <p class="recommendation-description">{{ formatActionDescription(recommendation.action_description) }}</p>
          <p class="muted">{{ siteName(recommendation.site_id) }}</p>
        </li>
      </ul>
      <p v-else class="muted">{{ t("recommendations.none") }}</p>

      <Pagination
        v-if="items.length"
        :page="page"
        :total="total"
        :limit="limit"
        @update:page="(p) => (page = p)"
        @update:limit="onLimitChange"
      />
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
