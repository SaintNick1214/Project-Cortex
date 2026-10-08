/** Closed canonical assembly. Source text is data; no project module is loaded. */
import fs from "node:fs";
import path from "node:path";
import {
  assertSafePath,
  hashBytes,
  planBackendSync,
  readBackendProjectFile,
  type ProspectiveBackendFiles,
  type BackendSdkView,
  type BackendPlan,
} from "./schema-sync.js";

export type CanonicalTemplate = "vercel-ai-quickstart" | "chat-sdk";
export const REGISTRATION_SHIM =
  'export {\n  internalQuery as query,\n  internalMutation as mutation,\n  internalAction as action,\n  internalQuery,\n  internalMutation,\n  internalAction,\n} from "./_generated/server";\nexport type { QueryCtx, MutationCtx } from "./_generated/server";\n';
export const SCHEMA_COMPOSER =
  '// Managed canonical composition v1. App and SDK update channels are independent.\nimport { defineSchema } from "convex/server";\nimport cortexSchema from "./cortex.schema";\nimport appSchema from "./app.schema";\n\nif (cortexSchema.schemaValidation !== true || appSchema.schemaValidation !== true) {\n  throw new Error("Canonical schemas must enable schema validation");\n}\nfor (const name of Object.keys(cortexSchema.tables)) {\n  if (Object.prototype.hasOwnProperty.call(appSchema.tables, name)) {\n    throw new Error(`Duplicate canonical table: ${name}`);\n  }\n}\nexport default defineSchema(\n  { ...cortexSchema.tables, ...appSchema.tables },\n  { schemaValidation: true, strictTableNameTypes: true },\n);\n';

