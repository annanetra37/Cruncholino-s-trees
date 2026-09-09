/** T7.2 / T10.1 — the authorisation rules, as pure functions. */
import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { atLeast, canEditTree, fuzzCoordinate } from '@/lib/policy';

const contributor = { id: 'user-1', role: Role.CONTRIBUTOR };
const otherContributor = { id: 'user-2', role: Role.CONTRIBUTOR };
const reviewer = { id: 'user-3', role: Role.REVIEWER };
const admin = { id: 'user-4', role: Role.ADMIN };

describe('atLeast', () => {
  it('ranks the roles', () => {
    expect(atLeast(Role.ADMIN, Role.REVIEWER)).toBe(true);
    expect(atLeast(Role.REVIEWER, Role.REVIEWER)).toBe(true);
    expect(atLeast(Role.CONTRIBUTOR, Role.REVIEWER)).toBe(false);
    expect(atLeast(undefined, Role.CONTRIBUTOR)).toBe(false);
  });
});

describe('canEditTree', () => {
  it('lets a contributor edit their own tree', () => {
    expect(canEditTree(contributor, { createdById: 'user-1' })).toBe(true);
  });

  it("refuses a contributor another contributor's tree", () => {
    // This is the rule T7.2 exists for.
    expect(canEditTree(otherContributor, { createdById: 'user-1' })).toBe(false);
  });

  it('lets reviewers and admins edit anything', () => {
    expect(canEditTree(reviewer, { createdById: 'user-1' })).toBe(true);
    expect(canEditTree(admin, { createdById: 'user-1' })).toBe(true);
  });

  it('refuses anonymous callers', () => {
    expect(canEditTree(null, { createdById: 'user-1' })).toBe(false);
  });

  it('does not let an orphaned tree become everyone’s tree', () => {
    // createdById is nulled when a user is deleted; `null === null` would
    // otherwise hand every contributor edit rights over it.
    expect(canEditTree(contributor, { createdById: null })).toBe(false);
    expect(canEditTree(reviewer, { createdById: null })).toBe(true);
  });
});

describe('fuzzCoordinate', () => {
  it('rounds to roughly 100 m', () => {
    expect(fuzzCoordinate(40.187234)).toBe(40.187);
    expect(fuzzCoordinate(44.515678)).toBe(44.516);
  });

  it('is stable, so a fuzzed tree does not wander between requests', () => {
    expect(fuzzCoordinate(40.187234)).toBe(fuzzCoordinate(40.187111));
  });
});
