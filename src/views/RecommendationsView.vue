<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <main class="app-shell">
    <h1>{{ t("coming_soon.recommendations_title") }}</h1>
    <div class="card coming-soon-card">
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
.coming-soon-card__title {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}
</style>
