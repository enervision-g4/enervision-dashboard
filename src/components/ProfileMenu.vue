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

function onKeydown(event) {
  if (event.key === "Escape" && open.value) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="profile-menu">
    <button
      type="button"
      class="profile-menu__trigger"
      :aria-label="t('profile.menu')"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>
    </button>

    <div v-if="open" class="profile-menu__panel" role="menu">
      <button type="button" class="profile-menu__item" role="menuitem" @click="toggleTheme">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" /></svg>
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

      <button type="button" class="profile-menu__item" role="menuitem" @click="handleLogout">
        {{ t("profile.logout") }}
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
}

.profile-menu__trigger svg {
  width: 1.15rem;
  height: 1.15rem;
}

.profile-menu__item svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
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
