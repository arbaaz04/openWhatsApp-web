/**
 * @file RBAC role enforcement middleware.
 *
 * Must be used after `requireAuth` — it assumes `userId` is already set on
 * the context. Looks up the caller's role in `team_members` for the given
 * team (resolved from a `teamId` route/query param) and rejects if the role
 * is not in the allowed list.
 *
 * Role hierarchy:
 * - `admin`       — full access to all features and settings
 * - `developer`   — developer settings, integrations, read inbox
 * - `subordinate` — inbox and conversations only
 */

import type { Context, Next } from 'hono';
import { ApiError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { teamMembers } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

/** All valid roles in the system. */
export type Role = 'admin' | 'developer' | 'subordinate';

/**
 * Returns a Hono middleware that allows only callers with one of the specified
 * roles on the team indicated by the `teamId` route parameter.
 *
 * The `teamId` is read from:
 * 1. Route parameter `c.req.param('teamId')` — for routes like `/teams/:teamId/...`
 * 2. Query parameter `c.req.query('teamId')` — fallback for flat routes
 *
 * @param allowedRoles - One or more roles permitted to access the route
 *
 * @example
 * // Only admins can delete a team member
 * router.delete('/members/:userId', requireAuth, requireRole('admin'), handler);
 *
 * @example
 * // Admins and developers can view integrations
 * router.get('/integrations', requireAuth, requireRole('admin', 'developer'), handler);
 */
export function requireRole(
  ...allowedRoles: Role[]
): (c: Context<{ Bindings: WorkerBindings }>, next: Next) => Promise<void> {
  return async (c, next) => {
    const userId = (c as Context<{ Bindings: WorkerBindings; Variables: Record<string, string> }>)
      .get('userId');

    if (!userId) {
      throw new ApiError(401, 'requireRole used without requireAuth', 'UNAUTHORIZED');
    }

    const teamId = c.req.param('teamId') ?? c.req.query('teamId');
    if (!teamId) {
      throw new ApiError(400, 'teamId is required for this endpoint', 'MISSING_TEAM_ID');
    }

    const teamIdInt = parseInt(teamId, 10);
    if (isNaN(teamIdInt)) {
      throw new ApiError(400, 'teamId must be a valid integer', 'INVALID_TEAM_ID');
    }

    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamIdInt),
          eq(teamMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      // Deliberately vague — don't reveal whether the team exists
      throw new ApiError(403, 'You do not have access to this team', 'FORBIDDEN');
    }

    if (!allowedRoles.includes(membership.role as Role)) {
      throw new ApiError(
        403,
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        'FORBIDDEN'
      );
    }

    // Attach resolved teamId for convenience in downstream handlers
    (c as Context<{ Bindings: WorkerBindings; Variables: Record<string, string> }>)
      .set('teamId', String(teamIdInt));

    await next();
  };
}
