import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import KeyPairRecoveryViaQR from "../components/KeyPairRecoveryViaQR";
import KeyImport from "../components/KeyBackupImport";
import axiosInstance from "../services/api";
import { getPrivateKey, setPrivateKey } from "../utils/keystore";
import { generateECDHKeyPair, exportECDHPublicKey } from "../utils/ECDH";
import { ArrowLeft, AlertCircle, ShieldAlert } from "lucide-react";

const KeyRecovery = () => {
  const [loading, setLoading] = useState(true);
  const { auth, logout } = useContext(AuthContext);
  const [recoveryMethod, setRecoveryMethod] = useState("qr");
  const [error, setError] = useState(null);
  const [showWarning, setShowWarning] = useState(true);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [countDown, setCountDown] = useState(0);
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (showRegenerateConfirm) {
      setCountDown(15);
      setIsConfirmEnabled(false);
      timerRef.current = setInterval(() => {
        setCountDown((prevCount) => {
          if (prevCount <= 1) {
            clearInterval(timerRef.current);
            setIsConfirmEnabled(true);
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
    }

    // Clear the timer when the modal is closed or component unmounts
    return () => {
      clearInterval(timerRef.current);
    };
  }, [showRegenerateConfirm]);

  useEffect(() => {
    const checkRecoveryState = async () => {
      try {
        const privateKey = await getPrivateKey(auth.user._id);
        if (privateKey) {
          navigate("/");
          return;
        }

        const publicKeyRes = await axiosInstance.get(
          `users/public-key/${auth.user._id}`
        );

        if (!publicKeyRes.data?.publicKey) {
          logout();
          return;
        }
      } catch (error) {
        setError("Failed to verify recovery state. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    checkRecoveryState();
  }, [navigate]);

  const handleRegenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setShowRegenerateConfirm(false);

      const keyPair = await generateECDHKeyPair();
      const publicKeyPem = await exportECDHPublicKey(keyPair.publicKey);
      const exportedPrivate = JSON.stringify(
        await window.crypto.subtle.exportKey("jwk", keyPair.privateKey)
      );

      await setPrivateKey(auth.user._id, exportedPrivate);
      await axiosInstance.put("users/public-key", { publicKey: publicKeyPem });

      navigate("/");
    } catch (error) {
      setError("Failed to generate a new key. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-center text-gray-500">Loading...</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 flex items-center gap-2 text-gray-600 hover:text-gray-800"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-lg text-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Recover Your Private Key
        </h2>

        {/* Warning Message */}
        {showWarning && (
          <div className="mt-4 bg-yellow-100 border border-yellow-500 p-4 rounded-md text-yellow-900 text-sm">
            <p className="font-semibold">
              This action allows you to restore your{" "}
              <strong><u>encryption key</u></strong>.
              <span className="block text-red-600 font-bold">
                If you enter the wrong password, your key{" "}
                <strong><u>cannot be recovered</u></strong>.
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

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 bg-red-100 text-red-600 p-3 rounded mt-3">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Recovery Method Toggle */}
        {!showWarning && (
          <>
            <p className="text-gray-600 mt-2">
              Choose a method to regain access:
            </p>

            <div className="flex justify-center gap-4 mt-4">
              <button
                className={`px-4 py-2 rounded-md transition-all ${
                  recoveryMethod === "qr"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
                onClick={() => setRecoveryMethod("qr")}
              >
                Scan QR Code
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-all ${
                  recoveryMethod === "manual"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
                onClick={() => setRecoveryMethod("manual")}
              >
                Enter Code Manually
              </button>
            </div>

            {/* Recovery Component */}
            <div className="mt-6">
              {recoveryMethod === "qr" ? (
                <KeyPairRecoveryViaQR onRecoverySuccess={() => navigate("/")} />
              ) : (
                <KeyImport onImportSuccess={() => navigate("/")} />
              )}
            </div>
          </>
        )}

        {/* Serious Warning About Regenerating a New Key */}
        {!showWarning && (
          <div className="mt-6 p-4 border border-red-500 bg-red-100 text-red-700 rounded-md">
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} />
              <p className="text-sm font-semibold">
                ⚠️ Important Security Warning
              </p>
            </div>
            <p className="text-xs mt-2">
              If you <strong>regenerate a new key</strong>, all old messages
              will be permanently lost.{" "}
              <u>
                All old keys from other logged-in devices will also become
                invalid.
              </u>{" "}
              This action <strong>cannot be undone.</strong>
            </p>
          </div>
        )}

        {/* Regenerate New Key Button */}
        {!showWarning && (
          <button
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
            onClick={() => setShowRegenerateConfirm(true)}
          >
            Regenerate New Key
          </button>
        )}
      </div>

      {/* Confirmation Modal for Regenerating New Key */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center">
            <h3 className="text-lg font-bold text-gray-800">
              Final Confirmation
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to regenerate a new encryption key?
              <br></br>
              <span className="text-red-600 font-bold">
                This will permanently delete all your old messages and logged-in
                devices.
              </span>
            </p>
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 bg-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                disabled={!isConfirmEnabled}
                onClick={handleRegenerate}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md disabled:bg-red-300 disabled:cursor-not-allowed transition"
              >
                {isConfirmEnabled
                  ? "Yes, Regenerate Key"
                  : `Yes, Regenerate Key (${countDown})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyRecovery;
