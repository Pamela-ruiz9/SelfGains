import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { createWorkout, addSet } from '../../../lib/workouts';

interface ExerciseOption {
  id: string;
  name: string;
  muscleGroup: string;
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
}

export default function WorkoutLogger({ exercises }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);

  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(data.session !== null);
      setAuthChecked(true);
    });
  }, []);

  function handleAddSet(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    const repsNum = Number(reps);
    const weightNum = Number(weight);
    const rpeNum = rpe === '' ? null : Number(rpe);

    if (!exerciseId) {
      setError('Elige un ejercicio.');
      return;
    }
    if (!Number.isFinite(repsNum) || repsNum <= 0) {
      setError('Las repeticiones deben ser un número mayor a 0.');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 0) {
      setError('El peso debe ser un número válido.');
      return;
    }
    if (rpeNum !== null && (!Number.isFinite(rpeNum) || rpeNum < 0 || rpeNum > 10)) {
      setError('El RPE debe ser un número entre 0 y 10.');
      return;
    }

    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const setNumber = loggedSets.filter((s) => s.exerciseId === exerciseId).length + 1;

    setLoggedSets((prev) => [
      ...prev,
      {
        exerciseId,
        exerciseName: exercise?.name ?? exerciseId,
        setNumber,
        reps: repsNum,
        weight: weightNum,
        rpe: rpeNum,
      },
    ]);
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
      const workout = await createWorkout(date);
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

      <form onSubmit={handleAddSet} className="card-brutal flex flex-col gap-4">
        <p className="label-brutal text-acid">Agregar serie</p>
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
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-2">
            <span className="label-brutal">Reps</span>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
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
              onChange={(e) => setWeight(e.target.value)}
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
              onChange={(e) => setRpe(e.target.value)}
              min={0}
              max={10}
              step="0.5"
              className="input-brutal"
            />
          </label>
        </div>
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
