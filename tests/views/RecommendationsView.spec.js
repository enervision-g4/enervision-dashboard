import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSitesMock = vi.fn();
const fetchRecommendationsMock = vi.fn();

vi.mock("@/api/sites", () => ({ fetchSites: (...args) => fetchSitesMock(...args) }));
vi.mock("@/api/recommendations", () => ({
  fetchRecommendations: (...args) => fetchRecommendationsMock(...args),
}));

import RecommendationsView from "@/views/RecommendationsView.vue";

const SITES = [
  { site_id: "SITE001", site_name: "Bureau Paris La Défense" },
  { site_id: "SITE004", site_name: "Centre Commercial Lille" },
];

const RECOMMENDATIONS = [
  {
    recommendation_id: "rec-1",
    site_id: "SITE004",
    prediction_id: "pred-1",
    timestamp: "2026-09-08T12:27:23Z",
    action_description: "Consommation prévue de 335.3 kW à 2026-09-08 15:00 UTC, au-dessus du seuil de 340.0 kW.",
    status: "open",
  },
];

function mountView() {
  return mount(RecommendationsView);
}

describe("RecommendationsView", () => {
  beforeEach(() => {
    fetchSitesMock.mockReset().mockResolvedValue(SITES);
    fetchRecommendationsMock.mockReset().mockResolvedValue(RECOMMENDATIONS);
  });

  it("charge et affiche les recommandations au montage", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith({
      siteId: undefined,
      status: undefined,
      limit: 25,
    });
    expect(wrapper.text()).toContain("Consommation prévue de 335.3 kW");
    expect(wrapper.text()).toContain("Centre Commercial Lille");
    expect(wrapper.find(".badge--open").exists()).toBe(true);
  });

  it("affiche le message 'aucune recommandation' quand la liste est vide", async () => {
    fetchRecommendationsMock.mockResolvedValue([]);
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Aucune recommandation pour ces filtres.");
  });

  it("refiltre par site quand on change la sélection", async () => {
    const wrapper = mountView();
    await flushPromises();
    fetchRecommendationsMock.mockClear();

    const selects = wrapper.findAll("select");
    await selects[0].setValue("SITE004"); // Site
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE004" }),
    );
  });

  it("change la limite affichée", async () => {
    const wrapper = mountView();
    await flushPromises();
    fetchRecommendationsMock.mockClear();

    const selects = wrapper.findAll("select");
    await selects[2].setValue("100"); // Limite affichée
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("affiche une erreur générique si le chargement échoue", async () => {
    fetchRecommendationsMock.mockRejectedValue(new Error("500"));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Impossible de charger les données depuis l'API.");
  });
});
