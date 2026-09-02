<script setup>
defineProps({
  site: { type: Object, required: true },
});
</script>

<template>
  <RouterLink :to="`/sites/${site.site_id}`" class="card">
    <h3>{{ site.site_name }}</h3>
    <p>{{ site.site_type }} — {{ site.location }}</p>
    <p>Capacité : {{ site.capacity_kw }} kW</p>
    <p>Statut : {{ site.status }}</p>
  </RouterLink>
</template>

<style scoped>
.card {
  display: block;
  color: inherit;
  text-decoration: none;
}
</style>
