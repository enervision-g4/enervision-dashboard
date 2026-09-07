<script setup>
import { useAuth } from "@/composables/useAuth";
import Sidebar from "@/components/Sidebar.vue";
import Topbar from "@/components/Topbar.vue";

const { isAuthenticated } = useAuth();
</script>

<template>
  <div v-if="isAuthenticated" class="layout">
    <Sidebar />
    <div class="main-content">
      <Topbar />
      <div class="main-scroll">
        <RouterView />
      </div>
    </div>
  </div>
  <RouterView v-else />
</template>
