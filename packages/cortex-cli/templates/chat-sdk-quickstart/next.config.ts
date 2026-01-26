import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Required for @cortexmemory packages to work with Turbopack
  transpilePackages: ["@cortexmemory/vercel-ai-provider", "@cortexmemory/sdk"],
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
