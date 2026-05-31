const DEVICE_ID_KEY = "e2ee_device_id";
const DEVICE_NAME_KEY = "e2ee_device_name";

function randomId() {
  if (window?.crypto?.randomUUID) return window.crypto.randomUUID();
  return `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName() {
  let name = localStorage.getItem(DEVICE_NAME_KEY);
  if (!name) {
    const platform = navigator.platform || "Unknown";
    const lang = navigator.language || "en";
    name = `${platform} (${lang})`;
    localStorage.setItem(DEVICE_NAME_KEY, name);
  }
  return name;
}
