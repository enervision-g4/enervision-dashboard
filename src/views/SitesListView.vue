<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import { fetchSites } from "@/api/sites";
import SiteCard from "@/components/SiteCard.vue";

const REFRESH_INTERVAL_MS = 20_000;

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
    loadError.value = "Impossible de charger les sites depuis l'API.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  // Rafraîchissement automatique : le statut d'un site peut changer sans
  // action de l'utilisateur (ETL/alerting tournent en continu côté back).
  intervalId = setInterval(() => loadData({ silent: true }), REFRESH_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(intervalId));
</script>

<template>
  <main class="app-shell">
    <h1>Sites</h1>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <div v-else class="card-grid">
      <SiteCard v-for="site in sites" :key="site.site_id" :site="site" />
    </div>
  </main>
</template>
