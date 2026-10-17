import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../style/Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();

  if (!authLoading && user) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/staff/dashboard"} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const data = response.data;

      // Read the token from the backend response
      const token =
        data.token ||
        data.accessToken ||
        data.data?.token;

      // Read the user details from the backend response
      const user =
        data.user ||
        data.data?.user;

      if (!token || !user) {
        setError(
          "Invalid login response. Please check your backend response."
        );
        return;
      }

      // Check the user's role
      if (user.role !== "admin" && user.role !== "staff") {
        setError("Your account does not have an authorized role.");
        return;
      }

      // Save authentication details
      login(token, user);

      // Redirect according to the user's role
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/staff/dashboard");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Login Form Section */}
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">P</div>

          <h1>
            POS<span>Flow</span>
          </h1>

          <p>Smart Billing & Inventory Management</p>
        </div>

        <div className="login-heading">
          <h2>Welcome back!</h2>
          <p>Sign in to access your workspace.</p>
        </div>

        <form onSubmit={handleLogin}>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>

            <div className="password-input">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          Secure access for authorized staff
        </div>
      </div>

      {/* Right Side Design */}
      <div className="login-decoration">
        <div className="decoration-circle circle-one"></div>
        <div className="decoration-circle circle-two"></div>

        <div className="decoration-content">
          <span className="eyebrow">
            YOUR BUSINESS, SIMPLIFIED
          </span>

          <h2>
            Everything you need to manage your store.
          </h2>

          <p>
            Manage billing, inventory, suppliers, and sales
            reports from one convenient workspace.
          </p>

          <div className="feature-list">
            <div>✓ Fast billing and checkout</div>
            <div>✓ Real-time stock management</div>
            <div>✓ Clear sales insights</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
