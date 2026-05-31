// In a helper file or within your ChatWindow component
import { deriveSharedAESKey, importECDHPublicKey } from "../utils/ECDH";
import {
  getPublicKeyForUser,
  setPublicKeyForUser,
  getPrivateKey,
} from "./keyStore";
import axiosInstance from "../services/api";

async function fetchAndCachePublicKey(recipientId) {
  const response = await axiosInstance.get(`users/public-key/${recipientId}`);
  const recipientPublicKeyPem = response?.data?.publicKey;
  if (!recipientPublicKeyPem) {
    throw new Error("Recipient public key not found");
  }
  await setPublicKeyForUser(recipientId, recipientPublicKeyPem);
  return recipientPublicKeyPem;
}

export async function getRecipientAESKey(recipientId, userId, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  let recipientPublicKeyPem = forceRefresh
    ? null
    : await getPublicKeyForUser(recipientId);
  if (!recipientPublicKeyPem) {
    recipientPublicKeyPem = await fetchAndCachePublicKey(recipientId);
  }
  const recipientPublicKey = await importECDHPublicKey(recipientPublicKeyPem);
  const ourPrivateKey = await getOurPrivateKey(userId);
  const aesKey = await deriveSharedAESKey(ourPrivateKey, recipientPublicKey);
  return aesKey;
}

async function getOurPrivateKey(userId) {
  const jwkString = await getPrivateKey(userId);
  if (!jwkString) throw new Error("Private key not found");
  const jwk = JSON.parse(jwkString);
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}
