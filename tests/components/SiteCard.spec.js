import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SiteCard from "@/components/SiteCard.vue";

const site = {
  site_id: "SITE001",
  site_type: "office",
  site_name: "Bureau Paris La Défense",
  location: "Paris, France",
  capacity_kw: 200,
  status: "active",
};

function mountCard(props) {
  return mount(SiteCard, {
    props,
    global: {
      // Évite d'avoir à monter un vrai router juste pour <RouterLink>.
      stubs: { RouterLink: { template: "<a><slot /></a>" } },
    },
  });
}

describe("SiteCard", () => {
  it("affiche le nom, le type, la localisation et le statut du site", () => {
    const wrapper = mountCard({ site });

    expect(wrapper.text()).toContain("Bureau Paris La Défense");
    expect(wrapper.text()).toContain("office");
    expect(wrapper.text()).toContain("Paris, France");
    expect(wrapper.text()).toContain("200 kW");
    expect(wrapper.text()).toContain("active");
  });

  it("pointe vers /sites/{site_id}", () => {
    const wrapper = mountCard({ site });

    expect(wrapper.find("a").attributes("to")).toBe("/sites/SITE001");
  });
});
