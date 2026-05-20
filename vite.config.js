import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // WebSocket goes directly to :3001 — no proxy needed
    // since BSPoker.jsx connects to ws://localhost:3001 directly
  },
});
