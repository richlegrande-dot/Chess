import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Generate build version from timestamp
const buildVersion = `v${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Fix ES module issues in production
  define: {
    global: 'globalThis',
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion),
  },
  server: {
    port: 3001,
    strictPort: true, // Fail if port is in use instead of trying another port
    proxy: {
      '/api': {
        target: 'http://localhost:8787',  // Mock backend port
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    // Optimize chunk sizes
    chunkSizeWarningLimit: 600,
    // Minify for production but KEEP console logs for debugging
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // KEEP console.logs for production debugging
        drop_debugger: true,
      },
    },
  },
  worker: {
    format: 'es', // Use ES module format for workers
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'chess.js', 'zustand'],
  },
});
