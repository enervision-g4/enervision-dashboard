<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useSidebar } from "@/composables/useSidebar";

const { collapsed, toggleSidebar } = useSidebar();
const { t } = useI18n();

const LINKS = [
  { to: "/", key: "nav.home" },
  { to: "/sites", key: "nav.sites" },
  { to: "/alerts", key: "nav.alerts" },
  { to: "/predictions", key: "nav.predictions" },
  { to: "/recommendations", key: "nav.recommendations" },
];

// Menu replié : les liens n'ont plus d'icône, on affiche les deux premières
// lettres du libellé (« Pr » / « Re » restent distinguables, contrairement à
// une seule initiale). Le libellé complet reste accessible en infobulle et
// pour les lecteurs d'écran (aria-label).
const links = computed(() =>
  LINKS.map((link) => {
    const label = t(link.key);
    return { ...link, label, short: label.slice(0, 2) };
  }),
);
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <!-- Le nom de la marque vit désormais dans la Topbar, à côté du menu
           profil : seul le logo reste ici (demande produit). -->
      <RouterLink to="/" class="sidebar-brand" :aria-label="t('app.name')">
        <img src="/logo.jpeg" alt="" class="sidebar-brand__logo" />
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
      <RouterLink
        v-for="link in links"
        :key="link.to"
        class="sidebar-link"
        :to="link.to"
        :aria-label="link.label"
        :title="collapsed ? link.label : null"
      >
        <span v-if="collapsed" class="sidebar-link__short" aria-hidden="true">{{ link.short }}</span>
        <span v-else>{{ link.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
