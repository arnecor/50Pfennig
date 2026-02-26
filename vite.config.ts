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
      '@domain':       resolve(__dirname, 'src/domain'),
      '@lib':          resolve(__dirname, 'src/lib'),
      '@repositories': resolve(__dirname, 'src/repositories'),
      '@features':     resolve(__dirname, 'src/features'),
      '@pages':        resolve(__dirname, 'src/pages'),
      '@components':   resolve(__dirname, 'src/components'),
      '@store':        resolve(__dirname, 'src/store'),
      '@router':       resolve(__dirname, 'src/router'),
    },
  },

  // Capacitor requires the output to be in `dist/`
  build: {
    outDir: 'dist',
  },
});
