<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("coming_soon.predictions_title") }}</h1>
    <div class="card coming-soon-card">
      <svg class="coming-soon-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
      <p class="coming-soon-card__title">{{ t("common.coming_soon") }}</p>
      <p class="muted">{{ t("common.coming_soon_detail") }}</p>
    </div>
  </main>
</template>

<style scoped>
.coming-soon-card {
  max-width: 480px;
  text-align: center;
  padding: 2.5rem 1.5rem;
}
.coming-soon-card__icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-text-muted);
  margin: 0 auto 1rem;
}
.coming-soon-card__title {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}
</style>
