import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

function activityLabel(a) {
  if (a.type === "sale") return "Sale";
  if (a.type === "return") return "Return";
  if (a.type === "order") return `Order · ${a.status}`;
  return a.type;
}

function activityBadgeClass(a) {
  if (a.type === "sale") return "badge-green";
  if (a.type === "return") return "badge-amber";
  if (a.type === "order") {
    if (a.status === "successful") return "badge-green";
    if (a.status === "cancelled") return "badge-red";
    if (a.status === "returned") return "badge-purple";
    return "badge-amber"; // pending
  }
  return "badge-blue";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page">Loading…</div>;

  const chartData = data.salesByDay.map((d) => ({ day: d.day.slice(5), total: d.total }));
  const recentActivity = data.recentActivity || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="page-subtitle">Here's what's happening in the store today.</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Products tracked" value={data.totalProducts} accent="blue" />
        <StatCard label="Low stock items" value={data.lowStockCount} accent="red" />
        <StatCard
          label="Inventory value"
          value={`₱${data.inventoryValue.toLocaleString()}`}
          accent="purple"
        />
        <StatCard
          label="Sales today"
          value={`₱${data.todaySalesTotal.toLocaleString()}`}
          sub={`${data.todaySalesUnits} units`}
          accent="green"
        />
      </div>

      <div className="panel-grid">
        <div className="card">
          <h2 className="card-title">Sales, last 7 days</h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8A94A6" }} />
                <YAxis tick={{ fontSize: 12, fill: "#8A94A6" }} width={50} />
                <Tooltip formatter={(v) => `₱${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="total" stroke="#2F6FED" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Low stock alerts</h2>
          {data.lowStockItems.length === 0 ? (
            <p className="muted">Everything is well stocked.</p>
          ) : (
            <ul className="simple-list">
              {data.lowStockItems.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span className="badge badge-red">{item.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Recent activity</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Qty</th>
              <th>Total</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className={`badge ${activityBadgeClass(a)}`}>{activityLabel(a)}</span>
                </td>
                <td>{a.description}</td>
                <td>{a.quantity}</td>
                <td>₱{Number(a.total).toLocaleString()}</td>
                <td className="muted">{new Date(a.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {recentActivity.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
