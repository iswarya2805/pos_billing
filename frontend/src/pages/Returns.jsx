import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Returns.css";

function Returns() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";
  const [billIdInput, setBillIdInput] = useState("");
  const [bill, setBill] = useState(null);
  const [returns, setReturns] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [refundMethod, setRefundMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [loadingBill, setLoadingBill] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(isAdmin);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReturns = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get("/returns");
      setReturns(Array.isArray(data.returns) ? data.returns : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load return history.");
    } finally {
      setLoadingReturns(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.get("/returns").then(({ data }) => {
      if (active) setReturns(Array.isArray(data.returns) ? data.returns : []);
    }).catch((err) => {
      if (active) setError(err.response?.data?.message || "Unable to load return history.");
    }).finally(() => { if (active) setLoadingReturns(false); });
    return () => { active = false; };
  }, [isAdmin]);

  const findBill = async (event) => {
    event.preventDefault();
    const id = billIdInput.trim();
    if (!id) return;
    setLoadingBill(true);
    setError("");
    setMessage("");
    setBill(null);
    setQuantities({});
    try {
      const { data } = await api.get(`/bills/${encodeURIComponent(id)}`);
      setBill(data.bill || data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not find that bill. Use its MongoDB bill ID.");
    } finally {
      setLoadingBill(false);
    }
  };

  const updateQuantity = (productId, value, max) => {
    const amount = value === "" ? "" : Math.min(Math.max(0, Number(value)), max);
    setQuantities((current) => ({ ...current, [productId]: amount }));
  };

  const selectedItems = (bill?.items || []).filter((item) => Number(quantities[item.product]) > 0);
  const refundTotal = selectedItems.reduce((sum, item) => sum + item.price * Number(quantities[item.product]), 0);
  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);

  const submitReturn = async (event) => {
    event.preventDefault();
    if (!bill || selectedItems.length === 0) {
      setError("Choose at least one eligible item and quantity to return.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/returns", {
        billId: bill._id,
        items: selectedItems.map((item) => ({ productId: item.product, quantity: Number(quantities[item.product]) })),
        refundMethod,
        reason: reason.trim(),
      });
      setMessage(`${data.message || "Return processed successfully."}${data.return?.returnNumber ? ` Return number: ${data.return.returnNumber}` : ""}`);
      const { data: refreshedBill } = await api.get(`/bills/${encodeURIComponent(bill._id)}`);
      setBill(refreshedBill.bill || refreshedBill);
      setQuantities({});
      setReason("");
      await loadReturns();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to process this return.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className="returns-layout">
    <Sidebar active="returns" onLogout={logout} />
    <main className="returns-main"><header className="returns-header"><div><h1>Returns & Refunds</h1><p>Process eligible items from a completed, paid bill.</p></div><div className="returns-user"><div className="returns-avatar">{(user.name || "U").charAt(0).toUpperCase()}</div><div><strong>{user.name || "User"}</strong><span>{user.role || "Staff"}</span></div></div></header>
      {error && <div className="returns-alert error" role="alert">{error}</div>}{message && <div className="returns-alert success" role="status">{message}</div>}
      <section className="returns-panel"><h2>Find original bill</h2><p>Enter the bill’s MongoDB ID. It is available in the bill record returned by checkout.</p><form className="bill-lookup" onSubmit={findBill}><input aria-label="Bill ID" value={billIdInput} onChange={(event) => setBillIdInput(event.target.value)} placeholder="Paste bill ID" required /><button type="submit" disabled={loadingBill}>{loadingBill ? "Searching…" : "Find bill"}</button></form></section>
      {bill && <section className="returns-panel"><div className="return-bill-heading"><div><h2>Bill {bill.billNumber || ""}</h2><p>{bill.customerName || "Walk-in Customer"} · {bill.paymentStatus || "Unknown status"} · {formatCurrency(bill.totalAmount)}</p></div><span className={`bill-status ${bill.paymentStatus === "paid" ? "paid" : "unpaid"}`}>{bill.paymentStatus}</span></div>
        {bill.paymentStatus !== "paid" && <p className="return-inline-error">Only paid bills can be returned.</p>}
        <form onSubmit={submitReturn}><div className="returns-table-wrap"><table className="returns-table"><thead><tr><th>Item</th><th>Purchased</th><th>Previously returned</th><th>Eligible</th><th>Return now</th><th>Refund</th></tr></thead><tbody>{(bill.items || []).map((item) => { const eligible = Math.max(0, Number(item.quantity) - Number(item.returnedQuantity || 0)); const amount = Number(quantities[item.product]) || 0; return <tr key={item.product}><td>{item.productName}</td><td>{item.quantity}</td><td>{item.returnedQuantity || 0}</td><td>{eligible}</td><td><input aria-label={`Return quantity for ${item.productName}`} type="number" min="0" max={eligible} step="1" disabled={eligible === 0 || bill.paymentStatus !== "paid"} value={quantities[item.product] ?? 0} onChange={(event) => updateQuantity(item.product, event.target.value, eligible)} /></td><td>{formatCurrency(Number(item.price) * amount)}</td></tr>; })}</tbody></table></div>
          <div className="return-form-bottom"><label>Refund method<select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></label><label>Reason (optional)<input value={reason} maxLength="300" onChange={(event) => setReason(event.target.value)} placeholder="Reason for return" /></label><strong>Refund total: {formatCurrency(refundTotal)}</strong><button type="submit" disabled={submitting || bill.paymentStatus !== "paid" || selectedItems.length === 0}>{submitting ? "Processing…" : "Process return"}</button></div></form>
      </section>}
      {isAdmin && <section className="returns-panel"><div className="return-bill-heading"><div><h2>Return history</h2><p>Previously processed refunds.</p></div></div>{loadingReturns ? <p className="returns-state">Loading return history...</p> : returns.length === 0 ? <p className="returns-state">No returns have been processed.</p> : <div className="returns-table-wrap"><table className="returns-table"><thead><tr><th>Return</th><th>Bill</th><th>Processed</th><th>Items</th><th>Refund</th><th>Method</th><th>Processed by</th></tr></thead><tbody>{returns.map((record) => <tr key={record._id}><td>{record.returnNumber}</td><td>{record.originalBill?.billNumber || "—"}</td><td>{record.createdAt ? new Date(record.createdAt).toLocaleString("en-IN") : "—"}</td><td>{record.items?.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}</td><td>{formatCurrency(record.totalRefund)}</td><td className="capitalize">{record.refundMethod}</td><td>{record.processedBy?.name || "—"}</td></tr>)}</tbody></table></div>}</section>}
    </main>
  </div>;
}

export default Returns;
