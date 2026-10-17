import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../style/StaffDashboard.css";

const dateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function StaffDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = dateKey(new Date());

  useEffect(() => {
    let active = true;
    api.get("/bills/mine")
      .then(({ data }) => { if (active) setBills(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Unable to load your bills."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const todayBills = bills.filter((bill) => dateKey(new Date(bill.createdAt)) === today && bill.paymentStatus === "paid");
  const todaySales = todayBills.reduce((sum, bill) => sum + (Number(bill.totalAmount) || 0), 0);
  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);

  return <div className="staff-dashboard-layout"><Sidebar active="dashboard" onLogout={logout} /><main className="staff-dashboard-main">
    <header className="staff-dashboard-header"><div><h1>Welcome, {user?.name || "Cashier"}</h1><p>Your billing activity for today.</p></div><span className="staff-role-chip">Staff workspace</span></header>
    {error && <div className="staff-dashboard-alert" role="alert">{error}</div>}
    <section className="staff-dashboard-cards"><article><span>My bills today</span><strong>{loading ? "…" : todayBills.length}</strong><small>Paid bills created by you</small></article><article><span>My sales today</span><strong>{loading ? "…" : formatCurrency(todaySales)}</strong><small>Your paid bills only</small></article><button className="staff-new-bill-card" onClick={() => navigate("/staff/billing")}><span>＋</span><strong>Start a new bill</strong><small>Open billing and checkout</small></button></section>
    <section className="staff-dashboard-panel"><div className="staff-dashboard-panel-heading"><div><h2>Recent bills</h2><p>Only bills created by your account are shown.</p></div><button onClick={() => navigate("/staff/bills")}>View all my bills</button></div>
      {loading ? <p className="staff-dashboard-state">Loading your bills...</p> : bills.length === 0 ? <div className="staff-dashboard-empty"><h3>No bills yet</h3><p>Create your first customer bill from checkout.</p><button onClick={() => navigate("/staff/billing")}>Go to billing</button></div> : <div className="staff-dashboard-table-wrap"><table className="staff-dashboard-table"><thead><tr><th>Bill number</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th></tr></thead><tbody>{bills.slice(0, 6).map((bill) => <tr key={bill._id}><td>{bill.billNumber}</td><td>{new Date(bill.createdAt).toLocaleString("en-IN")}</td><td>{bill.customerName || "Walk-in Customer"}</td><td className="staff-capitalize">{bill.paymentMethod}</td><td>{formatCurrency(bill.totalAmount)}</td></tr>)}</tbody></table></div>}
    </section>
  </main></div>;
}

export default StaffDashboard;