/** Only the previously reviewed v1 composer and its ES2021-compatible successor. */
export function isRecognizedSchemaComposerHash(value: unknown): boolean {
  return value === hashBytes(SCHEMA_COMPOSER) ||
    value === "747591d346a34e72a347b6bcf7742c206c9e6cf232f61ec267f47730c26b7438";
}
interface SourceContract {
  hash: string;
  imports: {
    statement: string;
    start: number;
    end: number;
    typeOnly: boolean;
    origin: string;
  }[];
  operations: { name: string; builder: string }[];
}
// Fixed reviewed candidate, not supplied by a target project or inferred from package name.
// Changed candidate bytes require review/reconciliation, not self-asserted contract metadata.
const SDK_CONTRACT: Record<string, SourceContract> = {
  "a2a.ts": {
    "hash": "33319d245a65c5021545a41739cdbd1c7324c7c21511aa38f15fbe5b2dccd941",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 655,
        "end": 709,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "send",
        "builder": "mutation"
      },
      {
        "name": "request",
        "builder": "mutation"
      },
      {
        "name": "broadcast",
        "builder": "mutation"
      },
      {
        "name": "getConversation",
        "builder": "query"
      }
    ]
  },
  "admin.ts": {
    "hash": "e99cb954e5f805feb42e5f19e43f9b9eeb312263de1b3a3b42aba92f66b9ee6c",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 401,
        "end": 471,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "listTable",
        "builder": "internalQuery"
      },
      {
        "name": "deleteRecord",
        "builder": "internalMutation"
      },
      {
        "name": "clearTable",
        "builder": "internalMutation"
      },
      {
        "name": "countTable",
        "builder": "internalQuery"
      },
      {
        "name": "getAllCounts",
        "builder": "internalQuery"
      }
    ]
  },
  "agents.ts": {
    "hash": "1c91db820f7a2903b4b4716cb0aa0e07614ad9d9b421a66381ff0f10bf3802b9",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 204,
        "end": 258,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "exists",
        "builder": "query"
      },
      {
        "name": "computeStats",
        "builder": "query"
      },
      {
        "name": "register",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "updateMany",
        "builder": "mutation"
      },
      {
        "name": "unregister",
        "builder": "mutation"
      },
      {
        "name": "unregisterMany",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      }
    ]
  },
  "artifacts.ts": {
    "hash": "9cbd95674342a9f83b7cd979a80a442aa1d8ce21fded63f4fdca379143b616fe",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 637,
        "end": 681,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "deleteArtifact",
        "builder": "mutation"
      },
      {
        "name": "undo",
        "builder": "mutation"
      },
      {
        "name": "redo",
        "builder": "mutation"
      },
      {
        "name": "setStreamingState",
        "builder": "mutation"
      },
      {
        "name": "setFileRef",
        "builder": "mutation"
      },
      {
        "name": "purgeVersions",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "getByConversation",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getVersion",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "startStreaming",
        "builder": "mutation"
      },
      {
        "name": "appendContent",
        "builder": "mutation"
      },
      {
        "name": "pauseStreaming",
        "builder": "mutation"
      },
      {
        "name": "resumeStreaming",
        "builder": "mutation"
      },
      {
        "name": "cancelStreaming",
        "builder": "mutation"
      },
      {
        "name": "finalizeStreaming",
        "builder": "mutation"
      },
      {
        "name": "setStreamingError",
        "builder": "mutation"
      },
      {
        "name": "retryFromError",
        "builder": "mutation"
      },
      {
        "name": "generateArtifactUploadUrl",
        "builder": "mutation"
      },
      {
        "name": "completeArtifactUpload",
        "builder": "mutation"
      },
      {
        "name": "getArtifactFileUrl",
        "builder": "query"
      },
      {
        "name": "detachFile",
        "builder": "mutation"
      }
    ]
  },
  "attachments.ts": {
    "hash": "6296ca35a2123796feade05e1d64618bf5e1aea6e9523abb798d8013a7bfca12",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 595,
        "end": 649,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "generateUploadUrl",
        "builder": "mutation"
      },
      {
        "name": "attach",
        "builder": "mutation"
      },
      {
        "name": "remove",
        "builder": "mutation"
      },
      {
        "name": "removeMany",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "getUrl",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getByIds",
        "builder": "query"
      },
      {
        "name": "getByConversation",
        "builder": "query"
      },
      {
        "name": "getByMessage",
        "builder": "query"
      }
    ]
  },
  "contexts.ts": {
    "hash": "daaf3ac1d8eeb153517f42f7b018fa4b83eb649f2d472816166100c1e643784b",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 326,
        "end": 370,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "deleteContext",
        "builder": "mutation"
      },
      {
        "name": "addParticipant",
        "builder": "mutation"
      },
      {
        "name": "grantAccess",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getChain",
        "builder": "query"
      },
      {
        "name": "getRoot",
        "builder": "query"
      },
      {
        "name": "getChildren",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "updateMany",
        "builder": "mutation"
      },
      {
        "name": "deleteMany",
        "builder": "mutation"
      },
      {
        "name": "removeParticipant",
        "builder": "mutation"
      },
      {
        "name": "getByConversation",
        "builder": "query"
      },
      {
        "name": "findOrphaned",
        "builder": "query"
      },
      {
        "name": "getVersion",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "getAtTimestamp",
        "builder": "query"
      },
      {
        "name": "exportContexts",
        "builder": "query"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      }
    ]
  },
  "conversations.ts": {
    "hash": "aac7aac5e45cc5dff1e5f44dcb337b8e4511fe78f71c5264ad6088f3acb51a89",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 852,
        "end": 896,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "setVisibility",
        "builder": "mutation"
      },
      {
        "name": "setMetadata",
        "builder": "mutation"
      },
      {
        "name": "checkAccess",
        "builder": "query"
      },
      {
        "name": "addMessage",
        "builder": "mutation"
      },
      {
        "name": "approveMessage",
        "builder": "mutation"
      },
      {
        "name": "rejectMessage",
        "builder": "mutation"
      },
      {
        "name": "deleteConversation",
        "builder": "mutation"
      },
      {
        "name": "deleteMany",
        "builder": "mutation"
      },
      {
        "name": "deleteByIds",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "getMessage",
        "builder": "query"
      },
      {
        "name": "getMessagesByIds",
        "builder": "query"
      },
      {
        "name": "getOrCreate",
        "builder": "mutation"
      },
      {
        "name": "findConversation",
        "builder": "query"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "exportConversations",
        "builder": "query"
      },
      {
        "name": "domainPage",
        "builder": "query"
      },
      {
        "name": "eraseSelected",
        "builder": "mutation"
      }
    ]
  },
  "conversationShares.ts": {
    "hash": "8bb508d14cf61ce85c9e4b9f5b83c3270875b974efda3a0bf33fe75a9f4341c2",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 277,
        "end": 331,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "revoke",
        "builder": "mutation"
      },
      {
        "name": "incrementViewCount",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "listByConversation",
        "builder": "query"
      },
      {
        "name": "listByGranter",
        "builder": "query"
      },
      {
        "name": "checkAccess",
        "builder": "query"
      }
    ]
  },
  "conversationSnapshots.ts": {
    "hash": "c2121d598367fcce917237832efc103d7ddf53f762af7401fa5e8481003bc890",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 305,
        "end": 359,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "deleteSnapshot",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "listByConversation",
        "builder": "query"
      },
      {
        "name": "listByUser",
        "builder": "query"
      }
    ]
  },
  "domainErasure.ts": {
    "hash": "c54a56843be91579b7716f0ca1eb22e5cb3a7a84493429a59d4bf9b18debb78a",
    "imports": [
      {
        "statement": "import { internalQuery, internalMutation, type QueryCtx, type MutationCtx } from \"./_generated/server\";",
        "start": 97,
        "end": 200,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "discoverPage",
        "builder": "internalQuery"
      },
      {
        "name": "verifyPage",
        "builder": "internalQuery"
      },
      {
        "name": "checkRecord",
        "builder": "internalQuery"
      },
      {
        "name": "checkBinaryReferences",
        "builder": "internalQuery"
      },
      {
        "name": "getReceiptPage",
        "builder": "internalQuery"
      },
      {
        "name": "eraseRecord",
        "builder": "internalMutation"
      },
      {
        "name": "purgeExpiredReceiptsPage",
        "builder": "internalMutation"
      }
    ]
  },
  "factHistory.ts": {
    "hash": "ed0e6f9bbc0346e39fdb6a014d69a021ddaef7d7647743ddc513519341810190",
    "imports": [
      {
        "statement": "import { internalMutation, mutation, query } from \"./_generated/server\";",
        "start": 254,
        "end": 326,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 327,
        "end": 392,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "page",
        "builder": "query"
      },
      {
        "name": "logEvent",
        "builder": "mutation"
      },
      {
        "name": "getOperationReceipt",
        "builder": "query"
      },
      {
        "name": "publishPendingEvent",
        "builder": "mutation"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "getEvent",
        "builder": "query"
      },
      {
        "name": "getChangesByTimeRange",
        "builder": "query"
      },
      {
        "name": "countByAction",
        "builder": "query"
      },
      {
        "name": "getActivitySummary",
        "builder": "query"
      },
      {
        "name": "deleteByFactId",
        "builder": "mutation"
      },
      {
        "name": "deleteByUserId",
        "builder": "mutation"
      },
      {
        "name": "deleteByMemorySpace",
        "builder": "mutation"
      },
      {
        "name": "deleteByOwner",
        "builder": "mutation"
      },
      {
        "name": "purgeOldEvents",
        "builder": "mutation"
      },
      {
        "name": "chainPage",
        "builder": "query"
      },
      {
        "name": "getSupersessionChain",
        "builder": "query"
      },
      {
        "name": "migrateEvidence",
        "builder": "internalMutation"
      }
    ]
  },
  "facts.ts": {
    "hash": "3b31d062c8570ef347864d30fac36d39b40432501aa858e4ae5f83d3b32d2028",
    "imports": [
      {
        "statement": "import {\n  action,\n  internalQuery,\n \n  query,\n  type QueryCtx,\n} from \"./_generated/server\";",
        "start": 578,
        "end": 671,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "store",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "deleteFact",
        "builder": "mutation"
      },
      {
        "name": "supersede",
        "builder": "mutation"
      },
      {
        "name": "updateInPlace",
        "builder": "mutation"
      },
      {
        "name": "deleteMany",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "fetchFactsByIds",
        "builder": "internalQuery"
      },
      {
        "name": "semanticSearch",
        "builder": "action"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "queryBySubject",
        "builder": "query"
      },
      {
        "name": "queryByRelationship",
        "builder": "query"
      },
      {
        "name": "exportFacts",
        "builder": "query"
      },
      {
        "name": "consolidate",
        "builder": "mutation"
      },
      {
        "name": "findByStructure",
        "builder": "query"
      },
      {
        "name": "deleteByIds",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "candidatePage",
        "builder": "query"
      }
    ]
  },
  "governance.ts": {
    "hash": "33d0ca51e043edf076c80fa054e2a3697d212d4f8fcc5982817931848630864a",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 127,
        "end": 181,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "setPolicy",
        "builder": "mutation"
      },
      {
        "name": "setAgentOverride",
        "builder": "mutation"
      },
      {
        "name": "enforce",
        "builder": "mutation"
      },
      {
        "name": "getPolicy",
        "builder": "query"
      },
      {
        "name": "getTemplate",
        "builder": "query"
      },
      {
        "name": "simulate",
        "builder": "query"
      },
      {
        "name": "getComplianceReport",
        "builder": "query"
      },
      {
        "name": "getEnforcementStats",
        "builder": "query"
      },
      {
        "name": "purgeAllPolicies",
        "builder": "mutation"
      },
      {
        "name": "purgeAllEnforcement",
        "builder": "mutation"
      }
    ]
  },
  "graphSync.ts": {
    "hash": "4e3719309246602599d89013307f0489c665c7dbf15de71b917b0ff0e1dd0609",
    "imports": [
      {
        "statement": "import {mutation,query,internalMutation,internalQuery,type MutationCtx,type QueryCtx} from \"./_generated/server\";",
        "start": 200,
        "end": 313,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "getGraphJob",
        "builder": "query"
      },
      {
        "name": "queueForSync",
        "builder": "mutation"
      },
      {
        "name": "markSynced",
        "builder": "mutation"
      },
      {
        "name": "suppressJob",
        "builder": "mutation"
      },
      {
        "name": "markFailed",
        "builder": "mutation"
      },
      {
        "name": "getUnsyncedItems",
        "builder": "query"
      },
      {
        "name": "getHighPriorityItems",
        "builder": "query"
      },
      {
        "name": "getFailedItems",
        "builder": "query"
      },
      {
        "name": "getSyncStats",
        "builder": "query"
      },
      {
        "name": "deleteSyncItem",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "clearSyncedItems",
        "builder": "internalMutation"
      },
      {
        "name": "rebuildSourcePage",
        "builder": "internalQuery"
      },
      {
        "name": "rebuildEdgePage",
        "builder": "internalQuery"
      }
    ]
  },
  "immutable.ts": {
    "hash": "a96cc6360b3012f0a0fb160f0b2cad435434dc6a4046b5bbb589df5500201ae2",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 373,
        "end": 417,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "store",
        "builder": "mutation"
      },
      {
        "name": "purge",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "getVersion",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getAtTimestamp",
        "builder": "query"
      },
      {
        "name": "purgeMany",
        "builder": "mutation"
      },
      {
        "name": "purgeVersions",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      }
    ]
  },
  "lib/domainErasureScope.ts": {
    "hash": "63713a8f209b1c4bf90106afe3f950c91f07e9b6f93ecbf3666c3f689f8a53de",
    "imports": [
      {
        "statement": "import type { QueryCtx, MutationCtx } from \"../_generated/server\";",
        "start": 194,
        "end": 260,
        "typeOnly": true,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/domainPaging.ts": {
    "hash": "82052782fc4f62ef7ead568859269cb7b1bcfd293e27f4c2eda4f444cf7e374d",
    "imports": [
      {
        "statement": "import type { QueryCtx } from \"../_generated/server\";",
        "start": 213,
        "end": 266,
        "typeOnly": true,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/domainScope.ts": {
    "hash": "032dff75a4cc6b8f5191b43be5b681f7d1f5ef416ea2fa9bff406d3f70e44d71",
    "imports": [
      {
        "statement": "import type { QueryCtx } from \"../_generated/server\";",
        "start": 142,
        "end": 195,
        "typeOnly": true,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/factHistoryProvenance.ts": {
    "hash": "615586cf7906b69bdd2540297e1e8aa1a58e3e20a32ea4f44722281d51b010bc",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"../_generated/server\";",
        "start": 302,
        "end": 368,
        "typeOnly": true,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/graphSync.ts": {
    "hash": "af7d2d48d40cb6f7a7c005ee016ca60df5b2af72e5b31b8d5bc802916ce18e99",
    "imports": [
      {
        "statement": "import {mutation, type MutationCtx, type QueryCtx} from \"../_generated/server\";",
        "start": 213,
        "end": 292,
        "typeOnly": false,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/memoryVectorScope.ts": {
    "hash": "64b584bd0068f1010b46367b858ca959efdcf6fbd220ad605dc04fe9e7b3f406",
    "imports": [],
    "operations": []
  },
  "lib/referenceLifecycle.ts": {
    "hash": "d9dc12c84750bac127ddfeda0fc699f54b9f3f04f37ec38cc0aabd01f6ff12c4",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"../_generated/server\";",
        "start": 271,
        "end": 337,
        "typeOnly": true,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/userDataScope.ts": {
    "hash": "ed1007f71cd92cd72d933dacd040c10c458c8c5ca793a6f6fa66b3200d5a5a5a",
    "imports": [],
    "operations": []
  },
  "memories.ts": {
    "hash": "4d053490ebb62d808b31d7797018f93ae2069d76aef2bb8e1df1d1863f574916",
    "imports": [
      {
        "statement": "import { action, internalQuery, query, type MutationCtx } from \"./_generated/server\";",
        "start": 931,
        "end": 1016,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "store",
        "builder": "mutation"
      },
      {
        "name": "storePartialMemory",
        "builder": "mutation"
      },
      {
        "name": "updatePartialMemory",
        "builder": "mutation"
      },
      {
        "name": "finalizePartialMemory",
        "builder": "mutation"
      },
      {
        "name": "deleteMemory",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "fetchMemoriesByIds",
        "builder": "internalQuery"
      },
      {
        "name": "keywordSearchMemories",
        "builder": "internalQuery"
      },
      {
        "name": "vectorReadiness",
        "builder": "internalQuery"
      },
      {
        "name": "search",
        "builder": "action"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "getVersion",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "deleteMany",
        "builder": "mutation"
      },
      {
        "name": "deleteByIds",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      },
      {
        "name": "exportMemories",
        "builder": "query"
      },
      {
        "name": "updateMany",
        "builder": "mutation"
      },
      {
        "name": "archive",
        "builder": "mutation"
      },
      {
        "name": "restoreFromArchive",
        "builder": "mutation"
      },
      {
        "name": "getAtTimestamp",
        "builder": "query"
      },
      {
        "name": "domainPage",
        "builder": "query"
      },
      {
        "name": "eraseSelected",
        "builder": "mutation"
      }
    ]
  },
  "memorySpaces.ts": {
    "hash": "21473603c29c33ed0059015f87ba87f6c41226c5501ceec3104c8426a86c3c43",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 332,
        "end": 376,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "register",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "addParticipant",
        "builder": "mutation"
      },
      {
        "name": "removeParticipant",
        "builder": "mutation"
      },
      {
        "name": "archive",
        "builder": "mutation"
      },
      {
        "name": "reactivate",
        "builder": "mutation"
      },
      {
        "name": "deleteSpace",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getStats",
        "builder": "query"
      },
      {
        "name": "findByParticipant",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "updateParticipants",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      }
    ]
  },
  "mutable.ts": {
    "hash": "bfe9689a3abbfbd4f6649b1045e13a36bd56a50f81df5a1e71966c533b9cf8a6",
    "imports": [
      {
        "statement": "import { query } from \"./_generated/server\";",
        "start": 382,
        "end": 426,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "set",
        "builder": "mutation"
      },
      {
        "name": "update",
        "builder": "mutation"
      },
      {
        "name": "deleteKey",
        "builder": "mutation"
      },
      {
        "name": "purgeNamespace",
        "builder": "mutation"
      },
      {
        "name": "transaction",
        "builder": "mutation"
      },
      {
        "name": "purgeMany",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "exists",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "purgeAll",
        "builder": "mutation"
      }
    ]
  },
  "referenceMaintenance.ts": {
    "hash": "7120053107da7689115696b07d580e359e420ea68ec6aaaf016d75e7595a96cb",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 180,
        "end": 250,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { MutationCtx } from \"./_generated/server\";",
        "start": 286,
        "end": 341,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "status",
        "builder": "internalQuery"
      },
      {
        "name": "planPage",
        "builder": "internalQuery"
      },
      {
        "name": "startGeneration",
        "builder": "internalMutation"
      },
      {
        "name": "advanceBackfill",
        "builder": "internalMutation"
      },
      {
        "name": "beginFinalization",
        "builder": "internalMutation"
      },
      {
        "name": "advanceValidation",
        "builder": "internalMutation"
      },
      {
        "name": "activateGeneration",
        "builder": "internalMutation"
      },
      {
        "name": "abortFinalization",
        "builder": "internalMutation"
      }
    ]
  },
  "schema.ts": {
    "hash": "b39ee8dac35dd1f4abe3a38994a2b60f727c4a3a465a40a2386fdbf166bc372d",
    "imports": [],
    "operations": []
  },
  "sessions.ts": {
    "hash": "2250359f2ff633983a5652daff2e3b929bc5374ae0b01877efe71d3579cf0333",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 186,
        "end": 240,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "create",
        "builder": "mutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "touch",
        "builder": "mutation"
      },
      {
        "name": "end",
        "builder": "mutation"
      },
      {
        "name": "endAll",
        "builder": "mutation"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "expireIdle",
        "builder": "mutation"
      },
      {
        "name": "incrementMessageCount",
        "builder": "mutation"
      },
      {
        "name": "incrementMemoryCount",
        "builder": "mutation"
      }
    ]
  },
  "tsconfig.json": {
    "hash": "c03a297a5e103f330ca7c7abf2a453c8d87a8b32853ab2fe983b3fc6c5482d0f",
    "imports": [],
    "operations": []
  },
  "userExport.ts": {
    "hash": "a29559bcb8a456bb9aee965cd369a146d4eb3ef412f31388c9a2c51c6bea3c1e",
    "imports": [
      {
        "statement": "import { internalQuery } from \"./_generated/server\";",
        "start": 101,
        "end": 153,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { QueryCtx } from \"./_generated/server\";",
        "start": 202,
        "end": 254,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "inspect",
        "builder": "internalQuery"
      },
      {
        "name": "page",
        "builder": "internalQuery"
      },
      {
        "name": "inspectEdge",
        "builder": "internalQuery"
      },
      {
        "name": "readNode",
        "builder": "internalQuery"
      },
      {
        "name": "resolveFile",
        "builder": "internalQuery"
      }
    ]
  },
  "users.ts": {
    "hash": "5b65edd03080e5ec1b3c82bbf38256a985e0c234cbd9ad48316aa5d3a560d71a",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 279,
        "end": 333,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "list",
        "builder": "query"
      },
      {
        "name": "count",
        "builder": "query"
      },
      {
        "name": "getVersion",
        "builder": "query"
      },
      {
        "name": "getHistory",
        "builder": "query"
      },
      {
        "name": "getAtTimestamp",
        "builder": "query"
      },
      {
        "name": "deleteUserProfile",
        "builder": "mutation"
      },
      {
        "name": "exists",
        "builder": "query"
      }
    ]
  }
};

