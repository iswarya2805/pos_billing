import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "../style/SupplierLedger.css";

function SupplierLedger() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [suppliers, setSuppliers] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") || "");
  const [transactionType, setTransactionType] = useState("PURCHASE");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const loadLedger = useCallback(async (id) => {
    if (!id) { setLedger(null); return; }
    try {
      const { data } = await api.get(`/supplier-ledger/${id}`);
      setLedger(data);
      setError("");
    } catch (err) {
      setLedger(null);
      setError(err.response?.data?.message || "Unable to load this supplier ledger.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/suppliers"), api.get("/supplier-ledger/transactions")])
      .then(async ([supplierResponse, transactionResponse]) => {
        if (!active) return;
        const supplierList = Array.isArray(supplierResponse.data) ? supplierResponse.data : [];
        setSuppliers(supplierList);
        setAllTransactions(Array.isArray(transactionResponse.data.transactions) ? transactionResponse.data.transactions : []);
        const requested = new URLSearchParams(window.location.search).get("supplierId");
        const chosen = supplierList.find((supplier) => supplier._id === requested)?._id || supplierList.find((supplier) => supplier.isActive)?._id || "";
        if (chosen) {
          setSupplierId(chosen);
          if (chosen !== requested) setSearchParams({ supplierId: chosen }, { replace: true });
          try {
            const { data } = await api.get(`/supplier-ledger/${chosen}`);
            if (active) setLedger(data);
          } catch (err) { if (active) setError(err.response?.data?.message || "Unable to load this supplier ledger."); }
        }
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Unable to load supplier ledger data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setSearchParams]);

  const selectSupplier = async (event) => {
    const id = event.target.value;
    setSupplierId(id);
    setSearchParams(id ? { supplierId: id } : {});
    setMessage("");
    await loadLedger(id);
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    if (!supplierId || !ledger) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = {
        supplierId,
        transactionType,
        amount: Number(amount),
        reference: reference.trim(),
        description: description.trim(),
        ...(transactionType === "PAYMENT" ? { paymentMethod } : {}),
      };
      const { data } = await api.post("/supplier-ledger/transactions", payload);
      setMessage(data.message || "Transaction recorded successfully.");
      setAmount(""); setReference(""); setDescription("");
      const [ledgerResponse, transactionsResponse] = await Promise.all([
        api.get(`/supplier-ledger/${supplierId}`),
        api.get("/supplier-ledger/transactions"),
      ]);
      setLedger(ledgerResponse.data);
      setAllTransactions(Array.isArray(transactionsResponse.data.transactions) ? transactionsResponse.data.transactions : []);
    } catch (err) { setError(err.response?.data?.message || "Unable to record supplier transaction."); }
    finally { setSaving(false); }
  };

  const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
  const visibleTransactions = useMemo(() => allTransactions.filter((transaction) => !supplierId || transaction.supplier?._id === supplierId), [allTransactions, supplierId]);
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className="ledger-layout"><Sidebar active="supplier-ledger" onLogout={logout} />
    <main className="ledger-main"><header className="ledger-header"><div><h1>Supplier Ledger</h1><p>Track purchases, payments, and outstanding balances.</p></div><div className="ledger-user"><div className="ledger-avatar">{(user.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user.name || "Administrator"}</strong><span>Admin</span></div></div></header>
      {error && <div className="ledger-alert error" role="alert">{error}</div>}{message && <div className="ledger-alert success" role="status">{message}</div>}
      <section className="ledger-panel ledger-select-panel"><label htmlFor="ledger-supplier">Select supplier</label><select id="ledger-supplier" value={supplierId} onChange={selectSupplier}><option value="">Choose a supplier</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}{supplier.companyName ? ` · ${supplier.companyName}` : ""}{supplier.isActive ? "" : " (inactive)"}</option>)}</select>{suppliers.length === 0 && !loading && <p>No suppliers yet. <button type="button" className="ledger-inline-link" onClick={() => navigate("/suppliers")}>Add a supplier</button></p>}</section>
      {loading ? <p className="ledger-state">Loading supplier ledger...</p> : ledger && <>
        <section className="ledger-overview"><div className="ledger-supplier-card"><span>Supplier</span><strong>{ledger.supplier.name}</strong><small>{ledger.supplier.companyName || ledger.supplier.phone}</small></div><article><span>Total purchases</span><strong>{formatCurrency(ledger.summary.totalPurchases)}</strong></article><article><span>Payments made</span><strong>{formatCurrency(ledger.summary.totalPayments)}</strong></article><article className="outstanding-card"><span>Outstanding balance</span><strong>{formatCurrency(ledger.summary.outstandingBalance)}</strong></article></section>
        {!ledger.supplier.isActive && <div className="ledger-info">This supplier is inactive. You can view its ledger, but new transactions require an active supplier.</div>}
        <section className="ledger-panel"><div className="ledger-panel-heading"><div><h2>Record transaction</h2><p>Purchases increase the balance; payments reduce it.</p></div></div><form className="ledger-form" onSubmit={submitTransaction}><label>Type<select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="PURCHASE">Purchase</option><option value="PAYMENT">Payment</option></select></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>{transactionType === "PAYMENT" && <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label>}<label>Reference<input value={reference} maxLength="120" onChange={(event) => setReference(event.target.value)} placeholder="Invoice or receipt no." /></label><label className="ledger-description">Description<input value={description} maxLength="300" onChange={(event) => setDescription(event.target.value)} placeholder="Optional details" /></label><button type="submit" disabled={saving || !ledger.supplier.isActive}>{saving ? "Recording…" : "Record transaction"}</button></form></section>
        <section className="ledger-panel"><div className="ledger-panel-heading"><div><h2>Transaction history</h2><p>{ledger.transactionCount} transaction{ledger.transactionCount === 1 ? "" : "s"}</p></div></div>{visibleTransactions.length === 0 ? <p className="ledger-state">No transactions for this supplier yet.</p> : <div className="ledger-table-wrap"><table className="ledger-table"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th><th>Balance after</th><th>Recorded by</th></tr></thead><tbody>{visibleTransactions.map((transaction) => <tr key={transaction._id}><td>{transaction.createdAt ? new Date(transaction.createdAt).toLocaleString("en-IN") : "—"}</td><td><span className={`ledger-type ${transaction.transactionType === "PURCHASE" ? "purchase" : "payment"}`}>{transaction.transactionType}</span>{transaction.paymentMethod && <small className="ledger-payment-method">{transaction.paymentMethod.replace("_", " ")}</small>}</td><td>{transaction.reference || "—"}</td><td>{transaction.description || "—"}</td><td>{formatCurrency(transaction.amount)}</td><td>{formatCurrency(transaction.balanceAfter)}</td><td>{transaction.recordedBy?.name || "—"}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </main></div>;
}

export default SupplierLedger;
