<script setup>
const RANGES = [
  { key: "1h", hours: 1 },
  { key: "6h", hours: 6 },
  { key: "24h", hours: 24 },
  { key: "7d", hours: 24 * 7 },
];

const props = defineProps({
  modelValue: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);

function select(key) {
  emit("update:modelValue", key);
}

defineExpose({ RANGES });
</script>

<template>
  <div class="time-range-selector">
    <button
      v-for="range in RANGES"
      :key="range.key"
      type="button"
      :class="{ primary: modelValue === range.key }"
      @click="select(range.key)"
    >
      {{ range.key }}
    </button>
  </div>
</template>

<style scoped>
.time-range-selector {
  display: inline-flex;
  gap: 0.35rem;
}
</style>
