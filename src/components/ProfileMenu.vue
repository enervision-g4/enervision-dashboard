<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useAuth } from "@/composables/useAuth";
import { useTheme } from "@/composables/useTheme";
import { setLocale, SUPPORTED_LOCALES } from "@/i18n";

const { logout } = useAuth();
const { theme, toggleTheme } = useTheme();
const { t, locale } = useI18n();

const open = ref(false);
const rootRef = ref(null);

function handleLogout() {
  logout();
  window.location.href = "/login";
}

function onDocumentClick(event) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
  <div ref="rootRef" class="profile-menu">
    <button type="button" class="profile-menu__trigger" @click="open = !open">👤</button>

    <div v-if="open" class="profile-menu__panel">
      <button type="button" class="profile-menu__item" @click="toggleTheme">
        {{ theme === "dark" ? "☀️" : "🌙" }}
        {{ theme === "dark" ? t("profile.theme_light") : t("profile.theme_dark") }}
      </button>

      <div class="profile-menu__item profile-menu__languages">
        <span>{{ t("profile.language") }}</span>
        <div class="profile-menu__lang-buttons">
          <button
            v-for="loc in SUPPORTED_LOCALES"
            :key="loc"
            type="button"
            :class="{ primary: locale === loc }"
            @click="setLocale(loc)"
          >
            {{ loc.toUpperCase() }}
          </button>
        </div>
      </div>

      <button type="button" class="profile-menu__item" @click="handleLogout">
        🚪 {{ t("profile.logout") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-menu {
  position: relative;
}

.profile-menu__trigger {
  border-radius: 999px;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.profile-menu__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-card);
  padding: 0.5rem;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 20;
}

.profile-menu__item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-menu__item:hover {
  background: var(--color-surface-alt);
}

.profile-menu__languages {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  cursor: default;
}

.profile-menu__lang-buttons {
  display: flex;
  gap: 0.35rem;
}

.profile-menu__lang-buttons button {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}
</style>
