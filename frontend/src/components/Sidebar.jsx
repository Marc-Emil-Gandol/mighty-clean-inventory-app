import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  UserSquare2,
  BarChart3,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: null },
  { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["admin", "sales_staff", "inventory_staff"] },
  { to: "/employees", label: "Employees", icon: Users, roles: ["admin"] },
  { to: "/customers", label: "Customers", icon: UserSquare2, roles: null },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: null },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mighty">MIGHTY</span>
        <span className="logo-clean">CLEAN</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role)).map(
          ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            >
              <Icon size={18} strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          )
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{user?.name?.[0]?.toUpperCase() ?? "?"}</div>
          <div>
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role?.replace("_", " ")}</div>
          </div>
        </div>
        <button className="sidebar-link logout" onClick={logout}>
          <LogOut size={18} strokeWidth={2.1} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
