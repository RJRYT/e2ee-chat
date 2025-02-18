import React, { useState, useContext } from "react";
import axiosInstance from "../services/api";
import { QRCodeCanvas } from "qrcode.react";
import { encryptData } from "../utils/keyBackup";
import { getPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";

const DevicePairing = () => {
  const { auth } = useContext(AuthContext);
  const [qrData, setQrData] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleGenerateQRCode = async () => {
    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      setShowConfirmation(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter correctly.");
      setShowConfirmation(false);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const privateKey = await getPrivateKey(auth.user._id);
      if (!privateKey) {
        setError("No private key found.");
        setShowConfirmation(false);
        return;
      }

      // Fetch the public key for this user from the server.
      const publicKeyRes = await axiosInstance.get(
        `users/public-key/${auth.user._id}`
      );
      if (!publicKeyRes.data?.publicKey) {
        setError(
          "No public key found on server. Please re-login to generate a new key."
        );
        setShowConfirmation(false);
        return;
      }
      // Create a backup object containing both keys.
      const backupObj = {
        privateKey, // (stored as a JSON string of the JWK)
        publicKey: publicKeyRes.data.publicKey,
      };

      const encryptedBackup = await encryptData(
        JSON.stringify(backupObj),
        password
      );
      setQrData(encryptedBackup);
      setShowConfirmation(false); // Hide confirmation modal
    } catch (err) {
      console.error("QR Code generation failed:", err);
      setError("Failed to generate QR Code: " + err.message);
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md bg-white">
      <h3 className="text-lg font-semibold text-red-600 mb-2">
        ⚠️ Important Security Notice
      </h3>

      {/* Warning Message */}
      {showWarning && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-500 rounded-md">
          <p className="text-sm text-yellow-900 font-semibold">
            This action allows you to securely transfer your encryption key to
            another device.
            <span className="block text-red-600 font-bold">
              If you forget your encryption password, you CANNOT recover this
              key.
            </span>
          </p>
          <button
            onClick={() => setShowWarning(false)}
            className="mt-2 text-blue-500 underline text-sm"
          >
            I understand the risk
          </button>
        </div>
      )}

      {/* Password Input */}
      {!showWarning && (
        <>
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              Encryption Password
            </label>
            <input
              type="password"
              placeholder="Enter a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          {/* Show confirmation modal before generating QR Code */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={loading}
            className={`w-full px-4 py-2 rounded-md text-white ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {loading ? "Processing..." : "Proceed to Generate QR Code"}
          </button>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Final Confirmation
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to generate the pairing QR code? <br />
              <span className="text-red-600 font-bold">
                Once generated, this code must be scanned before closing.
              </span>
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 bg-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateQRCode}
                className="px-4 py-2 bg-blue-500 text-white rounded-md"
              >
                Yes, Generate QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display QR Code */}
      {qrData && (
        <div className="mt-6 p-4 bg-gray-100 border rounded-md flex flex-col items-center">
          <p className="text-sm font-semibold mb-2">Scan this QR code:</p>
          <QRCodeCanvas value={qrData} size={350} className="shadow-lg" />
          <p className="text-xs text-gray-600 mt-2">
            Scan this on your new device to import your key backup.
          </p>
        </div>
      )}
    </div>
  );
};

export default DevicePairing;
