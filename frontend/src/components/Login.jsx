import React, { useState, useContext } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });
      login(res.data);
      navigate("/");
    } catch (error) {
      alert(
        "Login failed: " + (error.response?.data?.message || error.message)
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded shadow w-80">
        <h2 className="text-xl font-bold mb-4 text-center">Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Login
        </button>
        <p className="text-center mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-500 underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
