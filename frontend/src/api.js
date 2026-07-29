const BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("mc_token");
}

async function request(path, { method = "GET", body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    if (query) url += `?${query}`;
  }

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/auth/me"),

  getInventory: (params) => request("/inventory", { params }),
  getCategories: () => request("/inventory/categories"),
  getProduct: (id) => request(`/inventory/${id}`),
  createProduct: (body) => request("/inventory", { method: "POST", body }),
  updateProduct: (id, body) => request(`/inventory/${id}`, { method: "PUT", body }),
  deleteProduct: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
  getQrCode: (id) => request(`/inventory/${id}/qrcode`),

  getSales: () => request("/sales"),
  lookupCode: (code) => request(`/sales/lookup/${encodeURIComponent(code)}`),
  recordSale: (body) => request("/sales", { method: "POST", body }),

  getReturns: () => request("/returns"),
  recordReturn: (body) => request("/returns", { method: "POST", body }),

  getDashboard: () => request("/dashboard"),

  getInventoryReport: () => request("/reports/inventory"),
  getSalesReport: (params) => request("/reports/sales", { params }),

  getUsers: () => request("/users"),
  createUser: (body) => request("/users", { method: "POST", body }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  getCustomers: () => request("/customers"),
  createCustomer: (body) => request("/customers", { method: "POST", body }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: "DELETE" }),
};

export { getToken };
