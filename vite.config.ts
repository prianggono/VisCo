import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { exclude: ["tests/ui-smoke.test.ts", "node_modules/**"] }
});
