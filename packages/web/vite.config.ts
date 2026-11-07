import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4748,
    proxy: { "/api": "http://127.0.0.1:4747" },
  },
  build: { target: "esnext", cssCodeSplit: false, sourcemap: false },
});
