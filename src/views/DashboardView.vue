<script setup>
import { onMounted, ref } from "vue";

import { fetchAlerts, fetchSites } from "@/api/sites";
import AlertList from "@/components/AlertList.vue";
import SiteCard from "@/components/SiteCard.vue";

const sites = ref([]);
const alerts = ref([]);
const loading = ref(true);
const loadError = ref("");

async function loadData() {
  loading.value = true;
  loadError.value = "";
  try {
    const [sitesResult, alertsResult] = await Promise.all([fetchSites(), fetchAlerts()]);
    sites.value = sitesResult;
    alerts.value = alertsResult;
  } catch {
    loadError.value = "Impossible de charger les données depuis l'API.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <main class="app-shell">
    <h1>Vue d'ensemble des sites</h1>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <AlertList :alerts="alerts" />

      <div class="card-grid">
        <SiteCard v-for="site in sites" :key="site.site_id" :site="site" />
      </div>
    </template>
  </main>
</template>

<style scoped>
.error {
  color: #d33;
}
</style>
