import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Reports.css";

const dateValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function Reports() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const today = dateValue(new Date());
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);
  const [startDate, setStartDate] = useState(dateValue(monthAgo));
  const [endDate, setEndDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = { startDate, endDate };
    Promise.all([api.get("/reports/summary", { params }), api.get("/reports/daily", { params })])
      .then(([summaryResponse, dailyResponse]) => {
        if (active) {
          setSummary(summaryResponse.data);
          setDaily(Array.isArray(dailyResponse.data) ? dailyResponse.data : []);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load sales reports.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [startDate, endDate]);

  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);
  const maxRevenue = useMemo(() => Math.max(...daily.map((day) => Number(day.totalRevenue) || 0), 1), [daily]);

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className="reports-layout">
    <Sidebar active="reports" onLogout={logout} />
    <main className="reports-main"><header className="reports-header"><div><h1>Sales Reports</h1><p>Review paid sales for your selected date range.</p></div><div className="reports-user"><div className="reports-avatar">{(user.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user.name || "Administrator"}</strong><span>{user.role || "admin"}</span></div></div></header>
      {error && <div className="reports-alert" role="alert">{error}</div>}
      <div className="reports-filters"><label>From<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label>To<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label><span className="reports-filter-note">Updates when dates change</span></div>
      {loading && !summary ? <p className="reports-state" role="status">Loading reports...</p> : <>
        <section className="reports-kpis"><article><span>Total revenue</span><strong>{formatCurrency(summary?.totalRevenue)}</strong></article><article><span>Paid bills</span><strong>{summary?.totalBills || 0}</strong></article><article><span>Average bill</span><strong>{formatCurrency(summary?.totalBills ? summary.totalRevenue / summary.totalBills : 0)}</strong></article></section>
        <div className="reports-grid"><section className="reports-panel"><h2>Daily sales</h2><p>Revenue by day in the selected range.</p>{daily.length === 0 ? <div className="reports-empty">No sales for these dates.</div> : <div className="daily-sales-list">{daily.map((day) => <div className="daily-sales-row" key={day._id}><time>{day._id}</time><div className="daily-bar-track"><div className="daily-bar" style={{ width: `${Math.max(2, (Number(day.totalRevenue) / maxRevenue) * 100)}%` }} /></div><strong>{formatCurrency(day.totalRevenue)}</strong></div>)}</div>}</section>
          <section className="reports-panel"><h2>Payment methods</h2><p>Paid bill totals grouped by method.</p>{!summary?.paymentBreakdown?.length ? <div className="reports-empty">No payment data.</div> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Method</th><th>Bills</th><th>Revenue</th></tr></thead><tbody>{summary.paymentBreakdown.map((row) => <tr key={row._id}><td className="capitalize">{row._id}</td><td>{row.count}</td><td>{formatCurrency(row.totalAmount)}</td></tr>)}</tbody></table></div>}</section></div>
        <section className="reports-panel top-products"><h2>Top products</h2><p>Products ranked by units sold.</p>{!summary?.topProducts?.length ? <div className="reports-empty">No product sales for these dates.</div> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead><tbody>{summary.topProducts.map((item) => <tr key={item._id}><td>{item.productName}</td><td>{item.quantitySold}</td><td>{formatCurrency(item.revenue)}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </main>
  </div>;
}

export default Reports;
