import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: ['es2020', 'safari15', 'chrome89', 'edge89', 'firefox89'],
    cssTarget: ['safari15', 'chrome89', 'firefox89'],
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        splash: path.resolve(__dirname, "splash.html"),
        tray: path.resolve(__dirname, "tray.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes('@tauri-apps/')) return 'tauri';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('codemirror') || id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) return 'vendor-codemirror';
          if (id.includes('/motion/') || id.includes('\\motion\\') || id.includes('/framer-motion/') || id.includes('\\framer-motion\\')) return 'vendor-motion';
          if (id.includes('lottie-react')) return 'vendor-lottie';
          if (id.includes('@paypal/')) return 'vendor-paypal';
          if (id.includes('@uppy/')) return 'vendor-uppy';
          if (id.includes('react-markdown') || id.includes('marked')) return 'vendor-markdown';
          if (id.includes('cmdk')) return 'vendor-cmdk';
          if (id.includes('driver.js')) return 'vendor-driver';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
}));
