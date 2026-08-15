import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout, getSessionsForWorkout } from '../../../lib/workouts';
import {
  calculatePRs,
  groupPRsByMuscle,
  progressForExercise,
  calculateCardioPRs,
  groupCardioPRsByDiscipline,
  progressForCardioActivity,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import PRGrid from './PRGrid';
import ProgressChart from './ProgressChart';
import CardioPRGrid from './CardioPRGrid';
import CardioProgressChart from './CardioProgressChart';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  exerciseNames: Record<string, string>;
  exercises: ExerciseInfo[];
  activities: ActivityOption[];
}

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

export default function ProgressList({ exerciseNames, exercises, activities }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedCardioActivityId, setSelectedCardioActivityId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      try {
        const list = await getWorkoutsForCurrentUser();
        const withLogs = await Promise.all(
          list.map(async (w) => ({
            ...w,
            sets: await getSetsForWorkout(w.id),
            sessions: await getSessionsForWorkout(w.id),
          }))
        );
        setWorkouts(withLogs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const prs = calculatePRs(workouts);
  const muscleGroups = groupPRsByMuscle(prs, exercises);

  const cardioPrs = calculateCardioPRs(workouts);
  const disciplineGroups = groupCardioPRsByDiscipline(cardioPrs, activities);

  const activityNames = new Map(activities.map((a) => [a.id, a.name]));

  useEffect(() => {
    if (selectedExerciseId === null && muscleGroups.length > 0) {
      setSelectedExerciseId(muscleGroups[0].entries[0].exerciseId);
    }
  }, [muscleGroups.length, selectedExerciseId]);

  useEffect(() => {
    if (selectedCardioActivityId === null && disciplineGroups.length > 0) {
      setSelectedCardioActivityId(disciplineGroups[0].entries[0].activityId);
    }
  }, [disciplineGroups.length, selectedCardioActivityId]);

  if (!authChecked || loading) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tu historial.
      </p>
    );
  }

  if (error) {
    return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
  }

  if (workouts.length === 0) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Todavía no tienes entrenamientos registrados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <PRGrid prs={prs} exercises={exercises} onSelectExercise={setSelectedExerciseId} />
      {selectedExerciseId && (
        <ProgressChart
          exerciseId={selectedExerciseId}
          points={progressForExercise(workouts, selectedExerciseId)}
          exercises={exercises}
          onSelectExercise={setSelectedExerciseId}
        />
      )}
      <CardioPRGrid
        prs={cardioPrs}
        activities={activities}
        onSelectActivity={setSelectedCardioActivityId}
      />
      {selectedCardioActivityId && (
        <CardioProgressChart
          activityId={selectedCardioActivityId}
          points={progressForCardioActivity(workouts, selectedCardioActivityId)}
          activities={activities}
          onSelectActivity={setSelectedCardioActivityId}
        />
      )}
      <div className="flex flex-col gap-5">
        {workouts.map((w) => (
          <div key={w.id} className="card-brutal">
            <h2 className="font-display text-2xl tracking-wide text-acid">{w.date}</h2>
            <ul className="mt-3 flex flex-col divide-y divide-paper-dim/20 font-mono text-sm">
              {w.sets.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-body text-paper">
                    {exerciseNames[s.exercise_id] ?? s.exercise_id}
                  </span>
                  <span className="text-paper-dim">
                    — serie {s.set_number}: {s.reps} reps x {s.weight} kg
                    {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
                  </span>
                </li>
              ))}
              {w.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-body text-paper">
                    {activityNames.get(s.activity_id) ?? s.activity_id}
                  </span>
                  <span className="text-paper-dim">
                    — {s.distance_km !== null ? `${s.distance_km} km en ` : ''}
                    {s.duration_min} min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
