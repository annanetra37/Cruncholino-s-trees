/**
 * The authorisation rules, as pure functions.
 *
 * Kept separate from `authz.ts` — which reaches for the session and therefore
 * drags in Auth.js and the whole Next server runtime — so the rules themselves
 * can be tested directly. A permission rule that is awkward to test is a
 * permission rule nobody tests.
 */
import { Role } from '@prisma/client';

export type Actor = { id: string; role: Role };

const RANK: Record<Role, number> = {
  CONTRIBUTOR: 1,
  REVIEWER: 2,
  ADMIN: 3,
};

export function atLeast(role: Role | undefined | null, minimum: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[minimum];
}

/**
 * CONTRIBUTOR edits its own; REVIEWER and above edit anything.
 *
 * The `createdById !== null` guard matters: the column is nulled when a user is
 * deleted, and without it `null === null` would hand every contributor edit
 * rights over every orphaned tree.
 */
export function canEditTree(
  user: Actor | null,
  tree: { createdById: string | null },
): boolean {
  if (!user) return false;
  if (atLeast(user.role, Role.REVIEWER)) return true;
  return tree.createdById !== null && tree.createdById === user.id;
}

/**
 * T7.3 — coordinate privacy for signed-out viewers. Three decimal places is
 * about 110 m: enough to map a neighbourhood's fruit trees, not enough to walk
 * someone to a specific tree in a private garden.
 */
export const FUZZ_DECIMALS = 3;

export function fuzzCoordinate(value: number): number {
  const factor = 10 ** FUZZ_DECIMALS;
  return Math.round(value * factor) / factor;
}
