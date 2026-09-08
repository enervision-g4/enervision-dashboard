<script setup>
import { useI18n } from "vue-i18n";

import ProfileMenu from "@/components/ProfileMenu.vue";

const { t } = useI18n();
</script>

<template>
  <header class="topbar">
    <span class="topbar-brand">{{ t("app.name") }}</span>
    <ProfileMenu />
  </header>
</template>
