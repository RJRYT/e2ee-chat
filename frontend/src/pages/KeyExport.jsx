import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import KeyPairExport from "../components/KeyBackupExport";
import DevicePairing from "../components/DevicePairing";

const KeyExport = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("export");

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
      <p className="text-gray-600 text-center mb-4">
        Choose one flow at a time for a simpler recovery experience.
      </p>

      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            mode === "export"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setMode("export")}
        >
          Export Recovery Key
        </button>
        <button
          className={`px-4 py-2 rounded ${
            mode === "pair"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setMode("pair")}
        >
          Pair New Device
        </button>
      </div>

      {mode === "export" ? (
        <div className="mt-4 p-4 border rounded-lg bg-gray-100">
          <h3 className="text-lg font-semibold">Step 1: Export Recovery Key</h3>
          <p className="text-sm text-gray-500 mb-2">
            Create a password-protected backup string and store it safely.
          </p>
          <KeyPairExport />
        </div>
      ) : (
        <div className="mt-4 p-4 border rounded-lg bg-gray-100">
          <h3 className="text-lg font-semibold">Step 2: Pair New Device</h3>
          <p className="text-sm text-gray-500 mb-2">
            Generate a QR code and scan it from the new device while keeping this page open.
          </p>
          <DevicePairing />
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Tip: export backup first, then use pairing for faster login on secondary devices.
      </div>
    </div>
  );
};

export default KeyExport;
