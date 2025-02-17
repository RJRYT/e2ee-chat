// keyStore.js
import { openDB } from "idb";

const DB_NAME = "e2ee_keys";
const STORE_NAME = "keys";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    },
  });
}

export async function setPrivateKey(userId, privateKey) {
  const db = await getDB();
  await db.put(STORE_NAME, { key: `privateKey-${userId}`, value: privateKey });
}

export async function getPrivateKey(userId) {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, `privateKey-${userId}`);
  return entry ? entry.value : null;
}

export async function setPublicKeyForUser(userId, publicKey) {
  const db = await getDB();
  await db.put(STORE_NAME, { key: `publicKey-${userId}`, value: publicKey });
}

export async function getPublicKeyForUser(userId) {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, `publicKey-${userId}`);
  return entry ? entry.value : null;
}
