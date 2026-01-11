const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cortexmemory/vercel-ai-provider"],
  serverExternalPackages: ["convex", "neo4j-driver", "@cortexmemory/sdk"],
  // Disable image optimization to avoid sharp dependency (LGPL licensed)
  // This quickstart doesn't use image optimization features
  images: {
    unoptimized: true,
  },
  experimental: {
    // Ensure linked packages resolve dependencies from this project's node_modules
    externalDir: true,
  },
  // Empty turbopack config to silence the warning about missing turbopack config
  turbopack: {},
  // Webpack configuration for module resolution when SDK is file-linked
  // This is needed because the SDK uses dynamic imports that don't resolve
  // correctly from a linked package's location during local development
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@anthropic-ai/sdk": path.resolve(
        __dirname,
        "node_modules/@anthropic-ai/sdk",
      ),
      openai: path.resolve(__dirname, "node_modules/openai"),
    };

    // Mark neo4j-driver and its rxjs dependency as external for server builds
    // neo4j-driver uses rxjs for reactive sessions which doesn't bundle well
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("neo4j-driver", /^rxjs/, /^rxjs\//);
      }
    }

    return config;
  },
};

module.exports = nextConfig;