const APP_CONTRACT: Record<CanonicalTemplate, Record<string, string>> = {
  "vercel-ai-quickstart": {
    "app.schema.ts": "b20f419bbbb72a10d5e6db07a3b899d3c54725400576cf14511abc8f2a668ff7",
    "app/accounts.ts": "4d056054e3c8383ddec6f2cae6b8234b6b06b09b5a66001f80912eb8fa7a09d7",
    "app/authState.ts": "d5dbe3a0b526f5901555d5b1bf1dfa3052f98fe847f0d438da5367588a1e339d",
    "app/conversations.ts": "d8e3cd255b7de80db7fd69de5bfa293afd50e522511d6fbd710afb77e2293e1f",
    "app/facts.ts": "fdeaec714ffd6684b7c23d9078757083e645089be82ab136806166b82006026a",
    "app/health.ts": "ca1e6b2232df06cb13c900910bfddb674183e3df77728c83a48286b26e7f0f78",
    "app/memories.ts": "8501e2249e0cbaa1a373a3b593fd8e1f8f495318d5972567c440d9bbd37b72ce",
    "app/scope.ts": "e741ca1aa09aae370f70b7d8108538356ae05189be6d941d3d01aaa851cd0861",
    "app/sessions.ts": "1a53cc5fe224b47813ddc09bfafa3a24178c56ae27222fbcb7214b6d7a30002f",
    "app/users.ts": "654aa204f958af166bae2a61c01ccc469e6ad4b650d7a42568d308bf27a47fa6",
    "sdk.registration.ts": "d1b457ec7ebe9ca8383eec0475df432e2562f78afa4776f194792920f154f6ee"
  },
  "chat-sdk": {
    "app.schema.ts": "2bbe30a30d4d9300f163bb72f78356906799fa20895bd1389b49896986dd7e5b",
    "app/chatData.ts": "80af59421164fba8bd204758ecc949bec6b33fb652f3d96bb2143dd72ee75074",
    "app/chatUsers.ts": "5b04117e4e2f0ba2bf98aa3ff1603347cc14522919c9686f1881dbe01f0e5a7f",
    "sdk.registration.ts": "d1b457ec7ebe9ca8383eec0475df432e2562f78afa4776f194792920f154f6ee"
  }
};
const APP_REGISTRATIONS = {
  "vercel-ai-quickstart": [
    {
      module: "app/accounts",
      name: "setup",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/accounts",
      name: "register",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/accounts",
      name: "credentialByUsername",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/accounts",
      name: "identityById",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/authState",
      name: "status",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/conversations",
      name: "getRecent",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/conversations",
      name: "count",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/conversations",
      name: "get",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/facts",
      name: "getRecent",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/facts",
      name: "count",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/facts",
      name: "getByUser",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/facts",
      name: "getByType",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/facts",
      name: "typeSummary",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/health",
      name: "ping",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/memories",
      name: "getRecent",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/memories",
      name: "count",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/memories",
      name: "getByUser",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/memories",
      name: "search",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/sessions",
      name: "create",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/sessions",
      name: "resolve",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/sessions",
      name: "revoke",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/users",
      name: "get",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/users",
      name: "list",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/users",
      name: "stats",
      type: "query",
      visibility: "internal",
    },
  ],
  "chat-sdk": [
    {
      module: "app/chatData",
      name: "messages",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "message",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "saveMessages",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "updateMessage",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "truncate",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "branchEdited",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "setTitle",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "setVisibility",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "votes",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "vote",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "suggestions",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "saveSuggestions",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "recordStream",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "publicShare",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "recallBranches",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "documentVersions",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "setDocumentVersions",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "clearChat",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "clearAllChats",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "documentSelection",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "selectDocumentVersion",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "registerUpload",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "verifyUploads",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "listChats",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatData",
      name: "messageCount",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatUsers",
      name: "credentialByEmail",
      type: "query",
      visibility: "internal",
    },
    {
      module: "app/chatUsers",
      name: "register",
      type: "mutation",
      visibility: "internal",
    },
    {
      module: "app/chatUsers",
      name: "createGuest",
      type: "mutation",
      visibility: "internal",
    },
  ],
} as const;
export const TRANSFORM_CONTRACT_HASH = hashBytes(JSON.stringify(SDK_CONTRACT));
/** Reviewed prior A/B, C/D and Task17 epochs; never approves prospective bytes. */
export function isRecognizedTransformContractHash(value: unknown): boolean {
  return (
    value === TRANSFORM_CONTRACT_HASH ||
    value === "fb9cfabf73451e3c4116724515ae2a7b319682acd761168b1d1abaa613bffc5d" ||
    value ===
      "c3f2c351ad8e8691254d804aec6ef872848f90d3dfbea058d4ded189b920783f" ||
    value === "4a5508eb1b201cfcf2a6c28c20e097f8c9b7e3f4e1383e927fc5b005a70dde13"
  );
}
export function isCanonicalTemplate(
  value: unknown,
): value is CanonicalTemplate {
  return value === "vercel-ai-quickstart" || value === "chat-sdk";
}
export function appContractHash(template: CanonicalTemplate): string {
  if (!isCanonicalTemplate(template))
    throw new Error("Unknown canonical template");
  return hashBytes(JSON.stringify(APP_CONTRACT[template]));
}
/** Exact reviewed prior template epochs; actual app dependencies remain current-only. */
export function isRecognizedAppContractHash(template: unknown, value: unknown): boolean {
  if (!isCanonicalTemplate(template)) return false;
  const prior = {
    "chat-sdk": "7220fc2a4de7fe4b05cef054588d92c036c0570b0abcdec6974b4e36f833bf30",
    "vercel-ai-quickstart": "eac517966add9aedc500747e239f6be2607003393e270ed7f8242575ba9c01d0",
  };
  return value === appContractHash(template) || value === prior[template] ||
    (template === "chat-sdk" && value === "84b569cf43f082f128df8e4d548f68342f9a69094e8c89de3311fbcfbeb8b13e");
}
/** Narrow named-import grammar; rewrites only its module string. Never splits imports. */
export function rewriteRegistrationImport(
  statement: string,
  moduleName: string,
): string {
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(moduleName))
    throw new Error("Unsafe registration module");
  const match =
    /^import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+(["'])([^"']+)\3\s*;$/.exec(
      statement,
    );
  if (!match) throw new Error("Unsupported registration import syntax");
  const origin = path.posix.normalize(
    path.posix.join(path.posix.dirname(moduleName), match[4]),
  );
  if (origin !== "_generated/server")
    throw new Error("Unknown registration origin");
  const locals = new Set<string>();
  const entries = match[2]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!entries.length) throw new Error("Empty registration import");
  for (const entry of entries) {
    const binding =
      /^(type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(
        entry,
      );
    if (!binding) throw new Error("Unknown registration binding");
    const typeOnly = Boolean(match[1] || binding[1]);
    const local = binding[3] ?? binding[2];
    if (locals.has(local)) throw new Error("Ambiguous registration alias");
    locals.add(local);
    const allowed = match[1]
      ? ["QueryCtx", "MutationCtx"]
      : typeOnly
        ? ["QueryCtx", "MutationCtx"]
        : [
            "query",
            "mutation",
            "action",
            "internalQuery",
            "internalMutation",
            "internalAction",
          ];
    if (!allowed.includes(binding[2]))
      throw new Error("Unknown registration binding");
  }
  if (match[1]) return statement;
  let target = path.posix.relative(
    path.posix.dirname(moduleName),
    "sdk.registration",
  );
  if (!target.startsWith(".")) target = `./${target}`;
  const literal = `${match[3]}${match[4]}${match[3]}`;
  const index = statement.lastIndexOf(literal);
  return (
    statement.slice(0, index + 1) +
    target +
    statement.slice(index + literal.length - 1)
  );
}
/** Every recursive byte is approved before transforming any output. Generated files are absent. */
export function transformCanonicalSdk(
  raw: Record<string, Buffer>,
): Record<string, Buffer> {
  if (
    JSON.stringify(Object.keys(raw).sort()) !==
    JSON.stringify(Object.keys(SDK_CONTRACT).sort())
  )
    throw new Error("Unreviewed recursive SDK source set");
  for (const [name, bytes] of Object.entries(raw)) {
    if (hashBytes(bytes) !== SDK_CONTRACT[name].hash)
      throw new Error(`Unreviewed SDK source: ${name}`);
  }
  const output: Record<string, Buffer> = {};
  for (const [name, bytes] of Object.entries(raw)) {
    const contract = SDK_CONTRACT[name];
    let text = bytes.toString("utf8");
    for (const item of [...contract.imports].reverse()) {
      const index = text.indexOf(item.statement);
      if (
        index !== item.start ||
        text.slice(item.start, item.end) !== item.statement ||
        index !== text.lastIndexOf(item.statement)
      )
        throw new Error(`Ambiguous trusted import: ${name}`);
      const replacement = rewriteRegistrationImport(item.statement, name);
      text =
        text.slice(0, index) +
        replacement +
        text.slice(index + item.statement.length);
    }
    output[name === "schema.ts" ? "cortex.schema.ts" : name] =
      Buffer.from(text);
  }
  return output;
}
/** Native analysis must reconcile this whole set, including zero-operation helpers. */
export function expectedSdkRegistrations(): {
  module: string;
  name: string;
  type: string;
  visibility: "internal";
}[] {
  return Object.entries(SDK_CONTRACT).flatMap(([module, source]) =>
    source.operations.map((op) => ({
      module: module.slice(0, -3),
      name: op.name,
      type: op.builder.toLowerCase().includes("query")
        ? "query"
        : op.builder.toLowerCase().includes("mutation")
          ? "mutation"
          : "action",
      visibility: "internal" as const,
    })),
  );
}
/** App operations and zero-operation modules must also match native analysis after assembly. */
export function expectedAppRegistrations(template: CanonicalTemplate) {
  if (!isCanonicalTemplate(template))
    throw new Error("Unknown canonical template");
  return APP_REGISTRATIONS[template].map((operation) => ({ ...operation }));
}
export function expectedAppModules(template: CanonicalTemplate): string[] {
  if (!isCanonicalTemplate(template))
    throw new Error("Unknown canonical template");
  return Object.keys(APP_CONTRACT[template])
    .filter((name) => name.startsWith("app/"))
    .map((name) => name.slice(0, -3));
}
export function canonicalDependencies(
  project: string,
  functions: string,
  template: CanonicalTemplate,
  fresh: boolean,
  prospective?:ProspectiveBackendFiles,
): Record<string, string> {
  if (!isCanonicalTemplate(template))
    throw new Error("Unknown canonical template");
  const dependencies: Record<string, string> = {};
  for (const [name, approved] of Object.entries(APP_CONTRACT[template])) {
    const bytes = readBackendProjectFile(project, `${functions}/${name}`,prospective);
    if (bytes===null)
      throw new Error(`Canonical app dependency missing: ${name}`);
    const hash = hashBytes(bytes);
    // An app schema edit belongs to the app update channel; native validation remains pending.
    if ((fresh || name !== "app.schema.ts") && hash !== approved)
      throw new Error(`Canonical app contract changed: ${name}`);
    dependencies[name] = hash;
  }
  const config = readBackendProjectFile(project, `${functions}/tsconfig.json`,prospective);
  if (config!==null) dependencies["tsconfig.json"] = hashBytes(config);
  return dependencies;
}
export function planTemplateBackend(
  project: string,
  sdkPath: string,
  template: CanonicalTemplate,
  prospectiveFiles?:ProspectiveBackendFiles,
  sdkView?:BackendSdkView,
): BackendPlan {
  if (!isCanonicalTemplate(template))
    throw new Error("Unknown canonical template");
  return planBackendSync(project, sdkPath, { template,prospectiveFiles,sdkView });
}

