/** Actual nine-method release observations; acceptanceHash covers independent evidence review.
 * Final source/registry review is a separate release gate; no deployment or CI selector is changed here. */
import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";

export const RELEASE_GATEWAY_POLICY_MANIFEST_V19 = {
  "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
  "revision": 19,
  "classification": "reviewed-actual",
  "artifactRevision": "1031b5ebb4f26def04c58d0dc51e36c80b6660857d1ce9e6da4408a2ae32b340",
  "evidenceHash": "7d8c1a2f3d0cddcfeb42c4008135527f7b4168a10556c1ce71798467859c3388",
  "acceptanceHash": "ffcbc7b6ba21712668ff9c9a724edc8b98c48f88b1789c6df580b2a2146332d2",
  "budgetWindowMs": 86400000,
  "policies": [
    {
      "policyId": "cortex-model-defaults-v19",
      "version": 19,
      "scope": "deployment",
      "rules": {
        "allowedModels": [
          "openai/gpt-4o-mini",
          "openai/gpt-4o",
          "openai/text-embedding-3-small",
          "openai/text-embedding-3-large",
          "openai/gpt-image-2.5-flare"
        ],
        "interfaces": [
          "chat",
          "embedding",
          "image"
        ],
        "capabilities": [
          "text",
          "structured",
          "embedding",
          "tools",
          "image"
        ],
        "allowedOptions": [],
        "allowedTools": [
          "memory_recall",
          "memory_remember",
          "media_image_generate",
          "media_video_generate",
          "artifact_read"
        ],
        "fallbackModels": [],
        "limits": {
          "inputTokens": 32768,
          "contextTokens": 65536,
          "outputTokens": 512,
          "toolSteps": 4,
          "timeoutMs": 60000,
          "operationBudgetUnits": 2000000,
          "runBudgetUnits": 3000000,
          "tenantBudgetUnits": 10000000,
          "concurrency": 2
        },
        "pins": {
          "promptVersion": "memory-schema-prompt-v2",
          "schemaVersion": "facts-v1",
          "extractionVersion": "task04-qualification-e1",
          "toolRegistryVersion": "none-v1",
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512"
        }
      }
    },
    {
      "policyId": "cortex-conversation-title-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "conversation.title",
      "rules": {
        "modelId": "openai/gpt-4o",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-title-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-facts-resolution-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "facts.resolve",
      "rules": {
        "pins": {
          "schemaVersion": "conflicts-v1",
          "promptVersion": "memory-schema-prompt-v2",
          "boundRevision": "manual-plain-8192-512",
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "toolRegistryVersion": "none-v1"
        },
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-agent-response-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "agent.respond",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "boundRevision": "manual-agent-v2-32768-256",
          "toolRegistryVersion": "cortex-media-tools-v2",
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
        },
        "allowedTools": [
          "memory_recall",
          "memory_remember",
          "media_image_generate",
          "media_video_generate",
          "artifact_read"
        ],
        "limits": {
          "inputTokens": 32768,
          "contextTokens": 65536,
          "outputTokens": 256,
          "toolSteps": 1,
          "timeoutMs": 60000,
          "operationBudgetUnits": 100000,
          "runBudgetUnits": 3000000,
          "tenantBudgetUnits": 10000000,
          "concurrency": 2
        }
      }
    },
    {
      "policyId": "cortex-image-generation-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "media.image.generate",
      "rules": {
        "modelId": "openai/gpt-image-2.5-flare",
        "nativeInterface": "image",
        "capabilities": [
          "image"
        ],
        "allowedTools": [],
        "limits": {
          "inputTokens": 8192,
          "contextTokens": 16384,
          "outputTokens": 1,
          "toolSteps": 0,
          "timeoutMs": 60000,
          "operationBudgetUnits": 2000000,
          "runBudgetUnits": 3000000,
          "tenantBudgetUnits": 10000000,
          "concurrency": 2
        },
        "pins": {
          "priceRevision": "image-diagnostic-d861abc4-f446-40f9-ac14-c98ba205fa73-price",
          "boundRevision": "image25-flare-1024-low-png-v1",
          "toolRegistryVersion": "none-v1"
        }
      }
    },
    {
      "policyId": "cortex-memory-extract-observed-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "memory.extract",
      "rules": {
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "memory-json-schema-8192-512-v1",
          "promptVersion": "memory-extraction-assertions-prompt-v6",
          "toolRegistryVersion": "none-v1"
        },
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "limits": {
          "runBudgetUnits": 2000000
        },
        "allowedTools": []
      }
    },
    {
      "policyId": "cortex-embedding-memory-observed-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "embedding.memory",
      "rules": {
        "modelId": "openai/text-embedding-3-small",
        "nativeInterface": "embedding",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-small-8192-1536",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-embedding-query-observed-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "embedding.query",
      "rules": {
        "modelId": "openai/text-embedding-3-small",
        "nativeInterface": "embedding",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-small-8192-1536",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-memory-summarize-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "memory.summarize",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-text-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "artifact.text",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-code-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "artifact.code",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-sheet-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "artifact.sheet",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-suggestions-v19",
      "version": 19,
      "scope": "deployment",
      "operationKey": "artifact.suggestions",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    }
  ],
  "qualifications": [
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=plain; evidence=8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-plain-8192-512",
      "receiptId": "SUCCESSOR19-plain-8434f4569459d6d4da05",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=title; evidence=c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-title-8192-512",
      "receiptId": "SUCCESSOR19-title-c5ad914f9710218587b1",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "capabilities": [
        "embedding"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=small; evidence=32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-small-8192-1536",
      "receiptId": "SUCCESSOR19-small-32f78964c2bd598b86c0",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "modelId": "openai/text-embedding-3-large",
      "nativeInterface": "embedding",
      "capabilities": [
        "embedding"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=large; evidence=dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2; UNKNOWN retained; unapproved successor preparation."
      },
      "boundRevision": "manual-large-8192-3072",
      "receiptId": "SUCCESSOR19-large-dbc0ba4a91320841c9be",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "tools"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 32768,
        "contextTokens": 65536,
        "outputTokens": 256,
        "toolSteps": 1,
        "timeoutMs": 60000,
        "operationBudgetUnits": 100000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=v2; evidence=762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e; UNKNOWN retained; unapproved successor preparation."
      },
      "boundRevision": "manual-agent-v2-32768-256",
      "receiptId": "SUCCESSOR19-v2-762e16c9950646628807",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=jsonExtract; evidence=387968e2868b603af866d5e2880f426c308473282e04eddfd5b15c078ced06ce; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "memory-json-schema-8192-512-v1",
      "receiptId": "SUCCESSOR19-jsonExtract-387968e2868b603af866",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8"
    },
    {
      "receiptId": "SUCCESSOR19-v1-257fd3dbad975d20ded1",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "tools"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 32768,
        "contextTokens": 65536,
        "outputTokens": 512,
        "toolSteps": 4,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=v1; evidence=257fd3dbad975d20ded1634404371674f6b8c024741c81e6ed6c59ced29226e8; UNKNOWN retained; unapproved successor preparation."
      },
      "priceRevision": "renewal-v1-prices-e713bd4c-62e9-4e30-be26-16c05ad80f98",
      "boundRevision": "agent-tools-32768-512-v1"
    },
    {
      "modelId": "openai/gpt-image-2.5-flare",
      "nativeInterface": "image",
      "capabilities": [
        "image"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 1,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 2000000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 2000000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=image; evidence=4925e911cf48bbb085706dc8b29ae13deea435b2eacaa982ec4f2f8b749dc811; UNKNOWN retained; unapproved successor preparation."
      },
      "boundRevision": "image25-flare-1024-low-png-v1",
      "receiptId": "SUCCESSOR19-image-4925e911cf48bbb08570",
      "priceRevision": "image-diagnostic-d861abc4-f446-40f9-ac14-c98ba205fa73-price"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-0c2e39fdc267c8556965",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=plain; evidence=8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-e158bfb5d77b68823945",
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=title; evidence=c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-f179324c9b7ee9726e89",
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "capabilities": [
        "embedding"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=small; evidence=32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-d610fb7c41eff51ee0e7",
      "modelId": "openai/text-embedding-3-large",
      "nativeInterface": "embedding",
      "capabilities": [
        "embedding"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=large; evidence=dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2; UNKNOWN retained; unapproved successor preparation."
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "task10-large-8192-3072-v1"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-0ac0b05233cd35e879c0",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "tools"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 32768,
        "contextTokens": 65536,
        "outputTokens": 256,
        "toolSteps": 1,
        "timeoutMs": 60000,
        "operationBudgetUnits": 100000,
        "runBudgetUnits": 3000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "coversAllProviderCharges": true,
        "provenance": "Observed group=v2; evidence=762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e; UNKNOWN retained; unapproved successor preparation."
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "agent-tools-v2-32768-256-shared3m-v1"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-d32ce8cda9282960054a",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=plain; evidence=8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "text-8192-512-schema-observed-20261009"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-0a8d84a76aac6a1d6144",
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "capabilities": [
        "embedding"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=small; evidence=32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "small-8192-1536-observed-20261009"
    },
    {
      "receiptId": "SUCCESSOR19-ALIAS-e095a4aa7f801520a39e",
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "capabilities": [
        "text",
        "structured"
      ],
      "allowedOptions": [],
      "limits": {
        "inputTokens": 8192,
        "contextTokens": 16384,
        "outputTokens": 512,
        "toolSteps": 0,
        "timeoutMs": 60000,
        "operationBudgetUnits": 200000,
        "runBudgetUnits": 2000000,
        "tenantBudgetUnits": 10000000,
        "concurrency": 2
      },
      "costBound": {
        "kind": "qualified-call-ceiling",
        "maximumCostUnits": 100000,
        "provenance": "Observed group=title; evidence=c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a; UNKNOWN retained; unapproved successor preparation.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "boundRevision": "title-8192-512-observed-20261009"
    }
  ],
  "dispatchEvidence": [
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "manual-plain-8192-512",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b"
      },
      "receiptId": "SUCCESSOR19-plain-8434f4569459d6d4da05",
      "evidenceHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415464117,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "manual-title-8192-512",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a"
      },
      "receiptId": "SUCCESSOR19-title-c5ad914f9710218587b1",
      "evidenceHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415467678,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "providerVersion": "0.2.1",
      "boundRevision": "manual-small-8192-1536",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "default-embedding-utf8-v1",
        "featureEnvelope": "default-embedding-v1",
        "revision": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "SUCCESSOR19-small-32f78964c2bd598b86c0",
      "evidenceHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415470408,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/text-embedding-3-large",
      "nativeInterface": "embedding",
      "providerVersion": "0.2.1",
      "boundRevision": "manual-large-8192-3072",
      "embeddingProfile": {
        "profileId": "cortex-text-large-3072-v1",
        "modelId": "openai/text-embedding-3-large",
        "dimensions": 3072,
        "normalization": "text-nfc-lf-v1",
        "chunking": "codepoint-1600-overlap-200-v1",
        "indexName": "by_large_embedding_v1"
      },
      "terminalModelId": "text-embedding-3-large",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "profile-embedding-utf8-v1",
        "revision": 1,
        "featureEnvelope": "profile-embedding-v1",
        "proofHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 131072,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2"
      },
      "receiptId": "SUCCESSOR19-large-dbc0ba4a91320841c9be",
      "evidenceHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415473208,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "manual-agent-v2-32768-256",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "supportsStream": true,
      "toolContract": {
        "registryVersion": "cortex-media-tools-v2",
        "toolsCanonical": "[{\"description\":\"Recall authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"limit\":{\"maximum\":10,\"minimum\":1,\"type\":\"integer\"},\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\",\"limit\"],\"type\":\"object\"},\"name\":\"memory_recall\",\"type\":\"function\"},{\"description\":\"Remember explicit information in authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\"],\"type\":\"object\"},\"name\":\"memory_remember\",\"type\":\"function\"},{\"description\":\"Create one governed image and return its durable job and artifact references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"prompt\":{\"maxLength\":1024,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"prompt\"],\"type\":\"object\"},\"name\":\"media_image_generate\",\"type\":\"function\"},{\"description\":\"Create one governed video job and return its durable job and artifact references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"prompt\":{\"maxLength\":1024,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"prompt\"],\"type\":\"object\"},\"name\":\"media_video_generate\",\"type\":\"function\"},{\"description\":\"Read authorized artifact metadata and immutable asset references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"artifactId\":{\"maxLength\":256,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"artifactId\"],\"type\":\"object\"},\"name\":\"artifact_read\",\"type\":\"function\"}]",
        "maximumToolCalls": 1
      },
      "inputBound": {
        "ruleId": "agent-tools-chat-utf8-v1",
        "revision": 1,
        "featureEnvelope": "agent-tools-chat-v2",
        "proofHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 256,
        "maximumEmbeddingValues": 1,
        "proofHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e"
      },
      "receiptId": "SUCCESSOR19-v2-762e16c9950646628807",
      "evidenceHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415476314,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "memory-json-schema-8192-512-v1",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "memory-json-schema-chat-utf8-v1",
        "revision": 1,
        "featureEnvelope": "memory-extract-json-schema-v1",
        "proofHash": "387968e2868b603af866d5e2880f426c308473282e04eddfd5b15c078ced06ce",
        "documentHash": "99c8fddff5d60d4aea954acd5e85baf09e56899c2371dd9ea46263d6dc477868",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "387968e2868b603af866d5e2880f426c308473282e04eddfd5b15c078ced06ce"
      },
      "receiptId": "SUCCESSOR19-jsonExtract-387968e2868b603af866",
      "evidenceHash": "387968e2868b603af866d5e2880f426c308473282e04eddfd5b15c078ced06ce",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415460725,
      "expiresAt": 1794020171702
    },
    {
      "receiptId": "SUCCESSOR19-v1-257fd3dbad975d20ded1",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "evidenceHash": "257fd3dbad975d20ded1634404371674f6b8c024741c81e6ed6c59ced29226e8",
      "providerVersion": "0.2.1",
      "priceRevision": "renewal-v1-prices-e713bd4c-62e9-4e30-be26-16c05ad80f98",
      "boundRevision": "agent-tools-32768-512-v1",
      "checkedAt": 1793416392917,
      "expiresAt": 1794021143026,
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "supportsStream": true,
      "toolContract": {
        "registryVersion": "cortex-memory-tools-v1",
        "toolsCanonical": "[{\"description\":\"Recall authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"limit\":{\"maximum\":10,\"minimum\":1,\"type\":\"integer\"},\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\",\"limit\"],\"type\":\"object\"},\"name\":\"memory_recall\",\"type\":\"function\"},{\"description\":\"Remember explicit information in authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\"],\"type\":\"object\"},\"name\":\"memory_remember\",\"type\":\"function\"}]",
        "maximumToolCalls": 4
      },
      "inputBound": {
        "ruleId": "agent-tools-chat-utf8-v1",
        "revision": 1,
        "featureEnvelope": "agent-tools-chat-v1",
        "proofHash": "257fd3dbad975d20ded1634404371674f6b8c024741c81e6ed6c59ced29226e8",
        "documentHash": "6c2b1b8467e847baa3bab5c46ad276da3ebfffe086155adece2fcc80b27a324b",
        "nativeTransformHash": "72eeb121def33bf67105623abe4baf04c7f325b4b20c4dd20fb0611e81f40d64"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "257fd3dbad975d20ded1634404371674f6b8c024741c81e6ed6c59ced29226e8"
      }
    },
    {
      "boundRevision": "image25-flare-1024-low-png-v1",
      "checkedAt": 1793417058917,
      "evidenceHash": "4925e911cf48bbb085706dc8b29ae13deea435b2eacaa982ec4f2f8b749dc811",
      "expiresAt": 1794021797371,
      "inputBound": {
        "documentHash": "5b38503df764c0ec6f46656b4bd13044bfe44d0bee0c83f6abb50a7e64ccd5ca",
        "featureEnvelope": "media-image-v1",
        "nativeTransformHash": "601e8c9adbca7adb85b6f06b1b7e775f94285b11962674df44ff397385c41a3f",
        "proofHash": "4925e911cf48bbb085706dc8b29ae13deea435b2eacaa982ec4f2f8b749dc811",
        "revision": 1,
        "ruleId": "media-native-utf8-v1"
      },
      "mediaContract": {
        "callbacks": false,
        "inputProtocol": "none",
        "maximumInputAssetBytes": 0,
        "maximumResultBytes": 20000000,
        "options": {
          "kind": "image",
          "n": 1,
          "outputFormat": "png",
          "quality": "low",
          "size": "1024x1024"
        },
        "terminalIdentity": "requested-only",
        "usage": "optional",
        "version": 1
      },
      "modelId": "openai/gpt-image-2.5-flare",
      "nativeInterface": "image",
      "priceRevision": "image-diagnostic-d861abc4-f446-40f9-ac14-c98ba205fa73-price",
      "providerVersion": "0.2.1",
      "receiptId": "SUCCESSOR19-image-4925e911cf48bbb08570",
      "resultBound": {
        "maximumEmbeddingValues": 1,
        "maximumOutputTokens": 0,
        "maximumPrivateResultBytes": 60000,
        "proofHash": "4925e911cf48bbb085706dc8b29ae13deea435b2eacaa982ec4f2f8b749dc811"
      },
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1"
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "text-8192-512-schema-v2",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b"
      },
      "receiptId": "SUCCESSOR19-ALIAS-0c2e39fdc267c8556965",
      "evidenceHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415464117,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "text-8192-512-schema-v2",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a"
      },
      "receiptId": "SUCCESSOR19-ALIAS-e158bfb5d77b68823945",
      "evidenceHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415467678,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "providerVersion": "0.2.1",
      "boundRevision": "text-8192-512-schema-v2",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "default-embedding-utf8-v1",
        "featureEnvelope": "default-embedding-v1",
        "revision": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "SUCCESSOR19-ALIAS-f179324c9b7ee9726e89",
      "evidenceHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415470408,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/text-embedding-3-large",
      "nativeInterface": "embedding",
      "providerVersion": "0.2.1",
      "boundRevision": "task10-large-8192-3072-v1",
      "embeddingProfile": {
        "profileId": "cortex-text-large-3072-v1",
        "modelId": "openai/text-embedding-3-large",
        "dimensions": 3072,
        "normalization": "text-nfc-lf-v1",
        "chunking": "codepoint-1600-overlap-200-v1",
        "indexName": "by_large_embedding_v1"
      },
      "terminalModelId": "text-embedding-3-large",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "profile-embedding-utf8-v1",
        "revision": 1,
        "featureEnvelope": "profile-embedding-v1",
        "proofHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 131072,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2"
      },
      "receiptId": "SUCCESSOR19-ALIAS-d610fb7c41eff51ee0e7",
      "evidenceHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415473208,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "agent-tools-v2-32768-256-shared3m-v1",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "supportsStream": true,
      "toolContract": {
        "registryVersion": "cortex-media-tools-v2",
        "toolsCanonical": "[{\"description\":\"Recall authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"limit\":{\"maximum\":10,\"minimum\":1,\"type\":\"integer\"},\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\",\"limit\"],\"type\":\"object\"},\"name\":\"memory_recall\",\"type\":\"function\"},{\"description\":\"Remember explicit information in authorized Cortex memory.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"text\":{\"maxLength\":4096,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"text\"],\"type\":\"object\"},\"name\":\"memory_remember\",\"type\":\"function\"},{\"description\":\"Create one governed image and return its durable job and artifact references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"prompt\":{\"maxLength\":1024,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"prompt\"],\"type\":\"object\"},\"name\":\"media_image_generate\",\"type\":\"function\"},{\"description\":\"Create one governed video job and return its durable job and artifact references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"prompt\":{\"maxLength\":1024,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"prompt\"],\"type\":\"object\"},\"name\":\"media_video_generate\",\"type\":\"function\"},{\"description\":\"Read authorized artifact metadata and immutable asset references.\",\"inputSchema\":{\"additionalProperties\":false,\"properties\":{\"artifactId\":{\"maxLength\":256,\"minLength\":1,\"type\":\"string\"}},\"required\":[\"artifactId\"],\"type\":\"object\"},\"name\":\"artifact_read\",\"type\":\"function\"}]",
        "maximumToolCalls": 1
      },
      "inputBound": {
        "ruleId": "agent-tools-chat-utf8-v1",
        "revision": 1,
        "featureEnvelope": "agent-tools-chat-v2",
        "proofHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 256,
        "maximumEmbeddingValues": 1,
        "proofHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e"
      },
      "receiptId": "SUCCESSOR19-ALIAS-0ac0b05233cd35e879c0",
      "evidenceHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415476314,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "text-8192-512-schema-observed-20261009",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b"
      },
      "receiptId": "SUCCESSOR19-ALIAS-d32ce8cda9282960054a",
      "evidenceHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415464117,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "providerVersion": "0.2.1",
      "boundRevision": "small-8192-1536-observed-20261009",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "default-embedding-utf8-v1",
        "featureEnvelope": "default-embedding-v1",
        "revision": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "SUCCESSOR19-ALIAS-0a8d84a76aac6a1d6144",
      "evidenceHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415470408,
      "expiresAt": 1794020171702
    },
    {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "providerVersion": "0.2.1",
      "boundRevision": "title-8192-512-observed-20261009",
      "terminalCost": "unavailable",
      "terminalProof": "provider-terminal-v1",
      "inputBound": {
        "ruleId": "plain-chat-cookbook-utf8-v1",
        "featureEnvelope": "plain-chat-v1",
        "revision": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
        "documentHash": "15c6bb4658b28e0e12cac60d4fd1b11cb195833fdab04e71e80a14bd5a6b24bb",
        "nativeTransformHash": "5d26d04de5a5b74a4bf760aa7764c15d7fdf841a2a4f862135e9128f006ab613"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a"
      },
      "receiptId": "SUCCESSOR19-ALIAS-e095a4aa7f801520a39e",
      "evidenceHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
      "priceRevision": "sandbox-current-prices-5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8",
      "checkedAt": 1793415467678,
      "expiresAt": 1794020171702
    }
  ]
} as const satisfies DeploymentPolicyManifest;

