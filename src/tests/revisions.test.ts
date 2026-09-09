/** T10.1 — the audit diff records changes and nothing else. */
import { describe, expect, it } from 'vitest';
import { diffTree } from '@/lib/trees/revisions';

describe('diffTree', () => {
  it('records only what changed', () => {
    const diff = diffTree(
      { condition: 'GOOD', notes: 'same', latitude: 40.1 },
      { condition: 'POOR', notes: 'same', latitude: 40.1 },
    );
    expect(Object.keys(diff)).toEqual(['condition']);
    expect(diff.condition).toEqual({ from: 'GOOD', to: 'POOR' });
  });

  it('ignores fields that change on every write', () => {
    const diff = diffTree(
      { updatedAt: new Date('2026-01-01'), condition: 'GOOD' },
      { updatedAt: new Date('2026-01-02'), condition: 'GOOD' },
    );
    expect(diff).toEqual({});
  });

  it('compares dates by value, not identity', () => {
    const diff = diffTree(
      { deletedAt: new Date('2026-01-01') },
      { deletedAt: new Date('2026-01-01') },
    );
    expect(diff).toEqual({});
  });

  it('serialises dates so the diff survives JSON storage', () => {
    const diff = diffTree({ deletedAt: null }, { deletedAt: new Date('2026-01-02T00:00:00Z') });
    expect(diff.deletedAt?.to).toBe('2026-01-02T00:00:00.000Z');
  });

  it('treats null and undefined as the same absence', () => {
    expect(diffTree({ notes: null }, { notes: undefined })).toEqual({});
  });
});
