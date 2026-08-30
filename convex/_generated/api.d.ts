/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as crons from "../crons.js";
import type * as folders from "../folders.js";
import type * as lib_apiKeys from "../lib/apiKeys.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validation from "../lib/validation.js";
import type * as pastes from "../pastes.js";
import type * as rateLimit from "../rateLimit.js";
import type * as storage from "../storage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  crons: typeof crons;
  folders: typeof folders;
  "lib/apiKeys": typeof lib_apiKeys;
  "lib/auth": typeof lib_auth;
  "lib/password": typeof lib_password;
  "lib/tokens": typeof lib_tokens;
  "lib/validation": typeof lib_validation;
  pastes: typeof pastes;
  rateLimit: typeof rateLimit;
  storage: typeof storage;
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
