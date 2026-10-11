import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // الاختبارات بتختبر منطق طبقة الـ API على الـ mock بشكل صريح — مش سطح
    // الشبكة. من غير القيمة دي بتورث .env (false) وكل fetch بيفشل، فالسلوك
    // الصامت القديم (fallback للـ mock عند فشل الشبكة) كان هو اللي بيخليها تعدي.
    env: {
      VITE_USE_MOCK_API: "true",
    },
  },
});
