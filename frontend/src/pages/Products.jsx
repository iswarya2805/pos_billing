import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import ProductImage from "../components/ProductImage";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../style/Products.css";

const emptyForm = {
  name: "",
  productCode: "",
  category: "",
  price: "",
  stock: "0",
};
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [currentImage, setCurrentImage] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/products");
      const data = response.data;
      setProducts(Array.isArray(data) ? data : data.products || data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get("/products")
      .then(({ data }) => {
        if (!active) return;
        setProducts(Array.isArray(data) ? data : data.products || data.data || []);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load products.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) =>
      (!categoryFilter || product.category === categoryFilter) &&
      [product.name, product.productCode, product.category]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [products, search, categoryFilter]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const closeForm = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setForm(emptyForm);
    setImageFile(null);
    setCurrentImage("");
    setRemoveImage(false);
    setEditingId(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    closeForm();
    setShowForm(true);
    setError("");
    setMessage("");
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name || "",
      productCode: product.productCode || "",
      category: product.category || "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 0),
    });
    setImageFile(null);
    setCurrentImage(product.image || "");
    setRemoveImage(false);
    setEditingId(product._id);
    setShowForm(true);
    setError("");
    setMessage("");
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedImageTypes.includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setError("");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImageFile(file);
    setRemoveImage(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      productCode: form.productCode.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
    };

    try {
      const requestData = imageFile || removeImage ? new FormData() : payload;
      if (requestData instanceof FormData) {
        Object.entries(payload).forEach(([key, value]) => requestData.append(key, String(value)));
        if (imageFile) requestData.append("image", imageFile);
        if (removeImage && !imageFile) requestData.append("removeImage", "true");
      }
      if (editingId) {
        await api.put(`/products/${editingId}`, requestData);
        setMessage("Product updated successfully.");
      } else {
        await api.post("/products", requestData);
        setMessage("Product added successfully.");
      }
      closeForm();
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save product. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Are you sure you want to delete “${product.name}”?`)) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/products/${product._id}`);
      setMessage("Product deleted successfully.");
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete product.");
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="products-layout">
      <Sidebar active="products" onLogout={logout} />

      <main className="products-main">
        <header className="products-header">
          <div><h1>Product Management</h1><p>Manage products, prices, and stock.</p></div>
          <div className="products-user"><div className="products-avatar">{(user.name || "U").charAt(0).toUpperCase()}</div><div><strong>{user.name || "User"}</strong><span>{user.role || "Staff"}</span></div></div>
        </header>

      {error && <div className="products-alert error" role="alert">{error}</div>}
        {message && <div className="products-alert success" role="status">{message}</div>}

        <section className="products-panel">
          <div className="products-toolbar">
            <div><h2>Products</h2><p>Search your catalog or update product details.</p></div>
            {isAdmin && <button className="add-product-btn" type="button" onClick={openAddForm}>+ Add Product</button>}
          </div>

          <div className="products-search">
            <input type="search" aria-label="Search products" placeholder="Search by name, SKU, or category..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <span>{filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}</span>
          </div>

          {isAdmin && showForm && (
            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-heading"><h3>{editingId ? "Edit Product" : "Add New Product"}</h3><button type="button" className="close-form-btn" onClick={closeForm} aria-label="Close form">×</button></div>
              <div className="product-form-grid">
                <div className="product-field"><label htmlFor="product-name">Product name *</label><input id="product-name" name="name" value={form.name} onChange={updateField} required maxLength="120" /></div>
                <div className="product-field"><label htmlFor="product-code">SKU / Product code *</label><input id="product-code" name="productCode" value={form.productCode} onChange={updateField} required maxLength="60" /></div>
                <div className="product-field"><label htmlFor="product-category">Category *</label><input id="product-category" name="category" value={form.category} onChange={updateField} required maxLength="80" /></div>
                <div className="product-field"><label htmlFor="product-price">Selling price (₹) *</label><input id="product-price" type="number" name="price" min="0" step="0.01" value={form.price} onChange={updateField} required /></div>
                <div className="product-field"><label htmlFor="product-stock">Stock *</label><input id="product-stock" type="number" name="stock" min="0" step="1" value={form.stock} onChange={updateField} required /></div>
                <p className="product-form-note">Cost price is not stored in the current product model.</p>
              </div>
              <div className="product-image-field">
                <label htmlFor="product-image">Product image (JPG, PNG, WEBP; max 5 MB)</label>
                <input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                <div className="product-image-preview-wrap">
                  <ProductImage image={imagePreview || (removeImage ? "" : currentImage)} alt="Product preview" className="product-image-preview" />
                  {currentImage && !removeImage && !imageFile && <button type="button" onClick={() => setRemoveImage(true)}>Remove current image</button>}
                  {removeImage && <button type="button" onClick={() => setRemoveImage(false)}>Keep current image</button>}
                  {imageFile && <button type="button" onClick={() => { if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(""); setImageFile(null); const input = document.getElementById("product-image"); if (input) input.value = ""; }}>Clear selected image</button>}
                </div>
              </div>
              <div className="product-form-actions"><button type="button" className="cancel-product-btn" onClick={closeForm}>Cancel</button><button type="submit" className="save-product-btn" disabled={saving}>{saving ? "Saving…" : editingId ? "Update Product" : "Save Product"}</button></div>
            </form>
          )}

          {loading ? <p className="products-loading" role="status">Loading products...</p> : filteredProducts.length === 0 ? (
            <div className="products-empty"><span>▣</span><h3>{search ? "No matching products" : "No products yet"}</h3><p>{search ? "Try another name, SKU, or category." : "Add a product to start building your catalog."}</p></div>
          ) : (
            <div className="products-table-wrapper"><table className="products-table">
              <thead><tr><th>Image</th><th>Product</th><th>SKU</th><th>Category</th><th>Selling price</th><th>Cost price</th><th>Stock</th><th>Actions</th></tr></thead>
              <tbody>{visibleProducts.map((product) => {
                const stock = Number(product.stock) || 0;
                const low = stock > 0 && stock <= 5;
                return <tr key={product._id} className={low || stock === 0 ? "low-stock-row" : ""}>
                  <td><ProductImage image={product.image} alt={product.name} className="products-table-image" /></td><td><strong>{product.name}</strong></td><td>{product.productCode}</td><td>{product.category}</td>
                  <td>{formatCurrency(product.price)}</td><td className="unavailable-value" title="The current backend model does not store cost price">Not recorded</td>
                  <td><span className={`stock-status ${stock === 0 ? "out" : low ? "low" : "in"}`}>{stock} {stock === 0 ? "· Out" : low ? "· Low" : "· In stock"}</span></td>
                  <td>{isAdmin && <div className="product-actions"><button type="button" onClick={() => handleEdit(product)}>Edit</button><button type="button" className="delete-action" onClick={() => handleDelete(product)}>Delete</button></div>}</td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
          {!loading && filteredProducts.length > pageSize && <nav className="products-pagination" aria-label="Product pages"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></nav>}
        </section>
      </main>
    </div>
  );
}

export default Products;
