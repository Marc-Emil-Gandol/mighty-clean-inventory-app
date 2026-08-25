import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const EMPTY = { name: "", username: "", password: "", role: "sales_staff" };

export default function Employees() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function load() {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createUser(form);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Remove ${u.name}'s account?`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Employees</h1>
        <p className="page-subtitle">Manage staff accounts and roles.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="panel-grid">
        <div className="card">
          <h2 className="card-title">
            <Plus size={16} /> Add employee
          </h2>
          <form onSubmit={handleSubmit} className="modal-form">
            <label>
              Full name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Username
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Temporary password
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="sales_staff">Sales staff</option>
                <option value="inventory_staff">Inventory staff</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Create account
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Team</h2>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="muted">{u.username}</td>
                  <td>
                    <span className="badge badge-blue">{u.role.replace("_", " ")}</span>
                  </td>
                  <td>
                    {u.id !== user.id && (
                      <button className="icon-btn icon-btn-red" onClick={() => handleDelete(u)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
