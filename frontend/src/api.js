// Thin API client. Uses relative /api so it works behind the nginx proxy in
// production and behind the vite dev proxy locally — no hardcoded host.
const TOKEN_KEY = "amz_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, form, auth = true } = {}) {
  const headers = {};
  const opts = { method, headers };

  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(`/api${path}`, opts);
  if (res.status === 204) return null;

  const ctype = res.headers.get("content-type") || "";
  const data = ctype.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.detail) || res.statusText || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  async register(email, password) {
    return request("/auth/register", { method: "POST", body: { email, password }, auth: false });
  },
  async login(email, password) {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    return request("/auth/login", { method: "POST", form, auth: false });
  },
  me: () => request("/auth/me"),
  config: () => request("/config", { auth: false }),
  listScans: () => request("/scans"),
  getScan: (id) => request(`/scans/${id}`),
  createScan: (target_domain, authorized) =>
    request("/scans", { method: "POST", body: { target_domain, authorized } }),
  rerunScan: (id) => request(`/scans/${id}/rerun`, { method: "POST" }),
  deleteScan: (id) => request(`/scans/${id}`, { method: "DELETE" }),
  exportUrl: (id, kind) => `/api/scans/${id}/export.${kind}`,
};

// Authenticated file download (export endpoints require the JWT).
export async function downloadExport(id, kind, filename) {
  const res = await fetch(`/api/scans/${id}/export.${kind}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
