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
    <div className="flex flex-col gap-5">
      {workouts.map((w) => (
        <div key={w.id} className="card-brutal">
          <h2 className="font-display text-2xl tracking-wide text-acid">{w.date}</h2>
          <ul className="mt-3 flex flex-col divide-y divide-paper-dim/20 font-mono text-sm">
            {w.sets.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <span className="font-body text-paper">{exerciseNames[s.exercise_id] ?? s.exercise_id}</span>
                <span className="text-paper-dim">
                  — serie {s.set_number}: {s.reps} reps x {s.weight} kg
                  {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
