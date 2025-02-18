// In a helper file or within your ChatWindow component
import { deriveSharedAESKey, importECDHPublicKey } from "../utils/ECDH";
import {
  getPublicKeyForUser,
  setPublicKeyForUser,
  getPrivateKey,
} from "./keystore";
import axiosInstance from "../services/api";

export async function getRecipientAESKey(recipientId, userId) {
  let recipientPublicKeyPem = await getPublicKeyForUser(recipientId);
  if (!recipientPublicKeyPem) {
    const response = await axiosInstance.get(`users/public-key/${recipientId}`);
    recipientPublicKeyPem = response.data.publicKey;
    await setPublicKeyForUser(recipientId, recipientPublicKeyPem);
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
