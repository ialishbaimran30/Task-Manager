import api from "../services/api";

export function setAuthSession({ access, refresh, username, user_id }) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("username", username);
  if (user_id != null) localStorage.setItem("user_id", String(user_id));
}

export async function ensureUserId() {
  if (localStorage.getItem("user_id")) return;
  try {
    const res = await api.get("/api/auth/me/");
    localStorage.setItem("user_id", String(res.data.id));
  } catch {
    // not logged in yet / request failed - nothing to backfill
  }
}
