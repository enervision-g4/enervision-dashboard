<script setup>
import { useI18n } from "vue-i18n";

import { severityColor } from "@/severity";

defineProps({
  alerts: { type: Array, required: true },
});

const { t } = useI18n();

function severityClass(severity) {
  return `badge badge--${severity ?? "info"}`;
}
</script>

<template>
  <section v-if="alerts.length" class="alerts">
    <ul>
      <li
        v-for="alert in alerts"
        :key="alert.alert_id"
        class="card alert-card"
        :style="{ '--alert-accent': severityColor(alert.severity) }"
      >
        <span :class="severityClass(alert.severity)">{{ t(`severity.${alert.severity}`, alert.severity) }}</span>
        - {{ alert.message }}
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

/* Une couleur par sévérité (voir src/severity.js) plutôt que la précédente
   distinction binaire "critical vs le reste" (card--critical/card--degraded),
   qui affichait faible et moyenne avec exactement la même couleur. */
.alert-card {
  border-left: 3px solid var(--alert-accent);
}
</style>
