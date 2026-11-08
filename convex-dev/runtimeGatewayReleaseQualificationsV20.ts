/** Actual nine-method renewal; acceptanceHash is combined ACTUAL evidence review only.
 * V20 SOURCE/LOCAL acceptance is a separate gate. Original failed batches and UNKNOWN remain unchanged. */
import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";

export const RELEASE_GATEWAY_POLICY_MANIFEST_V20 = {
  "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
  "revision": 20,
  "classification": "reviewed-actual",
  "artifactRevision": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05",
  "evidenceHash": "000e5869e3da3bbb7dd5511c92edc95183f2ae336974b9dc719afc3024ef9e35",
  "acceptanceHash": "d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb",
  "budgetWindowMs": 86400000,
  "policies": [
    {
      "policyId": "cortex-model-defaults-v20",
      "version": 20,
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
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-plain-8192-512"
        }
      }
    },
    {
      "policyId": "cortex-conversation-title-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "conversation.title",
      "rules": {
        "modelId": "openai/gpt-4o",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-title-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-facts-resolution-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "facts.resolve",
      "rules": {
        "pins": {
          "schemaVersion": "conflicts-v1",
          "promptVersion": "memory-schema-prompt-v2",
          "boundRevision": "manual-plain-8192-512",
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
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
      "policyId": "cortex-agent-response-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "agent.respond",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "boundRevision": "manual-agent-v2-32768-256",
          "toolRegistryVersion": "cortex-media-tools-v2",
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
      "policyId": "cortex-image-generation-v20",
      "version": 20,
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
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "image25-flare-1024-low-png-v1",
          "toolRegistryVersion": "none-v1"
        }
      }
    },
    {
      "policyId": "cortex-memory-extract-observed-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "memory.extract",
      "rules": {
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
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
      "policyId": "cortex-embedding-memory-observed-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "embedding.memory",
      "rules": {
        "modelId": "openai/text-embedding-3-small",
        "nativeInterface": "embedding",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-small-8192-1536",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-embedding-query-observed-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "embedding.query",
      "rules": {
        "modelId": "openai/text-embedding-3-small",
        "nativeInterface": "embedding",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-small-8192-1536",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-memory-summarize-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "memory.summarize",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-text-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "artifact.text",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-code-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "artifact.code",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-sheet-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "artifact.sheet",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
          "boundRevision": "manual-plain-8192-512",
          "toolRegistryVersion": "none-v1"
        },
        "limits": {
          "runBudgetUnits": 2000000
        }
      }
    },
    {
      "policyId": "cortex-artifact-suggestions-v20",
      "version": 20,
      "scope": "deployment",
      "operationKey": "artifact.suggestions",
      "rules": {
        "modelId": "openai/gpt-4o-mini",
        "nativeInterface": "chat",
        "pins": {
          "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
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
        "provenance": "Observed group=plain; evidence=c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-plain-8192-512",
      "receiptId": "RELEASE20-plain-72208bbd586bd77e68b8",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
        "provenance": "Observed group=title; evidence=d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-title-8192-512",
      "receiptId": "RELEASE20-title-5fd0ba1151bcf6bc3ecf",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
        "provenance": "Observed group=small; evidence=fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "manual-small-8192-1536",
      "receiptId": "RELEASE20-small-8c5c3287c2fb628755f5",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
        "provenance": "Observed group=large; evidence=c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "boundRevision": "manual-large-8192-3072",
      "receiptId": "RELEASE20-large-a83f05e78bd138ecd2b4",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
        "provenance": "Observed group=v2; evidence=9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "boundRevision": "manual-agent-v2-32768-256",
      "receiptId": "RELEASE20-v2-585560b775ad3a25d1a4",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
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
        "provenance": "Observed group=jsonExtract; evidence=385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "boundRevision": "memory-json-schema-8192-512-v1",
      "receiptId": "RELEASE20-jsonExtract-09ed1f62d3677b72f70c",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
    },
    {
      "receiptId": "RELEASE20-v1-6905a27fbff571338691",
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
        "provenance": "Observed group=v1; evidence=57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
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
        "provenance": "Observed group=image; evidence=0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "boundRevision": "image25-flare-1024-low-png-v1",
      "receiptId": "RELEASE20-image-22d216541cfbff06b644",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28"
    },
    {
      "receiptId": "RELEASE20-plain-ad4b1c400cdc7a769c5e",
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
        "provenance": "Observed group=plain; evidence=c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "RELEASE20-title-dbfe6f2285ea979e08e7",
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
        "provenance": "Observed group=title; evidence=d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "RELEASE20-small-f5b164c979ddd358cfba",
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
        "provenance": "Observed group=small; evidence=fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "text-8192-512-schema-v2"
    },
    {
      "receiptId": "RELEASE20-large-2cae1a5e8f48d4571e12",
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
        "provenance": "Observed group=large; evidence=c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "task10-large-8192-3072-v1"
    },
    {
      "receiptId": "RELEASE20-v2-df238c033282004a191c",
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
        "provenance": "Observed group=v2; evidence=9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate."
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "agent-tools-v2-32768-256-shared3m-v1"
    },
    {
      "receiptId": "RELEASE20-plain-d2978205630f46175300",
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
        "provenance": "Observed group=plain; evidence=c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "text-8192-512-schema-observed-20261009"
    },
    {
      "receiptId": "RELEASE20-small-fe46326ffe016a7ff35a",
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
        "provenance": "Observed group=small; evidence=fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "small-8192-1536-observed-20261009"
    },
    {
      "receiptId": "RELEASE20-title-d77dd68600dcc85e041b",
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
        "provenance": "Observed group=title; evidence=d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487; combined actual review=d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb; UNKNOWN retained; V20 SOURCE/LOCAL acceptance separate.",
        "coversAllProviderCharges": true
      },
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
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
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
        "documentHash": "c60e9d44f93696de2e250b83c525eb08e836f2c4e1b0db2ee29c06d556a62b14",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18"
      },
      "receiptId": "RELEASE20-plain-72208bbd586bd77e68b8",
      "evidenceHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794085708101,
      "expiresAt": 1794685171866
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
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
        "documentHash": "5044df855700c2f1f503c9500595b898c9d25f12159bf4eaacdc2da02aae0440",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487"
      },
      "receiptId": "RELEASE20-title-5fd0ba1151bcf6bc3ecf",
      "evidenceHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088038914,
      "expiresAt": 1794685171866
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
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
        "documentHash": "177ae909ecd3795f438819473893500dc6437753aced09ef5bbd1842896468c0",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "RELEASE20-small-8c5c3287c2fb628755f5",
      "evidenceHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088047583,
      "expiresAt": 1794685171866
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
        "proofHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
        "documentHash": "b4c6cea765f32bf5cd73118afcea259d2f512408a5b559908d5fe6a84e5003eb",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 131072,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5"
      },
      "receiptId": "RELEASE20-large-a83f05e78bd138ecd2b4",
      "evidenceHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088055494,
      "expiresAt": 1794685171866
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
        "proofHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
        "documentHash": "6f03ce54e826a5edec92322b5df75d508029ff73461b13544f0b9ae27ad84e72",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 256,
        "maximumEmbeddingValues": 1,
        "proofHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7"
      },
      "receiptId": "RELEASE20-v2-585560b775ad3a25d1a4",
      "evidenceHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088063705,
      "expiresAt": 1794685171866
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
        "proofHash": "385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d",
        "documentHash": "5ba5921d42950c14fe623febf0f3eb0a46a53c5924e386090b685a97cec8df63",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d"
      },
      "receiptId": "RELEASE20-jsonExtract-09ed1f62d3677b72f70c",
      "evidenceHash": "385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088080241,
      "expiresAt": 1794685171866
    },
    {
      "receiptId": "RELEASE20-v1-6905a27fbff571338691",
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "evidenceHash": "57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4",
      "providerVersion": "0.2.1",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "boundRevision": "agent-tools-32768-512-v1",
      "checkedAt": 1794088088890,
      "expiresAt": 1794685171866,
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
        "proofHash": "57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4",
        "documentHash": "436ab05d2080290634d031a9b6000d44924e6b5d9dd9fc6a47a3a6853f12d0ff",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4"
      }
    },
    {
      "boundRevision": "image25-flare-1024-low-png-v1",
      "checkedAt": 1794088099292,
      "evidenceHash": "0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3",
      "expiresAt": 1794685171866,
      "inputBound": {
        "documentHash": "fa9166b779ed38480190ded4e37031101e1721b22fe64c0862132f792d0946c6",
        "featureEnvelope": "media-image-v1",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05",
        "proofHash": "0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3",
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
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "providerVersion": "0.2.1",
      "receiptId": "RELEASE20-image-22d216541cfbff06b644",
      "resultBound": {
        "maximumEmbeddingValues": 1,
        "maximumOutputTokens": 0,
        "maximumPrivateResultBytes": 60000,
        "proofHash": "0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3"
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
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
        "documentHash": "c60e9d44f93696de2e250b83c525eb08e836f2c4e1b0db2ee29c06d556a62b14",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18"
      },
      "receiptId": "RELEASE20-plain-ad4b1c400cdc7a769c5e",
      "evidenceHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794085708101,
      "expiresAt": 1794685171866
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
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
        "documentHash": "5044df855700c2f1f503c9500595b898c9d25f12159bf4eaacdc2da02aae0440",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487"
      },
      "receiptId": "RELEASE20-title-dbfe6f2285ea979e08e7",
      "evidenceHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088038914,
      "expiresAt": 1794685171866
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
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
        "documentHash": "177ae909ecd3795f438819473893500dc6437753aced09ef5bbd1842896468c0",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "RELEASE20-small-f5b164c979ddd358cfba",
      "evidenceHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088047583,
      "expiresAt": 1794685171866
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
        "proofHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
        "documentHash": "b4c6cea765f32bf5cd73118afcea259d2f512408a5b559908d5fe6a84e5003eb",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 131072,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5"
      },
      "receiptId": "RELEASE20-large-2cae1a5e8f48d4571e12",
      "evidenceHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088055494,
      "expiresAt": 1794685171866
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
        "proofHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
        "documentHash": "6f03ce54e826a5edec92322b5df75d508029ff73461b13544f0b9ae27ad84e72",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 256,
        "maximumEmbeddingValues": 1,
        "proofHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7"
      },
      "receiptId": "RELEASE20-v2-df238c033282004a191c",
      "evidenceHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088063705,
      "expiresAt": 1794685171866
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
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
        "documentHash": "c60e9d44f93696de2e250b83c525eb08e836f2c4e1b0db2ee29c06d556a62b14",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18"
      },
      "receiptId": "RELEASE20-plain-d2978205630f46175300",
      "evidenceHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794085708101,
      "expiresAt": 1794685171866
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
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
        "documentHash": "177ae909ecd3795f438819473893500dc6437753aced09ef5bbd1842896468c0",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 0,
        "maximumEmbeddingValues": 1,
        "proofHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737"
      },
      "terminalModelId": "text-embedding-3-small",
      "receiptId": "RELEASE20-small-fe46326ffe016a7ff35a",
      "evidenceHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088047583,
      "expiresAt": 1794685171866
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
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
        "documentHash": "5044df855700c2f1f503c9500595b898c9d25f12159bf4eaacdc2da02aae0440",
        "nativeTransformHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05"
      },
      "resultBound": {
        "maximumPrivateResultBytes": 60000,
        "maximumOutputTokens": 512,
        "maximumEmbeddingValues": 1,
        "proofHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487"
      },
      "receiptId": "RELEASE20-title-d77dd68600dcc85e041b",
      "evidenceHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
      "priceRevision": "refresh-2026-11-07-92389e57343076016cd78e28",
      "checkedAt": 1794088038914,
      "expiresAt": 1794685171866
    }
  ]
} as const satisfies DeploymentPolicyManifest;

