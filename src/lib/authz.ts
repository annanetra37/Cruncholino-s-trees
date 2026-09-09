/**
 * T7.2 — role enforcement.
 *
 * CONTRIBUTOR creates trees and edits its own; REVIEWER edits and flags any
 * tree; ADMIN does everything plus species management, user management and
 * export. Every rule lives here so the route handlers read as policy, not as
 * a pile of inline conditionals — and so the rules can be unit-tested without
 * standing up an HTTP server.
 */
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { forbidden, unauthorized } from '@/lib/api';
import { env } from '@/env';
import { atLeast, canEditTree, fuzzCoordinate } from '@/lib/policy';

// The rules themselves live in `policy.ts` and are re-exported here so callers
// have one import; see that file for why they are kept separate.
export { atLeast, canEditTree, fuzzCoordinate };

export type SessionUser = { id: string; email: string; name: string | null; role: Role };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? null,
    role: session.user.role ?? Role.CONTRIBUTOR,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!atLeast(user.role, minimum)) {
    throw forbidden(`This action requires the ${minimum.toLowerCase()} role`);
  }
  return user;
}

/** Reading is public unless the deployment says otherwise (T7.3). */
export async function requireReadAccess(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user && !env.PUBLIC_READ) throw unauthorized('This dashboard is private');
  return user;
}

export function assertCanEditTree(
  user: Pick<SessionUser, 'id' | 'role'> | null,
  tree: { createdById: string | null },
) {
  if (!user) throw unauthorized();
  if (!canEditTree(user, tree)) throw forbidden('You can only edit trees you added');
}

/** T7.3 — signed-out viewers get rounded coordinates when the flag is on. */
export function shouldFuzzCoordinates(user: SessionUser | null): boolean {
  return env.FUZZ_PUBLIC_COORDINATES && user === null;
}
