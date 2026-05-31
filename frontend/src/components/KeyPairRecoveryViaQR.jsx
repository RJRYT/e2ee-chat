import React, { useState, useContext, useEffect, useRef } from "react";
import axiosInstance from "../services/api";
import QrScanner from "react-qr-scanner";
import { decryptData } from "../utils/keyBackup";
import { setPrivateKey } from "../utils/keyStore";
import { AuthContext } from "../context/AuthContext";
import { getDeviceName } from "../utils/deviceId";
import { Loader2, AlertCircle, CheckCircle, Camera } from "lucide-react";

const KeyPairRecoveryViaQR = ({ onRecoverySuccess }) => {
  const { auth } = useContext(AuthContext);
  const [scannedData, setScannedData] = useState(null);
  const [legacyPassword, setLegacyPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraMode, setCameraMode] = useState("environment");
  const [sessionFlow, setSessionFlow] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("");
  const pollerRef = useRef(null);
  const consumeStartedRef = useRef(false);

  useEffect(() => {
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
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
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
      if (parsed.publicKey !== userPublicKey) {
        setError("Recovered key does not match your account. Recovery aborted.");
        return false;
      }
      return true;
    } catch (verifyErr) {
      console.error("Failed to verify private key: ", verifyErr);
      return false;
    }
  };

  const tryParseSessionPayload = (value) => {
    try {
      const parsed = JSON.parse(value);
      if (
        parsed &&
        parsed.type === "pair-session" &&
        parsed.sessionId &&
        parsed.code &&
        parsed.nonce &&
        parsed.sessionSecret
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleScan = (data) => {
    if (!data?.text) return;
    if (sessionFlow && ["requested", "approved", "completed"].includes(sessionStatus)) {
      return;
    }
    setError("");
    const text = data.text;
    setScannedData(text);

    const sessionPayload = tryParseSessionPayload(text);
    if (sessionPayload) {
      setSessionFlow(sessionPayload);
      setSessionStatus("scanned");
      consumeStartedRef.current = false;
    } else {
      setSessionFlow(null);
      setSessionStatus("");
      consumeStartedRef.current = false;
    }
  };

  const handleError = (err) => {
    console.error("QR Scan Error:", err);
    setError(
      "QR scanning error. Please ensure the QR code is visible and try again."
    );
  };

  const completeKeyImport = async (decrypted) => {
    if (!(await verifyGivenPrivateKey(decrypted))) return false;
    const parsed = JSON.parse(decrypted);
    await setPrivateKey(auth.user._id, parsed.privateKey);
    onRecoverySuccess && onRecoverySuccess();
    return true;
  };

  const pollSessionStatus = (sessionId) => {
    if (pollerRef.current) clearInterval(pollerRef.current);
    pollerRef.current = setInterval(async () => {
      try {
        const { data } = await axiosInstance.get(
          `users/pairing/sessions/${sessionId}/status`
        );
        setSessionStatus(data.status);
        if (data.status === "approved" && !consumeStartedRef.current) {
          consumeStartedRef.current = true;
          consumeApprovedSession();
        }
        if (["rejected", "expired", "cancelled", "completed"].includes(data.status)) {
          clearInterval(pollerRef.current);
          pollerRef.current = null;
        }
      } catch (statusErr) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    }, 2500);
  };

  const requestPairing = async () => {
    if (!sessionFlow) return;
    setLoading(true);
    setError("");
    try {
      await axiosInstance.post(
        `users/pairing/sessions/${sessionFlow.sessionId}/request`,
        {
          code: sessionFlow.code,
          nonce: sessionFlow.nonce,
          deviceName: getDeviceName(),
        }
      );
      setSessionStatus("requested");
      pollSessionStatus(sessionFlow.sessionId);
    } catch (err) {
      setError(err.response?.data?.message || "Pairing request failed.");
    } finally {
      setLoading(false);
    }
  };

  const consumeApprovedSession = async () => {
    if (!sessionFlow) return;
    setLoading(true);
    setError("");
    try {
      const consumeRes = await axiosInstance.post(
        `users/pairing/sessions/${sessionFlow.sessionId}/consume`
      );
      const decrypted = await decryptData(
        consumeRes.data.encryptedPayload,
        sessionFlow.sessionSecret
      );
      const imported = await completeKeyImport(decrypted);
      if (imported) {
        setSessionStatus("completed");
      }
    } catch (err) {
      consumeStartedRef.current = false;
      setError(err.response?.data?.message || "Failed to consume pairing session.");
    } finally {
      setLoading(false);
    }
  };

  const handleLegacyRecovery = async () => {
    if (!scannedData) {
      setError("No QR code scanned. Please scan your backup QR first.");
      return;
    }
    if (!legacyPassword) {
      setError("Please enter the backup password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const decrypted = await decryptData(scannedData, legacyPassword);
      if (!decrypted) throw new Error("Decryption failed.");
      await completeKeyImport(decrypted);
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
        Recover Key via QR Scan
      </h3>
      <p className="text-gray-600 text-sm mt-1">
        Scan a pairing QR session (recommended) or legacy backup QR.
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-100 text-red-600 p-3 rounded mt-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {scannedData && (
        <div className="flex items-center gap-2 bg-green-100 text-green-600 p-3 rounded mt-3">
          <CheckCircle size={20} />
          QR code scanned successfully.
        </div>
      )}

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

      {sessionFlow ? (
        <div className="mt-4 border rounded p-3 bg-gray-50">
          <p className="text-sm font-semibold">Pairing Session Detected</p>
          <p className="text-xs text-gray-600 mt-1">
            Verification code:{" "}
            <span className="font-bold tracking-wider">{sessionFlow.code}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Status: <span className="font-semibold">{sessionStatus || "scanned"}</span>
          </p>

          {sessionStatus === "scanned" && (
            <button
              className="mt-3 w-full px-4 py-2 bg-blue-500 text-white rounded-md"
              onClick={requestPairing}
              disabled={loading}
            >
              {loading ? "Requesting..." : "Request Pairing"}
            </button>
          )}

          {sessionStatus === "requested" && (
            <p className="mt-3 text-sm text-amber-700">
              Waiting for approval on your primary device.
            </p>
          )}

          {sessionStatus === "approved" && (
            <button
              className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md"
              onClick={consumeApprovedSession}
              disabled={loading}
            >
              {loading ? "Importing..." : "Complete Pairing"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Legacy Backup Password
          </label>
          <input
            type="password"
            className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter backup password"
            value={legacyPassword}
            onChange={(e) => setLegacyPassword(e.target.value)}
            disabled={loading}
          />
          <button
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all disabled:bg-gray-400"
            onClick={handleLegacyRecovery}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Recover Key"
            )}
          </button>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-3">
        <span className="font-semibold text-red-600">Warning:</span> Approve
        pairing only from a trusted device in your possession.
      </p>
    </div>
  );
};

export default KeyPairRecoveryViaQR;
