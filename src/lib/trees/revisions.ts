/**
 * T3.4 / T8.5 — the audit trail.
 *
 * Every write appends a revision; nothing is ever updated in place. The diff
 * records only the fields that actually changed, which keeps the history
 * readable and the table small.
 */
import { Prisma, type Tree } from '@prisma/client';

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt', 'geocodeRaw']);

export function diffTree(before: Partial<Tree>, after: Partial<Tree>): FieldDiff {
  const diff: FieldDiff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const from = (before as Record<string, unknown>)[key];
    const to = (after as Record<string, unknown>)[key];
    if (!equal(from, to)) diff[key] = { from: serialise(from), to: serialise(to) };
  }

  return diff;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function serialise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

export function revisionData(params: {
  treeId: string;
  userId: string | null;
  action: 'create' | 'update' | 'delete' | 'restore' | 'import';
  diff: FieldDiff;
}) {
  return {
    treeId: params.treeId,
    userId: params.userId,
    action: params.action,
    diff: params.diff as Prisma.InputJsonValue,
  };
}
