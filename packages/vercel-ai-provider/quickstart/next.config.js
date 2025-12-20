/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cortexmemory/sdk", "@cortexmemory/vercel-ai-provider"],
  serverExternalPackages: ["convex"],
};

module.exports = nextConfig;
