export const apiBase = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/,"");

export async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    sessionStorage.removeItem("token");
    window.location.assign("/login");
    return;
  }
  return res;
}
