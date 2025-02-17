// In a helper file or within your ChatWindow component
import { importPublicKey } from "./crypto";
import {
  getPublicKeyForUser,
  setPublicKeyForUser,
  getPrivateKey,
} from "./keystore";
import axiosInstance from "../services/api";

export async function getRecipientPublicKey(recipientId) {
  let publicKeyPem = await getPublicKeyForUser(recipientId);
  if (!publicKeyPem) {
    const response = await axiosInstance.get(
      `users/public-key/${recipientId}`
    );
    publicKeyPem = response.data.publicKey;
    await setPublicKeyForUser(recipientId, publicKeyPem);
  }
  return importPublicKey(publicKeyPem);
}

export async function getUserPrivateKey(userId) {
  const jwkString = await getPrivateKey(userId);
  if (!jwkString) throw new Error("Private key not found");
  const jwk = JSON.parse(jwkString);
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}