import React, { useState, useContext } from "react";
import axiosInstance from "../services/api";
import { decryptData } from "../utils/keyBackup";
import { setPrivateKey } from "../utils/keystore";
import { AuthContext } from "../context/AuthContext";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const KeyBackupImport = ({ onImportSuccess }) => {
  const { auth } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [backupData, setBackupData] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleImport = async () => {
    if (!password || !backupData) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const decrypted = await decryptData(backupData, password);
      if (!decrypted) throw new Error("Decryption failed");
      if (await verifyGivenPrivateKey(decrypted)) {
        const parsed = JSON.parse(decrypted);
        await setPrivateKey(auth.user._id, parsed.privateKey);
        setSuccess(true);
        onImportSuccess && onImportSuccess();
      }
    } catch (err) {
      console.error(err);
      setError("Import failed. Please check your password and backup data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-lg">
      <h3 className="text-xl font-semibold text-gray-800">Import Key Backup</h3>
      <p className="text-gray-600 text-sm mt-1">
        Restore your encrypted key using your backup data.
      </p>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 bg-red-100 text-red-600 p-3 rounded mt-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 bg-green-100 text-green-600 p-3 rounded mt-3">
          <CheckCircle size={20} />
          Successfully imported your backup key!
        </div>
      )}

      {/* Input Fields */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type="password"
          className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Backup Data
        </label>
        <textarea
          className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste your backup data here"
          value={backupData}
          onChange={(e) => setBackupData(e.target.value)}
          rows={5}
          disabled={loading}
        />
      </div>

      {/* Import Button */}
      <button
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all disabled:bg-gray-400"
        onClick={handleImport}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          "Import Backup"
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

export default KeyBackupImport;