/** Exact observed pre-addition source/native provenance; no future artifact identity or settled USD claim. */
export const RELEASE_GATEWAY_POLICY_V20_OBSERVATIONS = {
  "evidenceReviewSha256": "d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb",
  "evidenceReviewScope": "combined-nine-method-native-observation-and-cleanup",
  "finalCoherentCodeReviewRepresentedByAcceptanceHash": false,
  "sourceLocalAcceptanceRepresentedByAcceptanceHash": false,
  "evidenceReview": {
    "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/combined-actual-review01.json",
    "bytes": 337498,
    "sha256": "d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb"
  },
  "evidenceManifestSha256": "62982ea119907812a217ea960c9abad00e2aa9b51dc4292b89e8ee4c571420f3",
  "evidenceFileCount": 752,
  "evidenceBinding": {
    "combinedActualReview": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/combined-actual-review01.json",
      "bytes": 337498,
      "sha256": "d2099197a5e4611ed0c95d3d5b236980428aa945fb39334f6ac895b5e49346bb"
    },
    "combinedEvidenceManifestSha256": "62982ea119907812a217ea960c9abad00e2aa9b51dc4292b89e8ee4c571420f3",
    "rootInspection": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/root-combined-actual-review-inspection.json",
      "bytes": 1595,
      "sha256": "a9b7c40817a51ba9566c3617ac7fbc72950ce03f59e15e10d7087da43bd06e2e"
    },
    "sourceArtifactBindingHash": "3e087244605fef5c710786d15bd15f1264117560389aa3f6860b542ceb273e05",
    "prices": [
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/current-primary-prices.json",
        "bytes": 1456,
        "sha256": "293f6d89d8ce2f33782da7dac8e80a1e4785ab0d87e831821edd0b8605cab616"
      },
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/current-primary-prices.json",
        "bytes": 1456,
        "sha256": "d6ea136ecdba41141023ec579ed06ee25ba3466b04c459f0b01a6d4f8382aff3"
      }
    ],
    "groups": [
      {
        "id": "plain",
        "evidenceHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
        "checkedAt": 1794085708101,
        "expiresAt": 1794685171866
      },
      {
        "id": "title",
        "evidenceHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
        "checkedAt": 1794088038914,
        "expiresAt": 1794685171866
      },
      {
        "id": "small",
        "evidenceHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
        "checkedAt": 1794088047583,
        "expiresAt": 1794685171866
      },
      {
        "id": "large",
        "evidenceHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
        "checkedAt": 1794088055494,
        "expiresAt": 1794685171866
      },
      {
        "id": "v2",
        "evidenceHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
        "checkedAt": 1794088063705,
        "expiresAt": 1794685171866
      },
      {
        "id": "jsonExtract",
        "evidenceHash": "385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d",
        "checkedAt": 1794088080241,
        "expiresAt": 1794685171866
      },
      {
        "id": "v1",
        "evidenceHash": "57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4",
        "checkedAt": 1794088088890,
        "expiresAt": 1794685171866
      },
      {
        "id": "image",
        "evidenceHash": "0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3",
        "checkedAt": 1794088099292,
        "expiresAt": 1794685171866
      }
    ]
  },
  "sourceArtifactBinding": {
    "scope": "Exact observed pre-addition current P/native input closure; temporary existing-host fixture composition only. No claim that the later V20 artifact is byte-identical to observed code.",
    "sourceRoot": "/Users/SaintNick/Documents/Cortex/worktrees/publishing-source-equivalence-2026-11-02",
    "sdkSourceNativeManifest": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-refresh-2026-11-07/source-native-pins.json",
      "bytes": 5042304,
      "sha256": "3dfe209255ef4688bbc8c7804de4deaec4fdca9d51e59ba753471a382d897b51"
    },
    "cliSourceNativeManifest": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/source-native-pins.json",
      "bytes": 5045546,
      "sha256": "9109ccc43494c2cda8c2762b2b7645daab4b5f82d8991cc0af8ebc7c38d825eb"
    },
    "backendManifest": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/publishing-source-equivalence-2026-11-02/dist/backend/v1/manifest.json",
      "bytes": 52434,
      "sha256": "3a78bc1ecc15378e317aacf11cbbc8a5b6bae5d787fa7491f210353d22e161ff"
    },
    "hostOnlyPatch": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/temporary-host.patch",
      "bytes": 3120,
      "sha256": "c96dea0fe34017e8bd4c11b3f21e254d980c74b6c98f6feec35f11b3a93a4338"
    },
    "probeSource": {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/probe.ts",
      "bytes": 10961,
      "sha256": "15773c1e8d92183c4a2d22a3a64d74cab05bba928fe09e0478cd2c127a612b8c"
    },
    "observedHostCompositions": [
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/standard-additive-install.json",
        "bytes": 26611,
        "sha256": "0966edd67eb2d6762fedce0bd7e367610e913b49ed1c04583a57fd5b7552df64"
      },
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/standard-additive-install.json",
        "bytes": 26611,
        "sha256": "09e454cf69f0ee2a687948154beca7a4f4a9c70f9f51893d5a5a8be1247c9d19"
      }
    ],
    "syntheticCommissioningInputs": [
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/synthetic-commissioning-manifests.json",
        "bytes": 114096,
        "sha256": "a0064a8cf74cb64ec2009fd714d95644489223ee96eb0b8363fc1a53666ec0ea"
      },
      {
        "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/synthetic-commissioning-manifests.json",
        "bytes": 114096,
        "sha256": "57dc3003e26571001fed962f87f68c9b32ab8ef9c9e1ba1dfc50c3ee7ca701cb"
      }
    ],
    "sourceFiles": 188,
    "distributionFiles": 175,
    "nativeFiles": 15450,
    "nativePackages": 340,
    "oldArchiveEquivalenceClaimed": false,
    "futureSourceOrCommitIdentityClaimed": false
  },
  "priceInputs": [
    {
      "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/current-primary-prices.json",
      "bytes": 1456,
      "sha256": "293f6d89d8ce2f33782da7dac8e80a1e4785ab0d87e831821edd0b8605cab616"
    },
    {
      "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/current-primary-prices.json",
      "bytes": 1456,
      "sha256": "d6ea136ecdba41141023ec579ed06ee25ba3466b04c459f0b01a6d4f8382aff3"
    }
  ],
  "actualLeaseExpiresAt": 1794685171866,
  "validityRule": "min(actual raw checkedAt + 7 days, actual lease); V2 uses both constituent observations conservatively",
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
    },
    {
      "manifestId": "cortex-gateway-agent-defaults-2026-10-08",
      "revision": 19,
      "sha256": "c6770ab5985d6b23d3bb067d9a8f9f5afde5100fdc199a608861fc96f973134d"
    }
  ],
  "historicalSourceFiles": [
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/publishing-source-equivalence-2026-11-02/convex-dev/runtimeGatewayQualifications.ts",
      "bytes": 25994,
      "sha256": "ec0bdc4206270dbd4a3bf2aea9ccbbcb8209060ad0d67f182fa5684e1a91a44f"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/publishing-source-equivalence-2026-11-02/convex-dev/runtimeGatewayMediaQualifications.ts",
      "bytes": 46349,
      "sha256": "68b11c24d55dc184cf2fbf1a1e39e00c13221352e8d735c76a8957e518c5c710"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/publishing-source-equivalence-2026-11-02/convex-dev/runtimeGatewayReleaseQualifications.ts",
      "bytes": 58110,
      "sha256": "292437dedacdec125779068cd0a30197af544711b6cc01173cad09e5491ff738"
    }
  ],
  "groups": [
    {
      "id": "plain",
      "checkedAt": 1794085708101,
      "expiresAt": 1794685171866,
      "evidenceHash": "c006abb6adb68547f664e95a68f0021acc6fe11510acf64d5908931eee1b5a18",
      "inputDocumentHash": "c60e9d44f93696de2e250b83c525eb08e836f2c4e1b0db2ee29c06d556a62b14",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "plain",
        "requests": [
          {
            "mode": "plain",
            "requestCanonicalSha256": "57f7716ec631b597e1b7f68317d3ccebdd1103f179a4078393f60285cdcdadc6"
          }
        ]
      },
      "entries": [
        {
          "mode": "plain",
          "checkedAt": 1794085708101,
          "completedAt": 1794085709696,
          "rawSha256": "0caffd09d56e28bccc6c2993f4cd1f90e2591184909f5ff102e01d75ce248fb4",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/issued-plain.json",
              "bytes": 3421,
              "sha256": "78bfc20ebfd0aa8e28129323f42677b3c8c7066c910b4cecce601a68ade32a50"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/raw-plain.json",
              "bytes": 6058,
              "sha256": "0caffd09d56e28bccc6c2993f4cd1f90e2591184909f5ff102e01d75ce248fb4"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-refresh-20261107/receipts/ledger-plain.json",
              "bytes": 97394,
              "sha256": "3598dc29a74273632f95dd5457c80d716cd288c2c1b0451ccd4fbefbfa974348"
            }
          ]
        }
      ]
    },
    {
      "id": "title",
      "checkedAt": 1794088038914,
      "expiresAt": 1794685171866,
      "evidenceHash": "d06e516ec4ccd5133be807c5d6e4b7914f2cb631ff1c245f252ad775497d2487",
      "inputDocumentHash": "5044df855700c2f1f503c9500595b898c9d25f12159bf4eaacdc2da02aae0440",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "title",
        "requests": [
          {
            "mode": "title",
            "requestCanonicalSha256": "5ab2d8211db06230b1f55ce35c8f9a5fc745677f1de6f6814ce4434cc522ae40"
          }
        ]
      },
      "entries": [
        {
          "mode": "title",
          "checkedAt": 1794088038914,
          "completedAt": 1794088040091,
          "rawSha256": "7fd044b669f30eab51ac6a0fc59fc89bd2b662c5f0c7cc3da6bbca8429864c5c",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-title.json",
              "bytes": 3416,
              "sha256": "c5607384f8fcdcddfe52570025deb3faea783924c71af07436163eb0573e2f98"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-title.json",
              "bytes": 6116,
              "sha256": "7fd044b669f30eab51ac6a0fc59fc89bd2b662c5f0c7cc3da6bbca8429864c5c"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-title.json",
              "bytes": 97479,
              "sha256": "257d5b766e61d4cae4deba79fd16be1cced34967be4725e97bc1c1faf324335b"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-title.json",
              "bytes": 5177,
              "sha256": "0931262d8d501e5e4b7ecd5ce031bd01b7b4037b794295e4dc4f2ee714cc14a3"
            }
          ]
        }
      ]
    },
    {
      "id": "small",
      "checkedAt": 1794088047583,
      "expiresAt": 1794685171866,
      "evidenceHash": "fd64d5fc953c653a2b0384ead1a610e5f046f1f8c25a7291ef63de5edeb82737",
      "inputDocumentHash": "177ae909ecd3795f438819473893500dc6437753aced09ef5bbd1842896468c0",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "small",
        "requests": [
          {
            "mode": "small",
            "requestCanonicalSha256": "51958df0d33ce38a56464c99452d34df804fc33c38fc0d8506b6db20389a5ae6"
          }
        ]
      },
      "entries": [
        {
          "mode": "small",
          "checkedAt": 1794088047583,
          "completedAt": 1794088048497,
          "rawSha256": "06847541c984ac799847afe2a0353f508c81634e80dc577cda1fa7d9c75c5d4c",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-small.json",
              "bytes": 3493,
              "sha256": "479e24d0aab2dbf617a9415169ce205dd8ae98c231b087dd471e2f07900f31aa"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-small.json",
              "bytes": 49614,
              "sha256": "06847541c984ac799847afe2a0353f508c81634e80dc577cda1fa7d9c75c5d4c"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-small.json",
              "bytes": 176757,
              "sha256": "64df545d6c184f343be2aba8648a626147dbb044f992b014bb8994a999061ca0"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-small.json",
              "bytes": 5747,
              "sha256": "5afd03e8cb3326b0f77e593ca0f43b1ad6a1f131fc16ad609196a5a0de377887"
            }
          ]
        }
      ]
    },
    {
      "id": "large",
      "checkedAt": 1794088055494,
      "expiresAt": 1794685171866,
      "evidenceHash": "c6a7807fe8a134369715736ce2652cde1f1df7b70edf786b158cbc349edc10f5",
      "inputDocumentHash": "b4c6cea765f32bf5cd73118afcea259d2f512408a5b559908d5fe6a84e5003eb",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "large",
        "requests": [
          {
            "mode": "large",
            "requestCanonicalSha256": "d6e32858fde3691a450b36f4331366fbb4e968dbea2bd00b72399ae4af93be3b"
          }
        ]
      },
      "entries": [
        {
          "mode": "large",
          "checkedAt": 1794088055494,
          "completedAt": 1794088056421,
          "rawSha256": "f6d71c74ede87f1397d796dfc0508e7d2c947fc4b1cf51fabac26762fbaed120",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-large.json",
              "bytes": 3801,
              "sha256": "50d5449e591bb526c0309ac0b3c246618cd3a72c2a7f5dcd46e0fc03b4669bd5"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-large.json",
              "bytes": 94322,
              "sha256": "f6d71c74ede87f1397d796dfc0508e7d2c947fc4b1cf51fabac26762fbaed120"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-large.json",
              "bytes": 285780,
              "sha256": "4af466fcd98d6f82b0e38545d4cafe8d050ea18f76adc02213ac2660bf9ca3ba"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-large.json",
              "bytes": 5697,
              "sha256": "44e9fa6afd6e9a9d37842be5b9ef9d6f49c70aa2ef31a66d9df1faac4a5ed9ad"
            }
          ]
        }
      ]
    },
    {
      "id": "v2",
      "checkedAt": 1794088063705,
      "expiresAt": 1794685171866,
      "evidenceHash": "9ad5c688e26e56e9e3d9d7ccf02a018ce2c6964450748079432544447fb5c9d7",
      "inputDocumentHash": "6f03ce54e826a5edec92322b5df75d508029ff73461b13544f0b9ae27ad84e72",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "v2",
        "requests": [
          {
            "mode": "toolsGenerate",
            "requestCanonicalSha256": "8a0a81b9a4cf19c338b9eed859bbc0ad5e17c62c51ebe202fc7acd08babed298"
          },
          {
            "mode": "toolsStream",
            "requestCanonicalSha256": "9c2dc07695c9120fb4d378b579628c75a7931b10da3f450e412cb0bdc0b34233"
          }
        ]
      },
      "entries": [
        {
          "mode": "toolsGenerate",
          "checkedAt": 1794088063705,
          "completedAt": 1794088065138,
          "rawSha256": "32bf8d6db0fcfefe558495a5661dea30afe1899c830a2c6468cf2c61309245e0",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-toolsGenerate.json",
              "bytes": 5272,
              "sha256": "2b9db1e0b5983a670660766e23984edf18665ec9a40fe6697a5eb89d5f362c19"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-toolsGenerate.json",
              "bytes": 12670,
              "sha256": "32bf8d6db0fcfefe558495a5661dea30afe1899c830a2c6468cf2c61309245e0"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-toolsGenerate.json",
              "bytes": 339186,
              "sha256": "4aae143780602ca78c157db1d32120874eb8fd6d1433f8c3a623927d580bd810"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-toolsGenerate.json",
              "bytes": 7452,
              "sha256": "3f42b3db670acfa957371b446a7fe75363caeeeab9a36de1488276b2f8aa76a4"
            }
          ]
        },
        {
          "mode": "toolsStream",
          "checkedAt": 1794088071891,
          "completedAt": 1794088073692,
          "rawSha256": "54f18acb843aaf095d88ecb3a19bca83bffef9bec36224132ed759e6c8000e56",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-toolsStream.json",
              "bytes": 5266,
              "sha256": "164004726994af3b43aa9a2fcc56ed43e55023ed27b99d99940894a06374f508"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-toolsStream.json",
              "bytes": 13144,
              "sha256": "54f18acb843aaf095d88ecb3a19bca83bffef9bec36224132ed759e6c8000e56"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-toolsStream.json",
              "bytes": 392579,
              "sha256": "e84a3311d1daa344d9e424288e88fb306c6d7f376f3e2db9b2c2450946f27645"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-toolsStream.json",
              "bytes": 7594,
              "sha256": "3b3dc4b06d9e682998f66908aa855698635ceb035228ae299c1b2af7534f4821"
            }
          ]
        }
      ]
    },
    {
      "id": "jsonExtract",
      "checkedAt": 1794088080241,
      "expiresAt": 1794685171866,
      "evidenceHash": "385de1f2525f2110d7af357e16f16026cdaff8cf092580e84329780cc8ea0f8d",
      "inputDocumentHash": "5ba5921d42950c14fe623febf0f3eb0a46a53c5924e386090b685a97cec8df63",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "jsonExtract",
        "requests": [
          {
            "mode": "jsonExtract",
            "requestCanonicalSha256": "b49bb6a31e4e3d265a577ba74a29c41708f68ed7887dd8f72355cb82c778756d"
          }
        ]
      },
      "entries": [
        {
          "mode": "jsonExtract",
          "checkedAt": 1794088080241,
          "completedAt": 1794088081928,
          "rawSha256": "d57c57f0acaf466a76352260f70f09dbe3d8c064f63639bcc9f228a44939ae80",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-jsonExtract.json",
              "bytes": 3505,
              "sha256": "ce66fc7e8a7e336af944ed99d5cfa025d33adf40c07677eb2d4bc6b7d7d341ea"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-jsonExtract.json",
              "bytes": 28533,
              "sha256": "d57c57f0acaf466a76352260f70f09dbe3d8c064f63639bcc9f228a44939ae80"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-jsonExtract.json",
              "bytes": 464492,
              "sha256": "2394cdec1c4448766e1e984f6e416af8c69dafe629802a066ba53531291b5698"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-jsonExtract.json",
              "bytes": 17123,
              "sha256": "a151391829be4a9249783de10da89dbfd23e128e5f6d88a517c59786e6d3ef70"
            }
          ]
        }
      ]
    },
    {
      "id": "v1",
      "checkedAt": 1794088088890,
      "expiresAt": 1794685171866,
      "evidenceHash": "57f2f8817bb6c345f4c8e3716958078c8cf3c9ff3695a8a651c6cf4535d5b4f4",
      "inputDocumentHash": "436ab05d2080290634d031a9b6000d44924e6b5d9dd9fc6a47a3a6853f12d0ff",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "v1",
        "requests": [
          {
            "mode": "v1",
            "requestCanonicalSha256": "1a0e828dc787116cda021b41820b9723e52c8ab18c87191b6f8c8cd6ba7ad849"
          }
        ]
      },
      "entries": [
        {
          "mode": "v1",
          "checkedAt": 1794088088890,
          "completedAt": 1794088090683,
          "rawSha256": "aeaf206cb3e57ca3e32d5da625a35dde36ad5fa91eb5874dffce68fcee6ac6d9",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-v1.json",
              "bytes": 4236,
              "sha256": "60589841d37480bdb1b62db4dcab01a38521b0ad1cd13d0b437c1f9f2c074201"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-v1.json",
              "bytes": 9374,
              "sha256": "aeaf206cb3e57ca3e32d5da625a35dde36ad5fa91eb5874dffce68fcee6ac6d9"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-v1.json",
              "bytes": 563424,
              "sha256": "c5afce052865e77bdf5898aac18151fde97ec0fb8c5f147b68456b5d6e1e2e6b"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-v1.json",
              "bytes": 6937,
              "sha256": "ac1da9914f891a4659d8d674992cd6e03ee94c9d63df4d081c7d3f43634368fa"
            }
          ]
        }
      ]
    },
    {
      "id": "image",
      "checkedAt": 1794088099292,
      "expiresAt": 1794685171866,
      "evidenceHash": "0389603d873fa961aab5f018a3735a539e4e2980d1768044121cf9374c3f53b3",
      "inputDocumentHash": "fa9166b779ed38480190ded4e37031101e1721b22fe64c0862132f792d0946c6",
      "inputDocument": {
        "scope": "Exact observed admitted native request bytes, not an archived framing document",
        "group": "image",
        "requests": [
          {
            "mode": "image",
            "requestCanonicalSha256": "77f49a12ed869518068224c4576c81f605fef2b76c10686f016ba3f32a01fcda"
          }
        ]
      },
      "entries": [
        {
          "mode": "image",
          "checkedAt": 1794088099292,
          "completedAt": 1794088109183,
          "rawSha256": "00df014c04fba9d2d0b78be2b296fada01bafcde1916a09bae6d106137eb6265",
          "files": [
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/issued-image.json",
              "bytes": 3877,
              "sha256": "4b7d67cc8c51409ca167b600fdc9d66cdd002f82651b55537cba503c50322b8e"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/raw-image-handler.json",
              "bytes": 100,
              "sha256": "00df014c04fba9d2d0b78be2b296fada01bafcde1916a09bae6d106137eb6265"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/ledger-image.json",
              "bytes": 623988,
              "sha256": "5ceea8e82a6cdde11229eb89779cf2b080307adcdbd7823e026f57a57ff5c923"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/outcome-image.json",
              "bytes": 9079,
              "sha256": "89d7ff7d34e9e310adb984731f8dfe3f6f06c20751f97bf8c6fc99eb68695ecc"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/image-terminal-job.json",
              "bytes": 1006,
              "sha256": "11255abe461a1a18c9701b54e2f102f5846ea0df15b31d5910b444b601e9a064"
            },
            {
              "path": "/Users/SaintNick/.codex/tmp/cortex-qualification-remainder-20261107/receipts/actual-image.png",
              "bytes": 1507930,
              "sha256": "bab5c9c4a3a24224f1d2d981ce79ad2d5f10fc02c71e01d2d56566a9f6fdf284"
            }
          ]
        }
      ]
    }
  ],
  "v1": {
    "streamObserved": true,
    "generationSeparatelyObserved": false,
    "toolEffectsExecuted": false
  },
  "v2": {
    "generationObserved": true,
    "streamObserved": true,
    "toolEffectsExecuted": false
  },
  "image": {
    "modelId": "openai/gpt-image-2.5-flare",
    "boundRevision": "image25-flare-1024-low-png-v1",
    "bytes": 1507930,
    "sha256": "bab5c9c4a3a24224f1d2d981ce79ad2d5f10fc02c71e01d2d56566a9f6fdf284",
    "privateDeliveryVerified": true,
    "evidenceRenewsRetiredModel": false,
    "mimeType": "image/png",
    "width": 1024,
    "height": 1024,
    "identity": "requested-only",
    "settledUsdClaim": false
  },
  "originalFailures": {
    "sdk": {
      "toolSession": 87639,
      "exitCode": 1,
      "issued": [
        "plain"
      ],
      "completed": [],
      "observations": [],
      "priorVerdict": "REJECT",
      "accepted": false,
      "possibleLiabilityUnits": 100000
    },
    "cli": {
      "toolSession": 34237,
      "exitCode": 1,
      "issued": [
        "title",
        "small",
        "large",
        "toolsGenerate",
        "toolsStream",
        "jsonExtract",
        "v1",
        "image"
      ],
      "completed": [
        "title",
        "small",
        "large",
        "toolsGenerate",
        "toolsStream",
        "jsonExtract",
        "v1",
        "image"
      ],
      "journalFailure": true,
      "journalCleanup": "UNCERTAIN",
      "indexCleanup": "UNCERTAIN",
      "accepted": false,
      "possibleLiabilityUnits": 2700000
    },
    "recovery": {
      "toolSession": 44559,
      "exitCode": 0,
      "paidRequests": 0,
      "sourceChanges": 0,
      "meaning": "Current owned cleanup accepted separately; original failures unchanged."
    }
  },
  "currentRecoveredCleanupAccepted": true,
  "cleanupAndRevocationEvidence": [
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/root-cleanup-recovery-inspection.json",
      "bytes": 2435,
      "sha256": "e54e03bff33b47edec84a3cf2316cc6ff64dcedfeec0f7409089506ea72ff997"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/root-owned-timer-cancellation-result.json",
      "bytes": 410,
      "sha256": "739f598c0239913542e22ad4b6d7e340a689e0a8cfd70562b1faaae4386426c0"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/root-credential-revoked.json",
      "bytes": 1803,
      "sha256": "140e396d83b2beb846b0a0ffcd679fed1c53afe285e4d289cc2dc32d7bb6bc40"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-refresh-2026-11-07/root-credential-revoked.json",
      "bytes": 1285,
      "sha256": "5e78234c2986d5116ce65cf2bb8eca20a0cc0ffa8e2f04c4edfd80642053e63f"
    },
    {
      "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-refresh-2026-11-07/root-credential-valid-args-controls.json",
      "bytes": 818,
      "sha256": "ce215b9a59f56411234c98f6ddddfcd65f23cacb652fd042ccba275bbad7bf71"
    }
  ],
  "originalPlainProvenance": {
    "path": "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/permanent-main-release-policy-2026-11-01/publishing-equivalence-implementation-2026-11-02/qualification-remainder-preparation-2026-11-07/original-plain-provenance.json",
    "bytes": 2844,
    "sha256": "4640703966cfbfed893c2b68eefd1d9203b3345def09a0be89ff89e5c447283f"
  },
  "actualUsdSettlementClaim": false,
  "possibleLiabilityUnits": 2800000,
  "issuedAttempts": 9,
  "separateHistoricalLiability": {
    "revision": 19,
    "possibleLiabilityUnits": 4800000,
    "issuedAttempts": 10,
    "tenantRunRepresentationsAreNonAdditive": true
  }
} as const;
