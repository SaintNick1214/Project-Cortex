/** Observed actual native descriptors. Earlier fixture-synthetic records remain
 * immutable history; acceptanceHash binds operator-authorized actual receipts,
 * not a fabricated independent full-task PASS. USD remains unavailable. Async
 * video has no qualified descriptor and remains externally unavailable. */
import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";
import { DEFAULT_GATEWAY_POLICY_MANIFEST } from "./runtimeGatewayQualifications";
export const OBSERVED_GATEWAY_POLICY_MANIFEST_V14 = {
  ...DEFAULT_GATEWAY_POLICY_MANIFEST,
  revision: 14,
  artifactRevision: "da3160d9b30cc2db61a072ce8967f8c6dafa689bb3eb857ec057534e544f6224",
  evidenceHash: "da3160d9b30cc2db61a072ce8967f8c6dafa689bb3eb857ec057534e544f6224",
  acceptanceHash: "da3160d9b30cc2db61a072ce8967f8c6dafa689bb3eb857ec057534e544f6224",
  policies: [
  {
    "policyId": "cortex-model-defaults-v14",
    "version": 14,
    "scope": "deployment",
    "rules": {
      "allowedModels": [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "openai/text-embedding-3-small",
        "openai/text-embedding-3-large",
        "openai/gpt-image-1"
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
        "priceRevision": "openrouter-2026-10-08-candidate",
        "boundRevision": "text-8192-512-schema-v2"
      }
    }
  },
  {
    "policyId": "cortex-conversation-title-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "conversation.title",
    "rules": {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "pins": {
        "priceRevision": "gateway-2026-10-09-observed-default",
        "boundRevision": "title-8192-512-observed-20261009"
      }
    }
  },
  {
    "policyId": "cortex-facts-resolution-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "facts.resolve",
    "rules": {
      "pins": {
        "schemaVersion": "conflicts-v1",
        "promptVersion": "memory-schema-prompt-v2",
        "boundRevision": "text-8192-512-schema-v2"
      }
    }
  },
  {
    "policyId": "cortex-agent-response-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "agent.respond",
    "rules": {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "pins": {
        "boundRevision": "agent-tools-v2-32768-256-shared3m-v1",
        "toolRegistryVersion": "cortex-media-tools-v2",
        "priceRevision": "openrouter-2026-10-08-candidate"
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
    "policyId": "cortex-image-generation-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "media.image.generate",
    "rules": {
      "modelId": "openai/gpt-image-1",
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
        "priceRevision": "convex-gateway-2026-10-08-image-low",
        "boundRevision": "media-image-1024-low-png-shared3m-v1",
        "toolRegistryVersion": "none-v1"
      }
    }
  },
  {
    "policyId": "cortex-memory-extract-observed-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "memory.extract",
    "rules": {
      "pins": {
        "priceRevision": "gateway-2026-10-09-observed-default",
        "boundRevision": "text-8192-512-schema-observed-20261009"
      }
    }
  },
  {
    "policyId": "cortex-embedding-memory-observed-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "embedding.memory",
    "rules": {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "pins": {
        "priceRevision": "gateway-2026-10-09-observed-default",
        "boundRevision": "small-8192-1536-observed-20261009"
      }
    }
  },
  {
    "policyId": "cortex-embedding-query-observed-v14",
    "version": 14,
    "scope": "deployment",
    "operationKey": "embedding.query",
    "rules": {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "pins": {
        "priceRevision": "gateway-2026-10-09-observed-default",
        "boundRevision": "small-8192-1536-observed-20261009"
      }
    }
  }
],
  qualifications: [...DEFAULT_GATEWAY_POLICY_MANIFEST.qualifications, {
  "receiptId": "ACTUAL-agent-v2-generate-stream-20261009",
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
    "provenance": "Actual V2 stream/generate acbf6761b494268c5292dc5a961a4056fd1b60887e64e24a3dea9e126e980859; five tools,100000 full-call ceiling,no retries; USD unavailable,incurred uncertainty retained."
  },
  "priceRevision": "openrouter-2026-10-08-candidate",
  "boundRevision": "agent-tools-v2-32768-256-shared3m-v1"
},
{
  "receiptId": "ACTUAL-image-v4-requested-only-20261009",
  "modelId": "openai/gpt-image-1",
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
    "provenance": "Actual ImageModelV4 34e95f16f5a7a2c0acbda094299d0dc4a8f3a44502acc317d558366cf36e434a; n1/1024/low/png,requested-only identity; USD unavailable,full2000000 retained,no new request."
  },
  "priceRevision": "convex-gateway-2026-10-08-image-low",
  "boundRevision": "media-image-1024-low-png-shared3m-v1"
},
{
  "receiptId": "ACTUAL-memory-extract-20261009",
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
    "provenance": "Actual memory.extract 68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d; unchanged native bounds,100000 full-call ceiling; USD unavailable,incurred liabilities retained,no new request.",
    "coversAllProviderCharges": true
  },
  "priceRevision": "gateway-2026-10-09-observed-default",
  "boundRevision": "text-8192-512-schema-observed-20261009"
},
{
  "receiptId": "ACTUAL-small1536-memory-query-20261009",
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
    "provenance": "Actual embedding.memory+embedding.query 68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d; unchanged native bounds,100000 full-call ceiling; USD unavailable,incurred liabilities retained,no new request.",
    "coversAllProviderCharges": true
  },
  "priceRevision": "gateway-2026-10-09-observed-default",
  "boundRevision": "small-8192-1536-observed-20261009"
},
{
  "receiptId": "ACTUAL-ci-conversation-title-20261009",
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
    "provenance": "Actual CI title e998d452fef1275b5be784bda1ea35d1fbba71912f469a430951198a5e980ad7; unchanged plain native bounds,100000 full-call ceiling; USD unavailable,incurred liability retained,no new request.",
    "coversAllProviderCharges": true
  },
  "priceRevision": "gateway-2026-10-09-observed-default",
  "boundRevision": "title-8192-512-observed-20261009"
}],
  dispatchEvidence: [...DEFAULT_GATEWAY_POLICY_MANIFEST.dispatchEvidence, ...[
  {
    "receiptId": "ACTUAL-agent-v2-generate-stream-20261009",
    "modelId": "openai/gpt-4o-mini",
    "nativeInterface": "chat",
    "evidenceHash": "acbf6761b494268c5292dc5a961a4056fd1b60887e64e24a3dea9e126e980859",
    "providerVersion": "0.2.1",
    "priceRevision": "openrouter-2026-10-08-candidate",
    "boundRevision": "agent-tools-v2-32768-256-shared3m-v1",
    "checkedAt": 1791509851763,
    "expiresAt": 1791596251763,
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
      "proofHash": "acbf6761b494268c5292dc5a961a4056fd1b60887e64e24a3dea9e126e980859",
      "documentHash": "8fd2c39370d93acb0a22b671bb074c3599ed3de2d01061bf19c2919d2dfbcdd3",
      "nativeTransformHash": "e83975a54a65c33a60bf4d6b41546cf6725b143cb44f5e230c9db5353e54d08b"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 256,
      "maximumEmbeddingValues": 1,
      "proofHash": "acbf6761b494268c5292dc5a961a4056fd1b60887e64e24a3dea9e126e980859"
    }
  },
  {
    "receiptId": "ACTUAL-image-v4-requested-only-20261009",
    "modelId": "openai/gpt-image-1",
    "nativeInterface": "image",
    "evidenceHash": "34e95f16f5a7a2c0acbda094299d0dc4a8f3a44502acc317d558366cf36e434a",
    "providerVersion": "0.2.1",
    "priceRevision": "convex-gateway-2026-10-08-image-low",
    "boundRevision": "media-image-1024-low-png-shared3m-v1",
    "checkedAt": 1791505052086,
    "expiresAt": 1791591452086,
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "mediaContract": {
      "version": 1,
      "options": {
        "kind": "image",
        "n": 1,
        "size": "1024x1024",
        "quality": "low",
        "outputFormat": "png"
      },
      "inputProtocol": "none",
      "maximumInputAssetBytes": 0,
      "maximumResultBytes": 20000000,
      "callbacks": false,
      "terminalIdentity": "requested-only",
      "usage": "optional"
    },
    "inputBound": {
      "ruleId": "media-native-utf8-v1",
      "revision": 1,
      "featureEnvelope": "media-image-v1",
      "proofHash": "34e95f16f5a7a2c0acbda094299d0dc4a8f3a44502acc317d558366cf36e434a",
      "documentHash": "251ae6fcfcefac6fe253d90c843d12e7d2da787ba57347bd449bc1af9d3ab239",
      "nativeTransformHash": "da0004cdbf6bedcee67525f09e9e1abc4b1258b4aae04e4710e20cc756e218a8"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 0,
      "maximumEmbeddingValues": 1,
      "proofHash": "34e95f16f5a7a2c0acbda094299d0dc4a8f3a44502acc317d558366cf36e434a"
    }
  },
  {
    "receiptId": "ACTUAL-memory-extract-20261009",
    "modelId": "openai/gpt-4o-mini",
    "nativeInterface": "chat",
    "evidenceHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d",
    "providerVersion": "0.2.1",
    "priceRevision": "gateway-2026-10-09-observed-default",
    "boundRevision": "text-8192-512-schema-observed-20261009",
    "checkedAt": 1791533384235,
    "expiresAt": 1791619784235,
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "inputBound": {
      "ruleId": "plain-chat-cookbook-utf8-v1",
      "featureEnvelope": "plain-chat-v1",
      "revision": 1,
      "proofHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d",
      "documentHash": "cd1d1897380273728e11c1efcdb311ea6675677cf583ae5b9d1f8a5798ba8eaf",
      "nativeTransformHash": "e83975a54a65c33a60bf4d6b41546cf6725b143cb44f5e230c9db5353e54d08b"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 512,
      "maximumEmbeddingValues": 1,
      "proofHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d"
    }
  },
  {
    "receiptId": "ACTUAL-small1536-memory-query-20261009",
    "modelId": "openai/text-embedding-3-small",
    "nativeInterface": "embedding",
    "evidenceHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d",
    "providerVersion": "0.2.1",
    "priceRevision": "gateway-2026-10-09-observed-default",
    "boundRevision": "small-8192-1536-observed-20261009",
    "checkedAt": 1791533388910,
    "expiresAt": 1791619788910,
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "inputBound": {
      "ruleId": "default-embedding-utf8-v1",
      "featureEnvelope": "default-embedding-v1",
      "revision": 1,
      "proofHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d",
      "documentHash": "cd1d1897380273728e11c1efcdb311ea6675677cf583ae5b9d1f8a5798ba8eaf",
      "nativeTransformHash": "e83975a54a65c33a60bf4d6b41546cf6725b143cb44f5e230c9db5353e54d08b"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 0,
      "maximumEmbeddingValues": 1,
      "proofHash": "68eff3b251cda876d945e37b08a08b5cf98327ee6eff3cfa3cede396131e927d"
    },
    "terminalModelId": "text-embedding-3-small"
  },
  {
    "receiptId": "ACTUAL-ci-conversation-title-20261009",
    "modelId": "openai/gpt-4o",
    "nativeInterface": "chat",
    "evidenceHash": "e998d452fef1275b5be784bda1ea35d1fbba71912f469a430951198a5e980ad7",
    "providerVersion": "0.2.1",
    "priceRevision": "gateway-2026-10-09-observed-default",
    "boundRevision": "title-8192-512-observed-20261009",
    "checkedAt": 1791526119789,
    "expiresAt": 1791612519789,
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "inputBound": {
      "ruleId": "plain-chat-cookbook-utf8-v1",
      "featureEnvelope": "plain-chat-v1",
      "revision": 1,
      "proofHash": "e998d452fef1275b5be784bda1ea35d1fbba71912f469a430951198a5e980ad7",
      "documentHash": "cd1d1897380273728e11c1efcdb311ea6675677cf583ae5b9d1f8a5798ba8eaf",
      "nativeTransformHash": "71b3502ff7b878a4339e3617aa936ad06d56cc44a0d28e373a91dcec7d4d36ef"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 512,
      "maximumEmbeddingValues": 1,
      "proofHash": "e998d452fef1275b5be784bda1ea35d1fbba71912f469a430951198a5e980ad7"
    }
  }
]],
} as const satisfies DeploymentPolicyManifest;

