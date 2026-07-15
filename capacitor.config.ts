import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.spendbook.app",
  appName: "SpendBook",
  webDir: "out",
  // Deep links (OAuth return): the custom scheme "com.spendbook.app" is
  // declared in android/app/src/main/AndroidManifest.xml (VIEW intent-filter,
  // scheme from res/values/strings.xml `custom_url_scheme`) and handled in
  // app/providers.tsx via the App plugin's `appUrlOpen` listener, which routes
  // com.spendbook.app://auth/callback into /auth/callback.
  // RECOMMENDED for production: point the native shell at your deployed web app.
  // Next.js App Router dynamic routes (/book/[id], /shared/[shareId]) need a
  // server, so the native apps load the hosted PWA (with full offline caching
  // via the service worker). Set NEXT_PUBLIC_APP_URL's value here:
  server: {
    url: "https://spendbook-v2.vercel.app",
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
