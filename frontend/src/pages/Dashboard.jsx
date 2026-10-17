import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../style/Dashboard.css";

const toDateInput = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState({ products: [], staff: [], bills: [], lowStock: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = toDateInput(new Date());
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get("/products"),
      api.get("/stock/low-stock"),
      api.get("/staff"),
      api.get("/supplier-ledger/transactions"),
      api.get("/bills"),
    ]).then((results) => {
      if (!active) return;
      const [products, lowStock, staff, transactions, bills] = results;
      const failed = results.some((result) => result.status === "rejected");
      setData({
        products: products.status === "fulfilled" && Array.isArray(products.value.data) ? products.value.data : [],
        lowStock: lowStock.status === "fulfilled" && Array.isArray(lowStock.value.data) ? lowStock.value.data : [],
        staff: staff.status === "fulfilled" && Array.isArray(staff.value.data) ? staff.value.data : [],
        transactions: transactions.status === "fulfilled" && Array.isArray(transactions.value.data.transactions) ? transactions.value.data.transactions : [],
        bills: bills.status === "fulfilled" && Array.isArray(bills.value.data) ? bills.value.data : [],
      });
      if (failed) setError("Some dashboard figures could not be loaded. Refresh to try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);
  const todaysBills = data.bills.filter((bill) => toDateInput(new Date(bill.createdAt)) === today && bill.paymentStatus === "paid");
  const todaysRevenue = todaysBills.reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0);
  const pendingSupplierPayments = data.transactions.reduce((balance, transaction) => balance + (transaction.transactionType === "PURCHASE" ? Number(transaction.amount) : -Number(transaction.amount)), 0);
  const chartDays = useMemo(() => {
    const values = new Map();
    data.bills.forEach((bill) => {
      if (bill.paymentStatus !== "paid") return;
      const key = toDateInput(new Date(bill.createdAt));
      values.set(key, (values.get(key) || 0) + (Number(bill.totalAmount) || 0));
    });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = toDateInput(date);
      return { key, revenue: values.get(key) || 0 };
    });
  }, [data.bills]);
  const maxRevenue = Math.max(...chartDays.map((day) => day.revenue), 1);
  const recentBills = data.bills.slice(0, 7);

  return <div className="dashboard-layout"><Sidebar active="dashboard" onLogout={logout} /><main className="dashboard-main">
    <header className="dashboard-header"><div><h1>Admin Dashboard</h1><p>Shop activity and key figures for today.</p></div><div className="dashboard-user"><div className="user-avatar">{(user?.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user?.name || "Administrator"}</strong><span>Administrator</span></div></div></header>
    {error && <div className="admin-dashboard-alert" role="alert">{error}</div>}
    <section className="admin-stats-grid">
      <article className="admin-stat"><span>Today's Sales</span><strong>{loading ? "…" : formatCurrency(todaysRevenue)}</strong><small>Paid bills created today</small></article>
      <article className="admin-stat"><span>Today's Bill Count</span><strong>{loading ? "…" : todaysBills.length}</strong><small>Completed paid bills</small></article>
      <article className="admin-stat"><span>Total Products</span><strong>{loading ? "…" : data.products.length}</strong><small>In the product catalogue</small></article>
      <article className="admin-stat warning"><span>Low-Stock Products</span><strong>{loading ? "…" : data.lowStock.length}</strong><small>10 units or fewer</small></article>
      <article className="admin-stat"><span>Total Staff</span><strong>{loading ? "…" : data.staff.length}</strong><small>Staff accounts</small></article>
      <article className="admin-stat"><span>Supplier Payables</span><strong>{loading ? "…" : formatCurrency(Math.max(0, pendingSupplierPayments))}</strong><small>Purchases less recorded payments</small></article>
    </section>
    <section className="admin-dashboard-grid"><article className="admin-dashboard-panel"><div className="admin-panel-heading"><div><h2>Daily sales</h2><p>Revenue across the last seven days</p></div><button onClick={() => navigate("/admin/reports")}>Full reports</button></div><div className="admin-chart">{chartDays.map((day) => <div className="admin-chart-column" key={day.key}><strong>{formatCurrency(day.revenue)}</strong><div className="admin-chart-bar-wrap"><div className="admin-chart-bar" style={{ height: `${day.revenue ? Math.max(7, (day.revenue / maxRevenue) * 100) : 2}%` }} /></div><span>{new Date(`${day.key}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</span></div>)}</div></article>
      <article className="admin-dashboard-panel"><div className="admin-panel-heading"><div><h2>Quick access</h2><p>Open a management page</p></div></div><div className="admin-quick-links"><button onClick={() => navigate("/billing")}>New bill <span>→</span></button><button onClick={() => navigate("/admin/products")}>Products <span>→</span></button><button onClick={() => navigate("/admin/inventory")}>Inventory <span>→</span></button><button onClick={() => navigate("/admin/suppliers")}>Suppliers <span>→</span></button></div></article></section>
    <section className="admin-dashboard-panel admin-recent-bills"><div className="admin-panel-heading"><div><h2>Recent bills</h2><p>Latest bills across the shop</p></div></div>{loading ? <p className="dashboard-message">Loading bills…</p> : recentBills.length === 0 ? <p className="dashboard-message">No bills have been created yet.</p> : <div className="admin-bills-table-wrap"><table className="admin-bills-table"><thead><tr><th>Bill</th><th>Customer</th><th>Date</th><th>Staff</th><th>Total</th><th>Status</th></tr></thead><tbody>{recentBills.map((bill) => <tr key={bill._id}><td>{bill.billNumber}</td><td>{bill.customerName || "Walk-in Customer"}</td><td>{new Date(bill.createdAt).toLocaleString("en-IN")}</td><td>{bill.billedBy?.name || "—"}</td><td>{formatCurrency(bill.totalAmount)}</td><td>{bill.paymentStatus}</td></tr>)}</tbody></table></div>}</section>
  </main></div>;
}

export default Dashboard;
