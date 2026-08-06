import { MUSCLES } from './muscles';
import type { Workout, WorkoutSet } from '../types/db';

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
