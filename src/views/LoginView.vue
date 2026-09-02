<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuth } from "@/composables/useAuth";

const { login } = useAuth();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value, password.value);
    router.push(route.query.redirect || "/");
  } catch {
    error.value = "Identifiants invalides.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="app-shell login-shell">
    <h1>EnerVision — Connexion</h1>
    <form @submit.prevent="handleSubmit">
      <label>
        Utilisateur
        <input v-model="username" type="text" autocomplete="username" required />
      </label>
      <label>
        Mot de passe
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? "Connexion…" : "Se connecter" }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-shell {
  max-width: 320px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.error {
  color: #d33;
}
</style>
