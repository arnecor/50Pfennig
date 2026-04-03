import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arco.sharli',
  appName: 'Sharli',

  // Vite build output directory
  webDir: 'dist',

  plugins: {
    PushNotifications: {
      smallIcon: 'ic_stat_notification',
      // Brand blue — must match the value in res/values/colors.xml
      // Run `npm run icon` to see the exact sampled hex
      iconColor: '#8ca1b7',
    },
  },

  server: {
    // During development, you can point Capacitor at the Vite dev server
    // so you get hot-reload on device. Comment this out for production builds.
    // url: 'http://YOUR_LOCAL_IP:3000',
    // cleartext: true,
  },
};

export default config;
