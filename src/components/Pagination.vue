<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const FIXED_LIMITS = [5, 10, 20, 50, 100];

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  limit: { type: Number, required: true },
});

const emit = defineEmits(["update:page", "update:limit"]);

const { t } = useI18n();
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)));

// Si la limite active ne fait pas partie des valeurs proposées (prop initiale
// hors liste), on l'ajoute plutôt que de laisser le <select> retomber
// silencieusement sur la première option sans refléter la limite réelle.
const limitOptions = computed(() =>
  FIXED_LIMITS.includes(props.limit) ? FIXED_LIMITS : [...FIXED_LIMITS, props.limit].sort((a, b) => a - b),
);

function onLimitChange(event) {
  emit("update:limit", Number(event.target.value));
}

function goTo(page) {
  if (page < 1 || page > totalPages.value || page === props.page) return;
  emit("update:page", page);
}
</script>

<template>
  <div class="pagination">
    <button type="button" :disabled="page <= 1" @click="goTo(page - 1)">
      &larr; {{ t("common.previous") }}
    </button>
    <span class="muted tabular-nums">{{ t("common.page") }} {{ page }} / {{ totalPages }} ({{ total }} {{ t("common.results") }})</span>
    <button type="button" :disabled="page >= totalPages" @click="goTo(page + 1)">
      {{ t("common.next") }} &rarr;
    </button>

    <label class="filter-field pagination-limit">
      {{ t("common.per_page") }}
      <select :value="limit" @change="onLimitChange">
        <option v-for="option in limitOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.pagination-limit {
  margin-left: auto;
}
</style>
