/**
 * Display metadata for the enums. Kept out of the components so the map legend,
 * the filter panel, the capture form and the list view cannot drift apart.
 */
export const CONDITIONS = [
  { value: 'GOOD', label: 'Good', color: '#117733', hint: 'Healthy, no visible damage' },
  { value: 'FAIR', label: 'Fair', color: '#ddcc77', hint: 'Some damage or stress' },
  { value: 'POOR', label: 'Poor', color: '#cc6677', hint: 'Badly damaged or diseased' },
  { value: 'DEAD', label: 'Dead', color: '#555555', hint: 'No longer alive' },
  { value: 'UNKNOWN', label: 'Not sure', color: '#88ccee', hint: '' },
] as const;

export const AGE_BANDS = [
  { value: 'YOUNG', label: 'Young', hint: 'Sapling, thin trunk', radius: 5 },
  { value: 'MID', label: 'Mature', hint: 'Full grown, bearing', radius: 7 },
  { value: 'OLD', label: 'Old', hint: 'Thick trunk, veteran', radius: 10 },
  { value: 'UNKNOWN', label: 'Not sure', hint: '', radius: 6 },
] as const;

export const FRUIT_QUALITIES = [
  { value: 'GOOD', label: 'Good', hint: 'Worth picking' },
  { value: 'FAIR', label: 'Fair', hint: 'Edible, unremarkable' },
  { value: 'POOR', label: 'Poor', hint: 'Small, damaged or sour' },
  { value: 'NONE', label: 'No fruit', hint: 'Not bearing this year' },
  { value: 'UNKNOWN', label: 'Not sure', hint: '' },
] as const;

export const CATEGORIES = [
  { value: 'FRUIT', label: 'Fruit', shape: 'circle' },
  { value: 'NUT', label: 'Nut', shape: 'triangle' },
  { value: 'BERRY', label: 'Berry', shape: 'diamond' },
  { value: 'ORNAMENTAL', label: 'Ornamental', shape: 'square' },
  { value: 'OTHER', label: 'Other', shape: 'hexagon' },
] as const;

export const TREE_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

export type ConditionValue = (typeof CONDITIONS)[number]['value'];
export type CategoryValue = (typeof CATEGORIES)[number]['value'];

export const conditionColor = (value: string): string =>
  CONDITIONS.find((entry) => entry.value === value)?.color ?? '#88ccee';

export const conditionLabel = (value: string): string =>
  CONDITIONS.find((entry) => entry.value === value)?.label ?? value;

export const ageRadius = (value: string): number =>
  AGE_BANDS.find((entry) => entry.value === value)?.radius ?? 6;

export const labelFor = (
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string => (value ? (list.find((entry) => entry.value === value)?.label ?? value) : '—');
