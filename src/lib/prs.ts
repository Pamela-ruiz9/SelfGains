import { MUSCLES } from './muscles';
import type { Workout, WorkoutSet, WorkoutSession } from '../types/db';

export interface WorkoutWithSets extends Workout {
  sets: WorkoutSet[];
}

export interface ExercisePR {
  exerciseId: string;
  weight: number;
  date: string;
}

export interface ProgressPoint {
  date: string;
  maxWeight: number;
}

export interface SuggestedSet {
  reps: number;
  weight: number;
}

const WEIGHT_INCREMENT_KG = 2.5;

// Classic linear progression: suggest the same reps as last time, with
// WEIGHT_INCREMENT_KG more weight, based on the heaviest set of the most
// RECENT session for this exercise (not the all-time PR) — you're trying to
// beat your last outing, not your best-ever. Returns null if the exercise
// has never been logged.
export function suggestNextSet(workouts: WorkoutWithSets[], exerciseId: string): SuggestedSet | null {
  let mostRecentDate: string | null = null;
  for (const workout of workouts) {
    if (!workout.sets.some((s) => s.exercise_id === exerciseId)) continue;
    if (mostRecentDate === null || workout.date > mostRecentDate) {
      mostRecentDate = workout.date;
    }
  }
  if (mostRecentDate === null) return null;

  let heaviest: WorkoutSet | null = null;
  for (const workout of workouts) {
    if (workout.date !== mostRecentDate) continue;
    for (const set of workout.sets) {
      if (set.exercise_id !== exerciseId) continue;
      if (!heaviest || set.weight > heaviest.weight) heaviest = set;
    }
  }
  if (!heaviest) return null;
  return { reps: heaviest.reps, weight: heaviest.weight + WEIGHT_INCREMENT_KG };
}

export interface MuscleGroup {
  muscleId: string;
  entries: ExercisePR[];
}

// For each exercise_id, the single heaviest set ever logged (any date).
export function calculatePRs(workouts: WorkoutWithSets[]): ExercisePR[] {
  const prsByExercise = new Map<string, ExercisePR>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      const current = prsByExercise.get(set.exercise_id);
      if (!current || set.weight > current.weight) {
        prsByExercise.set(set.exercise_id, {
          exerciseId: set.exercise_id,
          weight: set.weight,
          date: workout.date,
        });
      }
    }
  }
  return Array.from(prsByExercise.values());
}

