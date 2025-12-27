/**
 * Cortex SDK - Auth Context System
 *
 * Provides framework-agnostic authentication context management.
 * Developers bring their own auth provider; Cortex provides clean interfaces.
 */

export { createAuthContext, validateAuthContext } from "./context";
export { AuthValidationError } from "./validators";
export type { AuthContext, AuthContextParams, AuthMethod } from "./types";
