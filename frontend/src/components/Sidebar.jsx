import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const adminLinks = [
  { key: "dashboard", label: "Dashboard", icon: "▦", path: "/admin/dashboard" },
  { key: "products", label: "Products", icon: "▣", path: "/admin/products" },
  { key: "billing", label: "Billing", icon: "▤", path: "/billing" },
  { key: "inventory", label: "Inventory", icon: "▥", path: "/admin/inventory" },
  { key: "suppliers", label: "Suppliers", icon: "♧", path: "/admin/suppliers" },
  { key: "supplier-ledger", label: "Supplier Ledger", icon: "≡", path: "/admin/supplier-ledger" },
  { key: "returns", label: "Returns & Refunds", icon: "↩", path: "/admin/returns" },
  { key: "reports", label: "Sales Reports", icon: "▧", path: "/admin/reports" },
  { key: "staff", label: "Staff Management", icon: "♙", path: "/admin/staff" },
];

const staffLinks = [
  { key: "dashboard", label: "Dashboard", icon: "▦", path: "/staff/dashboard" },
  { key: "billing", label: "Billing", icon: "▤", path: "/billing" },
  { key: "my-bills", label: "My Bills", icon: "▤", path: "/staff/bills" },
];

function Sidebar({ active, onLogout }) {
  const navigate = useNavigate();
  const { user, logout: clearAuth } = useAuth();
  const links = user.role === "admin" ? adminLinks : staffLinks;

  const logout = () => {
    if (onLogout) onLogout();
    clearAuth();
    navigate("/login");
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo">P</span>
        <h2>POS<span>Flow</span></h2>
      </div>
      <p className="app-sidebar__label">MAIN MENU</p>
      <nav className="app-sidebar__menu" aria-label="Main navigation">
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            aria-current={active === link.key ? "page" : undefined}
            onClick={() => navigate(link.path)}
          >
            <span className="app-sidebar__icon" aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </button>
        ))}
      </nav>
      <button type="button" className="app-sidebar__logout" onClick={logout}>
        <span aria-hidden="true">↪</span> Logout
      </button>
    </aside>
  );
}

export default Sidebar;