/** Observe only the functions tree; generated output stays outside source ownership. */
export function backendEntryNames(
  project: string,
  functions: string,
  prospective?:ProspectiveBackendFiles,
): string[] {
  const root = assertSafePath(project, functions),
    entries: string[] = [];
  const exists=fs.existsSync(root);
  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      if (item.name === "_generated") continue;
      const name = dir ? `${dir}/${item.name}` : item.name;
      assertSafePath(project, `${functions}/${name}`);
      if (item.isDirectory()) {
        entries.push(`${name}/`);
        walk(name);
      } else if (item.isFile()) entries.push(name);
      else throw new Error(`Unsupported backend file kind: ${name}`);
    }
  };
  if(exists)walk("");
  const effective=new Set(entries);
  for(const [relative,bytes] of prospective ?? []){
    if(!relative.startsWith(functions+"/"))continue;
    const name=relative.slice(functions.length+1);assertSafePath(project,relative);
    if(name.split("/").includes("_generated"))throw new Error("Prospective generated backend refused");
    if(bytes===null){effective.delete(name);continue;}
    effective.add(name);const parts=name.split("/");for(let i=1;i<parts.length;i++)effective.add(parts.slice(0,i).join("/")+"/");
  }
  return [...effective].sort();
}
export function assertCanonicalSdkTree(sdkPath: string,sourceEntries?:string[]): void {
  // SDK README is an existing non-module documentation leaf, never copied or executed.
  const names = (sourceEntries ?? backendEntryNames(sdkPath, "convex-dev")).filter(
    (name) => !name.endsWith("/") && name !== "README.md",
  );
  if (
    JSON.stringify(names) !== JSON.stringify(Object.keys(SDK_CONTRACT).sort())
  )
    throw new Error("Unreviewed SDK file/entrypoint set");
}
