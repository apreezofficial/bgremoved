import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apreez.bgremoved',
  appName: 'bgremoved',
  webDir: 'dist',
  backgroundColor: '#0B0B0C',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
