import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const usePolling = process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: usePolling
      ? {
          usePolling: true,
          interval: 100
        }
      : undefined
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});