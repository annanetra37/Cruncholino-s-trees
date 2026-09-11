/**
 * Display metadata for the enums.
 *
 * These carry message keys, not labels: the same list feeds the map legend,
 * the filter panel, the capture form and the list view, in both languages. A
 * component that hardcoded "Good" would be an English string that no amount of
 * switching language could reach.
 */
import type { MessageKey } from '@/i18n';

export type Choice = {
  value: string;
  labelKey: MessageKey;
  hintKey?: MessageKey;
  color?: string;
};

export const CONDITIONS = [
  { value: 'GOOD', labelKey: 'condition.GOOD', hintKey: 'condition.GOOD.hint', color: '#117733' },
  { value: 'FAIR', labelKey: 'condition.FAIR', hintKey: 'condition.FAIR.hint', color: '#ddcc77' },
  { value: 'POOR', labelKey: 'condition.POOR', hintKey: 'condition.POOR.hint', color: '#cc6677' },
  { value: 'DEAD', labelKey: 'condition.DEAD', hintKey: 'condition.DEAD.hint', color: '#555555' },
  {
    value: 'UNKNOWN',
    labelKey: 'condition.UNKNOWN',
    hintKey: 'condition.UNKNOWN.hint',
    color: '#88ccee',
  },
] as const satisfies readonly Choice[];

export const AGE_BANDS = [
  { value: 'YOUNG', labelKey: 'age.YOUNG', hintKey: 'age.YOUNG.hint', radius: 5 },
  { value: 'MID', labelKey: 'age.MID', hintKey: 'age.MID.hint', radius: 7 },
  { value: 'OLD', labelKey: 'age.OLD', hintKey: 'age.OLD.hint', radius: 10 },
  { value: 'UNKNOWN', labelKey: 'age.UNKNOWN', hintKey: 'age.UNKNOWN.hint', radius: 6 },
] as const;

export const FRUIT_QUALITIES = [
  { value: 'GOOD', labelKey: 'fruit.GOOD', hintKey: 'fruit.GOOD.hint' },
  { value: 'FAIR', labelKey: 'fruit.FAIR', hintKey: 'fruit.FAIR.hint' },
  { value: 'POOR', labelKey: 'fruit.POOR', hintKey: 'fruit.POOR.hint' },
  { value: 'NONE', labelKey: 'fruit.NONE', hintKey: 'fruit.NONE.hint' },
  { value: 'UNKNOWN', labelKey: 'fruit.UNKNOWN', hintKey: 'fruit.UNKNOWN.hint' },
] as const satisfies readonly Choice[];

export const REACHABILITIES = [
  { value: 'GROUND', labelKey: 'reach.GROUND', hintKey: 'reach.GROUND.hint' },
  { value: 'LADDER', labelKey: 'reach.LADDER', hintKey: 'reach.LADDER.hint' },
  { value: 'OUT_OF_REACH', labelKey: 'reach.OUT_OF_REACH', hintKey: 'reach.OUT_OF_REACH.hint' },
  { value: 'UNKNOWN', labelKey: 'reach.UNKNOWN', hintKey: 'reach.UNKNOWN.hint' },
] as const satisfies readonly Choice[];

export const CATEGORIES = [
  { value: 'FRUIT', labelKey: 'category.FRUIT', shape: 'circle' },
  { value: 'NUT', labelKey: 'category.NUT', shape: 'triangle' },
  { value: 'BERRY', labelKey: 'category.BERRY', shape: 'diamond' },
  { value: 'ORNAMENTAL', labelKey: 'category.ORNAMENTAL', shape: 'square' },
  { value: 'OTHER', labelKey: 'category.OTHER', shape: 'hexagon' },
] as const;

export const TREE_STATUSES = [
  { value: 'DRAFT', labelKey: 'treeStatus.DRAFT' },
  { value: 'PUBLISHED', labelKey: 'treeStatus.PUBLISHED' },
  { value: 'FLAGGED', labelKey: 'treeStatus.FLAGGED' },
  { value: 'ARCHIVED', labelKey: 'treeStatus.ARCHIVED' },
] as const satisfies readonly Choice[];

export const SORT_OPTIONS = [
  { value: 'created_at:desc', labelKey: 'sort.newest' },
  { value: 'created_at:asc', labelKey: 'sort.oldest' },
  { value: 'species:asc', labelKey: 'sort.species' },
  { value: 'condition:asc', labelKey: 'sort.condition' },
  { value: 'city:asc', labelKey: 'sort.city' },
] as const satisfies readonly Choice[];

export const conditionColor = (value: string): string =>
  CONDITIONS.find((entry) => entry.value === value)?.color ?? '#88ccee';

export const ageRadius = (value: string): number =>
  AGE_BANDS.find((entry) => entry.value === value)?.radius ?? 6;

/** The message key for an enum value, so callers can translate it themselves. */
export const labelKeyFor = (
  list: readonly Choice[],
  value: string | null | undefined,
): MessageKey | null =>
  value ? (list.find((entry) => entry.value === value)?.labelKey ?? null) : null;
