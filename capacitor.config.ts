import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicwishlist.app',
  appName: 'Music Wishlist',
  webDir: 'dist/music-wishlist-v2/browser',
  backgroundColor: '#22201f',
  loggingBehavior: 'production',
  android: {
    backgroundColor: '#22201f',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    SplashScreen: {
      backgroundColor: '#22201f',
      showSpinner: false,
      launchAutoHide: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#22201f',
      overlaysWebView: true,
    },
  },
};

export default config;
