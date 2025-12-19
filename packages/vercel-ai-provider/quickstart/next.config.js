/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cortexmemory/sdk', '@cortexmemory/vercel-ai-provider'],
  experimental: {
    serverComponentsExternalPackages: ['convex'],
  },
};

module.exports = nextConfig;
