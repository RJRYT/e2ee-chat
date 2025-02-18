import React, { useState, useContext } from "react";
import QrScanner from "react-qr-scanner";
import { decryptData } from "../utils/keyBackup";
import { setPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";

const KeyPairRecoveryViaQR = ({ onRecoverySuccess }) => {
  const { auth } = useContext(AuthContext);
  const [scannedData, setScannedData] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleScan = (data) => {
    if (data) {
      setScannedData(data.text);
      console.log(data);
      setError("");
    }
  };

  const handleError = (err) => {
    console.error("QR Scan Error:", err);
    setError("QR scanning error: " + err.message);
  };

  const handleRecovery = async () => {
    if (!scannedData || !password) {
      setError("Please scan the QR code and enter the password.");
      return;
    }
    try {
      // Decrypt the scanned backup data using the provided password.
      const decrypted = await decryptData(scannedData, password);
      // Store the recovered private key in IndexedDB.
      await setPrivateKey(auth.user._id, decrypted);
      onRecoverySuccess && onRecoverySuccess();
    } catch (err) {
      console.error("Recovery failed:", err);
      setError("Recovery failed: " + err.message);
    }
  };

  return (
    <div className="p-4 border rounded shadow-lg max-w-md mx-auto">
      <h3 className="text-lg font-bold mb-2">
        Recover Private Key via QR Scan
      </h3>
      <div className="mb-4">
        <QrScanner
          delay={300}
          onError={handleError}
          onScan={handleScan}
          style={{ width: "100%" }}
        />
      </div>
      {scannedData && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Scanned Backup Data: {scannedData}
          </p>
        </div>
      )}
      <input
        type="password"
        placeholder="Enter password used for backup"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border rounded p-2 w-full mb-4"
      />
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="flex justify-end space-x-2">
        <button
          onClick={handleRecovery}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Recover Key
        </button>
      </div>
    </div>
  );
};

export default KeyPairRecoveryViaQR;
