import React, { useState, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { motion } from "framer-motion";
import axiosInstance from "../services/api";

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [disableLogin, setDisableLogin] = useState(false);
  const formRef = useRef(null);

  // ✅ Validate inputs
  const validateForm = () => {
    let newErrors = {};
    if (!form.email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Invalid email format.";

    if (!form.password.trim()) newErrors.password = "Password is required.";
    else if (form.password.length < 4)
      newErrors.password = "Password must be at least 4 characters.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🏗 Controlled Input Handler
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });

    // ✅ Clear errors immediately when user types
    setErrors((prevErrors) => ({ ...prevErrors, [e.target.name]: "" }));
  };

  // 🚀 Handle login
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission

    if (!validateForm()) return;

    setLoading(true);
    setErrors({}); // Clear previous errors

    try {
      const res = await axiosInstance.post("/auth/login", form);
      login(res.data);
      navigate("/");
    } catch (error) {
      setErrors({
        server: error.response?.data?.message || "Login failed, try again.",
      });
      setAttempts((prev) => prev + 1);

      // 🛡️ Spam Protection: Lock login after 5 failed attempts
      if (attempts >= 4) {
        setDisableLogin(true);
        setTimeout(() => {
          setAttempts(0);
          setDisableLogin(false);
        }, 30000); // Lock for 30 seconds
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="p-6 bg-white rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold text-center mb-6">Login</h2>

        {/* Error message (Server-side error) */}
        {errors.server && (
          <p className="text-red-500 text-sm text-center mb-4" role="alert">
            {errors.server}
          </p>
        )}

        {/* 🏗️ Login Form */}
        <form onSubmit={handleLogin} ref={formRef} noValidate autoComplete="on">
          {/* Email Input */}
          <div className="relative mb-4">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              className={`border p-3 pl-10 w-full text-gray-400 rounded focus:ring-2 focus:ring-blue-400 outline-none transition ${
                errors.email ? "border-red-500" : ""
              }`}
              disabled={disableLogin}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby="email-error"
            />
            {errors.email && (
              <p
                id="email-error"
                className="text-red-500 text-sm mt-1"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="relative mb-4">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              className={`border p-3 pl-10 text-gray-400 pr-10 w-full rounded focus:ring-2 focus:ring-blue-400 outline-none transition ${
                errors.password ? "border-red-500" : ""
              }`}
              disabled={disableLogin}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby="password-error"
            />
            {showPassword ? (
              <EyeOff
                className="absolute right-3 top-3 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => setShowPassword(false)}
                aria-label="Hide password"
              />
            ) : (
              <Eye
                className="absolute right-3 top-3 text-gray-400 cursor-pointer"
                size={20}
                onClick={() => setShowPassword(true)}
                aria-label="Show password"
              />
            )}
            {errors.password && (
              <p
                id="password-error"
                className="text-red-500 text-sm mt-1"
                role="alert"
              >
                {errors.password}
              </p>
            )}
          </div>

          {/* Login Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            className={`w-full text-white py-3 rounded flex items-center justify-center transition-all ${
              loading || disableLogin ? "bg-gray-400" : "bg-blue-500"
            }`}
            disabled={loading || disableLogin}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Login"}
          </motion.button>
        </form>

        {/* Register Link */}
        <p className="text-center mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-500 underline">
            Register here
          </Link>
        </p>

        {/* Spam Protection Message */}
        {disableLogin && (
          <p className="text-red-500 text-sm text-center mt-3">
            Too many failed attempts. Try again in 30 seconds.
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
