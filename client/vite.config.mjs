import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base: in production the app is served at /tally/ behind Nginx.
  // VITE_BASE_PATH is set to "/tally/" in the production .env;
  // local dev uses "/" so hot-reload and the Vite proxy still work.
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
