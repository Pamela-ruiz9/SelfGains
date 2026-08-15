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
