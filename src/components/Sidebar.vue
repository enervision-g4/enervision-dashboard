<script setup>
import { useI18n } from "vue-i18n";

import { useSidebar } from "@/composables/useSidebar";

const { collapsed, toggleSidebar } = useSidebar();
const { t } = useI18n();
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <RouterLink to="/" class="sidebar-brand" :aria-label="t('app.name')">
        <img src="/logo.jpeg" alt="" class="sidebar-brand__logo" />
        <span v-if="!collapsed" class="sidebar-brand__name">{{ t("app.name") }}</span>
      </RouterLink>
      <button
        type="button"
        class="sidebar-collapse-toggle"
        :aria-label="collapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        :title="collapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        @click="toggleSidebar"
      >
        <svg v-if="collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <RouterLink class="sidebar-link" to="/" :aria-label="t('nav.home')" :title="collapsed ? t('nav.home') : null">
        <span class="sidebar-link__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>
        </span>
        <span v-if="!collapsed">{{ t("nav.home") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/sites" :aria-label="t('nav.sites')" :title="collapsed ? t('nav.sites') : null">
        <span class="sidebar-link__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" /></svg>
        </span>
        <span v-if="!collapsed">{{ t("nav.sites") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/alerts" :aria-label="t('nav.alerts')" :title="collapsed ? t('nav.alerts') : null">
        <span class="sidebar-link__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
        </span>
        <span v-if="!collapsed">{{ t("nav.alerts") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/predictions" :aria-label="t('nav.predictions')" :title="collapsed ? t('nav.predictions') : null">
        <span class="sidebar-link__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
        </span>
        <span v-if="!collapsed">{{ t("nav.predictions") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/recommendations" :aria-label="t('nav.recommendations')" :title="collapsed ? t('nav.recommendations') : null">
        <span class="sidebar-link__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3Z" /></svg>
        </span>
        <span v-if="!collapsed">{{ t("nav.recommendations") }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
