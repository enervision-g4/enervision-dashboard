<script setup>
import { useAuth } from "@/composables/useAuth";

const { isAuthenticated, logout } = useAuth();

function handleLogout() {
  logout();
  window.location.href = "/login";
}
</script>

<template>
  <header v-if="isAuthenticated" class="app-header">
    <strong>EnerVision</strong>
    <button @click="handleLogout">Se déconnecter</button>
  </header>
  <RouterView />
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd;
}
</style>
