import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Session and shared-chat routes use dynamic request data.
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
        protocol: "https",
      },
    ],
  },
  // Required for @cortexmemory packages to work with Turbopack
  transpilePackages: [
    "@cortexmemory/vercel-ai-provider",
    "@cortexmemory/sdk",
    "react-data-grid",
  ],
};

export default nextConfig;
