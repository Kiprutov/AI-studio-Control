import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ke.co.shuleni.studio',
  appName: 'Shuleni Studio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0B0E11',
    allowMixedContent: false,
  },
};

export default config;
