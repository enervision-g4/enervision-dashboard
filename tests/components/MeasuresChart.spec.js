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
});
