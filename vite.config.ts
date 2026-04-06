import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    // Path aliases — must match tsconfig.app.json compilerOptions.paths
    alias: {
      '@': resolve(__dirname, 'src'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@repositories': resolve(__dirname, 'src/repositories'),
      '@features': resolve(__dirname, 'src/features'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@components': resolve(__dirname, 'src/components'),
      '@store': resolve(__dirname, 'src/store'),
      '@router': resolve(__dirname, 'src/router'),
    },
  },

  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    strictPort: true,
  },

  // Capacitor requires the output to be in `dist/`
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-tanstack';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/@capacitor') || id.includes('node_modules/@capacitor-mlkit/')) {
            return 'vendor-capacitor';
          }
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          if (
            id.includes('node_modules/zod/') ||
            id.includes('node_modules/date-fns/') ||
            id.includes('node_modules/idb-keyval/') ||
            id.includes('node_modules/lucide-react/') ||
            id.includes('node_modules/qrcode/')
          ) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
