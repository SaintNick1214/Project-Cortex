import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    // Start Here section
    {
      type: 'doc',
      id: 'index',
      label: 'Documentation Overview',
    },
    {
      type: 'doc',
      id: 'whats-new',
      label: "What's New",
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      className: 'sidebar-category-getting-started',
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/five-minute-quickstart',
        'getting-started/core-concepts',
        'getting-started/configuration',
        'getting-started/auth-integration',
      ],
    },

    // Core section header
    {
      type: 'html',
      value: '<div class="sidebar-section-header">Core</div>',
    },
    {
      type: 'category',
      label: 'Core Features',
      collapsed: true,
      className: 'sidebar-category-core-features',
      items: [
        'core-features/memory-orchestration',
        'core-features/memory-spaces',
        'core-features/semantic-search',
        'core-features/user-profiles',
        'core-features/conversation-history',
        'core-features/fact-extraction',
        'core-features/hive-mode',
        'core-features/streaming-support',
        'core-features/artifacts',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      collapsed: true,
      className: 'sidebar-category-integrations',
      items: [
        'integrations/integrations',
        'integrations/auth-providers',
        {
          type: 'category',
          label: 'Vercel AI SDK',
          items: [
            'integrations/vercel-ai-sdk/vercel-ai-sdk',
            'integrations/vercel-ai-sdk/getting-started',
            'integrations/vercel-ai-sdk/memory-spaces',
            'integrations/vercel-ai-sdk/hive-mode',
            'integrations/vercel-ai-sdk/advanced-usage',
            'integrations/vercel-ai-sdk/api-reference',
            'integrations/vercel-ai-sdk/migration-from-mem0',
            'integrations/vercel-ai-sdk/troubleshooting',
          ],
        },
      ],
    },

    // Develop section header
    {
      type: 'html',
      value: '<div class="sidebar-section-header">Develop</div>',
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: true,
      className: 'sidebar-category-api-reference',
      items: [
        'api-reference/overview',
        'api-reference/memory-operations',
        'api-reference/conversation-operations',
        'api-reference/sessions-operations',
        'api-reference/user-operations',
        'api-reference/context-operations',
        'api-reference/a2a-communication',
        'api-reference/auth-context-api',
        'api-reference/immutable-store-api',
        'api-reference/mutable-store-api',
        'api-reference/agent-management',
        'api-reference/governance-policies-api',
        'api-reference/memory-space-operations',
        'api-reference/facts-operations',
        'api-reference/graph-operations',
        'api-reference/artifacts-operations',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      collapsed: true,
      className: 'sidebar-category-advanced-topics',
      items: [
        'advanced-topics/a2a-communication',
        'advanced-topics/context-chains',
        'advanced-topics/graph-integration',
        'advanced-topics/fact-integration',
        'advanced-topics/sessions-management',
        'advanced-topics/graph-capabilities',
        'advanced-topics/graph-database-integration',
        'advanced-topics/facts-vs-conversations',
        'advanced-topics/orchestration-observer',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: true,
      className: 'sidebar-category-architecture',
      items: [
        'architecture/system-overview',
        'architecture/data-models',
        'architecture/convex-integration',
        'architecture/vector-embeddings',
        'architecture/search-strategy',
        'architecture/context-chain-design',
        'architecture/agent-registry',
        'architecture/performance',
        'architecture/security-privacy',
        'architecture/infinite-context',
        'architecture/resilience-layer',
        'architecture/governance-policies',
      ],
    },

    // Resources section header
    {
      type: 'html',
      value: '<div class="sidebar-section-header">Resources</div>',
    },
    {
      type: 'category',
      label: 'Security',
      collapsed: true,
      className: 'sidebar-category-security',
      items: [
        'security/authentication',
        'security/isolation-boundaries',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      className: 'sidebar-category-reference',
      items: [
        'reference/types-interfaces',
        'reference/error-handling',
        'reference/patterns-and-practices',
        'reference/cheat-sheet',
      ],
    },
    {
      type: 'category',
      label: 'Tools',
      collapsed: true,
      className: 'sidebar-category-tools',
      items: [
        'tools/cli-reference',
      ],
    },

    // Project section header
    {
      type: 'html',
      value: '<div class="sidebar-section-header">Project</div>',
    },
    {
      type: 'category',
      label: 'Roadmap',
      collapsed: true,
      className: 'sidebar-category-roadmap',
      items: [
        'roadmap/roadmap-overview',
        'roadmap/mcp-server',
        'roadmap/access-analytics',
        'roadmap/cloud-mode',
        'roadmap/context-chains-enhancements',
        'roadmap/api-enhancements',
        'roadmap/a2a-communication-enhancements',
        'roadmap/governance-enhancements',
        'roadmap/infinite-context-enhancements',
      ],
    },
    {
      type: 'category',
      label: 'Project',
      collapsed: true,
      className: 'sidebar-category-project',
      items: [
        'project/project-overview',
        'project/contributing',
        'project/code-of-conduct',
        'project/security',
        'project/license',
      ],
    },
  ],
};

export default sidebars;
