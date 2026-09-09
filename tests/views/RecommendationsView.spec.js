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

const PAGE = {
  items: [
    {
      recommendation_id: "rec-1",
      site_id: "SITE004",
      prediction_id: "pred-1",
      timestamp: "2026-09-08T12:27:23Z",
      action_description:
        "Consommation prévue de 335.3 kW à 2026-09-08 15:00 UTC, au-dessus du seuil de 340.0 kW.",
      status: "open",
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
};

function mountView() {
  return mount(RecommendationsView);
}

describe("RecommendationsView", () => {
  beforeEach(() => {
    fetchSitesMock.mockReset().mockResolvedValue(SITES);
    fetchRecommendationsMock.mockReset().mockResolvedValue(PAGE);
  });

  it("charge et affiche les recommandations (enveloppe paginée) au montage", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith({
      siteId: undefined,
      status: undefined,
      sortBy: "timestamp",
      order: "desc",
      page: 1,
      limit: 25,
    });
    expect(wrapper.text()).toContain("Centre Commercial Lille");
    expect(wrapper.find(".badge--open").exists()).toBe(true);
  });

  it("reformate la date intégrée dans la description selon la langue active", async () => {
    // fr.json est la locale par défaut des tests (voir tests/setup.js) :
    // "2026-09-08 15:00 UTC" doit devenir "08/09/2026 15:00 UTC", pas rester
    // tel quel.
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("08/09/2026 15:00 UTC");
    expect(wrapper.text()).not.toContain("2026-09-08 15:00 UTC");
  });

  it("affiche le message 'aucune recommandation' quand la liste est vide", async () => {
    fetchRecommendationsMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Aucune recommandation pour ces filtres.");
  });

  it("refiltre par site et repart en page 1 quand on change la sélection", async () => {
    const wrapper = mountView();
    await flushPromises();
    fetchRecommendationsMock.mockClear();

    const selects = wrapper.findAll("select");
    await selects[0].setValue("SITE004"); // Site
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE004", page: 1 }),
    );
  });

  it("inverse le tri par date au clic sur le bouton de tri", async () => {
    const wrapper = mountView();
    await flushPromises();
    fetchRecommendationsMock.mockClear();

    await wrapper.find(".sort-toggle").trigger("click");
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ order: "asc", page: 1 }),
    );
  });

  it("change de page via la pagination", async () => {
    fetchRecommendationsMock.mockResolvedValue({
      items: PAGE.items,
      total: 60,
      page: 1,
      limit: 25,
    });
    const wrapper = mountView();
    await flushPromises();
    fetchRecommendationsMock.mockClear();

    await wrapper.find(".pagination button:last-of-type").trigger("click");
    await flushPromises();

    expect(fetchRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("affiche une erreur générique si le chargement échoue", async () => {
    fetchRecommendationsMock.mockRejectedValue(new Error("500"));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Impossible de charger les données depuis l'API.");
  });
});
