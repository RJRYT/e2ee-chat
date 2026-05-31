function assertCryptoAvailable() {
  const subtle = window?.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto is unavailable. Use HTTPS or localhost (not plain HTTP on LAN IP)."
    );
  }
}

// Generate an ECDH key pair using P-256 curve
export async function generateECDHKeyPair() {
  assertCryptoAvailable();
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );
}

// Export ECDH public key as a base64 string
export async function exportECDHPublicKey(key) {
  assertCryptoAvailable();
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import ECDH public key from a base64 string
export async function importECDHPublicKey(pem) {
  assertCryptoAvailable();
  const binaryStr = atob(pem);
  const binaryDer = new Uint8Array(binaryStr.split("").map((c) => c.charCodeAt(0)));
  return await window.crypto.subtle.importKey(
    "raw",
    binaryDer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// Derive a shared AES key (AES-GCM 256-bit) using our private ECDH key and the other party's public key
export async function deriveSharedAESKey(privateKey, publicKey) {
  assertCryptoAvailable();
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a message using the shared AES key
export async function encryptWithAES(aesKey, message) {
  assertCryptoAvailable();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for AES-GCM
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    encodedMessage
  );
  // Combine IV and ciphertext; convert to base64 for transmission
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt a message using the shared AES key
export async function decryptWithAES(aesKey, data) {
  assertCryptoAvailable();
  const binaryStr = atob(data);
  const combined = new Uint8Array(binaryStr.split("").map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    ciphertext
  );
  return new TextDecoder().decode(decryptedBuffer);
}
