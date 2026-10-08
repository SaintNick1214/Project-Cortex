/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as a2a from "../a2a.js";
import type * as admin from "../admin.js";
import type * as agents from "../agents.js";
import type * as artifacts from "../artifacts.js";
import type * as attachments from "../attachments.js";
import type * as cliOperator_admin from "../cliOperator/admin.js";
import type * as cliOperator_agents from "../cliOperator/agents.js";
import type * as cliOperator_artifacts from "../cliOperator/artifacts.js";
import type * as cliOperator_attachments from "../cliOperator/attachments.js";
import type * as cliOperator_conversations from "../cliOperator/conversations.js";
import type * as cliOperator_factHistory from "../cliOperator/factHistory.js";
import type * as cliOperator_facts from "../cliOperator/facts.js";
import type * as cliOperator_graphSync from "../cliOperator/graphSync.js";
import type * as cliOperator_immutable from "../cliOperator/immutable.js";
import type * as cliOperator_memories from "../cliOperator/memories.js";
import type * as cliOperator_memorySpaces from "../cliOperator/memorySpaces.js";
import type * as cliOperator_mutable from "../cliOperator/mutable.js";
import type * as contexts from "../contexts.js";
import type * as conversationShares from "../conversationShares.js";
import type * as conversationSnapshots from "../conversationSnapshots.js";
import type * as conversations from "../conversations.js";
import type * as domainErasure from "../domainErasure.js";
import type * as factHistory from "../factHistory.js";
import type * as facts from "../facts.js";
import type * as governance from "../governance.js";
import type * as graphSync from "../graphSync.js";
import type * as immutable from "../immutable.js";
import type * as lib_domainErasureScope from "../lib/domainErasureScope.js";
import type * as lib_domainPaging from "../lib/domainPaging.js";
import type * as lib_domainScope from "../lib/domainScope.js";
import type * as lib_factHistoryProvenance from "../lib/factHistoryProvenance.js";
import type * as lib_graphSync from "../lib/graphSync.js";
import type * as lib_memoryVectorScope from "../lib/memoryVectorScope.js";
import type * as lib_operatorBoundary from "../lib/operatorBoundary.js";
import type * as lib_referenceLifecycle from "../lib/referenceLifecycle.js";
import type * as lib_runtimeDomain_auth_types from "../lib/runtimeDomain/auth/types.js";
import type * as lib_runtimeDomain_auth_verified from "../lib/runtimeDomain/auth/verified.js";
import type * as lib_runtimeDomain_domain_clock from "../lib/runtimeDomain/domain/clock.js";
import type * as lib_runtimeDomain_domain_conflicts from "../lib/runtimeDomain/domain/conflicts.js";
import type * as lib_runtimeDomain_domain_contracts from "../lib/runtimeDomain/domain/contracts.js";
import type * as lib_runtimeDomain_domain_deduplication from "../lib/runtimeDomain/domain/deduplication.js";
import type * as lib_runtimeDomain_domain_extraction from "../lib/runtimeDomain/domain/extraction.js";
import type * as lib_runtimeDomain_domain_modelPolicy from "../lib/runtimeDomain/domain/modelPolicy.js";
import type * as lib_runtimeDomain_domain_profile from "../lib/runtimeDomain/domain/profile.js";
import type * as lib_runtimeDomain_domain_recall from "../lib/runtimeDomain/domain/recall.js";
import type * as lib_runtimeDomain_domain_sources from "../lib/runtimeDomain/domain/sources.js";
import type * as lib_runtimeDomain_sessions_types from "../lib/runtimeDomain/sessions/types.js";
import type * as lib_runtimeDomain_types_index from "../lib/runtimeDomain/types/index.js";
import type * as lib_runtimeDomain_types_streaming from "../lib/runtimeDomain/types/streaming.js";
import type * as lib_userDataScope from "../lib/userDataScope.js";
import type * as memories from "../memories.js";
import type * as memorySpaces from "../memorySpaces.js";
import type * as mutable from "../mutable.js";
import type * as referenceMaintenance from "../referenceMaintenance.js";
import type * as runtimeArtifactAuth from "../runtimeArtifactAuth.js";
import type * as runtimeAssetUnavailableAuth from "../runtimeAssetUnavailableAuth.js";
import type * as runtimeAuth from "../runtimeAuth.js";
import type * as runtimeAuthSchema from "../runtimeAuthSchema.js";
import type * as runtimeDataAuth from "../runtimeDataAuth.js";
import type * as runtimeGateway from "../runtimeGateway.js";
import type * as runtimeMemory from "../runtimeMemory.js";
import type * as runtimeMemoryRepository from "../runtimeMemoryRepository.js";
import type * as runtimeMemorySchema from "../runtimeMemorySchema.js";
import type * as runtimeMemoryServices from "../runtimeMemoryServices.js";
import type * as runtimeMetadataAuth from "../runtimeMetadataAuth.js";
import type * as runtimeModelPolicy from "../runtimeModelPolicy.js";
import type * as runtimeModelPolicyBootstrap from "../runtimeModelPolicyBootstrap.js";
import type * as runtimePolicySchema from "../runtimePolicySchema.js";
import type * as runtimeRegistryAuth from "../runtimeRegistryAuth.js";
import type * as runtimeRegistryStats from "../runtimeRegistryStats.js";
import type * as runtimeUnavailableAuth from "../runtimeUnavailableAuth.js";
import type * as runtimeWorkerAuth from "../runtimeWorkerAuth.js";
import type * as sessions from "../sessions.js";
import type * as userExport from "../userExport.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  a2a: typeof a2a;
  admin: typeof admin;
  agents: typeof agents;
  artifacts: typeof artifacts;
  attachments: typeof attachments;
  "cliOperator/admin": typeof cliOperator_admin;
  "cliOperator/agents": typeof cliOperator_agents;
  "cliOperator/artifacts": typeof cliOperator_artifacts;
  "cliOperator/attachments": typeof cliOperator_attachments;
  "cliOperator/conversations": typeof cliOperator_conversations;
  "cliOperator/factHistory": typeof cliOperator_factHistory;
  "cliOperator/facts": typeof cliOperator_facts;
  "cliOperator/graphSync": typeof cliOperator_graphSync;
  "cliOperator/immutable": typeof cliOperator_immutable;
  "cliOperator/memories": typeof cliOperator_memories;
  "cliOperator/memorySpaces": typeof cliOperator_memorySpaces;
  "cliOperator/mutable": typeof cliOperator_mutable;
  contexts: typeof contexts;
  conversationShares: typeof conversationShares;
  conversationSnapshots: typeof conversationSnapshots;
  conversations: typeof conversations;
  domainErasure: typeof domainErasure;
  factHistory: typeof factHistory;
  facts: typeof facts;
  governance: typeof governance;
  graphSync: typeof graphSync;
  immutable: typeof immutable;
  "lib/domainErasureScope": typeof lib_domainErasureScope;
  "lib/domainPaging": typeof lib_domainPaging;
  "lib/domainScope": typeof lib_domainScope;
  "lib/factHistoryProvenance": typeof lib_factHistoryProvenance;
  "lib/graphSync": typeof lib_graphSync;
  "lib/memoryVectorScope": typeof lib_memoryVectorScope;
  "lib/operatorBoundary": typeof lib_operatorBoundary;
  "lib/referenceLifecycle": typeof lib_referenceLifecycle;
  "lib/runtimeDomain/auth/types": typeof lib_runtimeDomain_auth_types;
  "lib/runtimeDomain/auth/verified": typeof lib_runtimeDomain_auth_verified;
  "lib/runtimeDomain/domain/clock": typeof lib_runtimeDomain_domain_clock;
  "lib/runtimeDomain/domain/conflicts": typeof lib_runtimeDomain_domain_conflicts;
  "lib/runtimeDomain/domain/contracts": typeof lib_runtimeDomain_domain_contracts;
  "lib/runtimeDomain/domain/deduplication": typeof lib_runtimeDomain_domain_deduplication;
  "lib/runtimeDomain/domain/extraction": typeof lib_runtimeDomain_domain_extraction;
  "lib/runtimeDomain/domain/modelPolicy": typeof lib_runtimeDomain_domain_modelPolicy;
  "lib/runtimeDomain/domain/profile": typeof lib_runtimeDomain_domain_profile;
  "lib/runtimeDomain/domain/recall": typeof lib_runtimeDomain_domain_recall;
  "lib/runtimeDomain/domain/sources": typeof lib_runtimeDomain_domain_sources;
  "lib/runtimeDomain/sessions/types": typeof lib_runtimeDomain_sessions_types;
  "lib/runtimeDomain/types/index": typeof lib_runtimeDomain_types_index;
  "lib/runtimeDomain/types/streaming": typeof lib_runtimeDomain_types_streaming;
  "lib/userDataScope": typeof lib_userDataScope;
  memories: typeof memories;
  memorySpaces: typeof memorySpaces;
  mutable: typeof mutable;
  referenceMaintenance: typeof referenceMaintenance;
  runtimeArtifactAuth: typeof runtimeArtifactAuth;
  runtimeAssetUnavailableAuth: typeof runtimeAssetUnavailableAuth;
  runtimeAuth: typeof runtimeAuth;
  runtimeAuthSchema: typeof runtimeAuthSchema;
  runtimeDataAuth: typeof runtimeDataAuth;
  runtimeGateway: typeof runtimeGateway;
  runtimeMemory: typeof runtimeMemory;
  runtimeMemoryRepository: typeof runtimeMemoryRepository;
  runtimeMemorySchema: typeof runtimeMemorySchema;
  runtimeMemoryServices: typeof runtimeMemoryServices;
  runtimeMetadataAuth: typeof runtimeMetadataAuth;
  runtimeModelPolicy: typeof runtimeModelPolicy;
  runtimeModelPolicyBootstrap: typeof runtimeModelPolicyBootstrap;
  runtimePolicySchema: typeof runtimePolicySchema;
  runtimeRegistryAuth: typeof runtimeRegistryAuth;
  runtimeRegistryStats: typeof runtimeRegistryStats;
  runtimeUnavailableAuth: typeof runtimeUnavailableAuth;
  runtimeWorkerAuth: typeof runtimeWorkerAuth;
  sessions: typeof sessions;
  userExport: typeof userExport;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
