import { useState } from 'react';
import {
  deleteSession,
  deleteSet,
  deleteWorkout,
  updateSession,
  updateSet,
} from '../../../lib/workouts';
import { DISCIPLINE_COLORS, fullActivityName, kmToMeters, requiresDistance } from '../../../lib/activities';
import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import {
  parseSessionInput,
  parseSetInput,
  SessionFields,
  SetFields,
} from '../WorkoutLogger/WorkoutLogger';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { WorkoutSession, WorkoutSet } from '../../../types/db';
import type { WorkoutWithSessions, WorkoutWithSets } from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import type { Dictionary } from '../../../i18n/es';

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

interface Props {
  workouts: WorkoutWithLogs[];
  exerciseNames: Record<string, string>;
  activities: ActivityOption[];
  onChanged: () => void;
  filterDiscipline?: string | null;
  t: Dictionary['progreso']['workoutHistory'];
  // Slice from `registrar` (not `progreso`) — reused here so
  // parseSetInput/parseSessionInput/SetFields/SessionFields (defined in
  // WorkoutLogger.tsx) get real translations instead of falling back to
  // their Spanish defaults.
  registrarT: Dictionary['registrar']['logger'];
}

function SetRow({
  set,
  exerciseName,
  onChanged,
  t,
  registrarT,
}: {
  set: WorkoutSet;
  exerciseName: string;
  onChanged: () => void;
  t: Dictionary['progreso']['workoutHistory'];
  registrarT: Dictionary['registrar']['logger'];
}) {
  const [editing, setEditing] = useState(false);
  const [weightUnit] = useState(() => getWeightUnit());
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(String(kgToDisplay(set.weight, weightUnit)));
  const [rpe, setRpe] = useState(set.rpe !== null ? String(set.rpe) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = parseSetInput(reps, weight, rpe, weightUnit, registrarT.validation);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSet(set.id, parsed.reps, parsed.weight, parsed.rpe ?? undefined);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.set.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t.set.deleteConfirm)) return;
    try {
      await deleteSet(set.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.set.deleteError);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <span className="font-body text-paper">
          {exerciseName} — {t.set.seriesLabel} {set.set_number}
        </span>
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          weightUnit={weightUnit}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
          labels={registrarT.fields.set}
        />
        {error && <p className="font-mono text-xs text-blood">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-brutal-sm">
            {saving ? t.actions.saving : t.actions.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-brutal-sm opacity-60"
          >
            {t.actions.cancel}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2">
      <span className="font-body text-paper">{exerciseName}</span>
      <span className="text-paper-dim">
        — {t.set.seriesLabel} {set.set_number}: {set.reps} {t.set.repsX}{' '}
        {kgToDisplay(set.weight, weightUnit)} {weightUnit}
        {set.rpe !== null ? ` (${t.set.rpeLabel} ${set.rpe})` : ''}
      </span>
      <span className="ml-auto flex gap-3 font-mono text-xs">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
        >
          {t.actions.edit}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-control border border-blood bg-transparent px-2 py-1 text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
        >
          {t.actions.delete}
        </button>
      </span>
    </li>
  );
}

function SessionRow({
  session,
  activityName,
  activity,
  onChanged,
  t,
  registrarT,
}: {
  session: WorkoutSession;
  activityName: string;
  activity: ActivityOption | undefined;
  onChanged: () => void;
  t: Dictionary['progreso']['workoutHistory'];
  registrarT: Dictionary['registrar']['logger'];
}) {
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState(String(session.duration_min));
  const [distance, setDistance] = useState(
    session.distance_km !== null ? String(kmToMeters(session.distance_km)) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsDistance = activity ? requiresDistance(activity) : session.distance_km !== null;

  async function handleSave() {
    const parsed = parseSessionInput(duration, distance, needsDistance, registrarT.validation);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSession(session.id, parsed.durationMin, parsed.distanceKm ?? undefined);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.session.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t.session.deleteConfirm)) return;
    try {
      await deleteSession(session.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.session.deleteError);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <span className="font-body text-paper">{activityName}</span>
        <SessionFields
          duration={duration}
          distance={distance}
          requiresDistance={needsDistance}
          onDurationChange={setDuration}
          onDistanceChange={setDistance}
          labels={registrarT.fields.session}
        />
        {error && <p className="font-mono text-xs text-blood">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-brutal-sm">
            {saving ? t.actions.saving : t.actions.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-brutal-sm opacity-60"
          >
            {t.actions.cancel}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2">
      <span className="font-body text-paper">{activityName}</span>
      <span className="text-paper-dim">
        — {session.distance_km !== null ? `${kmToMeters(session.distance_km)} ${t.session.metersIn} ` : ''}
        {session.duration_min} {t.session.min}
      </span>
      <span className="ml-auto flex gap-3 font-mono text-xs">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
        >
          {t.actions.edit}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-control border border-blood bg-transparent px-2 py-1 text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
        >
          {t.actions.delete}
        </button>
      </span>
    </li>
  );
}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

function DisciplineTags({ disciplines }: { disciplines: string[] }) {
  if (disciplines.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {disciplines.map((d) => (
        <span
          key={d}
          style={{ backgroundColor: DISCIPLINE_COLORS[d] ?? 'var(--color-paper-dim)' }}
          className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-on-accent"
        >
          {LABEL_BY_DISCIPLINE[d] ?? d}
        </span>
      ))}
    </div>
  );
}

export default function WorkoutHistory({
  workouts,
  exerciseNames,
  activities,
  onChanged,
  filterDiscipline,
  t,
  registrarT,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const activityById = new Map(activities.map((a) => [a.id, a]));

  function disciplinesForWorkout(w: WorkoutWithLogs): string[] {
    const found = new Set<string>();
    if (w.sets.length > 0) found.add('gym');
    for (const s of w.sessions) {
      const discipline = activityById.get(s.activity_id)?.discipline;
      if (discipline) found.add(discipline);
    }
    return DISCIPLINES.map((d) => d.id).filter((id) => found.has(id));
  }

  const visibleWorkouts = filterDiscipline
    ? workouts.filter((w) => disciplinesForWorkout(w).includes(filterDiscipline))
    : workouts;

  async function handleDeleteWorkout(workoutId: string) {
    if (!confirm(t.deleteDayConfirm)) {
      return;
    }
    setError(null);
    try {
      await deleteWorkout(workoutId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteWorkoutError);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {visibleWorkouts.length === 0 && (
        <p className="font-mono text-sm text-paper-dim">{t.empty}</p>
      )}
      {visibleWorkouts.map((w) => (
        <div key={w.id} className="card-brutal">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl tracking-wide text-acid">{w.date}</h2>
              <DisciplineTags disciplines={disciplinesForWorkout(w)} />
            </div>
            <button
              type="button"
              onClick={() => handleDeleteWorkout(w.id)}
              className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
            >
              {t.deleteDay}
            </button>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-paper-dim/20 font-mono text-sm">
            {w.sets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                exerciseName={exerciseNames[s.exercise_id] ?? s.exercise_id}
                onChanged={onChanged}
                t={t}
                registrarT={registrarT}
              />
            ))}
            {w.sessions.map((s) => {
              const activity = activityById.get(s.activity_id);
              return (
                <SessionRow
                  key={s.id}
                  session={s}
                  activityName={activity ? fullActivityName(activity) : s.activity_id}
                  activity={activity}
                  onChanged={onChanged}
                  t={t}
                  registrarT={registrarT}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