/** Policy-selector correction only: the existing generic plain-chat proof covers
 * ordinary bounded text and structured content, including conflict decisions.
 * Operation-specific semantic schemas, prompts and output parsers are unchanged.
 * No proof, expiry, price attestation or historical financial root is rewritten.
 */
export const OBSERVED_GATEWAY_POLICY_MANIFEST_V15 = {
  ...OBSERVED_GATEWAY_POLICY_MANIFEST_V14,
  revision: 15,
  artifactRevision: "c6dbe992f64330991e652c34da2522fae2f1af6970fd3d9de8f39bf2568e0a58",
  evidenceHash: "c6dbe992f64330991e652c34da2522fae2f1af6970fd3d9de8f39bf2568e0a58",
  acceptanceHash: "c6dbe992f64330991e652c34da2522fae2f1af6970fd3d9de8f39bf2568e0a58",
  policies: OBSERVED_GATEWAY_POLICY_MANIFEST_V14.policies.map(policy => {
    // Policy rows are immutable within their financial root. Give unchanged
    // rules successor identities so installing V15 never rewrites V14 rows.
    const successor = { ...policy, policyId: policy.policyId.replace(/-v14$/, "-v15"), version: 15 };
    if ("operationKey" in policy && policy.operationKey !== "facts.resolve") return successor;
    return {
      ...successor,
      rules: {
        ...policy.rules,
        pins: {
          ...policy.rules.pins,
          priceRevision: "gateway-2026-10-09-observed-default",
          boundRevision: "text-8192-512-schema-observed-20261009",
        },
      },
    };
  }),
} as const satisfies DeploymentPolicyManifest;

