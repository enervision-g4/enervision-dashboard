import { createRouter, createWebHistory } from "vue-router";

import { useAuth } from "@/composables/useAuth";
import AlertsView from "@/views/AlertsView.vue";
import HomeView from "@/views/HomeView.vue";
import LoginView from "@/views/LoginView.vue";
import PredictionsView from "@/views/PredictionsView.vue";
import RecommendationsView from "@/views/RecommendationsView.vue";
import SiteDetailView from "@/views/SiteDetailView.vue";
import SitesListView from "@/views/SitesListView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "home", component: HomeView },
    { path: "/sites", name: "sites", component: SitesListView },
    { path: "/sites/:siteId", name: "site-detail", component: SiteDetailView, props: true },
    { path: "/alerts", name: "alerts", component: AlertsView, props: (route) => ({ ...route.query }) },
    { path: "/predictions", name: "predictions", component: PredictionsView },
    { path: "/recommendations", name: "recommendations", component: RecommendationsView },
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
