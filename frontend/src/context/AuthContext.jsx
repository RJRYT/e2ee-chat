import React, { createContext, useState, useEffect } from "react";
import jwtDecode from "jwt-decode";
import axiosInstance from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuth(null);
  };

  const login = (data) => {
    // data is expected to include _id, username, email, and token
    localStorage.setItem("token", data.token);
    // Optionally store some user details; these will be updated by the profile API
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: data._id,
        username: data.username,
        email: data.email,
      })
    );
    // Set a temporary auth state
    setAuth({
      token: data.token,
      user: { id: data._id, username: data.username, email: data.email },
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Validate token by fetching profile information
      axiosInstance
        .get("/profile")
        .then((res) => {
          // res.data should contain user details returned by the profile route
          setAuth({ token, user: res.data });
          setLoading(false);
        })
        .catch((err) => {
          console.error("Profile validation failed:", err);
          logout();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    // Display a full-page loading indicator until authentication is validated
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
