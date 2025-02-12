export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keyPair;
}

export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const exportedAsString = ab2str(exported);
  return window.btoa(exportedAsString);
}

export async function importPublicKey(pem) {
  const binaryDerString = window.atob(pem);
  const binaryDer = str2ab(binaryDerString);
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function encryptMessage(publicKey, message) {
  const encoder = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoder.encode(message)
  );
  return window.btoa(ab2str(encrypted));
}

export async function decryptMessage(privateKey, encryptedMessage) {
  const binaryStr = window.atob(encryptedMessage);
  const encryptedArrayBuffer = str2ab(binaryStr);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedArrayBuffer
  );
  return new TextDecoder().decode(decrypted);
}

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
