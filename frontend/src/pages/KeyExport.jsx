import React from "react";
import KeyPairExport from "../components/KeyBackupExport";
import DevicePairing from "../components/DevicePairing";

const KeyExport = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Export or Pair Device</h2>
      <p className="text-gray-600">
        Securely transfer your key to another device.
      </p>

      <div className="mt-4">
        <h3 className="text-lg font-semibold">Export Recovery Key</h3>
        <KeyPairExport />
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold">Pair with Another Device</h3>
        <DevicePairing />
      </div>
    </div>
  );
};

export default KeyExport;