/** Finite observed scope; no settled USD claim and no separate V1 generation/tool effects. */
export const RELEASE_GATEWAY_POLICY_V19_OBSERVATIONS = {
  "evidenceReviewSha256": "ffcbc7b6ba21712668ff9c9a724edc8b98c48f88b1789c6df580b2a2146332d2",
  "evidenceReviewScope": "actual-release-model-observations-seven-plus-v1-plus-flare",
  "finalCoherentCodeReviewRepresentedByAcceptanceHash": false,
  "sourceEquivalenceScope": "18 material sources and19 native files; exact append-only V19 registry is a newly reviewed trust addition, not whole artifact identity",
  "observedBackendManifestSha256": "327e297e95948f127f51fa0d79fb6afb7a0281cf99066264a2ec75e3e57f737c",
  "historicalRoots": [
    {
      "manifestId": "cortex-gateway-text-defaults-2026-10-08",
      "revision": 3,
      "sha256": "dedafd99b33607abc788ad9ea27d795bcae320822db80a7593cbe348cf33047d"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 5,
      "sha256": "d77d10459fd5d0a8a185dafc986f97240a88fd902e05531a328245cdea8b7908"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 9,
      "sha256": "1a0b8c91551f62a78da6be6e017e8a11ec4fd1ec08f4f0b0a22414223032da70"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 14,
      "sha256": "3d6ddaf15b0607f8d98dc0f6b37974c79d84d0cb99cbc2eb544774cc527585cc"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 15,
      "sha256": "991b3c5ada3e1849b7a06db29c0be1412b0040a7fef216f9e80ee3b2fd07cf65"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 16,
      "sha256": "9181f182ff0fb32fdea1bd26d54e66b3c7bd0ed6e9198f5fee8a926e2a6fe789"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 17,
      "sha256": "0842d04789d0e7f606c04af0275852570f76957f1316f0029d4442b764c3b380"
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 18,
      "sha256": "3beff8df35710f1f258e63564a092a1fecfef2e945f990120b4d5c9ea98d8a45"
    }
  ],
  "groups": [
    {
      "id": "plain",
      "checkedAt": 1793415464117,
      "expiresAt": 1794020171702,
      "evidenceHash": "8434f4569459d6d4da057c559183d82f1525726385b5a9055580ff14f8078d6b",
      "entries": [
        {
          "mode": "plain",
          "sha256": "d50adf730a6be9d996f6d04039c0fbe20bbe92e042161345b35adcf26486e543",
          "checkedAt": 1793415464117,
          "completedAt": 1793415464660
        }
      ]
    },
    {
      "id": "title",
      "checkedAt": 1793415467678,
      "expiresAt": 1794020171702,
      "evidenceHash": "c5ad914f9710218587b1f1e5cb9dc638acb8263c59b296c830c3bb6867f1734a",
      "entries": [
        {
          "mode": "title",
          "sha256": "e403d9993cb3eef5822483a85c96edb957f3fad6041db5cd64e20739fe17cba7",
          "checkedAt": 1793415467678,
          "completedAt": 1793415467934
        }
      ]
    },
    {
      "id": "small",
      "checkedAt": 1793415470408,
      "expiresAt": 1794020171702,
      "evidenceHash": "32f78964c2bd598b86c0ff8521d44ea147cc27b6788e5e5e0a16be4c77c1059d",
      "entries": [
        {
          "mode": "small",
          "sha256": "29d71ed356b4a9188c9d7b86075e9edaef7884023d647b5f4e220b5cd6b7f43e",
          "checkedAt": 1793415470408,
          "completedAt": 1793415470702
        }
      ]
    },
    {
      "id": "large",
      "checkedAt": 1793415473208,
      "expiresAt": 1794020171702,
      "evidenceHash": "dbc0ba4a91320841c9bee6570e15694e589271ebccb929be731ae408e5660df2",
      "entries": [
        {
          "mode": "large",
          "sha256": "c4789088401720e145ce2534f55a137b88e5f783a7bd850ab5dffb441ab06b68",
          "checkedAt": 1793415473208,
          "completedAt": 1793415473597
        }
      ]
    },
    {
      "id": "v2",
      "checkedAt": 1793415476314,
      "expiresAt": 1794020171702,
      "evidenceHash": "762e16c99506466288079255141f68989d70804d40e591252612bb3dcc4dbf6e",
      "entries": [
        {
          "mode": "toolsGenerate",
          "sha256": "fe55e0db91dc108eb5d00e17514aebab27ad384f4be100a12131abbd0b82676c",
          "checkedAt": 1793415476314,
          "completedAt": 1793415476593
        },
        {
          "mode": "toolsStream",
          "sha256": "6e898105283b864c239ae169ef482a5a849784a3f17431757dcbf61be4abfc4d",
          "checkedAt": 1793415479799,
          "completedAt": 1793415480078
        }
      ]
    },
    {
      "id": "jsonExtract",
      "checkedAt": 1793415460725,
      "expiresAt": 1794020171702,
      "evidenceHash": "387968e2868b603af866d5e2880f426c308473282e04eddfd5b15c078ced06ce",
      "entries": [
        {
          "mode": "jsonExtract",
          "sha256": "325b1a1ba04dbf8958b6ee0e69a65a2ea6a849429fe417dbbc2a73900180000e",
          "checkedAt": 1793415460725,
          "completedAt": 1793415461032
        }
      ]
    },
    {
      "id": "v1",
      "checkedAt": 1793416392917,
      "expiresAt": 1794021143026,
      "evidenceHash": "257fd3dbad975d20ded1634404371674f6b8c024741c81e6ed6c59ced29226e8",
      "entries": [
        {
          "mode": "v1",
          "sha256": "1d908b9c4ffa87a51cc556cadcfcdce6ce9f2e9d2a00eb083cfc743c896062ce",
          "checkedAt": 1793416392917,
          "completedAt": 1793416393159
        }
      ]
    },
    {
      "id": "image",
      "checkedAt": 1793417058917,
      "expiresAt": 1794021797371,
      "evidenceHash": "4925e911cf48bbb085706dc8b29ae13deea435b2eacaa982ec4f2f8b749dc811",
      "entries": [
        {
          "mode": "image",
          "sha256": "a38609d45c99de2a2c414c8a1c7b8c0339b383d8898a0e26740a295b583e5989",
          "checkedAt": 1793417058917,
          "completedAt": 1793417062121
        }
      ]
    }
  ],
  "v1": {
    "streamObserved": true,
    "generationSeparatelyObserved": false,
    "toolEffectsExecuted": false
  },
  "image": {
    "modelId": "openai/gpt-image-2.5-flare",
    "boundRevision": "image25-flare-1024-low-png-v1",
    "bytes": 700695,
    "sha256": "10cd440e99cb38d4df81e0ea768c2704463780729e1e29d3bb8a028b31a67857",
    "privateDeliveryVerified": true,
    "evidenceRenewsRetiredModel": false,
    "mimeType": "image/png",
    "width": 1024,
    "height": 1024,
    "identity": "requested-only",
    "settledUsdClaim": false
  },
  "originalImageUpstreamOutcome": "UNKNOWN",
  "actualUsdSettlementClaim": false,
  "possibleLiabilityUnits": 4800000,
  "issuedAttempts": 10
} as const;
