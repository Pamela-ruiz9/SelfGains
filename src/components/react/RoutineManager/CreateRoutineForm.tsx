import { useEffect, useState, type FormEvent } from 'react';
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  type RoutineActivityTarget,
  type RoutineDayEntry,
  type RoutineDays,
} from '../../../lib/weekdays';
import { createRoutine, updateRoutine } from '../../../lib/routines';
import { fullActivityName, metersToKm, requiresDistance } from '../../../lib/activities';
import type { Routine } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import ActivityPicker, { type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface Props {
  activities: ActivityOption[];
  editingRoutine?: Routine | null;
  onSaved: () => void;
  onCancelEdit?: () => void;
  t: Dictionary['rutinas'];
  pickerT: Dictionary['registrar']['picker'];
  disciplinesT: Dictionary['disciplines'];
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
  dayEntries,
  onAdd,
  onRemove,
  onMove,
  t,
  pickerT,
  disciplinesT,
}: {
  activities: ActivityOption[];
  dayEntries: RoutineDayEntry[];
  onAdd: (target: RoutineActivityTarget) => void;
  onRemove: (activityId: string) => void;
  onMove: (activityId: string, direction: -1 | 1) => void;
  t: Dictionary['rutinas']['create'];
  pickerT: Dictionary['registrar']['picker'];
  disciplinesT: Dictionary['disciplines'];
}) {
  const [selected, setSelected] = useState<ActivityOption | null>(null);
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetDistance, setTargetDistance] = useState('');
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const activityById = new Map(activities.map((a) => [a.id, a]));

  function handleAdd() {
    if (!selected) return;
    if (dayEntries.some((entry) => entryActivityId(entry) === selected.id)) {
      setDuplicateError(`"${selected.name}" ${t.duplicateActivitySuffix}`);
      return;
    }
    const entry: RoutineActivityTarget = { activityId: selected.id };
    if (selected.metricType === 'sets') {
      if (targetSets !== '') entry.targetSets = Number(targetSets);
      if (targetReps !== '') entry.targetReps = Number(targetReps);
    } else if (targetDistance !== '' && requiresDistance(selected)) {
      entry.targetDistanceKm = metersToKm(Number(targetDistance));
    }
    onAdd(entry);
    setDuplicateError(null);
    setTargetSets('');
    setTargetReps('');
    setTargetDistance('');
  }

  return (
    <div className="flex flex-col gap-2">
      <ActivityPicker
        activities={activities}
        onSelect={(activity) => {
          setSelected(activity);
          setDuplicateError(null);
        }}
        t={{ ...pickerT, disciplines: disciplinesT }}
      />
      {selected?.description && (
        <p className="font-mono text-xs text-paper-dim">{selected.description}</p>
      )}
      {selected?.metricType === 'sets' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder={t.placeholderSets}
            value={targetSets}
            onChange={(e) => setTargetSets(e.target.value)}
            min={0}
            className="input-brutal"
          />
          <input
            type="number"
            placeholder={t.placeholderReps}
            value={targetReps}
            onChange={(e) => setTargetReps(e.target.value)}
            min={0}
            className="input-brutal"
          />
        </div>
      )}
      {selected?.metricType === 'session' && requiresDistance(selected) && (
        <input
          type="number"
          placeholder={t.placeholderDistance}
          value={targetDistance}
          onChange={(e) => setTargetDistance(e.target.value)}
          min={0}
          step="1"
          className="input-brutal"
        />
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selected}
        className="btn-brutal-sm self-start"
      >
        {t.add}
      </button>
      {duplicateError && <p className="font-mono text-xs text-blood">{duplicateError}</p>}
      {dayEntries.length > 0 && (
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {dayEntries.map((entry, index) => {
            const activityId = entryActivityId(entry);
            const target = entryTarget(entry);
            const activity = activityById.get(activityId);
            const summary = activity ? targetSummary(activity.metricType, target) : null;
            return (
              <li key={activityId} className="flex items-center justify-between gap-2 text-paper-dim">
                <span>
                  {activity ? fullActivityName(activity) : activityId}
                  {summary && <span className="text-acid"> — {summary}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMove(activityId, -1)}
                    disabled={index === 0}
                    aria-label={t.moveUp}
                    className="flex h-7 w-7 items-center justify-center rounded-control border border-paper-dim/60 text-acid transition duration-150 hover:border-paper hover:text-paper active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(activityId, 1)}
                    disabled={index === dayEntries.length - 1}
                    aria-label={t.moveDown}
                    className="flex h-7 w-7 items-center justify-center rounded-control border border-paper-dim/60 text-acid transition duration-150 hover:border-paper hover:text-paper active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(activityId)}
                    className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
                  >
                    {t.remove}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CreateRoutineForm({
  activities,
  editingRoutine,
  onSaved,
  onCancelEdit,
  t,
  pickerT,
  disciplinesT,
}: Props) {
  const [name, setName] = useState(editingRoutine?.name ?? '');
  const [days, setDays] = useState<RoutineDays>(editingRoutine?.days ?? emptyDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(editingRoutine?.name ?? '');
    setDays(editingRoutine?.days ?? emptyDays());
    setError(null);
  }, [editingRoutine]);

  function handleAddToDay(day: keyof RoutineDays, target: RoutineActivityTarget) {
    setDays((prev) => {
      if (prev[day].some((entry) => entryActivityId(entry) === target.activityId)) return prev;
      return { ...prev, [day]: [...prev[day], target] };
    });
  }

  function handleRemoveFromDay(day: keyof RoutineDays, activityId: string) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].filter((entry) => entryActivityId(entry) !== activityId),
    }));
  }

  function handleMoveInDay(day: keyof RoutineDays, activityId: string, direction: -1 | 1) {
    setDays((prev) => {
      const list = prev[day];
      const index = list.findIndex((entry) => entryActivityId(entry) === activityId);
      const newIndex = index + direction;
      if (index === -1 || newIndex < 0 || newIndex >= list.length) return prev;
      const next = [...list];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return { ...prev, [day]: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t.create.nameRequired);
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
          : editingRoutine
            ? t.create.saveErrorEdit
            : t.create.saveErrorCreate
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-brutal flex flex-col gap-4">
      <p className="label-brutal text-acid">
        {editingRoutine ? t.create.sectionTitleEdit : t.create.sectionTitleCreate}
      </p>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{t.create.name}</span>
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
            <span className="label-brutal">{t.days[day]}</span>
            <DayActivityPicker
              activities={activities}
              dayEntries={days[day]}
              onAdd={(target) => handleAddToDay(day, target)}
              onRemove={(activityId) => handleRemoveFromDay(day, activityId)}
              onMove={(activityId, direction) => handleMoveInDay(day, activityId, direction)}
              t={t.create}
              pickerT={pickerT}
              disciplinesT={disciplinesT}
            />
          </div>
        ))}
      </div>
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-brutal self-start">
          {saving ? t.create.saving : editingRoutine ? t.create.saveChanges : t.create.saveNew}
        </button>
        {editingRoutine && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="btn-brutal-outline self-start"
          >
            {t.create.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
