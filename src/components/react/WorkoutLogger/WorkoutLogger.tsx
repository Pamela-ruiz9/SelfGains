import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { createWorkout, addSet, addSession } from '../../../lib/workouts';
import { getActiveRoutine, getRoutineById } from '../../../lib/routines';
import { getTodayWeekday, type RoutineDays } from '../../../lib/weekdays';
import { requiresDistance } from '../../../lib/activities';
import ActivityPicker, { type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface PredefinedRoutine {
  id: string;
  days: RoutineDays;
}

interface LoggedSet {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

interface LoggedSession {
  activityId: string;
  activityName: string;
  durationMin: number;
  distanceKm: number | null;
}

interface Props {
  activities: ActivityOption[];
  plans: PredefinedRoutine[];
}

interface ParsedSet {
  reps: number;
  weight: number;
  rpe: number | null;
}

interface ParsedSession {
  durationMin: number;
  distanceKm: number | null;
}

export function parseSetInput(reps: string, weight: string, rpe: string): ParsedSet | { error: string } {
  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const rpeNum = rpe === '' ? null : Number(rpe);

  if (!Number.isFinite(repsNum) || repsNum <= 0) {
    return { error: 'Las repeticiones deben ser un número mayor a 0.' };
  }
  if (!Number.isFinite(weightNum) || weightNum < 0) {
    return { error: 'El peso debe ser un número válido.' };
  }
  if (rpeNum !== null && (!Number.isFinite(rpeNum) || rpeNum < 0 || rpeNum > 10)) {
    return { error: 'El RPE debe ser un número entre 0 y 10.' };
  }
  return { reps: repsNum, weight: weightNum, rpe: rpeNum };
}

export function parseSessionInput(
  duration: string,
  distance: string,
  needsDistance: boolean
): ParsedSession | { error: string } {
  const durationNum = Number(duration);
  if (!Number.isFinite(durationNum) || durationNum <= 0) {
    return { error: 'La duración debe ser un número mayor a 0.' };
  }
  if (!needsDistance) {
    return { durationMin: durationNum, distanceKm: null };
  }
  const distanceNum = Number(distance);
  if (!Number.isFinite(distanceNum) || distanceNum <= 0) {
    return { error: 'La distancia debe ser un número mayor a 0.' };
  }
  return { durationMin: durationNum, distanceKm: distanceNum };
}

export function SetFields({
  reps,
  weight,
  rpe,
  onRepsChange,
  onWeightChange,
  onRpeChange,
}: {
  reps: string;
  weight: string;
  rpe: string;
  onRepsChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  onRpeChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Reps</span>
        <input
          type="number"
          value={reps}
          onChange={(e) => onRepsChange(e.target.value)}
          min={1}
          required
          className="input-brutal"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Peso (kg)</span>
        <input
          type="number"
          value={weight}
          onChange={(e) => onWeightChange(e.target.value)}
          min={0}
          step="0.5"
          required
          className="input-brutal"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">RPE</span>
        <input
          type="number"
          value={rpe}
          onChange={(e) => onRpeChange(e.target.value)}
          min={0}
          max={10}
          step="0.5"
          className="input-brutal"
        />
      </label>
    </div>
  );
}

export function SessionFields({
  duration,
  distance,
  requiresDistance,
  onDurationChange,
  onDistanceChange,
}: {
  duration: string;
  distance: string;
  requiresDistance: boolean;
  onDurationChange: (v: string) => void;
  onDistanceChange: (v: string) => void;
}) {
  return (
    <div className={requiresDistance ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
      {requiresDistance && (
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Distancia (km)</span>
          <input
            type="number"
            value={distance}
            onChange={(e) => onDistanceChange(e.target.value)}
            min={0}
            step="0.1"
            required
            className="input-brutal"
          />
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Tiempo (min)</span>
        <input
          type="number"
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
          min={0}
          step="1"
          required
          className="input-brutal"
        />
      </label>
    </div>
  );
}

function RoutineActivityCard({
  activity,
  onAddSet,
  onAddSession,
}: {
  activity: ActivityOption;
  onAddSet: (activityId: string, activityName: string, parsed: ParsedSet) => void;
  onAddSession: (activityId: string, activityName: string, parsed: ParsedSession) => void;
}) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (activity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      setError(null);
      onAddSet(activity.id, activity.name, parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const parsed = parseSessionInput(duration, distance, requiresDistance(activity));
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      setError(null);
      onAddSession(activity.id, activity.name, parsed);
      setDuration('');
      setDistance('');
    }
  }

  return (
    <form onSubmit={handleAdd} className="card-brutal flex flex-col gap-3">
      <p className="font-display text-xl text-paper">{activity.name}</p>
      {activity.metricType === 'sets' ? (
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
        />
      ) : (
        <SessionFields
          duration={duration}
          distance={distance}
          requiresDistance={requiresDistance(activity)}
          onDurationChange={setDuration}
          onDistanceChange={setDistance}
        />
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button type="submit" className="btn-brutal-sm self-start">
        {activity.metricType === 'sets' ? '+ Agregar serie' : '+ Agregar sesión'}
      </button>
    </form>
  );
}

export default function WorkoutLogger({ activities, plans }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [loggedSessions, setLoggedSessions] = useState<LoggedSession[]>([]);
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [todayActivities, setTodayActivities] = useState<ActivityOption[]>([]);

  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) return;

      const active = await getActiveRoutine();
      if (!active) return;
      setPlanId(active.routine_ref);

      const today = getTodayWeekday();
      let ids: string[] = [];
      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        ids = plan?.days[today] ?? [];
      } else {
        const routine = await getRoutineById(active.routine_ref);
        ids = routine?.days[today] ?? [];
      }
      setTodayActivities(
        ids
          .map((id) => activities.find((a) => a.id === id))
          .filter((a): a is ActivityOption => a !== undefined)
      );
    });
  }, [plans, activities]);

  function addLoggedSet(activityId: string, activityName: string, parsed: ParsedSet) {
    const setNumber = loggedSets.filter((s) => s.exerciseId === activityId).length + 1;
    setLoggedSets((prev) => [
      ...prev,
      { exerciseId: activityId, exerciseName: activityName, setNumber, ...parsed },
    ]);
  }

  function addLoggedSession(activityId: string, activityName: string, parsed: ParsedSession) {
    setLoggedSessions((prev) => [...prev, { activityId, activityName, ...parsed }]);
  }

  function handleAddActivity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!selectedActivity) {
      setError('Elige una actividad.');
      return;
    }

    if (selectedActivity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSet(selectedActivity.id, selectedActivity.name, parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const parsed = parseSessionInput(duration, distance, requiresDistance(selectedActivity));
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSession(selectedActivity.id, selectedActivity.name, parsed);
      setDuration('');
      setDistance('');
    }
  }

  function handleRemoveSet(index: number) {
    setLoggedSets((prev) => {
      const removed = prev[index];
      const withoutRemoved = prev.filter((_, i) => i !== index);
      let nextNumber = 1;
      return withoutRemoved.map((s) =>
        s.exerciseId === removed.exerciseId ? { ...s, setNumber: nextNumber++ } : s
      );
    });
  }

  function handleRemoveSession(index: number) {
    setLoggedSessions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveWorkout() {
    if (loggedSets.length === 0 && loggedSessions.length === 0) {
      setError('Agrega al menos una serie o sesión antes de guardar.');
      return;
    }
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const workout = await createWorkout(date, undefined, planId);
      for (const s of loggedSets) {
        await addSet(workout.id, s.exerciseId, s.setNumber, s.reps, s.weight, s.rpe ?? undefined);
      }
      for (const s of loggedSessions) {
        await addSession(workout.id, s.activityId, s.durationMin, s.distanceKm ?? undefined);
      }
      setSavedMessage('Entrenamiento guardado correctamente.');
      setLoggedSets([]);
      setLoggedSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el entrenamiento.');
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
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
        para registrar un entrenamiento.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-brutal"
        />
      </label>

      {todayActivities.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="label-brutal text-acid">Hoy toca</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {todayActivities.map((activity) => (
              <RoutineActivityCard
                key={activity.id}
                activity={activity}
                onAddSet={addLoggedSet}
                onAddSession={addLoggedSession}
              />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAddActivity} className="card-brutal flex flex-col gap-4">
        <p className="label-brutal text-acid">Agregar otra actividad</p>
        <ActivityPicker activities={activities} onSelect={setSelectedActivity} />
        {selectedActivity?.metricType === 'sets' && (
          <SetFields
            reps={reps}
            weight={weight}
            rpe={rpe}
            onRepsChange={setReps}
            onWeightChange={setWeight}
            onRpeChange={setRpe}
          />
        )}
        {selectedActivity?.metricType === 'session' && (
          <SessionFields
            duration={duration}
            distance={distance}
            requiresDistance={requiresDistance(selectedActivity)}
            onDurationChange={setDuration}
            onDistanceChange={setDistance}
          />
        )}
        <button type="submit" className="btn-brutal-sm self-start">
          + Agregar
        </button>
      </form>

      {loggedSets.length > 0 && (
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[480px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">Ejercicio</th>
                <th className="px-3 py-2 font-normal">Serie</th>
                <th className="px-3 py-2 font-normal">Reps</th>
                <th className="px-3 py-2 font-normal">Peso</th>
                <th className="px-3 py-2 font-normal">RPE</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loggedSets.map((s, i) => (
                <tr key={i} className="border-b border-paper-dim/20">
                  <td className="px-3 py-2 font-body text-paper">{s.exerciseName}</td>
                  <td className="px-3 py-2 text-acid">{s.setNumber}</td>
                  <td className="px-3 py-2">{s.reps}</td>
                  <td className="px-3 py-2">{s.weight}</td>
                  <td className="px-3 py-2">{s.rpe ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(i)}
                      className="text-blood hover:text-paper"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loggedSessions.length > 0 && (
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[420px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">Actividad</th>
                <th className="px-3 py-2 font-normal">Distancia</th>
                <th className="px-3 py-2 font-normal">Tiempo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loggedSessions.map((s, i) => (
                <tr key={i} className="border-b border-paper-dim/20">
                  <td className="px-3 py-2 font-body text-paper">{s.activityName}</td>
                  <td className="px-3 py-2">
                    {s.distanceKm !== null ? `${s.distanceKm} km` : '—'}
                  </td>
                  <td className="px-3 py-2">{s.durationMin} min</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(i)}
                      className="text-blood hover:text-paper"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {savedMessage && (
        <p className="border-l-2 border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
      )}

      <button
        type="button"
        onClick={handleSaveWorkout}
        disabled={saving}
        className="btn-brutal self-start"
      >
        {saving ? 'Guardando...' : 'Guardar entrenamiento'}
      </button>
    </div>
  );
}
