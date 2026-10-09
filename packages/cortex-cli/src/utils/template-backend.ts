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
    "hash": "d5f3c93db358f10635bb451f69dae779fd1eb11e1d52aa0a16912dbfc405f7c1",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 591,
        "end": 645,
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
    "hash": "8b2eb63eaf6ff4fc41cdb64085840ad70f49bf377f394afd194f7ab08d450345",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 98,
        "end": 168,
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
    "hash": "2f62a62e8ae23e84542324fc2201335eb99ca36ae7ed7c9a3173c352e3e3e17d",
    "imports": [
      {
        "statement": "import { internalMutation, mutation, query } from \"./_generated/server\";",
        "start": 86,
        "end": 158,
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
        "builder": "internalMutation"
      },
      {
        "name": "computeStats",
        "builder": "query"
      }
    ]
  },
  "artifacts.ts": {
    "hash": "3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery, mutation, query } from \"./_generated/server\";",
        "start": 422,
        "end": 509,
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
        "builder": "internalMutation"
      },
      {
        "name": "purgeVersions",
        "builder": "mutation"
      },
      {
        "name": "purgeAll",
        "builder": "internalMutation"
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
        "builder": "internalMutation"
      },
      {
        "name": "completeArtifactUpload",
        "builder": "mutation"
      },
      {
        "name": "getArtifactFileUrl",
        "builder": "internalQuery"
      },
      {
        "name": "detachFile",
        "builder": "mutation"
      }
    ]
  },
  "attachments.ts": {
    "hash": "d76ae987e6f778023c95231dd4b92d19f02232c694128a4f46bbef825fb921f3",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery, mutation, query } from \"./_generated/server\";",
        "start": 517,
        "end": 604,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "generateUploadUrl",
        "builder": "internalMutation"
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
        "builder": "internalMutation"
      },
      {
        "name": "get",
        "builder": "query"
      },
      {
        "name": "getUrl",
        "builder": "internalQuery"
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
  "cliOperator/admin.ts": {
    "hash": "5f33f4ba0cd799a187686954181644ce0544d6f9cfb4acf1d1735c89b857e0b2",
    "imports": [],
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
  "cliOperator/agents.ts": {
    "hash": "c2b362176aa397fec8d945d996e4782543d578b02754f079ed46d154bae34dbd",
    "imports": [],
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
  "cliOperator/artifacts.ts": {
    "hash": "fb4bcab50d6e465328d02a90965186ee33ca771110b59aee49005b5f8e30f833",
    "imports": [],
    "operations": [
      {
        "name": "create",
        "builder": "graphMutation"
      },
      {
        "name": "update",
        "builder": "graphMutation"
      },
      {
        "name": "deleteArtifact",
        "builder": "graphMutation"
      },
      {
        "name": "undo",
        "builder": "graphMutation"
      },
      {
        "name": "redo",
        "builder": "graphMutation"
      },
      {
        "name": "setStreamingState",
        "builder": "graphMutation"
      },
      {
        "name": "setFileRef",
        "builder": "graphMutation"
      },
      {
        "name": "purgeVersions",
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      },
      {
        "name": "appendContent",
        "builder": "graphMutation"
      },
      {
        "name": "pauseStreaming",
        "builder": "graphMutation"
      },
      {
        "name": "resumeStreaming",
        "builder": "graphMutation"
      },
      {
        "name": "cancelStreaming",
        "builder": "graphMutation"
      },
      {
        "name": "finalizeStreaming",
        "builder": "graphMutation"
      },
      {
        "name": "setStreamingError",
        "builder": "graphMutation"
      },
      {
        "name": "retryFromError",
        "builder": "graphMutation"
      },
      {
        "name": "generateArtifactUploadUrl",
        "builder": "graphMutation"
      },
      {
        "name": "completeArtifactUpload",
        "builder": "graphMutation"
      },
      {
        "name": "getArtifactFileUrl",
        "builder": "query"
      },
      {
        "name": "detachFile",
        "builder": "graphMutation"
      }
    ]
  },
  "cliOperator/attachments.ts": {
    "hash": "e9404d8aa635233d192df9c3a6ddbabaf59ee1ea858ea5721392f13cfd364aff",
    "imports": [],
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
  "cliOperator/conversations.ts": {
    "hash": "ef6f29f835f292287b3d1eca746cbaaf6b5d5733891c6eca9e7aa52fdd9c69ec",
    "imports": [],
    "operations": [
      {
        "name": "create",
        "builder": "graphMutation"
      },
      {
        "name": "setVisibility",
        "builder": "graphMutation"
      },
      {
        "name": "setMetadata",
        "builder": "graphMutation"
      },
      {
        "name": "checkAccess",
        "builder": "query"
      },
      {
        "name": "addMessage",
        "builder": "graphMutation"
      },
      {
        "name": "approveMessage",
        "builder": "graphMutation"
      },
      {
        "name": "rejectMessage",
        "builder": "graphMutation"
      },
      {
        "name": "deleteConversation",
        "builder": "graphMutation"
      },
      {
        "name": "deleteMany",
        "builder": "graphMutation"
      },
      {
        "name": "deleteByIds",
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      }
    ]
  },
  "cliOperator/factHistory.ts": {
    "hash": "95835cb9d140a1a83cf57fe8adafb0a043e684a52bcf440912b405376b8f3599",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"../_generated/server\";",
        "start": 479,
        "end": 545,
        "typeOnly": true,
        "origin": "../_generated/server"
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
  "cliOperator/facts.ts": {
    "hash": "3449ae3dec3d06d9f8d6bcbbc696ee662817664c4bafc15770f410f0a06f5d31",
    "imports": [
      {
        "statement": "import {\n  type QueryCtx,\n} from \"../_generated/server\";",
        "start": 695,
        "end": 751,
        "typeOnly": false,
        "origin": "../_generated/server"
      }
    ],
    "operations": [
      {
        "name": "store",
        "builder": "graphMutation"
      },
      {
        "name": "update",
        "builder": "graphMutation"
      },
      {
        "name": "deleteFact",
        "builder": "graphMutation"
      },
      {
        "name": "supersede",
        "builder": "graphMutation"
      },
      {
        "name": "updateInPlace",
        "builder": "graphMutation"
      },
      {
        "name": "deleteMany",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      },
      {
        "name": "findByStructure",
        "builder": "query"
      },
      {
        "name": "deleteByIds",
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
      },
      {
        "name": "candidatePage",
        "builder": "query"
      }
    ]
  },
  "cliOperator/graphSync.ts": {
    "hash": "8e5aa790043ea2e48561905324fb90734f64d04faf0fde3dc225172b5ad47dae",
    "imports": [
      {
        "statement": "import {type MutationCtx,type QueryCtx} from \"../_generated/server\";",
        "start": 290,
        "end": 358,
        "typeOnly": false,
        "origin": "../_generated/server"
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
  "cliOperator/immutable.ts": {
    "hash": "0a4c7deed818eeaf4fe6b7c77002ae51880e26602d391f2c2c49b09aeda90823",
    "imports": [],
    "operations": [
      {
        "name": "store",
        "builder": "graphMutation"
      },
      {
        "name": "purge",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      },
      {
        "name": "purgeVersions",
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
      }
    ]
  },
  "cliOperator/memories.ts": {
    "hash": "dcd0411a51d3bb9b1859fb83e6916a0ee831e68ef24c98a541e7c94c0a878e50",
    "imports": [
      {
        "statement": "import { type MutationCtx } from \"../_generated/server\";",
        "start": 1029,
        "end": 1085,
        "typeOnly": false,
        "origin": "../_generated/server"
      }
    ],
    "operations": [
      {
        "name": "store",
        "builder": "graphMutation"
      },
      {
        "name": "storePartialMemory",
        "builder": "graphMutation"
      },
      {
        "name": "updatePartialMemory",
        "builder": "graphMutation"
      },
      {
        "name": "finalizePartialMemory",
        "builder": "graphMutation"
      },
      {
        "name": "deleteMemory",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      },
      {
        "name": "deleteByIds",
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
      },
      {
        "name": "exportMemories",
        "builder": "query"
      },
      {
        "name": "updateMany",
        "builder": "graphMutation"
      },
      {
        "name": "archive",
        "builder": "graphMutation"
      },
      {
        "name": "restoreFromArchive",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      }
    ]
  },
  "cliOperator/memorySpaces.ts": {
    "hash": "29f90287caa3f1e77a6b7d34bd290e3a2440c28bb57f563bd173421c8be4fa9e",
    "imports": [],
    "operations": [
      {
        "name": "register",
        "builder": "graphMutation"
      },
      {
        "name": "update",
        "builder": "graphMutation"
      },
      {
        "name": "addParticipant",
        "builder": "graphMutation"
      },
      {
        "name": "removeParticipant",
        "builder": "graphMutation"
      },
      {
        "name": "archive",
        "builder": "graphMutation"
      },
      {
        "name": "reactivate",
        "builder": "graphMutation"
      },
      {
        "name": "deleteSpace",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      },
      {
        "name": "purgeAll",
        "builder": "graphMutation"
      }
    ]
  },
  "cliOperator/mutable.ts": {
    "hash": "8c04b86ad53e0773a3460126e1ed33b634a3e596bcb864b2a0e7f11c79a117d4",
    "imports": [],
    "operations": [
      {
        "name": "set",
        "builder": "graphMutation"
      },
      {
        "name": "update",
        "builder": "graphMutation"
      },
      {
        "name": "deleteKey",
        "builder": "graphMutation"
      },
      {
        "name": "purgeNamespace",
        "builder": "graphMutation"
      },
      {
        "name": "transaction",
        "builder": "graphMutation"
      },
      {
        "name": "purgeMany",
        "builder": "graphMutation"
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
        "builder": "graphMutation"
      }
    ]
  },
  "contexts.ts": {
    "hash": "facb2f35168ab2243d59b88cc39ac6bafba2044a3fafcbc751f4a323c47367e2",
    "imports": [
      {
        "statement": "import { internalMutation, mutation, query, type MutationCtx } from \"./_generated/server\";",
        "start": 134,
        "end": 224,
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
        "name": "addParticipant",
        "builder": "mutation"
      },
      {
        "name": "removeParticipant",
        "builder": "mutation"
      },
      {
        "name": "grantAccess",
        "builder": "mutation"
      },
      {
        "name": "deleteContext",
        "builder": "mutation"
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
        "name": "get",
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
        "builder": "internalMutation"
      }
    ]
  },
  "conversations.ts": {
    "hash": "7718c76423d7f275faf51a534fb9ff3ef19eef3d05729028060487c59276e586",
    "imports": [
      {
        "statement": "import { mutation, query, internalMutation } from \"./_generated/server\";",
        "start": 359,
        "end": 431,
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
        "builder": "internalMutation"
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
      }
    ]
  },
  "conversationShares.ts": {
    "hash": "17dfb3859fc6e3bd60fa9b4d11af984a252df18995257c28e40415fa1a05d4d1",
    "imports": [
      {
        "statement": "import { mutation, query, internalMutation } from \"./_generated/server\";",
        "start": 284,
        "end": 356,
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
        "builder": "internalMutation"
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
    "hash": "7af4e9ad27d7fd5e1883e57ed560fbc509c4c10d3454ee2fe578edc790e6c1ac",
    "imports": [
      {
        "statement": "import { mutation, query } from \"./_generated/server\";",
        "start": 291,
        "end": 345,
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
    "hash": "f125bf879e8195f073a0011e3285213dc8b07edc3b011088fd2d3fb99af495c7",
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
    "hash": "b8734ec5ac5afc25eed9dc66fe27428fa078d3a9f3fb7ace37cbed5c0106e059",
    "imports": [
      {
        "statement": "import { query, internalMutation } from \"./_generated/server\";",
        "start": 278,
        "end": 340,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "logEvent",
        "builder": "internalMutation"
      },
      {
        "name": "deleteByFactId",
        "builder": "internalMutation"
      },
      {
        "name": "deleteByUserId",
        "builder": "internalMutation"
      },
      {
        "name": "deleteByMemorySpace",
        "builder": "internalMutation"
      },
      {
        "name": "purgeOldEvents",
        "builder": "internalMutation"
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
        "name": "getSupersessionChain",
        "builder": "query"
      },
      {
        "name": "getActivitySummary",
        "builder": "query"
      }
    ]
  },
  "facts.ts": {
    "hash": "4a3b972e97b42b7d5cd273adfe28db1ca3a390675424bad57463cafbe30d2b92",
    "imports": [
      {
        "statement": "import { action, internalMutation, internalQuery, mutation, query } from \"./_generated/server\";",
        "start": 199,
        "end": 294,
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
        "builder": "internalMutation"
      }
    ]
  },
  "governance.ts": {
    "hash": "ea81c7cc5d794a4d810086a2e539c309ec2712b6290b652efd12bda0493737ac",
    "imports": [
      {
        "statement": "import { internalMutation, mutation, query, type QueryCtx } from \"./_generated/server\";",
        "start": 127,
        "end": 214,
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
        "name": "enforce",
        "builder": "internalMutation"
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
        "builder": "internalMutation"
      },
      {
        "name": "purgeAllEnforcement",
        "builder": "internalMutation"
      }
    ]
  },
  "graphSync.ts": {
    "hash": "32e6d13a9377be88f2098e86800235d7b76ed8e039a231fdac81c88e4f8c5b33",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery, type QueryCtx } from \"./_generated/server\";",
        "start": 124,
        "end": 209,
        "typeOnly": false,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "queueForSync",
        "builder": "internalMutation"
      },
      {
        "name": "markSynced",
        "builder": "internalMutation"
      },
      {
        "name": "markFailed",
        "builder": "internalMutation"
      },
      {
        "name": "deleteSyncItem",
        "builder": "internalMutation"
      },
      {
        "name": "getUnsyncedItems",
        "builder": "internalQuery"
      },
      {
        "name": "getHighPriorityItems",
        "builder": "internalQuery"
      },
      {
        "name": "getFailedItems",
        "builder": "internalQuery"
      },
      {
        "name": "getSyncStats",
        "builder": "internalQuery"
      },
      {
        "name": "clearSyncedItems",
        "builder": "internalMutation"
      },
      {
        "name": "purgeAll",
        "builder": "internalMutation"
      }
    ]
  },
  "immutable.ts": {
    "hash": "1bbeca8ed71dd089a8804d34b016900a261a22a65ac70e08330b3a56a4fd0804",
    "imports": [
      {
        "statement": "import { mutation, query, internalMutation } from \"./_generated/server\";",
        "start": 141,
        "end": 213,
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
        "name": "getAtTimestamp",
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
        "name": "purge",
        "builder": "mutation"
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
        "builder": "internalMutation"
      }
    ]
  },
  "lib/domainErasureScope.ts": {
    "hash": "8e522d40d9c56b75bd41084a45cb67729ca07afaca8ccaa7c585b532af6d1a90",
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
    "hash": "a88e079d743b23deadef141923b83d77fe775f2dda45b3a73ae2e1f6b1f7a7ed",
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
    "hash": "a0d72bb65534df966096414cbd9c9b343e39a6a92a008a9a7bcf04964668732f",
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
    "hash": "a446aea0652e9daf517d1515017c4576ec6e085d35c557382ea5bf94b0405759",
    "imports": [
      {
        "statement": "import {type MutationCtx, type QueryCtx} from \"../_generated/server\";",
        "start": 213,
        "end": 282,
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
  "lib/operatorBoundary.ts": {
    "hash": "e0dc1e12246da2b503f4841841179a88c8472a2df0e81f18208357e7b814b568",
    "imports": [
      {
        "statement": "import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from \"../_generated/server\";",
        "start": 171,
        "end": 291,
        "typeOnly": false,
        "origin": "../_generated/server"
      }
    ],
    "operations": []
  },
  "lib/referenceLifecycle.ts": {
    "hash": "3d1ca1c74a91202ec0101284f5062798fc1c3cedfd714efed07e0bb8055cbf0c",
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
  "lib/runtimeDomain/auth/types.ts": {
    "hash": "162b985c1c28cf6c456e239881594c7f22d6745a2892aae41426cd0e3b394c66",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/auth/verified.ts": {
    "hash": "d2e514b198dcccff783b67ee7c7a625f91bf7553a41342a02bea8fd23f6908b3",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/clock.ts": {
    "hash": "7d6124f71c561ba1ce2643600470f37318367084ca9c5a6f5cc2a8f9c9de6497",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/conflicts.ts": {
    "hash": "899bf06d6885fc0c3f909ac2cce6ea08196de76111059785133eb0ef57baa4d4",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/contracts.ts": {
    "hash": "a40ca52e4d9c1eef84847c86a0b3681a7a3389095817745f3682663260fdc87b",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/deduplication.ts": {
    "hash": "c99092d8d7ce015e0f13cbf33c1012fb2a2d7c7f41ee4479b6684a0501cc7698",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/extraction.ts": {
    "hash": "7324f700278531e30ae22d3eca29dd7bef2fbeae1d6aa7c7011ec9bcbb45fa5b",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/modelPolicy.ts": {
    "hash": "f43de8775880d1d4f6ddad90e527837d9ddb4ce58d00ea622aabc2609a1769da",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/profile.ts": {
    "hash": "6b098f33dcfe9fb3f70a44b2d6117884dbc0658142edd6499e79e2d03f7fd63b",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/recall.ts": {
    "hash": "77f024da7c4d1329cb639d618a7c05af59ac88d41abab4f9c8c29f906f7bdb9e",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/domain/sources.ts": {
    "hash": "4015f729bd2dc5a01ea8c24fcd9e1a86ebcab536698affb043fdf287dea3c74e",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/sessions/types.ts": {
    "hash": "324557fadfd8e33e58bf151ccc7fbce0401641ae90cc11d186733d3ee8be1fb5",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/types/index.ts": {
    "hash": "46dce5f4e06cf9ced521bbead0258eedabb5211c98ffe2026e43e1909c6d8e1d",
    "imports": [],
    "operations": []
  },
  "lib/runtimeDomain/types/streaming.ts": {
    "hash": "26f87063d3a94e249dec8b32a8f4d6e883032654baadedcc8c8de926dea22e17",
    "imports": [],
    "operations": []
  },
  "lib/userDataScope.ts": {
    "hash": "01d03bdaca67e35f67c72e22448a3e6eb9477f862f578588d0e0d0ed6ea3a83f",
    "imports": [],
    "operations": []
  },
  "memories.ts": {
    "hash": "35123484567b893824050e585adf8e1ce650f2e6a8c636dcf357c7dfa7863c34",
    "imports": [
      {
        "statement": "import { action, internalMutation, internalQuery, mutation, query } from \"./_generated/server\";",
        "start": 203,
        "end": 298,
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
        "builder": "internalMutation"
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
      }
    ]
  },
  "memorySpaces.ts": {
    "hash": "cabb138c578220ee3b4b56fd16bf466da9e92e9508f8485ce1582fd3b29eee2c",
    "imports": [
      {
        "statement": "import { internalMutation, mutation, query, type MutationCtx } from \"./_generated/server\";",
        "start": 135,
        "end": 225,
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
        "name": "updateParticipants",
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
        "name": "findByParticipant",
        "builder": "query"
      },
      {
        "name": "search",
        "builder": "query"
      },
      {
        "name": "purgeAll",
        "builder": "internalMutation"
      },
      {
        "name": "getStats",
        "builder": "query"
      }
    ]
  },
  "mutable.ts": {
    "hash": "14feb91094f31b9f72cdab9ecb6faa5025a27972f234b1129d4c77ee4ee037e5",
    "imports": [
      {
        "statement": "import { mutation, query, internalMutation } from \"./_generated/server\";",
        "start": 148,
        "end": 220,
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
        "name": "deleteKey",
        "builder": "mutation"
      },
      {
        "name": "purgeMany",
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
        "name": "purgeAll",
        "builder": "internalMutation"
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
  "runtimeArtifactAuth.ts": {
    "hash": "84d0c2c202fedf8b856b7a0a9c0990adc8f533fb8a55a4635bab6b98236e5d0f",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 524,
        "end": 589,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "runtimeAssetUnavailableAuth.ts": {
    "hash": "10678769db2fb6c04edeee6c904f31db4da0baca1ba03d1f81c951c3141f18d4",
    "imports": [],
    "operations": []
  },
  "runtimeAuth.ts": {
    "hash": "cc130503bee2f6d2377f008047d683645fa512efc99a02a38c0f77a457d45283",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 193,
        "end": 263,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 264,
        "end": 329,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "authorize",
        "builder": "internalQuery"
      },
      {
        "name": "recheck",
        "builder": "internalQuery"
      },
      {
        "name": "provision",
        "builder": "internalMutation"
      },
      {
        "name": "revokeGrant",
        "builder": "internalMutation"
      },
      {
        "name": "revokeMembership",
        "builder": "internalMutation"
      },
      {
        "name": "deletePrincipal",
        "builder": "internalMutation"
      },
      {
        "name": "deleteScope",
        "builder": "internalMutation"
      },
      {
        "name": "tombstoneResource",
        "builder": "internalMutation"
      }
    ]
  },
  "runtimeAuthSchema.ts": {
    "hash": "41859c943e06ed185d88bb4f0da21540e0999d9f736f933dfdcbd572ee9dd5d1",
    "imports": [],
    "operations": []
  },
  "runtimeDataAuth.ts": {
    "hash": "718ec85232979594c5022ee25eff79764885b360280508302062e9e622acd459",
    "imports": [
      {
        "statement": "import type { ActionCtx, MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 250,
        "end": 326,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "runtimeGateway.ts": {
    "hash": "ccfac62e789c8f10dea3c2ea53add7c07dedb78bd2060df7767484cc077d7830",
    "imports": [],
    "operations": []
  },
  "runtimeMemory.ts": {
    "hash": "44dac14f1ec4e655ddd2983104364f8a35034c3953272068ff17f77da7206135",
    "imports": [
      {
        "statement": "import { action, internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 246,
        "end": 324,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { ActionCtx } from \"./_generated/server\";",
        "start": 325,
        "end": 378,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "checkAuthority",
        "builder": "internalQuery"
      },
      {
        "name": "readSource",
        "builder": "internalQuery"
      },
      {
        "name": "writeSource",
        "builder": "internalMutation"
      },
      {
        "name": "writeDerived",
        "builder": "internalMutation"
      },
      {
        "name": "readFacts",
        "builder": "internalQuery"
      },
      {
        "name": "readVectorMatches",
        "builder": "internalQuery"
      },
      {
        "name": "remember",
        "builder": "action"
      },
      {
        "name": "recall",
        "builder": "action"
      }
    ]
  },
  "runtimeMemoryRepository.ts": {
    "hash": "ee6ef0714d2a3e1582dd4e61f43355ff937073a776f52496f3439110a629ee4a",
    "imports": [
      {
        "statement": "import type { ActionCtx, MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 242,
        "end": 318,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "runtimeMemorySchema.ts": {
    "hash": "24abaebe350c4127c3b4b376b6749ef86ef6e4e1820b59b2d8a9538e7f257aba",
    "imports": [],
    "operations": []
  },
  "runtimeMemoryServices.ts": {
    "hash": "7e511baa29e994bb4faf8ad8aa817c76b6fe9ff3da1f02c5814a6d89895df21e",
    "imports": [],
    "operations": []
  },
  "runtimeMetadataAuth.ts": {
    "hash": "efcaaf5ec76803b9fa949b5fea4f1597780c7a907e77ca8db274694704238172",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 142,
        "end": 207,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "runtimeModelPolicy.ts": {
    "hash": "de98d04a1378dc0aeb9e2220896c3346b9fb30217494632e744b4310c9be2ed2",
    "imports": [
      {
        "statement": "import { internalMutation, internalQuery } from \"./_generated/server\";",
        "start": 213,
        "end": 283,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 284,
        "end": 349,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": [
      {
        "name": "ensureBudget",
        "builder": "internalMutation"
      },
      {
        "name": "installDeploymentPolicy",
        "builder": "internalMutation"
      },
      {
        "name": "provisionTenantPolicy",
        "builder": "internalMutation"
      },
      {
        "name": "resolve",
        "builder": "internalQuery"
      },
      {
        "name": "admit",
        "builder": "internalMutation"
      },
      {
        "name": "checkpoint",
        "builder": "internalMutation"
      },
      {
        "name": "markVisible",
        "builder": "internalMutation"
      },
      {
        "name": "captureTerminalEvidence",
        "builder": "internalMutation"
      },
      {
        "name": "attachTerminalResult",
        "builder": "internalMutation"
      },
      {
        "name": "reconcileDeploymentLiability",
        "builder": "internalMutation"
      },
      {
        "name": "settle",
        "builder": "internalMutation"
      },
      {
        "name": "recover",
        "builder": "internalMutation"
      },
      {
        "name": "releaseNotDispatched",
        "builder": "internalMutation"
      },
      {
        "name": "cancelBudget",
        "builder": "internalMutation"
      },
      {
        "name": "admitFallback",
        "builder": "internalMutation"
      },
      {
        "name": "checkFallback",
        "builder": "internalQuery"
      }
    ]
  },
  "runtimeModelPolicyBootstrap.ts": {
    "hash": "da18e1ac57bf2ca9a500ff382db212f9b19445a4ea59d79d33a94398966e1d06",
    "imports": [],
    "operations": []
  },
  "runtimePolicySchema.ts": {
    "hash": "2f15fde0b30b224423c5cfdbc8833dc43cdb7ccfcecb76e4c2792de1883c1b9e",
    "imports": [],
    "operations": []
  },
  "runtimeRegistryAuth.ts": {
    "hash": "670a9fef056c29bc43b081135fa05709511cd4886416ac25e3c078394f8d4454",
    "imports": [
      {
        "statement": "import type { QueryCtx, MutationCtx } from \"./_generated/server\";",
        "start": 203,
        "end": 268,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "runtimeRegistryStats.ts": {
    "hash": "ea2e7a99230a5fd33c2b445b099646c1015c98e873c1adfb30c01baed8cf49f6",
    "imports": [],
    "operations": []
  },
  "runtimeUnavailableAuth.ts": {
    "hash": "c4c2467eb4bbed436bcc57eb9f74f55ebe31b9a54a0e94ace86c5d98528bb126",
    "imports": [],
    "operations": []
  },
  "runtimeWorkerAuth.ts": {
    "hash": "41372d7913c78699bdcc14b86ba4591aa139667ad8f6e6e72348b34463333ba8",
    "imports": [
      {
        "statement": "import type { MutationCtx, QueryCtx } from \"./_generated/server\";",
        "start": 159,
        "end": 224,
        "typeOnly": true,
        "origin": "./_generated/server"
      }
    ],
    "operations": []
  },
  "schema.ts": {
    "hash": "4d4143f5ba3092627edc979117c35ecea1a7eff1836ae8e0c4bcd9a1fd1b95cd",
    "imports": [],
    "operations": []
  },
  "sessions.ts": {
    "hash": "29e168cd02a4ba333120f347782173089e38a0df4cde92d1d204084e089246ef",
    "imports": [
      {
        "statement": "import { mutation, query, internalMutation } from \"./_generated/server\";",
        "start": 153,
        "end": 225,
        "typeOnly": false,
        "origin": "./_generated/server"
      },
      {
        "statement": "import type { MutationCtx } from \"./_generated/server\";",
        "start": 226,
        "end": 281,
        "typeOnly": true,
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
        "name": "incrementMessageCount",
        "builder": "internalMutation"
      },
      {
        "name": "incrementMemoryCount",
        "builder": "internalMutation"
      },
      {
        "name": "expireIdle",
        "builder": "internalMutation"
      }
    ]
  },
  "tsconfig.json": {
    "hash": "6b077cd115f1e1a1cd41fe22824624d9ee39d89b2a53b016aaf59dd2981fdc17",
    "imports": [],
    "operations": []
  },
  "userExport.ts": {
    "hash": "78686fe0dfc00e2cc8d7e9b8275919b83c4f8ea254463629716dfd55ccf654a1",
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
        "start": 268,
        "end": 320,
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
    "hash": "733c926437533d4113feea633e6a1ff365a45803c1db0e63b42a8d2a25550f0f",
    "imports": [
      {
        "statement": "import { query, mutation } from \"./_generated/server\";",
        "start": 84,
        "end": 138,
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
        "name": "exists",
        "builder": "query"
      },
      {
        "name": "deleteUserProfile",
        "builder": "mutation"
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
    value === "148007af3ee17a2398a82a0a7a3a833b83f31effd5135780bc611c844eff8ea7" ||
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
  const integratedPrior = {"vercel-ai-quickstart":"da0d1ec39770761ed64fe3fea77625f0d411a81aa5b8ea7436069f3cfb95d1f4","chat-sdk":"157eeff2552b59a8a397dccd3f6852c721cefce7114a5a2867c5401b0c36ffd4"};
  return value === appContractHash(template) || value === integratedPrior[template] || value === prior[template] ||
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
      ? ["QueryCtx", "MutationCtx", "ActionCtx"]
      : typeOnly
        ? ["QueryCtx", "MutationCtx", "ActionCtx"]
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
