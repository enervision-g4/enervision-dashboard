import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AlertList from "@/components/AlertList.vue";

const alert = {
  alert_id: "ALR-SITE002-1718458320",
  timestamp: "2024-06-15T14:12:00",
  site_id: "SITE002",
  severity: "critical",
  type: "outage",
  message: "Risque de surcharge sur Usine Lyon Vénissieux",
  value: 812.5,
  threshold: 720.0,
};

describe("AlertList", () => {
  it("n'affiche rien quand il n'y a aucune alerte", () => {
    const wrapper = mount(AlertList, { props: { alerts: [] } });

    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("affiche le message et la sévérité de chaque alerte", () => {
    const wrapper = mount(AlertList, { props: { alerts: [alert] } });

    expect(wrapper.text()).toContain("Critique");
    expect(wrapper.text()).toContain("Risque de surcharge sur Usine Lyon Vénissieux");
    expect(wrapper.text()).toContain("SITE002");
  });

  it("distingue visuellement chaque sévérité par sa propre couleur de badge", () => {
    // Régression : faible et moyenne rendaient toutes les deux la même
    // classe "card--degraded" (donc la même couleur), seule "critical" se
    // distinguait du reste. Chaque sévérité doit maintenant porter le badge
    // badge--{severity} (mêmes couleurs que AlertsView/HomeView, voir
    // src/severity.js et src/style.css).
    const wrapper = mount(AlertList, {
      props: {
        alerts: [
          alert,
          { ...alert, alert_id: "ALR-2", severity: "medium" },
          { ...alert, alert_id: "ALR-3", severity: "low" },
        ],
      },
    });

    const items = wrapper.findAll("li");
    expect(items[0].find(".badge").classes()).toContain("badge--critical");
    expect(items[1].find(".badge").classes()).toContain("badge--medium");
    expect(items[2].find(".badge").classes()).toContain("badge--low");
  });
});
