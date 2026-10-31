/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _cortex_http from "../_cortex/http.js";
import type * as _cortex_shared_auth_types from "../_cortex/shared/auth/types.js";
import type * as _cortex_shared_auth_validators from "../_cortex/shared/auth/validators.js";
import type * as _cortex_shared_auth_verified from "../_cortex/shared/auth/verified.js";
import type * as _cortex_shared_common_backendApi from "../_cortex/shared/common/backendApi.js";
import type * as _cortex_shared_common_crypto from "../_cortex/shared/common/crypto.js";
import type * as _cortex_shared_common_deploymentOperator from "../_cortex/shared/common/deploymentOperator.js";
import type * as _cortex_shared_common_domainPaging from "../_cortex/shared/common/domainPaging.js";
import type * as _cortex_shared_common_userExportSupport from "../_cortex/shared/common/userExportSupport.js";
import type * as _cortex_shared_domain_agent_language from "../_cortex/shared/domain/agent_language.js";
import type * as _cortex_shared_domain_agent_tools from "../_cortex/shared/domain/agent_tools.js";
import type * as _cortex_shared_domain_artifact_context from "../_cortex/shared/domain/artifact_context.js";
import type * as _cortex_shared_domain_assets from "../_cortex/shared/domain/assets.js";
import type * as _cortex_shared_domain_belief_plan from "../_cortex/shared/domain/belief_plan.js";
import type * as _cortex_shared_domain_clock from "../_cortex/shared/domain/clock.js";
import type * as _cortex_shared_domain_conflicts from "../_cortex/shared/domain/conflicts.js";
import type * as _cortex_shared_domain_content from "../_cortex/shared/domain/content.js";
import type * as _cortex_shared_domain_context_witness from "../_cortex/shared/domain/context_witness.js";
import type * as _cortex_shared_domain_contracts from "../_cortex/shared/domain/contracts.js";
import type * as _cortex_shared_domain_deduplication from "../_cortex/shared/domain/deduplication.js";
import type * as _cortex_shared_domain_extraction from "../_cortex/shared/domain/extraction.js";
import type * as _cortex_shared_domain_graph_projection from "../_cortex/shared/domain/graph_projection.js";
import type * as _cortex_shared_domain_ingestion from "../_cortex/shared/domain/ingestion.js";
import type * as _cortex_shared_domain_media_input from "../_cortex/shared/domain/media_input.js";
import type * as _cortex_shared_domain_media_jobs from "../_cortex/shared/domain/media_jobs.js";
import type * as _cortex_shared_domain_media_schemas from "../_cortex/shared/domain/media_schemas.js";
import type * as _cortex_shared_domain_memory_context from "../_cortex/shared/domain/memory_context.js";
import type * as _cortex_shared_domain_model_policy from "../_cortex/shared/domain/model_policy.js";
import type * as _cortex_shared_domain_profile from "../_cortex/shared/domain/profile.js";
import type * as _cortex_shared_domain_recall from "../_cortex/shared/domain/recall.js";
import type * as _cortex_shared_domain_sources from "../_cortex/shared/domain/sources.js";
import type * as _cortex_shared_domain_transcript from "../_cortex/shared/domain/transcript.js";
import type * as _cortex_shared_facts_discovery from "../_cortex/shared/facts/discovery.js";
import type * as _cortex_shared_facts_history from "../_cortex/shared/facts/history.js";
import type * as _cortex_shared_graph_erasure from "../_cortex/shared/graph/erasure.js";
import type * as _cortex_shared_graph_erasureTransport from "../_cortex/shared/graph/erasureTransport.js";
import type * as _cortex_shared_graph_identity from "../_cortex/shared/graph/identity.js";
import type * as _cortex_shared_graph_rebuildTransport from "../_cortex/shared/graph/rebuildTransport.js";
import type * as _cortex_shared_graph_schema_initSchema from "../_cortex/shared/graph/schema/initSchema.js";
import type * as _cortex_shared_graph_types from "../_cortex/shared/graph/types.js";
import type * as _cortex_shared_resilience_CircuitBreaker from "../_cortex/shared/resilience/CircuitBreaker.js";
import type * as _cortex_shared_resilience_PriorityQueue from "../_cortex/shared/resilience/PriorityQueue.js";
import type * as _cortex_shared_resilience_Semaphore from "../_cortex/shared/resilience/Semaphore.js";
import type * as _cortex_shared_resilience_TokenBucket from "../_cortex/shared/resilience/TokenBucket.js";
import type * as _cortex_shared_resilience_index from "../_cortex/shared/resilience/index.js";
import type * as _cortex_shared_resilience_priorities from "../_cortex/shared/resilience/priorities.js";
import type * as _cortex_shared_resilience_types from "../_cortex/shared/resilience/types.js";
import type * as _cortex_shared_runtime from "../_cortex/shared/runtime.js";
import type * as _cortex_shared_sessions_types from "../_cortex/shared/sessions/types.js";
import type * as _cortex_shared_types_index from "../_cortex/shared/types/index.js";
import type * as _cortex_shared_types_streaming from "../_cortex/shared/types/streaming.js";
import type * as _cortex_shared_users_erasure from "../_cortex/shared/users/erasure.js";
import type * as _cortex_shared_users_export from "../_cortex/shared/users/export.js";
import type * as a2a from "../a2a.js";
import type * as admin from "../admin.js";
import type * as agentDefinitions from "../agentDefinitions.js";
import type * as agents from "../agents.js";
import type * as app_chatData from "../app/chatData.js";
import type * as app_chatUsers from "../app/chatUsers.js";
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
import type * as http from "../http.js";
import type * as immutable from "../immutable.js";
import type * as lib_domainErasureScope from "../lib/domainErasureScope.js";
import type * as lib_domainPaging from "../lib/domainPaging.js";
import type * as lib_domainScope from "../lib/domainScope.js";
import type * as lib_factHistoryProvenance from "../lib/factHistoryProvenance.js";
import type * as lib_graphSync from "../lib/graphSync.js";
import type * as lib_memoryVectorScope from "../lib/memoryVectorScope.js";
import type * as lib_operatorBoundary from "../lib/operatorBoundary.js";
import type * as lib_referenceLifecycle from "../lib/referenceLifecycle.js";
import type * as lib_userDataScope from "../lib/userDataScope.js";
import type * as memories from "../memories.js";
import type * as memorySpaces from "../memorySpaces.js";
import type * as mutable from "../mutable.js";
import type * as referenceMaintenance from "../referenceMaintenance.js";
import type * as runs from "../runs.js";
import type * as runtimeAgent from "../runtimeAgent.js";
import type * as runtimeAgentFence from "../runtimeAgentFence.js";
import type * as runtimeAgentReferences from "../runtimeAgentReferences.js";
import type * as runtimeAgentSchema from "../runtimeAgentSchema.js";
import type * as runtimeAgentTools from "../runtimeAgentTools.js";
import type * as runtimeArtifactAuth from "../runtimeArtifactAuth.js";
import type * as runtimeArtifactContext from "../runtimeArtifactContext.js";
import type * as runtimeArtifactContextSchema from "../runtimeArtifactContextSchema.js";
import type * as runtimeAssetCatalog from "../runtimeAssetCatalog.js";
import type * as runtimeAssetUnavailableAuth from "../runtimeAssetUnavailableAuth.js";
import type * as runtimeAssets from "../runtimeAssets.js";
import type * as runtimeAssetsHttp from "../runtimeAssetsHttp.js";
import type * as runtimeAssetsSchema from "../runtimeAssetsSchema.js";
import type * as runtimeAuth from "../runtimeAuth.js";
import type * as runtimeAuthSchema from "../runtimeAuthSchema.js";
import type * as runtimeBeliefs from "../runtimeBeliefs.js";
import type * as runtimeClient from "../runtimeClient.js";
import type * as runtimeClientExtensions from "../runtimeClientExtensions.js";
import type * as runtimeContentFence from "../runtimeContentFence.js";
import type * as runtimeContentGateway from "../runtimeContentGateway.js";
import type * as runtimeContentJobs from "../runtimeContentJobs.js";
import type * as runtimeContentJobsSchema from "../runtimeContentJobsSchema.js";
import type * as runtimeContextWitness from "../runtimeContextWitness.js";
import type * as runtimeContextWitnessSchema from "../runtimeContextWitnessSchema.js";
import type * as runtimeDataAuth from "../runtimeDataAuth.js";
import type * as runtimeDelivery from "../runtimeDelivery.js";
import type * as runtimeGateway from "../runtimeGateway.js";
import type * as runtimeGatewayBackend from "../runtimeGatewayBackend.js";
import type * as runtimeGatewayMediaQualifications from "../runtimeGatewayMediaQualifications.js";
import type * as runtimeGatewayQualifications from "../runtimeGatewayQualifications.js";
import type * as runtimeGraph from "../runtimeGraph.js";
import type * as runtimeGraphSchema from "../runtimeGraphSchema.js";
import type * as runtimeIngestion from "../runtimeIngestion.js";
import type * as runtimeIngestionSchema from "../runtimeIngestionSchema.js";
import type * as runtimeMediaFence from "../runtimeMediaFence.js";
import type * as runtimeMediaGateway from "../runtimeMediaGateway.js";
import type * as runtimeMediaHttp from "../runtimeMediaHttp.js";
import type * as runtimeMediaJobs from "../runtimeMediaJobs.js";
import type * as runtimeMediaJobsSchema from "../runtimeMediaJobsSchema.js";
import type * as runtimeMemory from "../runtimeMemory.js";
import type * as runtimeMemoryContext from "../runtimeMemoryContext.js";
import type * as runtimeMemoryGateway from "../runtimeMemoryGateway.js";
import type * as runtimeMemoryRepository from "../runtimeMemoryRepository.js";
import type * as runtimeMemorySchema from "../runtimeMemorySchema.js";
import type * as runtimeMemoryServices from "../runtimeMemoryServices.js";
import type * as runtimeMetadataAuth from "../runtimeMetadataAuth.js";
import type * as runtimeModelPolicy from "../runtimeModelPolicy.js";
import type * as runtimeModelPolicyBootstrap from "../runtimeModelPolicyBootstrap.js";
import type * as runtimeOutputProjection from "../runtimeOutputProjection.js";
import type * as runtimePolicySchema from "../runtimePolicySchema.js";
import type * as runtimeRegistryAuth from "../runtimeRegistryAuth.js";
import type * as runtimeRegistryStats from "../runtimeRegistryStats.js";
import type * as runtimeTranscript from "../runtimeTranscript.js";
import type * as runtimeTranscriptSchema from "../runtimeTranscriptSchema.js";
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
  "_cortex/http": typeof _cortex_http;
  "_cortex/shared/auth/types": typeof _cortex_shared_auth_types;
  "_cortex/shared/auth/validators": typeof _cortex_shared_auth_validators;
  "_cortex/shared/auth/verified": typeof _cortex_shared_auth_verified;
  "_cortex/shared/common/backendApi": typeof _cortex_shared_common_backendApi;
  "_cortex/shared/common/crypto": typeof _cortex_shared_common_crypto;
  "_cortex/shared/common/deploymentOperator": typeof _cortex_shared_common_deploymentOperator;
  "_cortex/shared/common/domainPaging": typeof _cortex_shared_common_domainPaging;
  "_cortex/shared/common/userExportSupport": typeof _cortex_shared_common_userExportSupport;
  "_cortex/shared/domain/agent_language": typeof _cortex_shared_domain_agent_language;
  "_cortex/shared/domain/agent_tools": typeof _cortex_shared_domain_agent_tools;
  "_cortex/shared/domain/artifact_context": typeof _cortex_shared_domain_artifact_context;
  "_cortex/shared/domain/assets": typeof _cortex_shared_domain_assets;
  "_cortex/shared/domain/belief_plan": typeof _cortex_shared_domain_belief_plan;
  "_cortex/shared/domain/clock": typeof _cortex_shared_domain_clock;
  "_cortex/shared/domain/conflicts": typeof _cortex_shared_domain_conflicts;
  "_cortex/shared/domain/content": typeof _cortex_shared_domain_content;
  "_cortex/shared/domain/context_witness": typeof _cortex_shared_domain_context_witness;
  "_cortex/shared/domain/contracts": typeof _cortex_shared_domain_contracts;
  "_cortex/shared/domain/deduplication": typeof _cortex_shared_domain_deduplication;
  "_cortex/shared/domain/extraction": typeof _cortex_shared_domain_extraction;
  "_cortex/shared/domain/graph_projection": typeof _cortex_shared_domain_graph_projection;
  "_cortex/shared/domain/ingestion": typeof _cortex_shared_domain_ingestion;
  "_cortex/shared/domain/media_input": typeof _cortex_shared_domain_media_input;
  "_cortex/shared/domain/media_jobs": typeof _cortex_shared_domain_media_jobs;
  "_cortex/shared/domain/media_schemas": typeof _cortex_shared_domain_media_schemas;
  "_cortex/shared/domain/memory_context": typeof _cortex_shared_domain_memory_context;
  "_cortex/shared/domain/model_policy": typeof _cortex_shared_domain_model_policy;
  "_cortex/shared/domain/profile": typeof _cortex_shared_domain_profile;
  "_cortex/shared/domain/recall": typeof _cortex_shared_domain_recall;
  "_cortex/shared/domain/sources": typeof _cortex_shared_domain_sources;
  "_cortex/shared/domain/transcript": typeof _cortex_shared_domain_transcript;
  "_cortex/shared/facts/discovery": typeof _cortex_shared_facts_discovery;
  "_cortex/shared/facts/history": typeof _cortex_shared_facts_history;
  "_cortex/shared/graph/erasure": typeof _cortex_shared_graph_erasure;
  "_cortex/shared/graph/erasureTransport": typeof _cortex_shared_graph_erasureTransport;
  "_cortex/shared/graph/identity": typeof _cortex_shared_graph_identity;
  "_cortex/shared/graph/rebuildTransport": typeof _cortex_shared_graph_rebuildTransport;
  "_cortex/shared/graph/schema/initSchema": typeof _cortex_shared_graph_schema_initSchema;
  "_cortex/shared/graph/types": typeof _cortex_shared_graph_types;
  "_cortex/shared/resilience/CircuitBreaker": typeof _cortex_shared_resilience_CircuitBreaker;
  "_cortex/shared/resilience/PriorityQueue": typeof _cortex_shared_resilience_PriorityQueue;
  "_cortex/shared/resilience/Semaphore": typeof _cortex_shared_resilience_Semaphore;
  "_cortex/shared/resilience/TokenBucket": typeof _cortex_shared_resilience_TokenBucket;
  "_cortex/shared/resilience/index": typeof _cortex_shared_resilience_index;
  "_cortex/shared/resilience/priorities": typeof _cortex_shared_resilience_priorities;
  "_cortex/shared/resilience/types": typeof _cortex_shared_resilience_types;
  "_cortex/shared/runtime": typeof _cortex_shared_runtime;
  "_cortex/shared/sessions/types": typeof _cortex_shared_sessions_types;
  "_cortex/shared/types/index": typeof _cortex_shared_types_index;
  "_cortex/shared/types/streaming": typeof _cortex_shared_types_streaming;
  "_cortex/shared/users/erasure": typeof _cortex_shared_users_erasure;
  "_cortex/shared/users/export": typeof _cortex_shared_users_export;
  a2a: typeof a2a;
  admin: typeof admin;
  agentDefinitions: typeof agentDefinitions;
  agents: typeof agents;
  "app/chatData": typeof app_chatData;
  "app/chatUsers": typeof app_chatUsers;
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
  http: typeof http;
  immutable: typeof immutable;
  "lib/domainErasureScope": typeof lib_domainErasureScope;
  "lib/domainPaging": typeof lib_domainPaging;
  "lib/domainScope": typeof lib_domainScope;
  "lib/factHistoryProvenance": typeof lib_factHistoryProvenance;
  "lib/graphSync": typeof lib_graphSync;
  "lib/memoryVectorScope": typeof lib_memoryVectorScope;
  "lib/operatorBoundary": typeof lib_operatorBoundary;
  "lib/referenceLifecycle": typeof lib_referenceLifecycle;
  "lib/userDataScope": typeof lib_userDataScope;
  memories: typeof memories;
  memorySpaces: typeof memorySpaces;
  mutable: typeof mutable;
  referenceMaintenance: typeof referenceMaintenance;
  runs: typeof runs;
  runtimeAgent: typeof runtimeAgent;
  runtimeAgentFence: typeof runtimeAgentFence;
  runtimeAgentReferences: typeof runtimeAgentReferences;
  runtimeAgentSchema: typeof runtimeAgentSchema;
  runtimeAgentTools: typeof runtimeAgentTools;
  runtimeArtifactAuth: typeof runtimeArtifactAuth;
  runtimeArtifactContext: typeof runtimeArtifactContext;
  runtimeArtifactContextSchema: typeof runtimeArtifactContextSchema;
  runtimeAssetCatalog: typeof runtimeAssetCatalog;
  runtimeAssetUnavailableAuth: typeof runtimeAssetUnavailableAuth;
  runtimeAssets: typeof runtimeAssets;
  runtimeAssetsHttp: typeof runtimeAssetsHttp;
  runtimeAssetsSchema: typeof runtimeAssetsSchema;
  runtimeAuth: typeof runtimeAuth;
  runtimeAuthSchema: typeof runtimeAuthSchema;
  runtimeBeliefs: typeof runtimeBeliefs;
  runtimeClient: typeof runtimeClient;
  runtimeClientExtensions: typeof runtimeClientExtensions;
  runtimeContentFence: typeof runtimeContentFence;
  runtimeContentGateway: typeof runtimeContentGateway;
  runtimeContentJobs: typeof runtimeContentJobs;
  runtimeContentJobsSchema: typeof runtimeContentJobsSchema;
  runtimeContextWitness: typeof runtimeContextWitness;
  runtimeContextWitnessSchema: typeof runtimeContextWitnessSchema;
  runtimeDataAuth: typeof runtimeDataAuth;
  runtimeDelivery: typeof runtimeDelivery;
  runtimeGateway: typeof runtimeGateway;
  runtimeGatewayBackend: typeof runtimeGatewayBackend;
  runtimeGatewayMediaQualifications: typeof runtimeGatewayMediaQualifications;
  runtimeGatewayQualifications: typeof runtimeGatewayQualifications;
  runtimeGraph: typeof runtimeGraph;
  runtimeGraphSchema: typeof runtimeGraphSchema;
  runtimeIngestion: typeof runtimeIngestion;
  runtimeIngestionSchema: typeof runtimeIngestionSchema;
  runtimeMediaFence: typeof runtimeMediaFence;
  runtimeMediaGateway: typeof runtimeMediaGateway;
  runtimeMediaHttp: typeof runtimeMediaHttp;
  runtimeMediaJobs: typeof runtimeMediaJobs;
  runtimeMediaJobsSchema: typeof runtimeMediaJobsSchema;
  runtimeMemory: typeof runtimeMemory;
  runtimeMemoryContext: typeof runtimeMemoryContext;
  runtimeMemoryGateway: typeof runtimeMemoryGateway;
  runtimeMemoryRepository: typeof runtimeMemoryRepository;
  runtimeMemorySchema: typeof runtimeMemorySchema;
  runtimeMemoryServices: typeof runtimeMemoryServices;
  runtimeMetadataAuth: typeof runtimeMetadataAuth;
  runtimeModelPolicy: typeof runtimeModelPolicy;
  runtimeModelPolicyBootstrap: typeof runtimeModelPolicyBootstrap;
  runtimeOutputProjection: typeof runtimeOutputProjection;
  runtimePolicySchema: typeof runtimePolicySchema;
  runtimeRegistryAuth: typeof runtimeRegistryAuth;
  runtimeRegistryStats: typeof runtimeRegistryStats;
  runtimeTranscript: typeof runtimeTranscript;
  runtimeTranscriptSchema: typeof runtimeTranscriptSchema;
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

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
