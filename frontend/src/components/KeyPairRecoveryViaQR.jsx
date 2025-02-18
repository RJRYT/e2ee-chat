import React, { useState, useContext, useEffect } from "react";
import axiosInstance from "../services/api";
import QrScanner from "react-qr-scanner";
import { decryptData } from "../utils/keyBackup";
import { setPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";
import { Loader2, AlertCircle, CheckCircle, Camera } from "lucide-react";

const KeyPairRecoveryViaQR = ({ onRecoverySuccess }) => {
  const { auth } = useContext(AuthContext);
  const [scannedData, setScannedData] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraMode, setCameraMode] = useState("environment");

  useEffect(() => {
    // Detect device type and set appropriate camera mode
    const userAgent = navigator.userAgent.toLowerCase();
    if (
      userAgent.includes("mobile") ||
      userAgent.includes("android") ||
      userAgent.includes("iphone")
    ) {
      setCameraMode("environment");
    } else {
      setCameraMode("user");
    }
  }, []);

  const verifyGivenPrivateKey = async (key) => {
    try {
      const publicKeyRes = await axiosInstance.get(
        `users/public-key/${auth.user._id}`
      );
      const userPublicKey = publicKeyRes.data.publicKey;
      if (!userPublicKey) {
        setError(
          "No public key found on server. Please re-login to generate a new key."
        );
        return false;
      }
      const parsed = JSON.parse(key);
      if (!parsed.publicKey) {
        setError("Invalid backup data: missing public key.");
        return false;
      }
      const recoveredPublicKeyPem = parsed.publicKey;
      if (recoveredPublicKeyPem !== userPublicKey) {
        setError(
          "Recovered key does not match your account. Recovery aborted."
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to verify private key: ", error);
      return false;
    }
  };

  const handleScan = (data) => {
    if (data) {
      setScannedData(data.text);
      setError(""); // Clear previous errors
    }
  };

  const handleError = (err) => {
    console.error("QR Scan Error:", err);
    setError(
      "QR scanning error. Please ensure the QR code is visible and try again."
    );
  };

  const handleRecovery = async () => {
    if (!scannedData) {
      setError("No QR code scanned. Please scan your backup QR first.");
      return;
    }
    if (!password) {
      setError("Please enter the backup password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const decrypted = await decryptData(scannedData, password);
      if (!decrypted) throw new Error("Decryption failed.");
      if (await verifyGivenPrivateKey(decrypted)) {
        const parsed = JSON.parse(decrypted);
        await setPrivateKey(auth.user._id, parsed.privateKey);
        onRecoverySuccess && onRecoverySuccess();
      } else {
        setError("This key is not this user's key");
      }
    } catch (err) {
      console.error("Recovery failed:", err);
      setError("Invalid password or corrupted backup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-lg">
      <h3 className="text-xl font-semibold text-gray-800">
        Recover Private Key via QR Scan
      </h3>
      <p className="text-gray-600 text-sm mt-1">
        Scan the QR code containing your encrypted private key.
      </p>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 bg-red-100 text-red-600 p-3 rounded mt-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Success Message */}
      {scannedData && (
        <div className="flex items-center gap-2 bg-green-100 text-green-600 p-3 rounded mt-3">
          <CheckCircle size={20} />
          QR code scanned successfully! Enter password to proceed.
        </div>
      )}

      {/* QR Scanner */}
      <div className="mt-4 relative">
        <QrScanner
          delay={300}
          onError={handleError}
          onScan={handleScan}
          constraints={{ video: { facingMode: cameraMode } }}
          className="w-full rounded border"
        />
        <button
          className="absolute top-2 right-2 bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition-all"
          onClick={() =>
            setCameraMode((prev) =>
              prev === "environment" ? "user" : "environment"
            )
          }
        >
          <Camera size={18} />
        </button>
      </div>

      {/* Password Input */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Backup Password
        </label>
        <input
          type="password"
          className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Recover Button */}
      <button
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all disabled:bg-gray-400"
        onClick={handleRecovery}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          "Recover Key"
        )}
      </button>

      {/* Security Warning */}
      <p className="text-sm text-gray-500 mt-3">
        <span className="font-semibold text-red-600">Warning:</span> If you
        recover an old key, any new messages received with a different key will
        be unreadable.
      </p>
    </div>
  );
};

export default KeyPairRecoveryViaQR;
