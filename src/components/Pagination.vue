<script setup>
import { computed } from "vue";

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  limit: { type: Number, required: true },
});

const emit = defineEmits(["update:page"]);

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)));

function goTo(page) {
  if (page < 1 || page > totalPages.value || page === props.page) return;
  emit("update:page", page);
}
</script>

<template>
  <div class="pagination">
    <button type="button" :disabled="page <= 1" @click="goTo(page - 1)">&larr; Précédent</button>
    <span class="muted">Page {{ page }} / {{ totalPages }} ({{ total }} résultats)</span>
    <button type="button" :disabled="page >= totalPages" @click="goTo(page + 1)">Suivant &rarr;</button>
  </div>
</template>
