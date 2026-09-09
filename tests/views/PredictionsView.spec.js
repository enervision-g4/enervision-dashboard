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
// ici, on vérifie seulement les props qu'on lui transmet et le contenu du
// slot #badge (le stub doit le rendre pour que wrapper.text() le voie).
const MeasuresChartStub = {
  props: ["series", "yLabel", "height", "rangeKey", "xMin", "xMax"],
  template: "<div class='measures-chart-stub'><slot name='badge' /></div>",
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

  it("charge les mesures (fenêtre ancrée serveur) et les prévisions du premier site au montage", async () => {
    const wrapper = mountView();
    await flushPromises();

    // rangeHours et non startTime : la fenêtre doit être calculée côté
    // serveur, ancrée sur la donnée la plus récente en base (voir
    // app/routers/readings.py) plutôt que sur l'horloge du navigateur.
    expect(fetchReadingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE001", rangeHours: 24, limit: 1000 }),
    );
    // Toujours HORIZON_ALL_LIMIT côté serveur, quel que soit l'horizon
    // affiché : le découpage sur la fenêtre choisie se fait côté client
    // (voir horizonWindow dans PredictionsView.vue) — un `limit` serveur basé
    // sur l'horizon renvoyait les prévisions les plus ANCIENNES du site, pas
    // les prochaines heures à venir.
    expect(fetchPredictionsMock).toHaveBeenCalledWith({ siteId: "SITE001", limit: 1000 });

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
        color: "#fb4d63",
        data: [
          { x: "2026-09-08T12:00:00Z", y: 65 },
          { x: "2026-09-08T13:00:00Z", y: 66 },
        ],
      },
    ]);
  });

  it("borne le graphique du début des mesures à la fin de l'horizon de prévision", async () => {
    const wrapper = mountView();
    await flushPromises();

    const chart = wrapper.findComponent(MeasuresChartStub);
    expect(chart.props("xMin")).toBe(new Date(READINGS[0].timestamp).toISOString());
    // La borne haute suit la dernière prévision, pas la dernière mesure :
    // c'est bien plus tard que READINGS[1].timestamp.
    expect(chart.props("xMax")).toBe(PREDICTIONS[1].target_timestamp);
  });

  it("affiche la version du modèle (badge) avec l'horodatage de génération en infobulle", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("scikit-learn==1.9.0+abc123");
    const badge = wrapper.find(".badge--type");
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("title")).toContain("11:05");
  });

  it("recharge uniquement les prévisions quand on change l'horizon", async () => {
    const wrapper = mountView();
    await flushPromises();
    fetchPredictionsMock.mockClear();
    fetchReadingsMock.mockClear();

    // TimeRangeSelector rend un groupe de boutons, pas un <select> — deux
    // instances coexistent (historique de mesures, horizon de prévision), la
    // seconde étant celle de l'horizon (voir l'ordre dans le template). Pas
    // de "48h" (voir HORIZON_HOUR_OPTIONS dans PredictionsView.vue : le
    // service ML ne génère pas encore d'horizon aussi long) — "12h" suffit à
    // vérifier qu'un changement d'horizon ne recharge que les prévisions.
    const horizonButtons = wrapper.findAll(".time-range-selector")[1].findAll("button");
    const button12h = horizonButtons.find((b) => b.text() === "12h");
    await button12h.trigger("click");
    await flushPromises();

    // Le `limit` envoyé au serveur ne dépend plus de l'horizon choisi (voir
    // le commentaire du premier test) : seul le filtrage côté client change
    // quand on sélectionne 12h.
    expect(fetchPredictionsMock).toHaveBeenCalledWith({ siteId: "SITE001", limit: 1000 });
    expect(fetchReadingsMock).not.toHaveBeenCalled();
  });

  it("ignore une extension d'historique (glissement) devenue périmée par un nouveau chargement", async () => {
    // Régression : glisser/zoomer sur le graphique déclenche onChartRangeChange,
    // qui charge un historique plus ancien et le FUSIONNE dans `readings`
    // (contrairement à loadReadings, qui remplace). Si cette extension met
    // plus longtemps à répondre qu'un changement de filtre "Historique
    // affiché" survenu entretemps, son résultat (potentiellement vieux de
    // plusieurs semaines) se fusionnait quand même après coup — le graphique
    // montrait alors un mélange incohérent malgré un filtre "propre"
    // sélectionné.
    const wrapper = mountView();
    await flushPromises();
    fetchReadingsMock.mockClear();

    // L'extension par glissement part en premier, mais sa réponse reste en
    // suspens (on la résout nous-mêmes, plus tard).
    let resolveExtension;
    const extensionPromise = new Promise((resolve) => {
      resolveExtension = resolve;
    });
    fetchReadingsMock.mockImplementationOnce(() => extensionPromise);

    const loadedStartMs = new Date(READINGS[0].timestamp).getTime();
    const span = 60 * 60 * 1000; // 1h
    const chart = wrapper.findComponent(MeasuresChartStub);
    chart.vm.$emit("range-change", { min: loadedStartMs - span, max: loadedStartMs });
    await flushPromises();

    // Avant que l'extension ne réponde, l'utilisateur change de filtre :
    // un nouveau chargement principal part, et doit remplacer proprement
    // `readings` dès qu'il répond.
    const FRESH_READING = { timestamp: "2026-09-08T11:30:00Z", consumption_kw: 70 };
    fetchReadingsMock.mockResolvedValueOnce([FRESH_READING]);
    const historiqueButtons = wrapper.findAll(".time-range-selector")[0].findAll("button");
    const button6h = historiqueButtons.find((b) => b.text() === "6h");
    await button6h.trigger("click");
    await flushPromises();

    // L'extension répond enfin, avec de vieilles données : elle doit être
    // ignorée puisqu'un chargement plus récent a eu lieu entretemps.
    resolveExtension([{ timestamp: "2026-08-06T00:00:00Z", consumption_kw: 999 }]);
    await flushPromises();

    const finalChart = wrapper.findComponent(MeasuresChartStub);
    expect(finalChart.props("series")[0].data).toEqual([
      { x: FRESH_READING.timestamp, y: FRESH_READING.consumption_kw },
    ]);
  });

  it("exclut les prévisions passées et celles au-delà de l'horizon sélectionné", async () => {
    // Régression : GET /api/v1/predictions trie par target_timestamp
    // croissant sur tout l'historique du site (latest_only ne retire pas les
    // créneaux désormais passés) — sans filtrage côté client, un horizon
    // précis (ex. 24h) affichait les prévisions les plus ANCIENNES jamais
    // générées pour ce site plutôt que les prochaines heures à venir.
    fetchPredictionsMock.mockResolvedValue([
      // Périmée : cible antérieure à la dernière mesure connue (11h00).
      {
        target_timestamp: "2026-09-07T09:00:00Z",
        predicted_consumption_kw: 40,
        timestamp: "2026-09-07T08:05:00Z",
        model_version: "v1",
      },
      // Dans la fenêtre de l'horizon par défaut (24h après 11h00).
      {
        target_timestamp: "2026-09-08T12:00:00Z",
        predicted_consumption_kw: 65,
        timestamp: "2026-09-08T11:05:00Z",
        model_version: "v1",
      },
      // Au-delà de l'horizon par défaut.
      {
        target_timestamp: "2026-09-10T00:00:00Z",
        predicted_consumption_kw: 70,
        timestamp: "2026-09-08T11:05:00Z",
        model_version: "v1",
      },
    ]);
    const wrapper = mountView();
    await flushPromises();

    const chart = wrapper.findComponent(MeasuresChartStub);
    const forecastSeries = chart.props("series")[1];
    expect(forecastSeries.data).toEqual([{ x: "2026-09-08T12:00:00Z", y: 65 }]);
  });

  it("\"Tous\" affiche l'intégralité de l'historique de prévisions, y compris les créneaux passés", async () => {
    // Régression : contrairement à un horizon précis (qui ne regarde que
    // vers l'avenir), "Tous" doit montrer chaque prévision enregistrée pour
    // le site, passé compris — utile pour comparer une prévision à la
    // mesure réelle qui a suivi.
    const PAST = {
      target_timestamp: "2026-09-07T09:00:00Z",
      predicted_consumption_kw: 40,
      timestamp: "2026-09-07T08:05:00Z",
      model_version: "v1",
    };
    fetchPredictionsMock.mockResolvedValue([PAST, ...PREDICTIONS]);
    const wrapper = mountView();
    await flushPromises();
    fetchPredictionsMock.mockClear();

    const horizonButtons = wrapper.findAll(".time-range-selector")[1].findAll("button");
    const buttonAll = horizonButtons.find((b) => b.text() === "Tous");
    await buttonAll.trigger("click");
    await flushPromises();

    const chart = wrapper.findComponent(MeasuresChartStub);
    const forecastSeries = chart.props("series")[1];
    expect(forecastSeries.data).toEqual([
      { x: PAST.target_timestamp, y: PAST.predicted_consumption_kw },
      { x: "2026-09-08T12:00:00Z", y: 65 },
      { x: "2026-09-08T13:00:00Z", y: 66 },
    ]);
    // La borne basse du graphique s'étend jusqu'à cette prévision passée,
    // sinon elle existerait dans les données sans jamais être visible.
    expect(chart.props("xMin")).toBe(PAST.target_timestamp);
  });

  it("recharge les mesures et les prévisions du nouveau site quand on change de sélection", async () => {
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

    expect(fetchPredictionsMock).toHaveBeenCalledWith({ siteId: "SITE002", limit: 1000 });
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
