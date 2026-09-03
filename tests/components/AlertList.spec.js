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

    expect(wrapper.text()).toContain("critical");
    expect(wrapper.text()).toContain("Risque de surcharge sur Usine Lyon Vénissieux");
    expect(wrapper.text()).toContain("SITE002");
  });

  it("distingue visuellement les alertes critiques des autres (classe CSS)", () => {
    const wrapper = mount(AlertList, {
      props: { alerts: [alert, { ...alert, alert_id: "ALR-2", severity: "medium" }] },
    });

    const items = wrapper.findAll("li");
    expect(items[0].classes()).toContain("card--critical");
    expect(items[1].classes()).toContain("card--degraded");
  });
});
