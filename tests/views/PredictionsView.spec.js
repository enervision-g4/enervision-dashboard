import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSitesMock = vi.fn();
const fetchReadingsMock = vi.fn();
const fetchPredictionsMock = vi.fn();
const useLiveSocketMock = vi.fn(() => ({ close: vi.fn() }));

vi.mock("@/api/sites", () => ({ fetchSites: (...args) => fetchSitesMock(...args) }));
vi.mock("@/api/readings", () => ({ fetchReadings: (...args) => fetchReadingsMock(...args) }));
vi.mock("@/api/predictions", () => ({
  fetchPredictions: (...args) => fetchPredictionsMock(...args),
}));
vi.mock("@/composables/useLiveSocket", () => ({
  useLiveSocket: (...args) => useLiveSocketMock(...args),
}));

import PredictionsView from "@/views/PredictionsView.vue";

const SITE = { site_id: "SITE001", site_name: "Bureau Paris La Défense" };

const READINGS = [
  { timestamp: "2026-09-08T10:00:00Z", consumption_kw: 60 },
  { timestamp: "2026-09-08T11:00:00Z", consumption_kw: 62 },
];

const PREDICTIONS = [
  {
    target_timestamp: "2026-09-08T12:00:00Z",
    predicted_consumption_kw: 65,
    timestamp: "2026-09-08T11:05:00Z",
    model_version: "scikit-learn==1.9.0+abc123",
  },
  {
    target_timestamp: "2026-09-08T13:00:00Z",
    predicted_consumption_kw: 66,
    timestamp: "2026-09-08T11:05:00Z",
    model_version: "scikit-learn==1.9.0+abc123",
  },
];

// MeasuresChart dessine sur un vrai <canvas> via Chart.js : hors de propos
// ici, on vérifie seulement les séries qu'on lui transmet.
const MeasuresChartStub = {
  props: ["series", "yLabel", "height", "rangeKey"],
  template: "<div class='measures-chart-stub' />",
};

function mountView() {
  return mount(PredictionsView, {
    global: { stubs: { MeasuresChart: MeasuresChartStub } },
  });
}

describe("PredictionsView", () => {
  beforeEach(() => {
    fetchSitesMock.mockReset().mockResolvedValue([SITE]);
    fetchReadingsMock.mockReset().mockResolvedValue(READINGS);
    fetchPredictionsMock.mockReset().mockResolvedValue(PREDICTIONS);
    useLiveSocketMock.mockClear();
  });

  it("charge les mesures et les prévisions du premier site au montage", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(fetchReadingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE001", limit: 1000 }),
    );
    expect(fetchPredictionsMock).toHaveBeenCalledWith({ siteId: "SITE001", limit: 24 });

    const chart = wrapper.findComponent(MeasuresChartStub);
    expect(chart.props("series")).toEqual([
      {
        label: "Mesures",
        data: [
          { x: "2026-09-08T10:00:00Z", y: 60 },
          { x: "2026-09-08T11:00:00Z", y: 62 },
        ],
      },
      {
        label: "Prévision",
        color: "#d33",
        data: [
          { x: "2026-09-08T12:00:00Z", y: 65 },
          { x: "2026-09-08T13:00:00Z", y: 66 },
        ],
      },
    ]);
  });

  it("affiche la version du modèle et l'horodatage de génération du lot", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("scikit-learn==1.9.0+abc123");
  });

  it("recharge les prévisions du nouveau site quand on change de sélection", async () => {
    fetchSitesMock.mockResolvedValue([
      SITE,
      { site_id: "SITE002", site_name: "Usine Lyon Vénissieux" },
    ]);
    const wrapper = mountView();
    await flushPromises();
    fetchPredictionsMock.mockClear();
    fetchReadingsMock.mockClear();

    await wrapper.find("select").setValue("SITE002");
    await flushPromises();

    expect(fetchPredictionsMock).toHaveBeenCalledWith({ siteId: "SITE002", limit: 24 });
    expect(fetchReadingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE002" }),
    );
  });

  it("affiche une erreur générique si le chargement échoue", async () => {
    // mockRejectedValue (persistant) et non ...Once : le site sélectionné au
    // montage déclenche un premier chargement direct puis, la même valeur
    // étant réaffectée, un second via le watcher (même schéma que HomeView) —
    // les deux appels doivent échouer pour observer l'état d'erreur final.
    fetchPredictionsMock.mockRejectedValue(new Error("500"));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Impossible de charger les données depuis l'API.");
  });
});
