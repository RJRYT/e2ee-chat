import React, { useEffect, useState, useContext } from "react";
import KeyPairRecoveryViaQR from "../components/KeyPairRecoveryViaQR";
import KeyImport from "../components/KeyBackupImport";
import axiosInstance from "../services/api";
import { getPrivateKey, setPrivateKey } from "../utils/keystore";
import { generateECDHKeyPair, exportECDHPublicKey } from "../utils/ECDH";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const KeyRecovery = () => {
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useContext(AuthContext);
  const [recoveryMethod, setRecoveryMethod] = useState("qr"); // Default: QR Code
  const navigate = useNavigate();

  const handleRegenerate = async () => {
    const keyPair = await generateECDHKeyPair();
    const publicKeyPem = await exportECDHPublicKey(keyPair.publicKey);
    // Export private key as JWK (for simplicity; encrypt in production)
    const exportedPrivate = JSON.stringify(
      await window.crypto.subtle.exportKey("jwk", keyPair.privateKey)
    );
    await setPrivateKey(auth.user._id, exportedPrivate);
    // Send public key to server
    await axiosInstance.put("users/public-key", {
      publicKey: publicKeyPem,
    });
  };

  useEffect(() => {
    const checkRecoveryState = async () => {
      try {
        // Step 1: Check if private key already exists
        const privateKey = await getPrivateKey(auth.user._id);
        if (privateKey) {
          navigate("/"); // Redirect to home if key exists
          return;
        }

        // Step 2: Check if the user has a public key in the server
        const publicKeyRes = await axiosInstance.get(
          `users/public-key/${auth.user._id}`
        );

        if (!publicKeyRes.data?.publicKey) {
          // Public key not found → force logout (user must relogin & regenerate key)
          logout();
          return;
        }
      } catch (error) {
        console.error("Error checking recovery state:", error);
      } finally {
        setLoading(false);
      }
    };

    checkRecoveryState();
  }, [navigate]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Recover Your Private Key</h2>
      <p className="text-gray-600">
        Choose a recovery method to regain access.
      </p>

      <div className="flex gap-4 mt-4">
        <button
          className={`px-4 py-2 rounded ${
            recoveryMethod === "qr" ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
          onClick={() => setRecoveryMethod("qr")}
        >
          Scan QR Code
        </button>
        <button
          className={`px-4 py-2 rounded ${
            recoveryMethod === "manual"
              ? "bg-blue-500 text-white"
              : "bg-gray-200"
          }`}
          onClick={() => setRecoveryMethod("manual")}
        >
          Enter Code Manually
        </button>
      </div>
      <p>
        Regenerating of new key will lost access to all old messages. Also other
        old keys from other logined devices also become invalid
      </p>
      <button
        className="px-4 py-2 rounded bg-red-500 text-white"
        onClick={handleRegenerate}
      >
        Regenerate New
      </button>

      <div className="mt-6">
        {recoveryMethod === "qr" ? (
          <KeyPairRecoveryViaQR onRecoverySuccess={() => navigate("/")} />
        ) : (
          <KeyImport onImportSuccess={() => navigate("/")} />
        )}
      </div>
    </div>
  );
};

export default KeyRecovery;
