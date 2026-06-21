import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    port: 4311,
    proxy: {
      "/api": "http://127.0.0.1:4312",
    },
  },
});
