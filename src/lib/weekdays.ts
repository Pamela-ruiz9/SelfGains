import { kmToMeters } from './activities';

export const WEEKDAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface RoutineActivityTarget {
  activityId: string;
  targetSets?: number;
  targetReps?: number;
  targetDistanceKm?: number;
  targetDurationMin?: number;
}

// A day entry is either a bare activity id (legacy shape, and still what
// predefined plans use — no prescribed target) or an object carrying a
// target. Reading either shape the same way via entryActivityId/entryTarget
// means existing routines/plans keep working untouched; only entries added
// or edited through the routine form after this feature gain a target.
export type RoutineDayEntry = string | RoutineActivityTarget;

export type RoutineDays = Record<Weekday, RoutineDayEntry[]>;

export function entryActivityId(entry: RoutineDayEntry): string {
  return typeof entry === 'string' ? entry : entry.activityId;
}

export function entryTarget(entry: RoutineDayEntry): Omit<RoutineActivityTarget, 'activityId'> {
  return typeof entry === 'string' ? {} : entry;
}

// Short display form of a target, e.g. "4x10" or "2 km · 40 min". Returns
// null when the entry has no target at all (legacy string entries, or a
// target-carrying entry the user just didn't fill in).
export function targetSummary(
  metricType: 'sets' | 'session',
  target: Omit<RoutineActivityTarget, 'activityId'>
): string | null {
  if (metricType === 'sets') {
    if (target.targetSets && target.targetReps) return `${target.targetSets}x${target.targetReps}`;
    if (target.targetSets) return `${target.targetSets} series`;
    if (target.targetReps) return `${target.targetReps} reps`;
    return null;
  }
  const parts: string[] = [];
  if (target.targetDistanceKm) parts.push(`${kmToMeters(target.targetDistanceKm)} m`);
  if (target.targetDurationMin) parts.push(`${target.targetDurationMin} min`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

export function getTodayWeekday(date: Date = new Date()): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
