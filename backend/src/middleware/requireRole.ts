/**
 * @file RBAC role enforcement middleware.
 *
 * Must be composed after `requireAuth` — it requires `userId` to be set on the
 * context. It then looks up the caller's role in `team_members` for the given
 * team and rejects with 403 if the role is not in the allowed list.
 *
 * Role hierarchy (most → least permissive):
 *   `admin`       — full access to all features and settings
 *   `developer`   — developer settings, integrations, read inbox
 *   `subordinate` — inbox and conversations only
 */

import type { Context, Next } from 'hono';
import { ApiError } from '../utils/errors.js';
import { teamMembers } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { AppEnv } from '../types/honoContext.js';

/** All valid roles in the system. */
export type Role = 'admin' | 'developer' | 'subordinate';

/**
 * Returns a Hono middleware that allows only callers with one of the given roles.
 *
 * The team is identified by `teamId` in order of preference:
 * 1. Route parameter (`/teams/:teamId/...`)
 * 2. Query parameter (`?teamId=...`)
 *
 * On success it writes `teamId` (as a string) to the request context so
 * downstream handlers can use `c.get('teamId')` without another DB lookup.
 *
 * @param allowedRoles - One or more roles permitted to call the route
 *
 * @example
 * // Only admins can delete a team member
 * router.delete('/members/:id', requireAuth, requireRole('admin'), handler);
 *
 * @example
 * // Admins and developers can view integrations
 * router.get('/integrations', requireAuth, requireRole('admin', 'developer'), handler);
 */
export function requireRole(
  ...allowedRoles: Role[]
): (c: Context<AppEnv>, next: Next) => Promise<void> {
  return async (c, next) => {
    const userId = c.get('userId');
    const db = c.get('db');

    if (!userId) {
      // Programming error — requireRole composed without requireAuth
      throw new ApiError(401, 'requireRole must be composed after requireAuth', 'UNAUTHORIZED');
    }

    const teamIdRaw = c.req.param('teamId') ?? c.req.query('teamId');
    if (!teamIdRaw) {
      throw new ApiError(400, 'teamId is required for this endpoint', 'MISSING_TEAM_ID');
    }

    const teamIdInt = parseInt(teamIdRaw, 10);
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

    // Attach the resolved teamId so handlers can use c.get('teamId')
    c.set('teamId', String(teamIdInt));

    await next();
  };
}
