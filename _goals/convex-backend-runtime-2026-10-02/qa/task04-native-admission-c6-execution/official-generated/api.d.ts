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
import type * as contexts from "../contexts.js";
import type * as conversationShares from "../conversationShares.js";
import type * as conversationSnapshots from "../conversationSnapshots.js";
import type * as conversations from "../conversations.js";
import type * as factHistory from "../factHistory.js";
import type * as facts from "../facts.js";
import type * as governance from "../governance.js";
import type * as graphSync from "../graphSync.js";
import type * as http from "../http.js";
import type * as immutable from "../immutable.js";
import type * as memories from "../memories.js";
import type * as memorySpaces from "../memorySpaces.js";
import type * as mutable from "../mutable.js";
import type * as productionSchema from "../productionSchema.js";
import type * as qualificationManifest from "../qualificationManifest.js";
import type * as qualificationOwned from "../qualificationOwned.js";
import type * as qualificationPeer from "../qualificationPeer.js";
import type * as runtimeArtifactAuth from "../runtimeArtifactAuth.js";
import type * as runtimeAssetUnavailableAuth from "../runtimeAssetUnavailableAuth.js";
import type * as runtimeAuth from "../runtimeAuth.js";
import type * as runtimeAuthSchema from "../runtimeAuthSchema.js";
import type * as runtimeDataAuth from "../runtimeDataAuth.js";
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
  contexts: typeof contexts;
  conversationShares: typeof conversationShares;
  conversationSnapshots: typeof conversationSnapshots;
  conversations: typeof conversations;
  factHistory: typeof factHistory;
  facts: typeof facts;
  governance: typeof governance;
  graphSync: typeof graphSync;
  http: typeof http;
  immutable: typeof immutable;
  memories: typeof memories;
  memorySpaces: typeof memorySpaces;
  mutable: typeof mutable;
  productionSchema: typeof productionSchema;
  qualificationManifest: typeof qualificationManifest;
  qualificationOwned: typeof qualificationOwned;
  qualificationPeer: typeof qualificationPeer;
  runtimeArtifactAuth: typeof runtimeArtifactAuth;
  runtimeAssetUnavailableAuth: typeof runtimeAssetUnavailableAuth;
  runtimeAuth: typeof runtimeAuth;
  runtimeAuthSchema: typeof runtimeAuthSchema;
  runtimeDataAuth: typeof runtimeDataAuth;
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
