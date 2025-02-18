// DevicePairing.jsx
import React, { useState, useContext } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { encryptData } from "../utils/keyBackup";
import { getPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";

const DevicePairing = () => {
  const { auth } = useContext(AuthContext);
  const [backupQRCode, setBackupQRCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const generateQRCode = async () => {
    try {
      const privateKey = await getPrivateKey(auth.user._id);
      if (!privateKey) {
        setError("No private key found.");
        return;
      }
      const encryptedBackup = await encryptData(privateKey, password);
      setBackupQRCode(encryptedBackup);
    } catch (err) {
      console.error(err);
      setError("Failed to generate QR Code: " + err.message);
    }
  };

  return (
    <div>
      <h3>Device Pairing</h3>
      <input
        type="password"
        placeholder="Enter password for encryption"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={generateQRCode}>Generate Pairing QR Code</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {backupQRCode && (
        <div>
          <p>Scan this QR code on your new device to import your key backup:</p>
          <QRCodeCanvas value={backupQRCode} size={200} />
        </div>
      )}
    </div>
  );
};

export default DevicePairing;
