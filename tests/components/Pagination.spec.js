import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Pagination from "@/components/Pagination.vue";

describe("Pagination", () => {
  it("affiche la page courante et le nombre total de pages", () => {
    const wrapper = mount(Pagination, { props: { page: 2, total: 45, limit: 20 } });

    expect(wrapper.text()).toContain("Page 2 / 3");
    expect(wrapper.text()).toContain("45 résultats");
  });

  it("désactive Précédent sur la première page", () => {
    const wrapper = mount(Pagination, { props: { page: 1, total: 45, limit: 20 } });

    const [prev] = wrapper.findAll("button");
    expect(prev.attributes("disabled")).toBeDefined();
  });

  it("désactive Suivant sur la dernière page", () => {
    const wrapper = mount(Pagination, { props: { page: 3, total: 45, limit: 20 } });

    const [, next] = wrapper.findAll("button");
    expect(next.attributes("disabled")).toBeDefined();
  });

  it("émet update:page avec la page suivante au clic sur Suivant", async () => {
    const wrapper = mount(Pagination, { props: { page: 1, total: 45, limit: 20 } });

    const [, next] = wrapper.findAll("button");
    await next.trigger("click");

    expect(wrapper.emitted("update:page")).toEqual([[2]]);
  });

  it("ne propose que des tailles de page fixes (pas de valeur \"Autre…\")", () => {
    const wrapper = mount(Pagination, { props: { page: 1, total: 45, limit: 20 } });

    const options = wrapper.findAll("option").map((option) => option.element.value);
    expect(options).toEqual(["5", "10", "20", "50", "100"]);
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("émet update:limit avec la taille de page choisie", async () => {
    const wrapper = mount(Pagination, { props: { page: 1, total: 45, limit: 20 } });

    await wrapper.find("select").setValue("50");

    expect(wrapper.emitted("update:limit")).toEqual([[50]]);
  });

  it("émet update:page avec la page précédente au clic sur Précédent", async () => {
    const wrapper = mount(Pagination, { props: { page: 2, total: 45, limit: 20 } });

    const [prev] = wrapper.findAll("button");
    await prev.trigger("click");

    expect(wrapper.emitted("update:page")).toEqual([[1]]);
  });
});