/** Versioned extraction clarity only. V15/V14 and every genuine proof remain
 * immutable; the unchanged full-request plain-chat envelope covers these bytes.
 * Strict response parsing, conflict semantics and all other selectors stay intact.
 */
export const OBSERVED_GATEWAY_POLICY_MANIFEST_V16 = {
  ...OBSERVED_GATEWAY_POLICY_MANIFEST_V15,
  revision: 16,
  artifactRevision: "7535ae57928ece80905bc9edadcf483ace240b8d375104c8c54bfb767fbb13f5",
  evidenceHash: "7535ae57928ece80905bc9edadcf483ace240b8d375104c8c54bfb767fbb13f5",
  acceptanceHash: "7535ae57928ece80905bc9edadcf483ace240b8d375104c8c54bfb767fbb13f5",
  policies: OBSERVED_GATEWAY_POLICY_MANIFEST_V15.policies.map(policy => {
    const successor = { ...policy, policyId: policy.policyId.replace(/-v15$/, "-v16"), version: 16 };
    if (!("operationKey" in policy) || policy.operationKey !== "memory.extract") return successor;
    return { ...successor, rules: { ...policy.rules, pins: { ...policy.rules.pins,
      promptVersion: "memory-extraction-instance-prompt-v3" } } };
  }),
} as const satisfies DeploymentPolicyManifest;

