import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Staff.css";

const blankStaff = { name: "", email: "", password: "" };

function Staff() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(blankStaff);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await api.get("/staff");
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get("/staff").then(({ data }) => { if (active) setStaff(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Unable to load staff accounts."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const resetForm = () => { setForm(blankStaff); setEditingId(null); setShowForm(false); };
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const editStaff = (member) => {
    setForm({ name: member.name || "", email: member.email || "", password: "" });
    setEditingId(member._id);
    setShowForm(true);
    setError("");
    setMessage("");
  };

  const saveStaff = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingId) {
        await api.put(`/staff/${editingId}`, { name: form.name.trim(), email: form.email.trim() });
        setMessage("Staff details updated.");
      } else {
        await api.post("/staff", { name: form.name.trim(), email: form.email.trim(), password: form.password });
        setMessage("Staff account created.");
      }
      resetForm();
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save staff account.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member) => {
    setError(""); setMessage("");
    try {
      const { data } = await api.patch(`/staff/${member._id}/status`);
      setMessage(data.message || "Staff status updated.");
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change staff status.");
    }
  };

  const visibleStaff = staff.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className="staff-layout"><Sidebar active="staff" onLogout={logout} />
    <main className="staff-main"><header className="staff-header"><div><h1>Staff Management</h1><p>Create staff accounts and manage account access.</p></div><div className="staff-user"><div className="staff-avatar">{(user.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user.name || "Administrator"}</strong><span>Admin</span></div></div></header>
      {error && <div className="staff-alert error" role="alert">{error}</div>}{message && <div className="staff-alert success" role="status">{message}</div>}
      <section className="staff-panel"><div className="staff-toolbar"><div><h2>Staff accounts</h2><p>{staff.length} member{staff.length === 1 ? "" : "s"}</p></div><button type="button" className="staff-primary" onClick={() => { resetForm(); setShowForm(true); setError(""); setMessage(""); }}>+ Add staff</button></div>
        <div className="staff-search"><input type="search" aria-label="Search staff" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{visibleStaff.length} shown</span></div>
        {showForm && <form className="staff-form" onSubmit={saveStaff}><div className="staff-form-heading"><h3>{editingId ? "Edit staff member" : "Create staff account"}</h3><button type="button" onClick={resetForm} aria-label="Close">×</button></div><div className="staff-form-grid"><label>Name<input name="name" value={form.name} onChange={change} required maxLength="100" /></label><label>Email<input type="email" name="email" value={form.email} onChange={change} required maxLength="254" /></label>{!editingId && <label>Password (minimum 10 characters)<input type="password" name="password" value={form.password} onChange={change} required minLength="10" autoComplete="new-password" /></label>}</div><div className="staff-form-actions"><button type="button" className="staff-secondary" onClick={resetForm}>Cancel</button><button className="staff-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create account"}</button></div></form>}
        {loading ? <p className="staff-state">Loading staff...</p> : visibleStaff.length === 0 ? <p className="staff-state">No staff accounts match your search.</p> : <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{visibleStaff.map((member) => <tr key={member._id}><td><strong>{member.name}</strong></td><td>{member.email}</td><td><span className={`staff-status ${member.isActive ? "active" : "inactive"}`}>{member.isActive ? "Active" : "Inactive"}</span></td><td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString("en-IN") : "—"}</td><td><div className="staff-actions"><button type="button" onClick={() => editStaff(member)}>Edit</button><button type="button" className={member.isActive ? "deactivate" : "activate"} onClick={() => toggleStatus(member)}>{member.isActive ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </main></div>;
}

export default Staff;
