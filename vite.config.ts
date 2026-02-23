import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize production builds
    target: "esnext",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    // Code splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor bundles
          react: ["react", "react-dom"],
          framer: ["framer-motion"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-slot",
          ],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