/** Reviewed source framing successor; the evidence hash binds the read-only
 * invalid-output analysis, not a new native JSON capability or syntax guarantee.
 * V16 and older prompt requests, accounting roots and actual proofs stay exact.
 */
export const OBSERVED_GATEWAY_POLICY_MANIFEST_V17 = {
  ...OBSERVED_GATEWAY_POLICY_MANIFEST_V16,
  revision: 17,
  artifactRevision: "d2aa058ea9d2ed73281b1f6ccc3a4a808d5ac33462718261d98e55f852a75776",
  evidenceHash: "d2aa058ea9d2ed73281b1f6ccc3a4a808d5ac33462718261d98e55f852a75776",
  acceptanceHash: "d2aa058ea9d2ed73281b1f6ccc3a4a808d5ac33462718261d98e55f852a75776",
  policies: OBSERVED_GATEWAY_POLICY_MANIFEST_V16.policies.map(policy => {
    const successor = { ...policy, policyId: policy.policyId.replace(/-v16$/, "-v17"), version: 17 };
    if (!("operationKey" in policy) || policy.operationKey !== "memory.extract") return successor;
    return { ...successor, rules: { ...policy.rules, pins: { ...policy.rules.pins,
      promptVersion: "memory-extraction-framed-prompt-v4" } } };
  }),
} as const satisfies DeploymentPolicyManifest;

