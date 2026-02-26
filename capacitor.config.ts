import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pfennig50.app',
  appName: '50Pfennig',

  // Vite build output directory
  webDir: 'dist',

  server: {
    // During development, you can point Capacitor at the Vite dev server
    // so you get hot-reload on device. Comment this out for production builds.
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
  },
};

export default config;
