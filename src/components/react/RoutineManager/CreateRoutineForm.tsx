import { useState, type FormEvent } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';
import { createRoutine } from '../../../lib/routines';

interface ExerciseOption {
  id: string;
  name: string;
}

interface Props {
  exercises: ExerciseOption[];
  onCreated: () => void;
}

function emptyDays(): RoutineDays {
  return {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
}

export default function CreateRoutineForm({ exercises, onCreated }: Props) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<RoutineDays>(emptyDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDayChange(day: keyof RoutineDays, selected: string[]) {
    setDays((prev) => ({ ...prev, [day]: selected }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Ponele un nombre a la rutina.');
      return;
    }

    setSaving(true);
    try {
      await createRoutine(name.trim(), days);
      setName('');
      setDays(emptyDays());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la rutina.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-brutal flex flex-col gap-4">
      <p className="label-brutal text-acid">Crear rutina</p>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-brutal"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {WEEKDAYS.map((day) => (
          <label key={day} className="flex flex-col gap-2">
            <span className="label-brutal">{weekdayLabel(day)}</span>
            <select
              multiple
              value={days[day]}
              onChange={(e) =>
                handleDayChange(
                  day,
                  Array.from(e.target.selectedOptions).map((o) => o.value)
                )
              }
              className="input-brutal"
              size={4}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={saving} className="btn-brutal self-start">
        {saving ? 'Guardando...' : 'Guardar rutina'}
      </button>
    </form>
  );
}
