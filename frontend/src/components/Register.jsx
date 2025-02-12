import React, { useState, useContext } from "react";
import axiosInstance from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const res = await axiosInstance.post("/auth/register", {
        username,
        email,
        password,
      });
      login(res.data);
      navigate("/");
    } catch (err) {
      alert(
        "Registration failed: " + (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded shadow w-80">
        <h2 className="text-xl font-bold mb-4 text-center">Register</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
        />
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
          onClick={handleRegister}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Register
        </button>
        <p className="text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-500 underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
