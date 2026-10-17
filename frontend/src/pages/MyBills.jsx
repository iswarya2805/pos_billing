import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../style/MyBills.css";

function MyBills() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/bills/mine")
      .then(({ data }) => { if (active) setBills(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Unable to load your bills."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openBill = async (id) => {
    setDetailLoading(true); setError("");
    try {
      const { data } = await api.get(`/bills/${id}`);
      setSelectedBill(data);
    } catch (err) { setError(err.response?.data?.message || "Unable to open this bill."); }
    finally { setDetailLoading(false); }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);

  return <div className="my-bills-layout"><Sidebar active="my-bills" onLogout={logout} /><main className="my-bills-main">
    <header className="my-bills-header"><div><h1>My Bills</h1><p>Bill history for {user?.name || "your account"}.</p></div><button onClick={() => navigate("/staff/billing")}>＋ New bill</button></header>
    {error && <div className="my-bills-alert" role="alert">{error}</div>}
    <section className="my-bills-panel">{loading ? <p className="my-bills-state">Loading your bills...</p> : bills.length === 0 ? <div className="my-bills-empty"><h2>No bills created yet</h2><p>Your completed bills will appear here.</p><button onClick={() => navigate("/staff/billing")}>Create a bill</button></div> : <div className="my-bills-table-wrap"><table className="my-bills-table"><thead><tr><th>Bill number</th><th>Date and time</th><th>Customer</th><th>Payment</th><th>Status</th><th>Total</th><th>Receipt</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill._id}><td>{bill.billNumber}</td><td>{new Date(bill.createdAt).toLocaleString("en-IN")}</td><td>{bill.customerName || "Walk-in Customer"}</td><td className="my-bills-capitalize">{bill.paymentMethod}</td><td className="my-bills-capitalize">{bill.paymentStatus}</td><td>{formatCurrency(bill.totalAmount)}</td><td><button className="my-bills-view" onClick={() => openBill(bill._id)} disabled={detailLoading}>{detailLoading ? "Loading…" : "View / print"}</button></td></tr>)}</tbody></table></div>}</section>
    {selectedBill && <div className="receipt-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBill(null); }}><section className="receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-heading"><div className="receipt-heading"><div><h2 id="receipt-heading">POSFlow receipt</h2><p>{selectedBill.billNumber}</p></div><button className="receipt-close no-print" onClick={() => setSelectedBill(null)} aria-label="Close receipt">×</button></div><p className="receipt-meta">{new Date(selectedBill.createdAt).toLocaleString("en-IN")} · {selectedBill.customerName || "Walk-in Customer"}</p><div className="receipt-lines">{selectedBill.items?.map((item) => <div key={item._id || item.product}><span>{item.productName} × {item.quantity}</span><strong>{formatCurrency(item.subtotal)}</strong></div>)}</div><div className="receipt-total"><span>Total paid</span><strong>{formatCurrency(selectedBill.totalAmount)}</strong></div><p className="receipt-payment">Payment: {selectedBill.paymentMethod}</p><button className="receipt-print no-print" onClick={() => window.print()}>Print receipt</button></section></div>}
  </main></div>;
}

export default MyBills;
