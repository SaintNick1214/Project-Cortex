const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cortexmemory/sdk", "@cortexmemory/vercel-ai-provider"],
  serverExternalPackages: ["convex"],
  experimental: {
    // Ensure linked packages resolve dependencies from this project's node_modules
    externalDir: true,
  },
  // Empty turbopack config to silence the warning about missing turbopack config
  turbopack: {},
  // Webpack configuration for module resolution when SDK is file-linked
  // This is needed because the SDK uses dynamic imports that don't resolve
  // correctly from a linked package's location during local development
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@anthropic-ai/sdk": path.resolve(__dirname, "node_modules/@anthropic-ai/sdk"),
      "openai": path.resolve(__dirname, "node_modules/openai"),
      "neo4j-driver": path.resolve(__dirname, "node_modules/neo4j-driver"),
    };
    return config;
  },
};

module.exports = nextConfig;
