<script setup>
import { computed, ref, watch } from "vue";
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

// "Autre" quand la limite active ne fait pas partie des valeurs fixes
// (ex. une valeur personnalisée saisie précédemment, ou une prop initiale
// hors liste) : évite que le <select> retombe silencieusement sur la
// première option sans refléter la vraie limite utilisée.
const limitChoice = ref(FIXED_LIMITS.includes(props.limit) ? props.limit : "custom");
const customLimit = ref(FIXED_LIMITS.includes(props.limit) ? 20 : props.limit);

watch(
  () => props.limit,
  (value) => {
    limitChoice.value = FIXED_LIMITS.includes(value) ? value : "custom";
    if (!FIXED_LIMITS.includes(value)) customLimit.value = value;
  },
);

function onLimitChoiceChange() {
  if (limitChoice.value === "custom") {
    emit("update:limit", customLimit.value);
  } else {
    emit("update:limit", limitChoice.value);
  }
}

function onCustomLimitChange() {
  if (limitChoice.value === "custom" && customLimit.value > 0) {
    emit("update:limit", customLimit.value);
  }
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
      <select v-model="limitChoice" @change="onLimitChoiceChange">
        <option v-for="option in FIXED_LIMITS" :key="option" :value="option">{{ option }}</option>
        <option value="custom">{{ t("common.custom") }}</option>
      </select>
    </label>
    <input
      v-if="limitChoice === 'custom'"
      v-model.number="customLimit"
      type="text"
      inputmode="numeric"
      class="pagination-custom-limit"
      @change="onCustomLimitChange"
    />
  </div>
</template>

<style scoped>
.pagination-limit,
.pagination-custom-limit {
  margin-left: auto;
}
.pagination-custom-limit {
  width: 4.5rem;
}
</style>
