// KeyBackupImport.jsx
import React, { useState, useContext } from "react";
import { decryptData } from "../utils/keyBackup";
import { setPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";

const KeyBackupImport = ({ onImportSuccess }) => {
  const { auth } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [backupData, setBackupData] = useState("");
  const [error, setError] = useState("");

  const handleImport = async () => {
    try {
      const decrypted = await decryptData(backupData, password);
      await setPrivateKey(auth.user._id, decrypted);
      onImportSuccess && onImportSuccess();
    } catch (err) {
      console.error(err);
      setError("Import failed: " + err.message);
    }
  };

  return (
    <div>
      <h3>Import Key Backup</h3>
      <input
        type="password"
        placeholder="Enter password used for backup"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <textarea
        placeholder="Paste your backup data here"
        value={backupData}
        onChange={(e) => setBackupData(e.target.value)}
        rows={5}
        cols={40}
      />
      <button onClick={handleImport}>Import Backup</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default KeyBackupImport;
