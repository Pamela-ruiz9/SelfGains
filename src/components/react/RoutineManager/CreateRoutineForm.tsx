import { useEffect, useState, type FormEvent } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';
import { createRoutine, updateRoutine } from '../../../lib/routines';
import { fullActivityName } from '../../../lib/activities';
import type { Routine } from '../../../types/db';
import ActivityPicker, { type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface Props {
  activities: ActivityOption[];
  editingRoutine?: Routine | null;
  onSaved: () => void;
  onCancelEdit?: () => void;
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

function DayActivityPicker({
  activities,
  dayIds,
  onAdd,
  onRemove,
}: {
  activities: ActivityOption[];
  dayIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState<ActivityOption | null>(null);
  const activityById = new Map(activities.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-2">
      <ActivityPicker activities={activities} onSelect={setSelected} />
      <button
        type="button"
        onClick={() => selected && onAdd(selected.id)}
        disabled={!selected}
        className="btn-brutal-sm self-start"
      >
        + Agregar
      </button>
      {dayIds.length > 0 && (
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {dayIds.map((id) => {
            const activity = activityById.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-paper-dim">
                <span>{activity ? fullActivityName(activity) : id}</span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="text-blood hover:text-paper"
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CreateRoutineForm({ activities, editingRoutine, onSaved, onCancelEdit }: Props) {
  const [name, setName] = useState(editingRoutine?.name ?? '');
  const [days, setDays] = useState<RoutineDays>(editingRoutine?.days ?? emptyDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(editingRoutine?.name ?? '');
    setDays(editingRoutine?.days ?? emptyDays());
    setError(null);
  }, [editingRoutine]);

  function handleAddToDay(day: keyof RoutineDays, id: string) {
    setDays((prev) => {
      if (prev[day].includes(id)) return prev;
      return { ...prev, [day]: [...prev[day], id] };
    });
  }

  function handleRemoveFromDay(day: keyof RoutineDays, id: string) {
    setDays((prev) => ({ ...prev, [day]: prev[day].filter((existing) => existing !== id) }));
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
      if (editingRoutine) {
        await updateRoutine(editingRoutine.id, name.trim(), days);
      } else {
        await createRoutine(name.trim(), days);
      }
      setName('');
      setDays(emptyDays());
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo ${editingRoutine ? 'guardar' : 'crear'} la rutina.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-brutal flex flex-col gap-4">
      <p className="label-brutal text-acid">{editingRoutine ? 'Editar rutina' : 'Crear rutina'}</p>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-brutal"
        />
      </label>
      <div className="grid gap-6 sm:grid-cols-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex flex-col gap-2">
            <span className="label-brutal">{weekdayLabel(day)}</span>
            <DayActivityPicker
              activities={activities}
              dayIds={days[day]}
              onAdd={(id) => handleAddToDay(day, id)}
              onRemove={(id) => handleRemoveFromDay(day, id)}
            />
          </div>
        ))}
      </div>
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-brutal self-start">
          {saving ? 'Guardando...' : editingRoutine ? 'Guardar cambios' : 'Guardar rutina'}
        </button>
        {editingRoutine && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="btn-brutal-outline self-start"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