// For ONE exercise_id, one point per date with that day's heaviest set,
// sorted chronologically.
export function progressForExercise(
  workouts: WorkoutWithSets[],
  exerciseId: string
): ProgressPoint[] {
  const maxWeightByDate = new Map<string, number>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.exercise_id !== exerciseId) continue;
      const current = maxWeightByDate.get(workout.date);
      if (current === undefined || set.weight > current) {
        maxWeightByDate.set(workout.date, set.weight);
      }
    }
  }
  return Array.from(maxWeightByDate.entries())
    .map(([date, maxWeight]) => ({ date, maxWeight }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// A PR whose exercise_id isn't in the current exercise library (e.g. logged
// against an exercise later renamed or removed from src/content/exercises/)
// falls into this bucket instead of being silently dropped — muscleLabel()
// has no entry for it either, so it displays as-is via that function's own
// fallback.
const UNKNOWN_MUSCLE = 'Otros';

// Groups PRs by each exercise's primary muscle, in the same order as the
// MUSCLES taxonomy, skipping muscles with no PRs. Any PR that can't be
// matched to a known exercise/muscle goes in a trailing "Otros" group rather
// than disappearing.
export function groupPRsByMuscle(
  prs: ExercisePR[],
  exercises: { id: string; muscle: string }[]
): MuscleGroup[] {
  const muscleByExerciseId = new Map(exercises.map((e) => [e.id, e.muscle]));
  const entriesByMuscle = new Map<string, ExercisePR[]>();
  for (const pr of prs) {
    const muscle = muscleByExerciseId.get(pr.exerciseId) ?? UNKNOWN_MUSCLE;
    const list = entriesByMuscle.get(muscle) ?? [];
    list.push(pr);
    entriesByMuscle.set(muscle, list);
  }
  const knownGroups = MUSCLES.filter((m) => entriesByMuscle.has(m.id)).map((m) => ({
    muscleId: m.id,
    entries: entriesByMuscle.get(m.id)!,
  }));
  const unknownEntries = entriesByMuscle.get(UNKNOWN_MUSCLE);
  return unknownEntries
    ? [...knownGroups, { muscleId: UNKNOWN_MUSCLE, entries: unknownEntries }]
    : knownGroups;
}

export interface WorkoutWithSessions extends Workout {
  sessions: WorkoutSession[];
}

export interface CardioPR {
  activityId: string;
  paceMinPerKm: number;
  date: string;
}

export interface CardioProgressPoint {
  date: string;
  paceMinPerKm: number;
}

export interface DisciplineGroup {
  discipline: string;
  entries: CardioPR[];
}

// For each activity_id, the fastest pace (lowest duration_min / distance_km)
// ever logged. Sessions with no distance (combate) never produce a pace and
// are skipped entirely — there's no "record" for a duration-only session.
export function calculateCardioPRs(workouts: WorkoutWithSessions[]): CardioPR[] {
  const prsByActivity = new Map<string, CardioPR>();
  for (const workout of workouts) {
    for (const session of workout.sessions) {
      if (session.distance_km === null) continue;
      const pace = session.duration_min / session.distance_km;
      const current = prsByActivity.get(session.activity_id);
      if (!current || pace < current.paceMinPerKm) {
        prsByActivity.set(session.activity_id, {
          activityId: session.activity_id,
          paceMinPerKm: pace,
          date: workout.date,
        });
      }
    }
  }
  return Array.from(prsByActivity.values());
}

// For ONE activity_id, one point per date with that day's fastest pace,
// sorted chronologically. Mirrors progressForExercise.
export function progressForCardioActivity(
  workouts: WorkoutWithSessions[],
  activityId: string
): CardioProgressPoint[] {
  const bestPaceByDate = new Map<string, number>();
  for (const workout of workouts) {
    for (const session of workout.sessions) {
      if (session.activity_id !== activityId || session.distance_km === null) continue;
      const pace = session.duration_min / session.distance_km;
      const current = bestPaceByDate.get(workout.date);
      if (current === undefined || pace < current) {
        bestPaceByDate.set(workout.date, pace);
      }
    }
  }
  return Array.from(bestPaceByDate.entries())
    .map(([date, paceMinPerKm]) => ({ date, paceMinPerKm }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// A PR whose activity_id isn't in the current activities collection (e.g. an
// activity later renamed or removed) falls into this bucket instead of
// disappearing — same fallback as groupPRsByMuscle for gym.
const UNKNOWN_DISCIPLINE = 'Otros';

// Groups cardio PRs by discipline ('running' | 'natacion'), skipping
// disciplines with no PRs. Combate never appears here (calculateCardioPRs
// already excludes it).
export function groupCardioPRsByDiscipline(
  prs: CardioPR[],
  activities: { id: string; discipline: string }[]
): DisciplineGroup[] {
  const disciplineByActivityId = new Map(activities.map((a) => [a.id, a.discipline]));
  const entriesByDiscipline = new Map<string, CardioPR[]>();
  for (const pr of prs) {
    const discipline = disciplineByActivityId.get(pr.activityId) ?? UNKNOWN_DISCIPLINE;
    const list = entriesByDiscipline.get(discipline) ?? [];
    list.push(pr);
    entriesByDiscipline.set(discipline, list);
  }
  const order = ['running', 'natacion'];
  const knownGroups = order
    .filter((d) => entriesByDiscipline.has(d))
    .map((d) => ({ discipline: d, entries: entriesByDiscipline.get(d)! }));
  const unknownEntries = entriesByDiscipline.get(UNKNOWN_DISCIPLINE);
  return unknownEntries
    ? [...knownGroups, { discipline: UNKNOWN_DISCIPLINE, entries: unknownEntries }]
    : knownGroups;
}

export interface DisciplineSummary {
  discipline: string;
  sessionCount: number; // distinct days trained in this discipline
  totalMinutes: number | null; // null for gym — sets have no duration logged
  setCount: number | null; // null for session-based disciplines (running/natacion/combate)
}

// One entry per discipline the user has actually logged something in —
// disciplines with zero activity are omitted entirely rather than shown as
// empty, so this doubles as "which disciplines do you practice".
export function summarizeByDiscipline(
  workouts: (WorkoutWithSets & WorkoutWithSessions)[],
  activities: { id: string; discipline: string }[]
): DisciplineSummary[] {
  const disciplineByActivityId = new Map(activities.map((a) => [a.id, a.discipline]));

  const gymDates = new Set<string>();
  let gymSetCount = 0;
  const cardioStats = new Map<string, { dates: Set<string>; totalMinutes: number }>();

  for (const workout of workouts) {
    if (workout.sets.length > 0) {
      gymDates.add(workout.date);
      gymSetCount += workout.sets.length;
    }
    for (const session of workout.sessions) {
      const discipline = disciplineByActivityId.get(session.activity_id) ?? UNKNOWN_DISCIPLINE;
      const stat = cardioStats.get(discipline) ?? { dates: new Set<string>(), totalMinutes: 0 };
      stat.dates.add(workout.date);
      stat.totalMinutes += session.duration_min;
      cardioStats.set(discipline, stat);
    }
  }

  const summaries: DisciplineSummary[] = [];
  if (gymDates.size > 0) {
    summaries.push({
      discipline: 'gym',
      sessionCount: gymDates.size,
      totalMinutes: null,
      setCount: gymSetCount,
    });
  }
  for (const discipline of ['running', 'natacion', 'combate', UNKNOWN_DISCIPLINE]) {
    const stat = cardioStats.get(discipline);
    if (!stat) continue;
    summaries.push({
      discipline,
      sessionCount: stat.dates.size,
      totalMinutes: Math.round(stat.totalMinutes),
      setCount: null,
    });
  }
  return summaries;
}

// Formats a pace in minutes-per-km as "M:SS /km" (e.g. 5.5 -> "5:30 /km").
export function formatPace(paceMinPerKm: number): string {
  const totalSeconds = Math.round(paceMinPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
