import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks: they change rarely, so browsers keep them cached
        // across deploys while the app chunk is re-downloaded.
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-network",
              test: /node_modules[\\/](axios|socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io|xmlhttprequest-ssl|debug|ms)[\\/]/,
              priority: 20,
            },
            { name: "vendor-icons", test: /node_modules[\\/]lucide-react[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
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
