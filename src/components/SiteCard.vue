<script setup>
import { useI18n } from "vue-i18n";

defineProps({
  site: { type: Object, required: true },
});

const { t } = useI18n();
</script>

<template>
  <RouterLink :to="`/sites/${site.site_id}`" class="card site-card">
    <div class="site-card__header">
      <h3>{{ site.site_name }}</h3>
      <span class="badge badge--type">{{ t(`site_type.${site.site_type}`, site.site_type) }}</span>
    </div>
    <p class="muted site-card__location">{{ site.location }}</p>
    <div class="site-card__meta">
      <span>{{ t("sites.capacity") }} : {{ site.capacity_kw }} kW</span>
      <span :class="`badge badge--status-${site.status}`">{{ t(`status.${site.status}`, site.status) }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: block;
  color: inherit;
  text-decoration: none;
}

.site-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.site-card__header h3 {
  margin: 0;
}

.site-card__location {
  margin: 0.35rem 0 0.75rem;
}

.site-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
</style>
