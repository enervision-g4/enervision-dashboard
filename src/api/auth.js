import apiClient from "./client";

/**
 * POST /auth/login attend un formulaire OAuth2 (username/password), pas du
 * JSON — c'est le contrat imposé par OAuth2PasswordRequestForm côté API
 * (enervision-api/app/routers/auth.py).
 */
export async function login(username, password) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  const { data } = await apiClient.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // { access_token, token_type }
}
