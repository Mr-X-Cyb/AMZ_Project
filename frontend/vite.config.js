import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `vite dev` (outside Docker) we proxy /api to localhost:8000.
// In production the nginx container handles the /api proxy instead.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
