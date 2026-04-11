/**
 * @file Shared Hono application environment type.
 *
 * A single generic parameter for all routers and middleware so there is no
 * inconsistency between what `c.get()`/`c.set()` expects across files, and
 * so that middleware functions don't need internal type casts to satisfy the
 * TypeScript compiler.
 *
 * Usage:
 *   import type { AppEnv } from '../types/honoContext.js';
 *   const router = new OpenAPIHono<AppEnv>();
 *   async function myMiddleware(c: Context<AppEnv>, next: Next) { ... }
 */

import type { WorkerBindings } from './bindings.js';

/** Variables available on every request context after the global middleware runs. */
export interface AppVariables {
  /** Unique UUID per request — set by the correlation-ID middleware in index.ts */
  requestId: string;
  /** Supabase user UUID — present after requireAuth runs */
  userId: string;
  /** Authenticated user's email — present after requireAuth runs */
  userEmail: string;
  /** Resolved team ID (string) — present after requireRole runs */
  teamId: string;
}

/** Full Hono generic environment for routers, middleware, and handlers. */
export interface AppEnv {
  Bindings: WorkerBindings;
  Variables: AppVariables;
}
