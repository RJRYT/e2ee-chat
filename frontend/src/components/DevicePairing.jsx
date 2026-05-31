import React, { useState, useContext, useEffect, useRef } from "react";
import axiosInstance from "../services/api";
import { QRCodeCanvas } from "qrcode.react";
import { encryptData } from "../utils/keyBackup";
import { getPrivateKey } from "../utils/keyStore";
import { AuthContext } from "../context/AuthContext";

function randomSecret() {
  if (window?.crypto?.randomUUID) {
    return `${window.crypto.randomUUID()}-${window.crypto.randomUUID()}`;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const DevicePairing = () => {
  const { auth } = useContext(AuthContext);
  const [qrData, setQrData] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const pollerRef = useRef(null);

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const fetchSessionStatus = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get(
        `users/pairing/sessions/${sessionId}/status`
      );
      setSession((prev) => ({ ...prev, ...data }));
      if (
        ["rejected", "completed", "expired", "cancelled"].includes(data.status)
      ) {
        stopPolling();
        loadHistory();
      }
    } catch (err) {
      setError("Failed to track pairing session status.");
      stopPolling();
    }
  };

  useEffect(() => {
    loadHistory();
    return () => stopPolling();
  }, []);

  const loadHistory = async () => {
    try {
      const { data } = await axiosInstance.get("users/pairing/sessions");
      setHistory(data || []);
    } catch (err) {}
  };

  const handleGenerateQRCode = async () => {
    setError("");
    setLoading(true);
    setShowConfirmation(false);

    try {
      const privateKey = await getPrivateKey(auth.user._id);
      if (!privateKey) {
        setError("No private key found on this device.");
        return;
      }

      const publicKeyRes = await axiosInstance.get(
        `users/public-key/${auth.user._id}`
      );
      if (!publicKeyRes.data?.publicKey) {
        setError("No public key found on server. Please login again.");
        return;
      }

      const backupObj = {
        privateKey,
        publicKey: publicKeyRes.data.publicKey,
      };

      const sessionSecret = randomSecret();
      const encryptedPayload = await encryptData(
        JSON.stringify(backupObj),
        sessionSecret
      );

      const createRes = await axiosInstance.post("users/pairing/sessions", {
        encryptedPayload,
      });

      const qrPayload = JSON.parse(createRes.data.qrPayload);
      const uiPayload = JSON.stringify({
        ...qrPayload,
        sessionSecret,
      });

      setQrData(uiPayload);
      setSession({
        sessionId: createRes.data.sessionId,
        code: createRes.data.code,
        expiresAt: createRes.data.expiresAt,
        status: createRes.data.status,
      });

      stopPolling();
      pollerRef.current = setInterval(() => {
        fetchSessionStatus(createRes.data.sessionId);
      }, 2500);
      loadHistory();
    } catch (err) {
      console.error("QR Code generation failed:", err);
      setError(err.response?.data?.message || "Failed to start pairing session.");
    } finally {
      setLoading(false);
    }
  };

  const approveSession = async (approve) => {
    if (!session?.sessionId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosInstance.post(
        `users/pairing/sessions/${session.sessionId}/approve`,
        { approve }
      );
      setSession((prev) => ({ ...prev, ...data.session }));
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update pairing request.");
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    setError("");
    try {
      await axiosInstance.post(`users/pairing/sessions/${session.sessionId}/cancel`);
      setSession((prev) => ({ ...prev, status: "cancelled" }));
      stopPolling();
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel pairing session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md bg-white">
      <h3 className="text-lg font-semibold text-red-600 mb-2">
        Secure Device Pairing
      </h3>

      {showWarning && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-500 rounded-md">
          <p className="text-sm text-yellow-900 font-semibold">
            Pairing opens a temporary secure session for this account.
            <span className="block text-red-600 font-bold">
              Approve only if the requester device is physically with you.
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

      {!showWarning && !qrData && (
        <button
          onClick={() => setShowConfirmation(true)}
          disabled={loading}
          className={`w-full px-4 py-2 rounded-md text-white ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {loading ? "Processing..." : "Start Pairing Session"}
        </button>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Start Pairing?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This creates a short-lived session. You must approve the new
              device request to complete pairing.
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
                Yes, Start
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      {qrData && (
        <div className="mt-6 p-4 bg-gray-100 border rounded-md flex flex-col items-center">
          <p className="text-sm font-semibold mb-2">
            Scan this QR from the new device
          </p>
          <QRCodeCanvas value={qrData} size={320} className="shadow-lg" />
          {session?.code && (
            <p className="mt-3 text-sm">
              Verification code:{" "}
              <span className="font-bold tracking-wider">{session.code}</span>
            </p>
          )}
          {session?.expiresAt && (
            <p className="text-xs text-gray-600 mt-1">
              Expires: {new Date(session.expiresAt).toLocaleTimeString()}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Session status:{" "}
            <span className="font-semibold">{session?.status || "pending"}</span>
          </p>

          {session?.status === "requested" && (
            <div className="mt-3 w-full p-3 bg-white rounded border">
              <p className="text-sm font-semibold text-gray-800">
                Pairing request received
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Requester device: {session.requesterDeviceName || "Unknown"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => approveSession(true)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 rounded bg-green-500 text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => approveSession(false)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 rounded bg-red-500 text-white"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {session?.status === "approved" && (
            <p className="mt-3 text-sm text-green-700 font-semibold">
              Approved. Waiting for the new device to complete import.
            </p>
          )}

          {session?.status === "completed" && (
            <p className="mt-3 text-sm text-green-700 font-semibold">
              Pairing completed and acknowledged.
            </p>
          )}

          {["pending", "requested", "approved"].includes(session?.status) && (
            <button
              onClick={cancelSession}
              className="mt-4 px-3 py-2 rounded bg-gray-300 text-gray-800"
            >
              Cancel Session
            </button>
          )}
        </div>
      )}

      {!showWarning && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
              Recent Pairing Sessions
            </p>
            <button
              className="text-xs px-2 py-1 rounded bg-gray-200"
              onClick={loadHistory}
            >
              Refresh
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-gray-500">No pairing sessions yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded bg-gray-50">
              {history.map((item) => (
                <div
                  key={item.sessionId}
                  className="px-3 py-2 border-b last:border-b-0 text-xs"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">{item.status}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-600 mt-1">
                    {item.requesterDeviceName
                      ? `Requester: ${item.requesterDeviceName}`
                      : "Requester: -"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevicePairing;
