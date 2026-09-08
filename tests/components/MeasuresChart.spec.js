import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Chart.js a besoin d'un vrai canvas 2D, absent de jsdom : on le remplace par
// un double qui mémorise la configuration reçue. C'est justement ce qui nous
// intéresse ici — la forme des données passées à Chart.js.
const instances = [];
vi.mock("chart.js", () => {
  class FakeChart {
    constructor(canvas, config) {
      this.config = config;
      this.data = config.data;
      this.scales = { x: { min: NaN, max: NaN } };
      instances.push(this);
    }
    update() {}
    destroy() {}
    resetZoom() {}
    static register() {}
  }
  return { Chart: FakeChart, registerables: [] };
});
vi.mock("chartjs-adapter-date-fns", () => ({}));
vi.mock("chartjs-plugin-zoom", () => ({ default: {} }));

import MeasuresChart from "@/components/MeasuresChart.vue";

describe("MeasuresChart", () => {
  beforeEach(() => {
    instances.length = 0;
  });

  it("convertit les horodatages ISO en millisecondes", async () => {
    // Régression : en mode `parsing: false`, Chart.js n'interprète pas les
    // valeurs. Un `x` resté sous forme de chaîne ISO n'était plaçable par
    // aucune échelle temporelle et le graphique s'affichait vide.
    mount(MeasuresChart, {
      props: {
        series: [
          {
            label: "Consommation",
            data: [
              { x: "2026-09-08T10:00:00Z", y: 12 },
              { x: "2026-09-08T10:05:00Z", y: 14 },
            ],
          },
        ],
      },
    });
    await flushPromises();

    const [{ data }] = instances;
    expect(data.datasets[0].data).toEqual([
      { x: Date.parse("2026-09-08T10:00:00Z"), y: 12 },
      { x: Date.parse("2026-09-08T10:05:00Z"), y: 14 },
    ]);
  });

  it("écarte les points dont l'horodatage est inexploitable", async () => {
    mount(MeasuresChart, {
      props: {
        series: [{ label: "Consommation", data: [{ x: "pas-une-date", y: 1 }, { x: 1757325600000, y: 2 }] }],
      },
    });
    await flushPromises();

    const [{ data }] = instances;
    expect(data.datasets[0].data).toEqual([{ x: 1757325600000, y: 2 }]);
  });

  it("réinitialise le zoom quand la période demandée change", async () => {
    const wrapper = mount(MeasuresChart, {
      props: {
        series: [{ label: "Consommation", data: [{ x: 1757325600000, y: 2 }] }],
        rangeKey: "SITE001|24h",
      },
    });
    await flushPromises();

    const chart = instances[0];
    const resetZoom = vi.spyOn(chart, "resetZoom");

    await wrapper.setProps({ rangeKey: "SITE001|1h" });
    await flushPromises();

    expect(resetZoom).toHaveBeenCalled();
  });

  it("affiche le message 'aucune donnée' quand tous les points sont à null", async () => {
    // Régression : un capteur en panne (data_quality dégradée) fournit des
    // points avec un horodatage valide mais une valeur `y` nulle. Compter les
    // points ne suffit pas à savoir si le graphique a quelque chose à
    // montrer — sans ce contrôle, le site affichait un cadre vide (axe 0-1)
    // au lieu du message explicite, ce qui donnait l'impression à tort
    // qu'aucune donnée n'avait été chargée pour ce site.
    const wrapper = mount(MeasuresChart, {
      props: {
        series: [
          {
            label: "Consommation",
            data: [
              { x: "2026-09-08T10:00:00Z", y: null },
              { x: "2026-09-08T10:05:00Z", y: null },
            ],
          },
        ],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Aucune donnée à afficher pour cette sélection.");
  });

  it("n'affiche pas le message 'aucune donnée' dès qu'une valeur est exploitable", async () => {
    const wrapper = mount(MeasuresChart, {
      props: {
        series: [
          {
            label: "Tension",
            data: [
              { x: "2026-09-08T10:00:00Z", y: null },
              { x: "2026-09-08T10:05:00Z", y: 400 },
            ],
          },
        ],
      },
    });
    await flushPromises();

    expect(wrapper.text()).not.toContain("Aucune donnée à afficher pour cette sélection.");
  });

  it("glisser fait défiler la période (pan) au lieu de zoomer sur la zone surlignée", async () => {
    // Régression : le zoom par rectangle de sélection (drag) et le
    // glissement (pan) étaient tous les deux activés sur le même geste de
    // souris, et le zoom l'emportait — glisser zoomait sur la zone surlignée
    // au lieu de faire défiler la période dans le temps.
    mount(MeasuresChart, {
      props: { series: [{ label: "Consommation", data: [{ x: 1757325600000, y: 2 }] }] },
    });
    await flushPromises();

    const zoomConfig = instances[0].config.options.plugins.zoom;
    expect(zoomConfig.pan.enabled).toBe(true);
    expect(zoomConfig.zoom.drag.enabled).toBe(false);
  });

  it("émet 'rangeChange' (avec anti-rebond) quand la fenêtre visible bouge", async () => {
    // Le parent (HomeView/SiteDetailView) s'en sert pour charger davantage de
    // données quand on approche du bord de ce qui est déjà en mémoire — sans
    // ça, glisser vers des dates plus anciennes affichait un graphique vide.
    vi.useFakeTimers();
    try {
      const wrapper = mount(MeasuresChart, {
        props: { series: [{ label: "Consommation", data: [{ x: 1757325600000, y: 2 }] }] },
      });
      await flushPromises();

      const chart = instances[0];
      chart.scales.x = { min: 1000, max: 2000 };
      chart.config.options.plugins.zoom.pan.onPanComplete();

      expect(wrapper.emitted("rangeChange")).toBeUndefined();
      vi.advanceTimersByTime(250);
      expect(wrapper.emitted("rangeChange")).toEqual([[{ min: 1000, max: 2000 }]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applique xMin/xMax comme bornes explicites de l'axe des temps", async () => {
    // Régression : sans bornes explicites, Chart.js cadrait l'axe sur
    // l'étendue réelle des points reçus (qui peut être plus courte que la
    // période demandée, ex. léger retard d'ingestion), donnant l'impression
    // à tort que l'historique antérieur avait disparu.
    mount(MeasuresChart, {
      props: {
        series: [{ label: "Consommation", data: [{ x: 1757325600000, y: 2 }] }],
        xMin: "2026-09-08T00:00:00Z",
        xMax: "2026-09-09T00:00:00Z",
      },
    });
    await flushPromises();

    const { min, max } = instances[0].config.options.scales.x;
    expect(min).toBe("2026-09-08T00:00:00Z");
    expect(max).toBe("2026-09-09T00:00:00Z");
  });

  it("reconstruit le graphique (et réinitialise le zoom) quand seules les bornes xMin/xMax changent", async () => {
    // Une période/un horizon peut changer sans que le nombre ou le libellé
    // des séries change (ex. PredictionsView : changer l'historique de
    // mesures ne touche qu'aux bornes) — shapeKey() doit quand même détecter
    // le changement, sinon l'ancien zoom/pan resterait affiché sur la
    // nouvelle plage.
    const wrapper = mount(MeasuresChart, {
      props: {
        series: [{ label: "Consommation", data: [{ x: 1757325600000, y: 2 }] }],
        xMin: "2026-09-08T00:00:00Z",
        xMax: "2026-09-09T00:00:00Z",
      },
    });
    await flushPromises();
    const firstInstanceCount = instances.length;

    await wrapper.setProps({ xMin: "2026-09-01T00:00:00Z" });
    await flushPromises();

    expect(instances.length).toBeGreaterThan(firstInstanceCount);
  });

  it("survol d'un élément de légende : estompe les autres courbes, restaure tout au départ", async () => {
    mount(MeasuresChart, {
      props: {
        series: [
          { label: "Mesures", color: "#3b82f6", data: [{ x: 1757325600000, y: 2 }] },
          { label: "Prévision", color: "#fb4d63", data: [{ x: 1757325600000, y: 3 }] },
        ],
      },
    });
    await flushPromises();

    const chart = instances[0];
    const legend = chart.config.options.plugins.legend;

    legend.onHover(null, { datasetIndex: 1 });
    expect(chart.data.datasets[1].borderColor).toBe("#fb4d63");
    expect(chart.data.datasets[0].borderColor).not.toBe("#3b82f6");
    expect(chart.data.datasets[0].borderColor).toMatch(/^rgba\(59, 130, 246, 0\.18\)$/);

    legend.onLeave();
    expect(chart.data.datasets[0].borderColor).toBe("#3b82f6");
    expect(chart.data.datasets[1].borderColor).toBe("#fb4d63");
  });
});
