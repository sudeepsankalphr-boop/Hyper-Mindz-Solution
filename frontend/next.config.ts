import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Never cache API calls — auth/data must always be fresh
        urlPattern: /^https:\/\/hyper-mindz-solution-1\.onrender\.com\/.*/i,
        handler: "NetworkOnly",
      },
    ],
  },
})(nextConfig);
