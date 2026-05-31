import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const host = env.VITE_DEV_HOST || "0.0.0.0";
  const port = Number(env.VITE_DEV_PORT || 5173);
  const backendTarget = env.VITE_BACKEND_TARGET || "http://127.0.0.1:5000";

  const keyPath = env.VITE_SSL_KEY_PATH
    ? path.resolve(process.cwd(), env.VITE_SSL_KEY_PATH)
    : null;
  const certPath = env.VITE_SSL_CERT_PATH
    ? path.resolve(process.cwd(), env.VITE_SSL_CERT_PATH)
    : null;

  const hasCerts =
    keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath);

  return {
    plugins: [react()],
    server: {
      host,
      port,
      https: hasCerts
        ? {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          }
        : false,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
