<script setup>
import { useI18n } from "vue-i18n";

import { useSidebar } from "@/composables/useSidebar";

const { collapsed, toggleSidebar } = useSidebar();
const { t } = useI18n();
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <RouterLink to="/" class="sidebar-brand">
        <img src="/logo.jpeg" alt="" class="sidebar-brand__logo" />
        <span v-if="!collapsed" class="sidebar-brand__name">{{ t("app.name") }}</span>
      </RouterLink>
      <button
        type="button"
        class="sidebar-collapse-toggle"
        :title="collapsed ? '»' : '«'"
        @click="toggleSidebar"
      >
        {{ collapsed ? "»" : "«" }}
      </button>
    </div>

    <nav class="sidebar-nav">
      <RouterLink class="sidebar-link" to="/" :title="t('nav.home')">
        <span class="sidebar-link__icon">🏠</span>
        <span v-if="!collapsed">{{ t("nav.home") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/sites" :title="t('nav.sites')">
        <span class="sidebar-link__icon">🏢</span>
        <span v-if="!collapsed">{{ t("nav.sites") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/alerts" :title="t('nav.alerts')">
        <span class="sidebar-link__icon">🔔</span>
        <span v-if="!collapsed">{{ t("nav.alerts") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/predictions" :title="t('nav.predictions')">
        <span class="sidebar-link__icon">📈</span>
        <span v-if="!collapsed">{{ t("nav.predictions") }}</span>
      </RouterLink>
      <RouterLink class="sidebar-link" to="/recommendations" :title="t('nav.recommendations')">
        <span class="sidebar-link__icon">💡</span>
        <span v-if="!collapsed">{{ t("nav.recommendations") }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
