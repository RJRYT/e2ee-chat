// KeyBackupExport.jsx
import React, { useState, useContext } from "react";
import { encryptData } from "../utils/keyBackup";
import { getPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";

const KeyBackupExport = () => {
  const { auth } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [backupData, setBackupData] = useState("");
  const [error, setError] = useState("");

  const handleExport = async () => {
    try {
      const privateKey = await getPrivateKey(auth.user._id);
      if (!privateKey) {
        setError("No private key found. Please generate one.");
        return;
      }
      const encryptedBackup = await encryptData(privateKey, password);
      setBackupData(encryptedBackup);
    } catch (err) {
      console.error(err);
      setError("Export failed: " + err.message);
    }
  };

  return (
    <div>
      <h3>Export Key Backup</h3>
      <input
        type="password"
        placeholder="Enter password for backup"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleExport}>Export Backup</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {backupData && (
        <div>
          <p>
            Backup Data (copy and save securely; you'll need this to restore
            your key):
          </p>
          <textarea value={backupData} readOnly rows={5} cols={40} />
        </div>
      )}
    </div>
  );
};

export default KeyBackupExport;
