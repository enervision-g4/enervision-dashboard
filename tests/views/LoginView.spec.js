import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

const loginMock = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

import LoginView from "@/views/LoginView.vue";

async function mountLoginView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/login", component: LoginView },
      { path: "/", component: { template: "<div>home</div>" } },
    ],
  });
  router.push("/login");
  await router.isReady();

  return mount(LoginView, { global: { plugins: [router] } });
}

describe("LoginView", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("appelle login() avec les identifiants saisis", async () => {
    loginMock.mockResolvedValueOnce();
    const wrapper = await mountLoginView();

    await wrapper.find('input[type="text"]').setValue("admin");
    await wrapper.find('input[type="password"]').setValue("secret");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(loginMock).toHaveBeenCalledWith("admin", "secret");
  });

  it("affiche un message d'erreur si le login échoue", async () => {
    loginMock.mockRejectedValueOnce(new Error("401"));
    const wrapper = await mountLoginView();

    await wrapper.find('input[type="text"]').setValue("admin");
    await wrapper.find('input[type="password"]').setValue("wrong");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).toContain("Identifiants invalides");
  });

  it("désactive le bouton pendant la soumission", async () => {
    let resolveLogin;
    loginMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const wrapper = await mountLoginView();

    await wrapper.find('input[type="text"]').setValue("admin");
    await wrapper.find('input[type="password"]').setValue("secret");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    resolveLogin();
    await flushPromises();
  });
});
