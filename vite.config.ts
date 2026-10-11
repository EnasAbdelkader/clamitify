import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // "@/services/api" === "src/services/api"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    // ثابت على 5173 عشان الـ CORS allowlist الموثّقة في docs/ ما تبوظ لو البورت اتغير.
    // strictPort: fail loudly instead of silently moving to 5174 and breaking CORS.
    port: 5173,
    strictPort: true,

    // بروكسي للتطوير المحلي: أي /api/* بيتحوّل لـ Flask، فمفيش CORS خالص.
    // Dev-only proxy. To use it set VITE_API_BASE_URL=/api in .env
    // (same-origin requests => no CORS preflight, no allowlist to maintain).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        // الـ bundle الرئيسي كان 453 kB — بنفصل المكتبات التقيلة في chunks منفصلة
        // عشان تتكاش لوحدها وما تتنزّلش تاني مع كل deploy.
        //
        // ⚠️ مهم: أي chunk هنا بيتحوّل لـ modulepreload في index.html، يعني
        // بينزل على كل صفحة. فمينفعش نحط فيه مكتبة صفحة واحدة بس بتستخدمها.
        //
        // IMPORTANT: a manual chunk becomes a modulepreload in index.html, i.e. it
        // is fetched on EVERY page. So only libraries the eager app shell actually
        // imports may go here.
        //   - react/react-dom/router : imported by main.tsx + App.tsx  -> always needed
        //   - framer-motion + lenis  : imported by Layout.tsx (eager)  -> always needed
        //   - gsap                   : only ChromaGrid + BorderGlow (About/Programs)
        //   - ogl                    : only Aurora (Home, dark mode only)
        // gsap and ogl are deliberately NOT listed: leaving them out lets Rollup
        // keep them inside the lazy page chunks that import them, so a visitor who
        // never opens About never downloads gsap.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "react-vendor";
          }
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils|lenis)[\\/]/.test(id)) {
            return "motion-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
