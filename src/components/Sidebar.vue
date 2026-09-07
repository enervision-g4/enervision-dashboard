<script setup>
import { useAuth } from "@/composables/useAuth";
import { useTheme } from "@/composables/useTheme";

const { logout } = useAuth();
const { theme, toggleTheme } = useTheme();

function handleLogout() {
  logout();
  window.location.href = "/login";
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">EnerVision</div>

    <nav class="sidebar-nav">
      <RouterLink class="sidebar-link" to="/">Accueil</RouterLink>
      <RouterLink class="sidebar-link" to="/sites">Sites</RouterLink>
      <RouterLink class="sidebar-link" to="/alerts">Alertes</RouterLink>
    </nav>

    <div class="sidebar-footer">
      <button class="theme-toggle" type="button" @click="toggleTheme">
        {{ theme === "dark" ? "☀️ Mode clair" : "🌙 Mode sombre" }}
      </button>
      <button type="button" @click="handleLogout">Se déconnecter</button>
    </div>
  </aside>
</template>
