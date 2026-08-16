import type { CollectionEntry } from 'astro:content';

type ActivityEntry = CollectionEntry<'activities'>;
type GymActivityData = Extract<ActivityEntry['data'], { metricType: 'sets' }>;

// Narrows a mixed `activities` entry down to the gym ('sets') variant, so
// callers can access `muscles`/`equipment` without a manual cast. Pages that
// only ever need gym content (Explorador Muscular, the Progreso PR grid)
// filter with this before reading those fields.
export function isGymActivity(entry: ActivityEntry): entry is ActivityEntry & { data: GymActivityData } {
  return entry.data.metricType === 'sets';
}

// Every session-based discipline tracks distance except combate, which is
// duration-only (there's no meaningful distance in a boxing/muay thai class).
export function requiresDistance(activity: { discipline: string }): boolean {
  return activity.discipline !== 'combate';
}

// Distance is stored/summed in km everywhere (DB column, pace math) but
// shown/entered in meters in the UI — swim/run session distances are small
// enough that meters read far more naturally than fractional km.
export function kmToMeters(km: number): number {
  return Math.round(km * 1000);
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

// Fixed per-discipline colors for the little tags on each workout-history
// day — categorical labels, not the user's customizable accent, so these
// stay constant regardless of theme/accent picks.
export const DISCIPLINE_COLORS: Record<string, string> = {
  gym: 'var(--color-acid)',
  running: 'var(--color-blood)',
  natacion: '#3fa9ff',
  combate: '#a855f7',
};

const GROUP_LABELS: Record<string, string> = {
  crol: 'Crol',
  dorso: 'Dorso',
  mariposa: 'Mariposa',
  pecho: 'Pecho',
};

// Canonical display order for known groups (e.g. swim strokes), since content
// entries are otherwise sorted alphabetically by name and that would put
// numeric drill names ("2 patadas...") ahead of "Crol" for no good reason.
export const KNOWN_GROUPS = Object.keys(GROUP_LABELS);

export function groupLabel(group: string | undefined): string | undefined {
  if (!group) return undefined;
  return GROUP_LABELS[group] ?? group;
}

// Activity `name` only holds the drill/variant (e.g. "Catch-up") since the
// discipline and group are already implied once you're inside that tab/
// selector in the activity picker. Anywhere an activity name is shown flat
// (routine summaries, workout history, PR cards) it needs that context back,
// so this reconstructs the qualified "Crol — Catch-up" form for display.
export function fullActivityName(activity: { name: string; group?: string }): string {
  const label = groupLabel(activity.group);
  return label ? `${label} — ${activity.name}` : activity.name;
}
