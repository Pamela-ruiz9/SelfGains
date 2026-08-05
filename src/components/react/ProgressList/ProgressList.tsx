import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout } from '../../../lib/workouts';
import type { Workout, WorkoutSet } from '../../../types/db';

interface WorkoutWithSets extends Workout {
  sets: WorkoutSet[];
}

interface Props {
  exerciseNames: Record<string, string>;
}

export default function ProgressList({ exerciseNames }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const withSets = await Promise.all(
          list.map(async (w) => ({ ...w, sets: await getSetsForWorkout(w.id) }))
        );
        setWorkouts(withSets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (!authChecked || loading) return <p>Cargando...</p>;

  if (!isLoggedIn) {
    return (
      <p>
        Debes{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          iniciar sesión
        </a>{' '}
        para ver tu historial.
      </p>
    );
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  if (workouts.length === 0) {
    return <p>Todavía no tienes entrenamientos registrados.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {workouts.map((w) => (
        <div key={w.id} className="border rounded p-4">
          <h2 className="font-bold">{w.date}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {w.sets.map((s) => (
              <li key={s.id}>
                {exerciseNames[s.exercise_id] ?? s.exercise_id} — serie {s.set_number}: {s.reps} reps x {s.weight} kg
                {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
