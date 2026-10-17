import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import ProductImage from "../components/ProductImage";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../style/Billing.css";

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout. Check your internet connection."));
    document.body.appendChild(script);
  });
}

function Billing() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successBill, setSuccessBill] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Fetch products
  const fetchProducts = async () => {
    try {
      const response = await api.get("/products");
      const data = response.data;

      const list = Array.isArray(data)
        ? data
        : data.products || data.data || [];

      setProducts(list);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load products. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get("/products")
      .then(({ data }) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data.products || data.data || [];
        setProducts(list);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load products. Please try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Filter products
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        (product.name || "").toLowerCase().includes(query) ||
        (product.productCode || product.sku || "").toLowerCase().includes(query) ||
        (product.category || "").toLowerCase().includes(query);

      return matchesSearch && (!categoryFilter || product.category === categoryFilter) && Number(product.stock || 0) > 0;
    });
  }, [products, search, categoryFilter]);

  // Add product to cart
  const addToCart = (product) => {
    setError("");
    setSuccessBill(null);

    // Ensure the product has a valid MongoDB ID
    const productId = product._id || product.id;

    if (!productId) {
      setError(
        `Unable to add ${product.name || "this product"}: product ID is missing.`
      );
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.productId === productId
      );

      if (existing) {
        if (existing.quantity >= Number(product.stock)) {
          setError(
            `Only ${product.stock} units of ${product.name} are available.`
          );
          return currentCart;
        }

        return currentCart.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...currentCart,
        {
          productId,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          availableStock: Number(product.stock),
        },
      ];
    });
  };

  // Update quantity
  const updateQuantity = (productId, value) => {
    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    const item = cart.find((entry) => entry.productId === productId);

    if (item && quantity > item.availableStock) {
      setError(
        `Only ${item.availableStock} units of ${item.name} are available.`
      );
      return;
    }

    setError("");

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  // Remove product from cart
  const removeFromCart = (productId) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.productId !== productId)
    );

    setError("");
  };

  // Calculate total
  const totalAmount = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Currency formatting
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const finishPaidSale = async (createdBill) => {
    setSuccessBill(createdBill);
    setPendingPayment(null);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    await fetchProducts();
  };

  const verifyRazorpayPayment = async (payload, paymentDetails) => {
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/bills/razorpay/verify", {
        ...payload,
        ...paymentDetails,
      });
      await finishPaidSale(data.bill || data);
    } catch (err) {
      setError(err.response?.data?.message || "Payment was received, but bill confirmation failed. Retry verification before attempting another payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openRazorpayCheckout = async (payload) => {
    await loadRazorpayCheckout();
    const { data: order } = await api.post("/bills/razorpay/order", { items: payload.items });
    let paymentSubmitted = false;

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "POSFlow",
      description: "POS sale payment",
      order_id: order.orderId,
      prefill: {
        name: payload.customerName,
        contact: payload.customerPhone,
      },
      theme: { color: "#2563eb" },
      modal: {
        ondismiss: () => {
          if (!paymentSubmitted) {
            setSubmitting(false);
            setError("Razorpay checkout was closed. No bill was created.");
          }
        },
      },
      handler: (paymentDetails) => {
        paymentSubmitted = true;
        setPendingPayment({ payload, paymentDetails });
        verifyRazorpayPayment(payload, paymentDetails);
      },
    });

    checkout.on("payment.failed", (event) => {
      paymentSubmitted = false;
      setPendingPayment(null);
      setSubmitting(false);
      setError(event.error?.description || "UPI payment failed. No bill was created.");
    });
    checkout.open();
  };

  // Cash/card bills keep their existing flow. Razorpay payments are verified before a bill is created.
  const handleCheckout = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessBill(null);

    if (pendingPayment) {
      await verifyRazorpayPayment(pendingPayment.payload, pendingPayment.paymentDetails);
      return;
    }
    if (cart.length === 0) {
      setError("Please add at least one product to the cart.");
      return;
    }

    const invalidItem = cart.find((item) => !item.productId || !/^[a-fA-F0-9]{24}$/.test(String(item.productId)));
    if (invalidItem) {
      setError(`Invalid product ID for "${invalidItem.name}". Remove it and add the product again.`);
      return;
    }

    const payload = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      items: cart.map((item) => ({ productId: String(item.productId), quantity: Number(item.quantity) })),
    };

    setSubmitting(true);
    if (paymentMethod === "upi") {
      try {
        await openRazorpayCheckout(payload);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Unable to start Razorpay checkout.");
        setSubmitting(false);
      }
      return;
    }

    try {
      const response = await api.post("/bills", payload);
      await finishPaidSale(response.data.bill || response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create the bill. Please check the product ID and stock.");
    } finally {
      setSubmitting(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const billNumber =
    successBill?.billNumber || successBill?._id || "Generated successfully";

  return (
    <div className="billing-layout">
      <Sidebar active="billing" onLogout={logout} />

      <main className="billing-main">
        <header className="billing-header">
          <div>
            <h1>Billing & Checkout</h1>
            <p>Create bills and process customer payments.</p>
          </div>

          <div className="billing-user">
            <div className="billing-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{user.name || "User"}</strong>
              <span>{user.role || "Staff"}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="billing-alert error" role="alert">
            {error}
          </div>
        )}

        {successBill && (
          <div className="billing-alert success" role="status">
            <div>
              <strong>Bill created successfully!</strong>
              <p>Bill Number: {billNumber}</p>
              <p>
                Total:{" "}
                {formatCurrency(successBill.totalAmount ?? totalAmount)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="print-bill-btn"
            >
              Print
            </button>
          </div>
        )}

        <div className="billing-content">
          <section className="billing-products-panel">
            <div className="billing-panel-heading">
              <div>
                <h2>Select Products</h2>
                <p>Choose products to add to the customer's bill.</p>
              </div>

              <span>{filteredProducts.length} available</span>
            </div>

            <input
              className="billing-search"
              type="search"
              placeholder="Search products by name, SKU, or category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="billing-category-filter" aria-label="Filter products by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>

            {loading ? (
              <p className="billing-empty">Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="billing-empty">
                No available products found.
              </p>
            ) : (
              <div className="billing-product-grid">
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    className="billing-product-card"
                    key={product._id || product.id}
                    onClick={() => addToCart(product)}
                    disabled={submitting || Boolean(pendingPayment)}
                  >
                    <ProductImage image={product.image} alt={product.name} className="billing-product-image" />
                    <strong>{product.name}</strong>
                    <span>{product.category || "General"}</span>
                    <b>{formatCurrency(product.price)}</b>
                    <small>{product.stock} in stock</small>
                    <span className="add-product-label">+ Add to bill</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="billing-cart-panel">
            <div className="billing-panel-heading">
              <div>
                <h2>Current Bill</h2>
                <p>{cart.length} different product(s)</p>
              </div>

              <span className="cart-icon">🧾</span>
            </div>

            <form onSubmit={handleCheckout}>
              <div className="billing-customer-fields">
                <label>
                  Customer Name
                  <input
                    type="text"
                    placeholder="Walk-in customer"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    disabled={submitting || Boolean(pendingPayment)}
                  />
                </label>

                <label>
                  Customer Phone
                  <input
                    type="tel"
                    placeholder="Optional phone number"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    disabled={submitting || Boolean(pendingPayment)}
                  />
                </label>
              </div>

              <div className="billing-cart-items">
                {cart.length === 0 ? (
                  <div className="billing-empty-cart">
                    <span>🛒</span>
                    <p>Your bill is empty.</p>
                    <small>Select a product to get started.</small>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      className="billing-cart-item"
                      key={item.productId}
                    >
                      <div className="cart-item-details">
                        <strong>{item.name}</strong>
                        <span>{formatCurrency(item.price)} each</span>
                      </div>

                      <div className="cart-item-controls">
                        <input
                          aria-label={`Quantity for ${item.name}`}
                          type="number"
                          min="1"
                          max={item.availableStock}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              item.productId,
                              event.target.value
                            )
                          }
                          disabled={submitting || Boolean(pendingPayment)}
                        />

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          aria-label={`Remove ${item.name}`}
                          disabled={submitting || Boolean(pendingPayment)}
                        >
                          ✕
                        </button>
                      </div>

                      <strong className="cart-item-subtotal">
                        {formatCurrency(item.price * item.quantity)}
                      </strong>
                    </div>
                  ))
                )}
              </div>

              <div className="billing-payment">
                <label htmlFor="paymentMethod">Payment Method</label>

                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  disabled={submitting || Boolean(pendingPayment)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">Razorpay (UPI / Google Pay / cards / more)</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div className="billing-total">
                <span>Total Amount</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </div>

              <button
                type="submit"
                className="checkout-btn"
                disabled={submitting || loading || cart.length === 0}
              >
                {submitting
                  ? "Processing..."
                  : pendingPayment
                    ? `Retry Payment Verification · ${formatCurrency(totalAmount)}`
                    : paymentMethod === "upi"
                      ? `Pay with Razorpay · ${formatCurrency(totalAmount)}`
                      : `Complete Sale · ${formatCurrency(totalAmount)}`}
              </button>

              <p className="billing-secure-note">
                Razorpay offers the payment methods enabled for your account. Stock updates after a successful sale.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Billing;
