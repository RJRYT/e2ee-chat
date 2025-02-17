import React, { createContext, useState, useEffect } from "react";
import axiosInstance from "../services/api";
import { generateKeyPair, exportPublicKey } from "../utils/crypto";
import { getPrivateKey, setPrivateKey } from "../utils/keystore";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuth(null);
  };

  async function setupUserKeys(user) {
    const existingPrivate = await getPrivateKey(user._id);
    if (!existingPrivate) {
      try {
        const keyPair = await generateKeyPair();
        const publicKeyPem = await exportPublicKey(keyPair.publicKey);
        // Export private key as JWK (for simplicity; encrypt in production)
        const exportedPrivate = JSON.stringify(
          await window.crypto.subtle.exportKey("jwk", keyPair.privateKey)
        );
        await setPrivateKey(user._id, exportedPrivate);
        // Send public key to server
        await axiosInstance.put("users/public-key", {
          publicKey: publicKeyPem,
        });
      } catch (err) {
        console.error("Key generation failed:", err);
        throw new Error("Key generation failed. Cannot proceed.");
      }
    }
  }

  const login = async(data) => {
    try {
      // data is expected to include _id, username, email, and token
      localStorage.setItem("token", data.token);
      await setupUserKeys(data);
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
    } catch (err) {
      console.error("Key generation failed: ", err);
      logout();
      alert("Key generation failed. Please try again.");
    }
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
