import React, { useState, useContext, useRef } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Mail, Lock, User } from "lucide-react";
import { motion } from "framer-motion";

const Register = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [disableRegister, setDisableRegister] = useState(false);
  const formRef = useRef(null);

  // ✅ Validate inputs
  const validateForm = () => {
    let newErrors = {};
    if (!form.username.trim()) newErrors.username = "Username is required.";
    if (!form.email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Invalid email format.";
    if (!form.password.trim()) newErrors.password = "Password is required.";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🏗 Controlled Input Handler
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });

    // ✅ Clear errors immediately when user types
    setErrors((prevErrors) => ({ ...prevErrors, [e.target.name]: "" }));
  };

  // 🚀 Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await axiosInstance.post("/auth/register", form);
      login(res.data);
      navigate("/");
    } catch (err) {
      setErrors({
        server:
          err.response?.data?.message || "Registration failed, try again.",
      });
      setAttempts((prev) => prev + 1);

      // 🛡️ Spam Protection: Lock registration after 5 failed attempts
      if (attempts >= 4) {
        setDisableRegister(true);
        setTimeout(() => {
          setAttempts(0);
          setDisableRegister(false);
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
        <h2 className="text-2xl font-semibold text-center mb-6">Register</h2>

        {/* Error message (Server-side error) */}
        {errors.server && (
          <p className="text-red-500 text-sm text-center mb-4" role="alert">
            {errors.server}
          </p>
        )}

        {/* 🏗️ Register Form */}
        <form
          onSubmit={handleRegister}
          ref={formRef}
          noValidate
          autoComplete="on"
        >
          {/* Username Input */}
          <div className="relative mb-4">
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <User className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              id="username"
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              className={`border p-3 pl-10 w-full text-gray-400 rounded focus:ring-2 focus:ring-blue-400 outline-none transition ${
                errors.username ? "border-red-500" : ""
              }`}
              disabled={disableRegister}
              aria-invalid={errors.username ? "true" : "false"}
              aria-describedby="username-error"
            />
            {errors.username && (
              <p
                id="username-error"
                className="text-red-500 text-sm mt-1"
                role="alert"
              >
                {errors.username}
              </p>
            )}
          </div>

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
              disabled={disableRegister}
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
              autoComplete="new-password"
              className={`border p-3 pl-10 pr-10 w-full text-gray-400 rounded focus:ring-2 focus:ring-blue-400 outline-none transition ${
                errors.password ? "border-red-500" : ""
              }`}
              disabled={disableRegister}
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

          {/* Register Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            className={`w-full text-white py-3 rounded flex items-center justify-center transition-all ${
              loading || disableRegister ? "bg-gray-400" : "bg-blue-500"
            }`}
            disabled={loading || disableRegister}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Register"
            )}
          </motion.button>
        </form>

        {/* Login Link */}
        <p className="text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-500 underline">
            Login here
          </Link>
        </p>

        {/* Spam Protection Message */}
        {disableRegister && (
          <p className="text-red-500 text-sm text-center mt-3">
            Too many failed attempts. Try again in 30 seconds.
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Register;
