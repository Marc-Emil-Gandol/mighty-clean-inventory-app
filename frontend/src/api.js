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
  getNextProductCode: () => request("/inventory/next-code"),
  getProduct: (id) => request(`/inventory/${id}`),
  createProduct: (body) => request("/inventory", { method: "POST", body }),
  updateProduct: (id, body) => request(`/inventory/${id}`, { method: "PUT", body }),
  addStockBatch: (lines) => request("/inventory/add-stock-batch", { method: "POST", body: { lines } }),
  deleteProduct: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
  getQrCode: (id) => request(`/inventory/${id}/qrcode`),
  reportDamage: (id, body) => request(`/inventory/${id}/report-damage`, { method: "POST", body }),
  getDamageReport: (id) => request(`/inventory/damage-reports/${id}`),

  getOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (body) => request("/orders", { method: "POST", body }),
  completeOrder: (id) => request(`/orders/${id}/complete`, { method: "PATCH" }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "PATCH" }),
  returnOrder: (id) => request(`/orders/${id}/return`, { method: "PATCH" }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),

  getSales: () => request("/sales"),
  lookupCode: (code) => request(`/sales/lookup/${encodeURIComponent(code)}`),
  recordSale: (body) => request("/sales", { method: "POST", body }),

  getReturns: () => request("/returns"),
  recordReturn: (body) => request("/returns", { method: "POST", body }),

  getDashboard: (params) => request("/dashboard", { params }),

  getInventoryReport: () => request("/reports/inventory"),
  getSalesReport: (params) => request("/reports/sales", { params }),
  getGoodsReceipts: () => request("/reports/goods-receipts"),
  getGoodsReceipt: (id) => request(`/reports/goods-receipts/${id}`),

  getUsers: () => request("/users"),
  createUser: (body) => request("/users", { method: "POST", body }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  getCustomers: (params) => request("/customers", { params }),
  getCustomerOrders: (id) => request(`/customers/${id}/orders`),
  createCustomer: (body) => request("/customers", { method: "POST", body }),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: "PUT", body }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: "DELETE" }),

  getActivityLog: () => request("/activity"),
};

export { getToken };