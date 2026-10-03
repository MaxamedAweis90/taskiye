import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  envDir: '../',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'lucide-react',
      'better-auth/react',
    ],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('/node_modules/')) {
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/react-router-dom/') ||
              normalizedId.includes('/react-router/')
            ) {
              return 'vendor-react';
            }
            if (normalizedId.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (normalizedId.includes('@tanstack') || normalizedId.includes('/zustand/')) {
              return 'vendor-state';
            }
            if (normalizedId.includes('better-auth')) {
              return 'vendor-auth';
            }
            if (normalizedId.includes('/qrcode/') || normalizedId.includes('/jsqr/')) {
              return 'vendor-qr';
            }
          }
        },
      },
    },
  },
});