/** Genuine K6 successor: seven immutable proof groups cover eight actual methods.
 * V17 remains exact history. Receipt IDs/hashes, original dates/finite expiry,
 * unavailable USD cost and full UNKNOWN ceilings are copied without renewal.
 * JSON extraction selects the observed v5 closed envelope, with no tools.
 */
export const OBSERVED_GATEWAY_POLICY_MANIFEST_V18 = {
  ...OBSERVED_GATEWAY_POLICY_MANIFEST_V17,
  revision: 18,
  artifactRevision: "6df226b98503a03cf2a43fe933004cfb1976eeee2e89def4db62f14815f0e944",
  evidenceHash: "f6ec2415a109e0d34a1283dd51a6272e30462652b70604e7b649f21110add95a",
  acceptanceHash: "42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29",
  policies: [
  {
    "policyId": "cortex-model-defaults-v18",
    "version": 18,
    "scope": "deployment",
    "rules": {
      "allowedModels": [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "openai/text-embedding-3-small",
        "openai/text-embedding-3-large",
        "openai/gpt-image-1"
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
        "boundRevision": "manual-plain-8192-512",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  },
  {
    "policyId": "cortex-conversation-title-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "conversation.title",
    "rules": {
      "modelId": "openai/gpt-4o",
      "nativeInterface": "chat",
      "pins": {
        "boundRevision": "manual-title-8192-512",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  },
  {
    "policyId": "cortex-facts-resolution-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "facts.resolve",
    "rules": {
      "pins": {
        "schemaVersion": "conflicts-v1",
        "promptVersion": "memory-schema-prompt-v2",
        "boundRevision": "manual-plain-8192-512",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  },
  {
    "policyId": "cortex-agent-response-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "agent.respond",
    "rules": {
      "modelId": "openai/gpt-4o-mini",
      "nativeInterface": "chat",
      "pins": {
        "boundRevision": "manual-agent-v2-32768-256",
        "toolRegistryVersion": "cortex-media-tools-v2",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "policyId": "cortex-image-generation-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "media.image.generate",
    "rules": {
      "modelId": "openai/gpt-image-1",
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
        "boundRevision": "manual-image-1024-low-png",
        "toolRegistryVersion": "none-v1",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  },
  {
    "policyId": "cortex-memory-extract-observed-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "memory.extract",
    "rules": {
      "pins": {
        "boundRevision": "memory-json-object-8192-512-v1",
        "promptVersion": "memory-extraction-json-object-prompt-v5",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      },
      "allowedTools": []
    }
  },
  {
    "policyId": "cortex-embedding-memory-observed-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "embedding.memory",
    "rules": {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "pins": {
        "boundRevision": "manual-small-8192-1536",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  },
  {
    "policyId": "cortex-embedding-query-observed-v18",
    "version": 18,
    "scope": "deployment",
    "operationKey": "embedding.query",
    "rules": {
      "modelId": "openai/text-embedding-3-small",
      "nativeInterface": "embedding",
      "pins": {
        "boundRevision": "manual-small-8192-1536",
        "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
      }
    }
  }
],
  qualifications: [...OBSERVED_GATEWAY_POLICY_MANIFEST_V17.qualifications, {
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
    "provenance": "Actual native=69d815d7e2d271204bda1098d08bacf4f46993dd812fd1171d210feab86a045e; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review.",
    "coversAllProviderCharges": true
  },
  "boundRevision": "manual-plain-8192-512",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-0",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "provenance": "Actual native=447dd9127c828fb3a33676c111f3ab7619457bc1d2d46b6901709cc8af427e4e; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review.",
    "coversAllProviderCharges": true
  },
  "boundRevision": "manual-title-8192-512",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-1",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "provenance": "Actual native=0dc8ba0a63e73ffd804cf652700e9b47e8390508c15db6f27301b551fef8dd3a; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review.",
    "coversAllProviderCharges": true
  },
  "boundRevision": "manual-small-8192-1536",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-2",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "provenance": "Actual native=df75e40a0cc436ae8060ac2dce9212be715f19d110d28c595877c5989bdb15c4; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review."
  },
  "boundRevision": "manual-large-8192-3072",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-3",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "provenance": "Actual native=260b5b73fe17ec2f007c4dade4f5de3a22a4ba692b2304788b0694d35b9a315d; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review."
  },
  "boundRevision": "manual-agent-v2-32768-256",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-4",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
},
{
  "modelId": "openai/gpt-image-1",
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
    "provenance": "Actual native=fc3fd79d1e3991ce1a00f38735bbb6e627053bc74a71cffad89cecdd0cae1ac3; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=2000000microUSD; retries0; automatic evaluation, no per-run human review."
  },
  "boundRevision": "manual-image-1024-low-png",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-5",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
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
    "provenance": "Actual native=d1b0aadf6ca662fb5a2c31b7040c9e0ef3738d060927bdb07e23a4c886a8af03; procedure=42d6837ed13f3178c138be449e47733ae8c4d7e5ce7eee66e0c6f3457091da29; full unknown=100000microUSD; retries0; automatic evaluation, no per-run human review.",
    "coversAllProviderCharges": true
  },
  "boundRevision": "memory-json-object-8192-512-v1",
  "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-6",
  "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b"
}],
  dispatchEvidence: [...OBSERVED_GATEWAY_POLICY_MANIFEST_V17.dispatchEvidence, ...[
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
      "proofHash": "69d815d7e2d271204bda1098d08bacf4f46993dd812fd1171d210feab86a045e",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "039338854227878c17af1220d1a0121818702fd1e603f88f8e9b2224d23dbb5f"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 512,
      "maximumEmbeddingValues": 1,
      "proofHash": "69d815d7e2d271204bda1098d08bacf4f46993dd812fd1171d210feab86a045e"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-0",
    "evidenceHash": "69d815d7e2d271204bda1098d08bacf4f46993dd812fd1171d210feab86a045e",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879332795,
    "expiresAt": 1792484091111
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
      "proofHash": "447dd9127c828fb3a33676c111f3ab7619457bc1d2d46b6901709cc8af427e4e",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "039338854227878c17af1220d1a0121818702fd1e603f88f8e9b2224d23dbb5f"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 512,
      "maximumEmbeddingValues": 1,
      "proofHash": "447dd9127c828fb3a33676c111f3ab7619457bc1d2d46b6901709cc8af427e4e"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-1",
    "evidenceHash": "447dd9127c828fb3a33676c111f3ab7619457bc1d2d46b6901709cc8af427e4e",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879335661,
    "expiresAt": 1792484091111
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
      "proofHash": "0dc8ba0a63e73ffd804cf652700e9b47e8390508c15db6f27301b551fef8dd3a",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "0dfdcdf7ea7223d340cb280f8b20f7fea364c5af6a199d646e4284825e600b0e"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 0,
      "maximumEmbeddingValues": 1,
      "proofHash": "0dc8ba0a63e73ffd804cf652700e9b47e8390508c15db6f27301b551fef8dd3a"
    },
    "terminalModelId": "text-embedding-3-small",
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-2",
    "evidenceHash": "0dc8ba0a63e73ffd804cf652700e9b47e8390508c15db6f27301b551fef8dd3a",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879338395,
    "expiresAt": 1792484091111
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
      "proofHash": "df75e40a0cc436ae8060ac2dce9212be715f19d110d28c595877c5989bdb15c4",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "0dfdcdf7ea7223d340cb280f8b20f7fea364c5af6a199d646e4284825e600b0e"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 131072,
      "maximumOutputTokens": 0,
      "maximumEmbeddingValues": 1,
      "proofHash": "df75e40a0cc436ae8060ac2dce9212be715f19d110d28c595877c5989bdb15c4"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-3",
    "evidenceHash": "df75e40a0cc436ae8060ac2dce9212be715f19d110d28c595877c5989bdb15c4",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879341416,
    "expiresAt": 1792484091111
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
      "proofHash": "260b5b73fe17ec2f007c4dade4f5de3a22a4ba692b2304788b0694d35b9a315d",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "039338854227878c17af1220d1a0121818702fd1e603f88f8e9b2224d23dbb5f"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 256,
      "maximumEmbeddingValues": 1,
      "proofHash": "260b5b73fe17ec2f007c4dade4f5de3a22a4ba692b2304788b0694d35b9a315d"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-4",
    "evidenceHash": "260b5b73fe17ec2f007c4dade4f5de3a22a4ba692b2304788b0694d35b9a315d",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879344474,
    "expiresAt": 1792484091111
  },
  {
    "modelId": "openai/gpt-image-1",
    "nativeInterface": "image",
    "providerVersion": "0.2.1",
    "boundRevision": "manual-image-1024-low-png",
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "mediaContract": {
      "version": 1,
      "options": {
        "kind": "image",
        "n": 1,
        "size": "1024x1024",
        "quality": "low",
        "outputFormat": "png"
      },
      "inputProtocol": "none",
      "maximumInputAssetBytes": 0,
      "maximumResultBytes": 20000000,
      "callbacks": false,
      "terminalIdentity": "requested-only",
      "usage": "optional"
    },
    "inputBound": {
      "ruleId": "media-native-utf8-v1",
      "revision": 1,
      "featureEnvelope": "media-image-v1",
      "proofHash": "fc3fd79d1e3991ce1a00f38735bbb6e627053bc74a71cffad89cecdd0cae1ac3",
      "documentHash": "b5b31ac01122e00bc3445ab6edab7069a19dd0c144c51121d0983889f248cd4e",
      "nativeTransformHash": "cbe6ac92ea9a7ccb1a8fae426488af8a885bcbd5d490fe60a8cf69c68bff3233"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 0,
      "maximumEmbeddingValues": 1,
      "proofHash": "fc3fd79d1e3991ce1a00f38735bbb6e627053bc74a71cffad89cecdd0cae1ac3"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-5",
    "evidenceHash": "fc3fd79d1e3991ce1a00f38735bbb6e627053bc74a71cffad89cecdd0cae1ac3",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879363884,
    "expiresAt": 1792484091111
  },
  {
    "modelId": "openai/gpt-4o-mini",
    "nativeInterface": "chat",
    "providerVersion": "0.2.1",
    "boundRevision": "memory-json-object-8192-512-v1",
    "terminalCost": "unavailable",
    "terminalProof": "provider-terminal-v1",
    "inputBound": {
      "ruleId": "memory-json-object-chat-utf8-v1",
      "revision": 1,
      "featureEnvelope": "memory-extract-json-object-v1",
      "proofHash": "d1b0aadf6ca662fb5a2c31b7040c9e0ef3738d060927bdb07e23a4c886a8af03",
      "documentHash": "ef09dfa49a4dd30c844d8b349ebb8a49e37f196e8194cdeac2c0f0955ea2ee5c",
      "nativeTransformHash": "039338854227878c17af1220d1a0121818702fd1e603f88f8e9b2224d23dbb5f"
    },
    "resultBound": {
      "maximumPrivateResultBytes": 60000,
      "maximumOutputTokens": 512,
      "maximumEmbeddingValues": 1,
      "proofHash": "d1b0aadf6ca662fb5a2c31b7040c9e0ef3738d060927bdb07e23a4c886a8af03"
    },
    "receiptId": "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-6",
    "evidenceHash": "d1b0aadf6ca662fb5a2c31b7040c9e0ef3738d060927bdb07e23a4c886a8af03",
    "priceRevision": "sandbox-current-prices-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b",
    "checkedAt": 1791879328790,
    "expiresAt": 1792484091111
  }
]],
} as const satisfies DeploymentPolicyManifest;
