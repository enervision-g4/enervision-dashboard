<script setup>
defineProps({
  alerts: { type: Array, required: true },
});
</script>

<template>
  <section v-if="alerts.length" class="alerts">
    <h2>Alertes actives</h2>
    <ul>
      <li
        v-for="alert in alerts"
        :key="alert.alert_id"
        :class="`card card--${alert.severity === 'critical' ? 'critical' : 'degraded'}`"
      >
        <strong>{{ alert.severity }}</strong> — {{ alert.message }}
        <br />
        <small>{{ alert.site_id }} · {{ new Date(alert.timestamp).toLocaleString() }}</small>
      </li>
    </ul>
  </section>
</template>

<style scoped>
ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
