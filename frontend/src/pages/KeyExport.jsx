import React from "react";
import { useNavigate } from "react-router-dom";
import KeyPairExport from "../components/KeyBackupExport";
import DevicePairing from "../components/DevicePairing";

const KeyExport = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white shadow-lg rounded-lg">
      <button
        className="text-blue-500 hover:underline mb-4"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold text-center mb-4">
        Export or Pair Device
      </h2>
      <p className="text-gray-600 text-center">
        Securely transfer your key to another device.
      </p>

      <div className="mt-6 p-4 border rounded-lg bg-gray-100">
        <h3 className="text-lg font-semibold">Export Recovery Key</h3>
        <p className="text-sm text-gray-500 mb-2">
          Keep a backup of your encryption key.
        </p>
        <KeyPairExport />
      </div>

      <div className="mt-6 p-4 border rounded-lg bg-gray-100">
        <h3 className="text-lg font-semibold">Pair with Another Device</h3>
        <p className="text-sm text-gray-500 mb-2">
          Sync your key securely with a new device.
        </p>
        <DevicePairing />
      </div>
    </div>
  );
};

export default KeyExport;
