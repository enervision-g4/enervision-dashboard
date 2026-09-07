<script setup>
import { useAuth } from "@/composables/useAuth";
import Sidebar from "@/components/Sidebar.vue";

const { isAuthenticated } = useAuth();
</script>

<template>
  <div v-if="isAuthenticated" class="layout">
    <Sidebar />
    <div class="main-content">
      <RouterView />
    </div>
  </div>
  <RouterView v-else />
</template>
