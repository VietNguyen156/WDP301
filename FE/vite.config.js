import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow opening the dev server through a public dev tunnel (tenant No-App links).
    allowedHosts: [".devtunnels.ms"],
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:5000",
        ws: true,
      },
    },
  },
});
