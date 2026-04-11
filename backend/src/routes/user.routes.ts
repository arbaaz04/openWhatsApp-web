import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users, teams, teamMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { WorkerBindings } from '../types/bindings.js';

type Variables = { requestId: string; userId: string; userEmail: string; teamId: string };

const userRouter = new OpenAPIHono<{ Bindings: WorkerBindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// POST /api/users/me — upsert the authenticated user's profile
// Called once after OAuth sign-in completes on the frontend.
// ---------------------------------------------------------------------------
const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      description: 'Authenticated user profile with team memberships',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              avatarUrl: z.string().nullable(),
            }),
            teams: z.array(
              z.object({ teamId: z.number(), name: z.string(), role: z.string() })
            ),
          }),
        },
      },
    },
    401: { description: 'Unauthorized — invalid or missing JWT' },
  },
});

userRouter.use('/me', requireAuth);
userRouter.openapi(meRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');

  // Upsert user record — creates on first call, no-ops on subsequent calls
  await db
    .insert(users)
    .values({
      id: userId,
      email: c.get('userEmail'),
    })
    .onConflictDoNothing(); // Already exists — skip

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new ApiError(500, 'Failed to resolve user record', 'DB_ERROR');

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      name: teams.name,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  log.info('User profile resolved', { userId, teamCount: memberships.length });

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    },
    teams: memberships.map((m) => ({
      teamId: m.teamId ?? 0,
      name: m.name,
      role: m.role,
    })),
  }, 200);
});

// ---------------------------------------------------------------------------
// POST /api/users/teams — create a new team (called after first sign-in)
// ---------------------------------------------------------------------------
const createTeamRoute = createRoute({
  method: 'post',
  path: '/teams',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ name: z.string().min(1).max(255) }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Team created',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), teamId: z.number() }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

userRouter.use('/teams', requireAuth);
userRouter.openapi(createTeamRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  const teamId = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ name, ownerUserId: userId })
      .returning({ id: teams.id });

    if (!team) throw new ApiError(500, 'Failed to create team', 'DB_ERROR');

    // Creator is automatically an admin of the team they created.
    await tx.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role: 'admin',
    });

    return team.id;
  });

  log.info('Team created', { teamId, name, userId });

  return c.json({ success: true, teamId }, 201);
});

// ---------------------------------------------------------------------------
// POST /api/users/teams/:teamId/members — invite a registered user
// Only admins can invite new members.
// ---------------------------------------------------------------------------
const inviteMemberRoute = createRoute({
  method: 'post',
  path: '/teams/:teamId/members',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            role: z.enum(['admin', 'developer', 'subordinate']),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Member invited',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    400: { description: 'User not found or already a member' },
    401: { description: 'Unauthorized' },
    403: { description: 'Insufficient permissions — admin required' },
  },
});

userRouter.use('/teams/:teamId/members', requireAuth);
userRouter.use('/teams/:teamId/members', requireRole('admin'));
userRouter.openapi(inviteMemberRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const inviterId = c.get('userId');
  const teamId = parseInt(c.req.param('teamId'), 10);
  const { email, role } = c.req.valid('json');

  // Resolve the invitee — they must already have an account on WhatFlow
  const [invitee] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!invitee) {
    throw new ApiError(400, 'No account found with that email address', 'USER_NOT_FOUND');
  }

  // Prevent duplicate memberships (the unique index would catch it anyway, but
  // a clear error is better than a raw DB constraint violation)
  const [existing] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, invitee.id)))
    .limit(1);

  if (existing) {
    throw new ApiError(400, 'User is already a member of this team', 'ALREADY_MEMBER');
  }

  await db.insert(teamMembers).values({
    teamId,
    userId: invitee.id,
    role,
    invitedBy: inviterId,
  });

  log.info('Team member invited', { teamId, inviteeId: invitee.id, role });

  return c.json({ success: true }, 200);
});

// ---------------------------------------------------------------------------
// PATCH /api/users/teams/:teamId/members/:userId — update a member's role
// ---------------------------------------------------------------------------
const updateMemberRoute = createRoute({
  method: 'patch',
  path: '/teams/:teamId/members/:userId',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ role: z.enum(['admin', 'developer', 'subordinate']) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role updated',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    403: { description: 'Admin required' },
    404: { description: 'Member not found' },
  },
});

userRouter.use('/teams/:teamId/members/:userId', requireAuth);
userRouter.use('/teams/:teamId/members/:userId', requireRole('admin'));

userRouter.openapi(updateMemberRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const targetUserId = c.req.param('userId');
  const { role } = c.req.valid('json');

  const [updated] = await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
    .returning({ id: teamMembers.id });

  if (!updated) {
    throw new ApiError(404, 'Member not found', 'NOT_FOUND');
  }

  log.info('Member role updated', { teamId, targetUserId, role });

  return c.json({ success: true }, 200);
});

// ---------------------------------------------------------------------------
// DELETE /api/users/teams/:teamId/members/:userId — remove a team member
// ---------------------------------------------------------------------------
const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/teams/:teamId/members/:userId',
  responses: {
    200: {
      description: 'Member removed',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: { description: 'Admin required' },
    404: { description: 'Member not found' },
  },
});

// Explicitly register middleware for the DELETE route as well to appease static analysis
// (Even though the previous `use` for this path applies to all methods)
userRouter.use('/teams/:teamId/members/:userId', requireAuth);
userRouter.use('/teams/:teamId/members/:userId', requireRole('admin'));
userRouter.openapi(removeMemberRoute, async (c) => {
  const log = createLogger({ requestId: c.get('requestId') });
  const teamId = parseInt(c.req.param('teamId'), 10);
  const targetUserId = c.req.param('userId');

  const [removed] = await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
    .returning({ id: teamMembers.id });

  if (!removed) {
    throw new ApiError(404, 'Member not found', 'NOT_FOUND');
  }

  log.info('Member removed from team', { teamId, targetUserId });

  return c.json({ success: true }, 200);
});

export default userRouter;
