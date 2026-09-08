<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { useAuth } from "@/composables/useAuth";

const { login } = useAuth();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

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
    error.value = t("login.invalid");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="card login-card">
      <img src="/logo.jpeg" alt="" class="login-card__logo" />
      <h1 class="login-card__title">{{ t("login.title") }}</h1>
      <form @submit.prevent="handleSubmit">
        <label class="filter-field">
          {{ t("login.username") }}
          <input v-model="username" type="text" autocomplete="username" autofocus required />
        </label>
        <label class="filter-field">
          {{ t("login.password") }}
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? t("login.submitting") : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.login-card {
  width: 100%;
  max-width: 340px;
  padding: 2rem 1.75rem;
}
.login-card__logo {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  margin: 0 auto 1rem;
}
.login-card__title {
  font-size: 1.15rem;
  text-align: center;
  margin: 0 0 1.5rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.filter-field input {
  font-size: 1rem;
  padding: 0.55rem 0.7rem;
}
form .primary {
  margin-top: 0.25rem;
  padding: 0.6rem 0.9rem;
  font-weight: 600;
}
</style>
