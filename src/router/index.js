import { createRouter, createWebHistory } from "vue-router";

import { useAuth } from "@/composables/useAuth";
import DashboardView from "@/views/DashboardView.vue";
import LoginView from "@/views/LoginView.vue";
import SiteDetailView from "@/views/SiteDetailView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "dashboard", component: DashboardView },
    { path: "/sites/:siteId", name: "site-detail", component: SiteDetailView, props: true },
  ],
});

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth();
  if (!to.meta.public && !isAuthenticated.value) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
