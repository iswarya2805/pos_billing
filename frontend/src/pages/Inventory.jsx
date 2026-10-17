import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import ProductImage from "../components/ProductImage";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Inventory.css";

function Inventory() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movementType, setMovementType] = useState("STOCK_IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const { data } = await api.get("/stock");
      setProducts(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/stock/history");
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load stock history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get("/stock")
      .then(({ data }) => {
        if (active) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load inventory.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    api.get("/stock/history")
      .then(({ data }) => {
        if (active) setHistory(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load stock history.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) =>
      [product.name, product.productCode, product.category]
        .some((field) => String(field || "").toLowerCase().includes(query))
    );
  }, [products, search]);

  const lowStockCount = products.filter((product) => Number(product.stock) <= 10).length;
  const totalUnits = products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0);

  const openAdjustment = (product, type) => {
    setSelectedProduct(product);
    setMovementType(type);
    setQuantity("");
    setReason("");
    setError("");
    setMessage("");
  };

  const closeAdjustment = () => {
    setSelectedProduct(null);
    setQuantity("");
    setReason("");
  };

  const handleAdjustment = async (event) => {
    event.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.patch(`/stock/${selectedProduct._id}`, {
        movementType,
        quantity: Number(quantity),
        reason: reason.trim(),
      });
      setMessage(data.message || "Stock updated successfully.");
      closeAdjustment();
      await Promise.all([loadInventory(), loadHistory()]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update stock.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const formatDate = (value) => value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

  return (
    <div className="inventory-layout">
      <Sidebar active="inventory" onLogout={logout} />

      <main className="inventory-main">
        <header className="inventory-header">
          <div><h1>Inventory</h1><p>Monitor stock and record incoming or outgoing movements.</p></div>
          <div className="inventory-user"><div className="inventory-avatar">{(user.name || "A").charAt(0).toUpperCase()}</div><div><strong>{user.name || "Administrator"}</strong><span>{user.role || "admin"}</span></div></div>
        </header>

        {error && <div className="inventory-alert error" role="alert">{error}</div>}
        {message && <div className="inventory-alert success" role="status">{message}</div>}

        <section className="inventory-summary" aria-label="Inventory summary">
          <article><span>Product types</span><strong>{products.length}</strong></article>
          <article><span>Total units in stock</span><strong>{totalUnits}</strong></article>
          <article><span>Low stock (10 or fewer)</span><strong>{lowStockCount}</strong></article>
        </section>

        <section className="inventory-panel">
          <div className="inventory-toolbar"><div><h2>Stock by product</h2><p>Low stock products are highlighted.</p></div><label className="inventory-search"><span className="sr-only">Search inventory</span><input type="search" placeholder="Search name, SKU, or category..." value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
          {loading ? <p className="inventory-state" role="status">Loading inventory...</p> : products.length === 0 ? <p className="inventory-state">No products found in inventory.</p> : filteredProducts.length === 0 ? <p className="inventory-state">No products match your search.</p> : (
            <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Image</th><th>Product</th><th>SKU</th><th>Category</th><th>On hand</th><th>Status</th><th>Stock actions</th></tr></thead><tbody>
              {filteredProducts.map((product) => {
                const stock = Number(product.stock) || 0;
                const low = stock <= 10;
                return <tr key={product._id} className={low ? "inventory-low-row" : ""}><td><ProductImage image={product.image} alt={product.name} className="inventory-product-image" /></td><td><strong>{product.name}</strong></td><td>{product.productCode || "—"}</td><td>{product.category || "—"}</td><td>{stock}</td><td><span className={`inventory-badge ${stock === 0 ? "out" : low ? "low" : "in"}`}>{stock === 0 ? "Out of stock" : low ? "Low stock" : "In stock"}</span></td><td><div className="inventory-actions"><button type="button" onClick={() => openAdjustment(product, "STOCK_IN")}>Stock in</button><button type="button" className="stock-out-button" onClick={() => openAdjustment(product, "STOCK_OUT")}>Stock out</button></div></td></tr>;
              })}
            </tbody></table></div>
          )}
        </section>

        <section className="inventory-panel history-panel">
          <div className="inventory-toolbar"><div><h2>Recent stock movements</h2><p>Recorded stock changes, including sales and returns.</p></div></div>
          {historyLoading ? <p className="inventory-state" role="status">Loading stock history...</p> : history.length === 0 ? <p className="inventory-state">No stock movements recorded yet.</p> : (
            <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Stock change</th><th>Reason</th><th>Recorded by</th></tr></thead><tbody>
              {history.map((movement) => <tr key={movement._id}><td>{formatDate(movement.createdAt)}</td><td>{movement.product?.name || "Product unavailable"}</td><td><span className={`movement-type ${movement.movementType === "STOCK_IN" ? "positive" : "negative"}`}>{movement.movementType?.replace("_", " ") || "—"}</span></td><td>{movement.quantity}</td><td>{movement.previousStock} → {movement.newStock}</td><td>{movement.reason || "—"}</td><td>{movement.performedBy?.name || "—"}</td></tr>)}
            </tbody></table></div>
          )}
        </section>
      </main>

      {selectedProduct && <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAdjustment(); }}><section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title"><div className="inventory-modal-heading"><div><h2 id="adjust-stock-title">{movementType === "STOCK_IN" ? "Add stock" : "Remove stock"}</h2><p>{selectedProduct.name} · Current stock: {selectedProduct.stock}</p></div><button type="button" onClick={closeAdjustment} aria-label="Close">×</button></div><form onSubmit={handleAdjustment}><label>Quantity<input type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Reason (optional)<input type="text" maxLength="200" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={movementType === "STOCK_IN" ? "e.g. Purchase received" : "e.g. Damaged items"} /></label><div className="inventory-modal-actions"><button type="button" className="inventory-cancel" onClick={closeAdjustment}>Cancel</button><button type="submit" className="inventory-confirm" disabled={saving}>{saving ? "Saving…" : movementType === "STOCK_IN" ? "Add stock" : "Remove stock"}</button></div></form></section></div>}
    </div>
  );
}

export default Inventory;
