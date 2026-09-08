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
    <div class="login-card">
      <!-- Volet de marque : logo en grand + accroche. Passe au-dessus du
           formulaire (et non à sa gauche) sous 720px. -->
      <div class="login-brand">
        <img src="/logo.jpeg" alt="" class="login-brand__logo" />
        <p class="login-brand__name">{{ t("app.name") }}</p>
        <p class="login-brand__tagline">{{ t("login.tagline") }}</p>
      </div>

      <div class="login-form">
        <h1 class="login-form__title">{{ t("login.heading") }}</h1>
        <p class="login-form__subtitle muted">{{ t("login.subtitle") }}</p>

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
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  /* Halo coloré discret derrière la carte : deux dégradés radiaux plutôt
     qu'une image, pour rester net à toutes les résolutions et suivre le
     thème clair/sombre via les variables de couleur. */
  background:
    radial-gradient(60rem 30rem at 15% -10%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent),
    radial-gradient(45rem 28rem at 110% 110%, color-mix(in srgb, var(--color-severity-critical) 16%, transparent), transparent),
    var(--color-bg);
}

.login-card {
  display: grid;
  grid-template-columns: 15rem 1fr;
  width: 100%;
  max-width: 780px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: 0 18px 45px rgba(15, 20, 40, 0.16);
  overflow: hidden;
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: #fff;
  background: linear-gradient(
    160deg,
    var(--color-primary),
    color-mix(in srgb, var(--color-severity-critical) 70%, var(--color-primary))
  );
}

.login-brand__logo {
  width: 92px;
  height: 92px;
  object-fit: cover;
  border-radius: 20px;
  background: #fff;
  padding: 6px;
  box-shadow: 0 8px 20px rgba(10, 15, 35, 0.25);
  margin-bottom: 0.75rem;
}

.login-brand__name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
}

.login-brand__tagline {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
  line-height: 1.4;
}

.login-form {
  padding: 2.5rem 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-form__title {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}

.login-form__subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-field input {
  font-size: 1rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
}

form .primary {
  margin-top: 0.5rem;
  padding: 0.65rem 0.9rem;
  border-radius: 8px;
  font-weight: 600;
}

@media (max-width: 720px) {
  .login-card {
    grid-template-columns: 1fr;
    max-width: 400px;
  }

  .login-brand {
    padding: 1.75rem 1.5rem;
  }

  .login-brand__logo {
    width: 68px;
    height: 68px;
    border-radius: 16px;
  }

  .login-form {
    padding: 1.75rem 1.5rem;
  }
}
</style>
