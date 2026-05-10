import type { NextConfig } from "next";

/** When testing from a phone via LAN IP, Next.js blocks `/_next` dev assets unless the host is allowlisted. Set `DEV_LAN_HOST` in `.env.local` (hostname only, e.g. `172.20.10.6`). */
const lanDevHost = process.env.DEV_LAN_HOST?.trim();

const nextConfig: NextConfig = {
  ...(lanDevHost ? { allowedDevOrigins: [lanDevHost] } : {}),
};

export default nextConfig;
