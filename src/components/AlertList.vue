<script setup>
import { useI18n } from "vue-i18n";

defineProps({
  alerts: { type: Array, required: true },
});

const { t } = useI18n();
</script>

<template>
  <section v-if="alerts.length" class="alerts">
    <ul>
      <li
        v-for="alert in alerts"
        :key="alert.alert_id"
        :class="`card card--${alert.severity === 'critical' ? 'critical' : 'degraded'}`"
      >
        <strong>{{ t(`severity.${alert.severity}`, alert.severity) }}</strong> - {{ alert.message }}
        <br />
        <small class="muted">{{ alert.site_id }} · <span class="tabular-nums">{{ new Date(alert.timestamp).toLocaleString() }}</span></small>
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
