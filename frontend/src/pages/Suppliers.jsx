import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Suppliers.css";

const blankSupplier = { name: "", companyName: "", phone: "", email: "", address: "" };

function Suppliers() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(blankSupplier);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get("/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load suppliers.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    api.get("/suppliers").then(({ data }) => { if (active) setSuppliers(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Unable to load suppliers."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const resetForm = () => { setForm(blankSupplier); setEditingId(null); setShowForm(false); };
  const editSupplier = (supplier) => {
    setForm({ name: supplier.name || "", companyName: supplier.companyName || "", phone: supplier.phone || "", email: supplier.email || "", address: supplier.address || "" });
    setEditingId(supplier._id); setShowForm(true); setError(""); setMessage("");
  };
  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveSupplier = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    try {
      if (editingId) { await api.put(`/suppliers/${editingId}`, payload); setMessage("Supplier updated successfully."); }
      else { await api.post("/suppliers", payload); setMessage("Supplier added successfully."); }
      resetForm(); await loadSuppliers();
    } catch (err) { setError(err.response?.data?.message || "Unable to save supplier."); }
    finally { setSaving(false); }
  };

  const deactivateSupplier = async (supplier) => {
    if (!window.confirm(`Deactivate ${supplier.name}?`)) return;
    setError(""); setMessage("");
    try { await api.patch(`/suppliers/${supplier._id}/deactivate`); setMessage("Supplier deactivated."); await loadSuppliers(); }
    catch (err) { setError(err.response?.data?.message || "Unable to deactivate supplier."); }
  };

  const visibleSuppliers = suppliers.filter((supplier) => `${supplier.name} ${supplier.companyName} ${supplier.phone} ${supplier.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className="suppliers-layout"><Sidebar active="suppliers" onLogout={logout} />
    <main className="suppliers-main"><header className="suppliers-header"><div><h1>Suppliers</h1><p>Maintain supplier contact details and account status.</p></div><div className="suppliers-user"><div className="suppliers-avatar">{(user.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user.name || "Administrator"}</strong><span>Admin</span></div></div></header>
      {error && <div className="suppliers-alert error" role="alert">{error}</div>}{message && <div className="suppliers-alert success" role="status">{message}</div>}
      <section className="suppliers-panel"><div className="suppliers-toolbar"><div><h2>Supplier directory</h2><p>{suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} · {suppliers.filter((item) => item.isActive).length} active</p></div><button className="suppliers-primary" type="button" onClick={() => { resetForm(); setShowForm(true); setError(""); setMessage(""); }}>+ Add supplier</button></div>
        <div className="suppliers-search"><input type="search" aria-label="Search suppliers" placeholder="Search name, company, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{visibleSuppliers.length} shown</span></div>
        {showForm && <form className="supplier-form" onSubmit={saveSupplier}><div className="supplier-form-heading"><h3>{editingId ? "Edit supplier" : "Add supplier"}</h3><button type="button" onClick={resetForm} aria-label="Close">×</button></div><div className="supplier-form-grid"><label>Contact name *<input name="name" value={form.name} onChange={updateField} required maxLength="120" /></label><label>Company<input name="companyName" value={form.companyName} onChange={updateField} maxLength="160" /></label><label>Phone *<input type="tel" name="phone" value={form.phone} onChange={updateField} required maxLength="40" /></label><label>Email<input type="email" name="email" value={form.email} onChange={updateField} maxLength="254" /></label><label className="supplier-address">Address<textarea name="address" value={form.address} onChange={updateField} rows="2" maxLength="500" /></label></div><div className="supplier-form-actions"><button type="button" className="suppliers-secondary" onClick={resetForm}>Cancel</button><button type="submit" className="suppliers-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add supplier"}</button></div></form>}
        {loading ? <p className="suppliers-state">Loading suppliers...</p> : visibleSuppliers.length === 0 ? <p className="suppliers-state">No suppliers match your search.</p> : <div className="suppliers-table-wrap"><table className="suppliers-table"><thead><tr><th>Name / company</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleSuppliers.map((supplier) => <tr key={supplier._id}><td><strong>{supplier.name}</strong><small>{supplier.companyName || "—"}</small></td><td>{supplier.phone}</td><td>{supplier.email || "—"}</td><td className="supplier-address-cell">{supplier.address || "—"}</td><td><span className={`supplier-status ${supplier.isActive ? "active" : "inactive"}`}>{supplier.isActive ? "Active" : "Inactive"}</span></td><td><div className="supplier-actions"><button type="button" onClick={() => editSupplier(supplier)}>Edit</button><button type="button" onClick={() => navigate(`/supplier-ledger?supplierId=${supplier._id}`)}>Ledger</button>{supplier.isActive && <button type="button" className="supplier-deactivate" onClick={() => deactivateSupplier(supplier)}>Deactivate</button>}</div></td></tr>)}</tbody></table></div>}
      </section></main></div>;
}

export default Suppliers;
