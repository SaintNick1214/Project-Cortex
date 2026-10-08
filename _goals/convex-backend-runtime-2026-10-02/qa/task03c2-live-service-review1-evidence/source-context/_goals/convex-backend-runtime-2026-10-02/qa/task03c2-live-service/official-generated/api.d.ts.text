/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as immutable from "../immutable.js";
import type * as mutable from "../mutable.js";
import type * as runtimeAuth from "../runtimeAuth.js";
import type * as runtimeAuthSchema from "../runtimeAuthSchema.js";
import type * as runtimeMemorySchema from "../runtimeMemorySchema.js";
import type * as runtimeMetadataAuth from "../runtimeMetadataAuth.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  immutable: typeof immutable;
  mutable: typeof mutable;
  runtimeAuth: typeof runtimeAuth;
  runtimeAuthSchema: typeof runtimeAuthSchema;
  runtimeMemorySchema: typeof runtimeMemorySchema;
  runtimeMetadataAuth: typeof runtimeMetadataAuth;
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
