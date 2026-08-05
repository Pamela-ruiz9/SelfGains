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
    return <p>Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p>
        Debes{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          iniciar sesión
        </a>{' '}
        para registrar un entrenamiento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <label className="flex flex-col gap-1">
        <span>Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>

      <form onSubmit={handleAddSet} className="flex flex-col gap-3 border rounded p-4">
        <label className="flex flex-col gap-1">
          <span>Ejercicio</span>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.muscleGroup})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span>Reps</span>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              min={1}
              required
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span>Peso (kg)</span>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min={0}
              step="0.5"
              required
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span>RPE (opcional)</span>
            <input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              min={0}
              max={10}
              step="0.5"
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
        <button type="submit" className="bg-gray-800 text-white rounded px-4 py-2 self-start">
          Agregar serie
        </button>
      </form>

      {loggedSets.length > 0 && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b py-1">Ejercicio</th>
              <th className="border-b py-1">Serie</th>
              <th className="border-b py-1">Reps</th>
              <th className="border-b py-1">Peso</th>
              <th className="border-b py-1">RPE</th>
              <th className="border-b py-1"></th>
            </tr>
          </thead>
          <tbody>
            {loggedSets.map((s, i) => (
              <tr key={i}>
                <td className="py-1">{s.exerciseName}</td>
                <td className="py-1">{s.setNumber}</td>
                <td className="py-1">{s.reps}</td>
                <td className="py-1">{s.weight}</td>
                <td className="py-1">{s.rpe ?? '-'}</td>
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(i)}
                    className="text-red-600 text-sm"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {savedMessage && <p className="text-green-600 text-sm">{savedMessage}</p>}

      <button
        type="button"
        onClick={handleSaveWorkout}
        disabled={saving}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50 self-start"
      >
        {saving ? 'Guardando...' : 'Guardar entrenamiento'}
      </button>
    </div>
  );
}
