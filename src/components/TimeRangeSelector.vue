<script setup>
const RANGES = [
  { key: "1h", hours: 1 },
  { key: "6h", hours: 6 },
  { key: "24h", hours: 24 },
  { key: "7d", hours: 24 * 7 },
];

const props = defineProps({
  modelValue: { type: String, required: true },
  // Permet de réutiliser ce même composant (bouton-groupe) pour un autre
  // découpage que les périodes de mesures par défaut — ex. l'horizon de
  // prévision de PredictionsView, qui n'a ni les mêmes clés ni les mêmes
  // libellés. `label` est ce qui s'affiche sur le bouton ; `key`, la valeur
  // émise. Par défaut : les périodes historiques habituelles (1h/6h/24h/7j).
  options: {
    type: Array,
    // Ne référence pas RANGES : defineProps() est hissé hors du setup() par
    // le compilateur, il ne peut pas fermer sur une variable du module.
    default: () => [
      { key: "1h", label: "1h" },
      { key: "6h", label: "6h" },
      { key: "24h", label: "24h" },
      { key: "7d", label: "7d" },
    ],
  },
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
      v-for="option in options"
      :key="option.key"
      type="button"
      :class="{ primary: modelValue === option.key }"
      @click="select(option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.time-range-selector {
  display: inline-flex;
  gap: 0.35rem;
}
</style>
