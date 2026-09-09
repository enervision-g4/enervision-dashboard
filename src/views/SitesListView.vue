<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { fetchSites } from "@/api/sites";
import SiteCard from "@/components/SiteCard.vue";

// Pas de flux temps réel dédié au statut des sites côté API : un polling
// espacé reste le plus simple ici (le statut change rarement).
const REFRESH_INTERVAL_MS = 30_000;

const { t } = useI18n();

const sites = ref([]);
const loading = ref(true);
const loadError = ref("");
let intervalId = null;

async function loadData({ silent = false } = {}) {
  if (!silent) loading.value = true;
  try {
    sites.value = await fetchSites();
    loadError.value = "";
  } catch {
    loadError.value = t("common.error_generic");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  intervalId = setInterval(() => loadData({ silent: true }), REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(intervalId));
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("sites.title") }}</h1>

    <p v-if="loading">{{ t("common.loading") }}</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <div v-else class="card-grid">
      <SiteCard v-for="site in sites" :key="site.site_id" :site="site" />
    </div>
  </main>
</template>
