import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { createWorkout, addSet } from '../../../lib/workouts';
import { getActiveRoutine, getRoutineById } from '../../../lib/routines';
import { getTodayWeekday, type RoutineDays } from '../../../lib/weekdays';

interface ExerciseOption {
  id: string;
  name: string;
  muscleGroup: string;
}

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

interface Props {
  exercises: ExerciseOption[];
  plans: PredefinedRoutine[];
}

interface ParsedSet {
  reps: number;
  weight: number;
  rpe: number | null;
}

function parseSetInput(reps: string, weight: string, rpe: string): ParsedSet | { error: string } {
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

function SetFields({
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

function RoutineExerciseCard({
  exerciseId,
  exerciseName,
  onAddSet,
}: {
  exerciseId: string;
  exerciseName: string;
  onAddSet: (exerciseId: string, exerciseName: string, parsed: ParsedSet) => void;
}) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const parsed = parseSetInput(reps, weight, rpe);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onAddSet(exerciseId, exerciseName, parsed);
    setReps('');
    setWeight('');
    setRpe('');
  }

  return (
    <form onSubmit={handleAdd} className="card-brutal flex flex-col gap-3">
      <p className="font-display text-xl text-paper">{exerciseName}</p>
      <SetFields
        reps={reps}
        weight={weight}
        rpe={rpe}
        onRepsChange={setReps}
        onWeightChange={setWeight}
        onRpeChange={setRpe}
      />
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button type="submit" className="btn-brutal-sm self-start">
        + Agregar serie
      </button>
    </form>
  );
}

export default function WorkoutLogger({ exercises, plans }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [todayExerciseIds, setTodayExerciseIds] = useState<string[]>([]);

  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');

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
      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        setTodayExerciseIds(plan?.days[today] ?? []);
      } else {
        const routine = await getRoutineById(active.routine_ref);
        setTodayExerciseIds(routine?.days[today] ?? []);
      }
    });
  }, [plans]);

  function addLoggedSet(exId: string, exName: string, parsed: ParsedSet) {
    const setNumber = loggedSets.filter((s) => s.exerciseId === exId).length + 1;
    setLoggedSets((prev) => [
      ...prev,
      { exerciseId: exId, exerciseName: exName, setNumber, ...parsed },
    ]);
  }

  function handleAddSet(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!exerciseId) {
      setError('Elige un ejercicio.');
      return;
    }
    const parsed = parseSetInput(reps, weight, rpe);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }

    const exercise = exercises.find((ex) => ex.id === exerciseId);
    addLoggedSet(exerciseId, exercise?.name ?? exerciseId, parsed);
    setReps('');
    setWeight('');
    setRpe('');
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

  async function handleSaveWorkout() {
    if (loggedSets.length === 0) {
      setError('Agrega al menos una serie antes de guardar.');
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
      setSavedMessage('Entrenamiento guardado correctamente.');
      setLoggedSets([]);
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

      {todayExerciseIds.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="label-brutal text-acid">Hoy toca</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {todayExerciseIds.map((exId) => {
              const exercise = exercises.find((ex) => ex.id === exId);
              return (
                <RoutineExerciseCard
                  key={exId}
                  exerciseId={exId}
                  exerciseName={exercise?.name ?? exId}
                  onAddSet={addLoggedSet}
                />
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleAddSet} className="card-brutal flex flex-col gap-4">
        <p className="label-brutal text-acid">Agregar otro ejercicio</p>
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Ejercicio</span>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="input-brutal"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.muscleGroup})
              </option>
            ))}
          </select>
        </label>
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
        />
        <button type="submit" className="btn-brutal-sm self-start">
          + Agregar serie
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
