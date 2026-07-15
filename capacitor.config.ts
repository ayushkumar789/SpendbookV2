import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.spendbook.app",
  appName: "SpendBook",
  webDir: "out",
  // RECOMMENDED for production: point the native shell at your deployed web app.
  // Next.js App Router dynamic routes (/book/[id], /shared/[shareId]) need a
  // server, so the native apps load the hosted PWA (with full offline caching
  // via the service worker). Set NEXT_PUBLIC_APP_URL's value here:
  server: {
    url: "https://YOUR-DEPLOYED-DOMAIN.com",
    cleartext: false,
  },
  android: {
    backgroundColor: "#F7F2E9",
  },
  ios: {
    backgroundColor: "#F7F2E9",
  },
};

export default config;
