import React, { createContext, useState, useEffect } from "react";
import axiosInstance from "../services/api";
import { generateECDHKeyPair, exportECDHPublicKey } from "../utils/ECDH";
import { getPrivateKey, setPrivateKey } from "../utils/keyStore";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuth(null);
  };

  const refreshKeyState = async (userArg) => {
    const user = userArg || auth?.user;
    const userId = user?._id || user?.id;
    if (!userId) return;
    const privateKey = await getPrivateKey(userId);
    setAuth((prev) => ({ ...prev, key: Boolean(privateKey) }));
  };

  async function setupUserKeys(user) {
    const userId = user?._id || user?.id;
    if (!userId) {
      throw new Error("Invalid user payload for key setup");
    }
    const existingPrivate = await getPrivateKey(userId);
    if (!existingPrivate) {
      try {
        const publicKeyRes = await axiosInstance.get(
          `users/public-key/${userId}`
        );
        if (publicKeyRes.data?.publicKey) {
          setAuth((prev) => ({ ...prev, key: false }));
          window.location.hash = "#/recover";
          return;
        } else {
          const keyPair = await generateECDHKeyPair();
          const publicKeyPem = await exportECDHPublicKey(keyPair.publicKey);
          // Export private key as JWK (for simplicity; encrypt in production)
          const exportedPrivate = JSON.stringify(
            await window.crypto.subtle.exportKey("jwk", keyPair.privateKey)
          );
          await setPrivateKey(userId, exportedPrivate);
          // Send public key to server
          await axiosInstance.put("users/public-key", {
            publicKey: publicKeyPem,
          });
          setAuth((prev) => ({ ...prev, key: true }));
          return;
        }
      } catch (err) {
        console.error("Key generation failed:", err);
        setError(err?.message || "Key generation failed. Cannot proceed.");
      }
    }
    setAuth((prev) => ({ ...prev, key: true }));
  }

  const login = async (data) => {
    try {
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
        user: { _id: data._id, username: data.username, email: data.email },
      });
      await setupUserKeys(data);
    } catch (err) {
      console.error("Key generation failed: ", err);
      logout();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Validate token by fetching profile information
      axiosInstance
        .get("/profile")
        .then(async (res) => {
          // res.data should contain user details returned by the profile route
          setAuth({ token, user: res.data });
          setLoading(false);
          await setupUserKeys(res.data);
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

  if (error) {
    return (
      <div className="flex items-center flex-col justify-center h-screen">
        <div className="text-4xl">An Error occoured</div>
        <div className="text-xl">{error}</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout, refreshKeyState }}>
      {children}
    </AuthContext.Provider>
  );
};
