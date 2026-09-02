<script setup>
import { onMounted, ref } from "vue";

import { fetchAlerts, fetchReadings, fetchSite } from "@/api/sites";
import AlertList from "@/components/AlertList.vue";

const props = defineProps({
  siteId: { type: String, required: true },
});

const site = ref(null);
const readings = ref([]);
const alerts = ref([]);
const loading = ref(true);
const loadError = ref("");

async function loadData() {
  loading.value = true;
  loadError.value = "";
  try {
    const [siteResult, readingsResult, alertsResult] = await Promise.all([
      fetchSite(props.siteId),
      fetchReadings({ siteId: props.siteId, limit: 50 }),
      fetchAlerts({ siteId: props.siteId }),
    ]);
    site.value = siteResult;
    readings.value = readingsResult;
    alerts.value = alertsResult;
  } catch {
    loadError.value = "Impossible de charger ce site depuis l'API.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <main class="app-shell">
    <RouterLink to="/">&larr; Retour</RouterLink>

    <p v-if="loading">Chargement…</p>
    <p v-else-if="loadError" class="error">{{ loadError }}</p>

    <template v-else>
      <h1>{{ site.site_name }}</h1>
      <p>{{ site.location }} — {{ site.capacity_kw }} kW — statut : {{ site.status }}</p>

      <AlertList :alerts="alerts" />

      <h2>Dernières mesures</h2>
      <table>
        <thead>
          <tr>
            <th>Horodatage</th>
            <th>Consommation (kW)</th>
            <th>Qualité</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reading in readings" :key="reading.timestamp">
            <td>{{ new Date(reading.timestamp).toLocaleString() }}</td>
            <td>{{ reading.consumption_kw ?? "—" }}</td>
            <td>{{ reading.data_quality ?? "—" }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </main>
</template>

<style scoped>
.error {
  color: #d33;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.4rem;
  border-bottom: 1px solid #eee;
}
</style>
