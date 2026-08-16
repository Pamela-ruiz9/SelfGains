import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  createWorkout,
  addSet,
  addSession,
  getWorkoutsForCurrentUser,
  getSetsForWorkout,
  getSessionsForWorkout,
} from '../../../lib/workouts';
import { getActiveRoutine, getRoutineById } from '../../../lib/routines';
import {
  entryActivityId,
  entryTarget,
  getTodayWeekday,
  targetSummary,
  type RoutineActivityTarget,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName, kmToMeters, metersToKm, requiresDistance } from '../../../lib/activities';
import {
  calculatePRs,
  suggestNextSet,
  type SuggestedSet,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import ActivityPicker, { DISCIPLINES, type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface PredefinedRoutine {
  id: string;
  days: RoutineDays;
}

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

interface TodayActivityEntry {
  activity: ActivityOption;
  target: Omit<RoutineActivityTarget, 'activityId'>;
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

// `distance` is the user-facing string in METERS; distanceKm on the way out
// is what actually gets stored (DB column, pace math elsewhere).
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
  const distanceMetersNum = Number(distance);
  if (!Number.isFinite(distanceMetersNum) || distanceMetersNum <= 0) {
    return { error: 'La distancia debe ser un número mayor a 0.' };
  }
  return { durationMin: durationNum, distanceKm: metersToKm(distanceMetersNum) };
}

// Compares each just-saved set against the PRs computed from workouts logged
// BEFORE this session (pastWorkouts doesn't include what was just saved), so
// a set that ties or beats the prior best gets called out by name.
function buildSavedMessage(justSaved: LoggedSet[], pastWorkouts: WorkoutWithSets[]): string {
  const priorPRByExercise = new Map(calculatePRs(pastWorkouts).map((pr) => [pr.exerciseId, pr.weight]));

  const bestByExercise = new Map<string, LoggedSet>();
  for (const s of justSaved) {
    const current = bestByExercise.get(s.exerciseId);
    if (!current || s.weight > current.weight) bestByExercise.set(s.exerciseId, s);
  }

  const newPRs = Array.from(bestByExercise.values()).filter((s) => {
    const prior = priorPRByExercise.get(s.exerciseId);
    return prior === undefined || s.weight > prior;
  });

  if (newPRs.length === 0) return 'Entrenamiento guardado correctamente.';
  const list = newPRs.map((pr) => `${pr.exerciseName} (${pr.weight} kg)`).join(', ');
  return `Entrenamiento guardado correctamente. ¡Nuevo PR en ${list}!`;
}

function suggestionHint(suggestion: SuggestedSet): string {
  const base = `Sugerido: ${suggestion.reps} reps × ${suggestion.weight} kg`;
  if (suggestion.status === 'progress') {
    return `${base} (+2.5 kg — llevas 3 sesiones con RPE bajo)`;
  }
  if (suggestion.status === 'deload') {
    return `${base} (-10% — llevas 3 sesiones al límite sin avanzar, toca bajar peso)`;
  }
  return `${base} (igual que tu última sesión)`;
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
      <p className="col-span-3 font-mono text-xs text-paper-dim">
        Escala RPE: 10 = al fallo · 8–9 = 1–2 reps en reserva · 6–7 = varias reps en reserva · ≤4 =
        fácil
      </p>
    </div>
  );
}

const DISTANCE_STEP = 25; // one pool length — the increment that matters mid-swim
const DISTANCE_PRESETS = [200, 400, 800, 1500];
const DURATION_STEP = 1;
const DURATION_PRESETS = [15, 30, 45, 60];

function bumpValue(value: string, delta: number): string {
  const next = Math.max(0, (Number(value) || 0) + delta);
  return String(next);
}

// Big stepper buttons + one-tap presets for the common totals, so a session
// can be logged with a handful of taps instead of typing on a phone
// keyboard — the number inputs stay as a fallback for anything off-preset.
function SteppedNumberField({
  label,
  value,
  step,
  presets,
  unit,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  presets: number[];
  unit: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-brutal">{label}</span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onChange(bumpValue(value, -step))}
          aria-label={`Restar ${step} ${unit}`}
          className="h-14 w-14 shrink-0 border-2 border-paper-dim/50 font-display text-2xl text-paper active:border-acid active:text-acid"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={0}
          step="1"
          required
          className="input-brutal h-14 flex-1 text-center text-xl"
        />
        <button
          type="button"
          onClick={() => onChange(bumpValue(value, step))}
          aria-label={`Sumar ${step} ${unit}`}
          className="h-14 w-14 shrink-0 border-2 border-paper-dim/50 font-display text-2xl text-paper active:border-acid active:text-acid"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(String(preset))}
            className={`h-12 min-w-[4.5rem] flex-1 border-2 font-mono text-sm transition-colors ${
              value === String(preset)
                ? 'border-acid bg-acid text-on-accent'
                : 'border-paper-dim/50 text-paper-dim hover:border-acid hover:text-acid'
            }`}
          >
            {preset} {unit}
          </button>
        ))}
      </div>
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
    <div className="flex flex-col gap-4">
      {requiresDistance && (
        <SteppedNumberField
          label="Distancia (m)"
          value={distance}
          step={DISTANCE_STEP}
          presets={DISTANCE_PRESETS}
          unit="m"
          onChange={onDistanceChange}
        />
      )}
      <SteppedNumberField
        label="Tiempo (min)"
        value={duration}
        step={DURATION_STEP}
        presets={DURATION_PRESETS}
        unit="min"
        onChange={onDurationChange}
      />
    </div>
  );
}

function RoutineActivityCard({
  activity,
  target,
  workouts,
  onAddSet,
  onAddSession,
  done,
  progressLabel,
}: {
  activity: ActivityOption;
  target: Omit<RoutineActivityTarget, 'activityId'>;
  workouts: WorkoutWithSets[];
  onAddSet: (activityId: string, activityName: string, parsed: ParsedSet) => void;
  onAddSession: (activityId: string, activityName: string, parsed: ParsedSession) => void;
  done: boolean;
  progressLabel: string | null;
}) {
  const suggestion =
    activity.metricType === 'sets' ? suggestNextSet(workouts, activity.id) : null;
  const goal = targetSummary(activity.metricType, target);
  const [reps, setReps] = useState(
    target.targetReps ? String(target.targetReps) : suggestion ? String(suggestion.reps) : ''
  );
  const [weight, setWeight] = useState(suggestion ? String(suggestion.weight) : '');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState(
    target.targetDistanceKm ? String(kmToMeters(target.targetDistanceKm)) : ''
  );
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
      onAddSet(activity.id, fullActivityName(activity), parsed);
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
      onAddSession(activity.id, fullActivityName(activity), parsed);
      setDuration('');
      setDistance('');
    }
  }

  return (
    <form
      onSubmit={handleAdd}
      className={`card-brutal flex flex-col gap-3 transition-colors ${done ? 'border-acid' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-xl text-paper">{fullActivityName(activity)}</p>
        {done && (
          <span className="shrink-0 border-2 border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
            ✓ Hecho
          </span>
        )}
      </div>
      {activity.description && (
        <p className="font-mono text-xs text-paper-dim">{activity.description}</p>
      )}
      {goal && (
        <p className="font-mono text-xs text-acid">
          Meta: {goal}
          {progressLabel && <span className="text-paper-dim"> — llevas {progressLabel}</span>}
        </p>
      )}
      {suggestion && (
        <p className="font-mono text-xs text-paper-dim">{suggestionHint(suggestion)}</p>
      )}
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
  const [routineDaysMap, setRoutineDaysMap] = useState<RoutineDays | null>(null);
  const [todayActivities, setTodayActivities] = useState<TodayActivityEntry[]>([]);
  const [pastWorkouts, setPastWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [copySourceId, setCopySourceId] = useState('');

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

      const list = await getWorkoutsForCurrentUser();
      const withLogs = await Promise.all(
        list.map(async (w) => ({
          ...w,
          sets: await getSetsForWorkout(w.id),
          sessions: await getSessionsForWorkout(w.id),
        }))
      );
      setPastWorkouts(withLogs);

      const active = await getActiveRoutine();
      if (!active) return;
      setPlanId(active.routine_ref);

      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        setRoutineDaysMap(plan?.days ?? null);
      } else {
        const routine = await getRoutineById(active.routine_ref);
        setRoutineDaysMap(routine?.days ?? null);
      }
    });
  }, [plans]);

  // Re-suggests the routine's activities for whichever weekday `date` falls
  // on — not just the real "today" — so switching the date to log a past or
  // future session still surfaces that day's routine first.
  useEffect(() => {
    if (!routineDaysMap) {
      setTodayActivities([]);
      return;
    }
    const weekday = getTodayWeekday(new Date(`${date}T00:00:00`));
    const entries = routineDaysMap[weekday] ?? [];
    setTodayActivities(
      entries
        .map((entry) => {
          const activity = activities.find((a) => a.id === entryActivityId(entry));
          return activity ? { activity, target: entryTarget(entry) } : null;
        })
        .filter((e): e is TodayActivityEntry => e !== null)
    );
  }, [date, routineDaysMap, activities]);

  // Prefills reps/peso for the free-form "Agregar otra actividad" picker with
  // the same progression suggestion the "Hoy toca" cards use, whenever the
  // selected activity changes.
  useEffect(() => {
    if (selectedActivity?.metricType === 'sets') {
      const suggestion = suggestNextSet(pastWorkouts, selectedActivity.id);
      setReps(suggestion ? String(suggestion.reps) : '');
      setWeight(suggestion ? String(suggestion.weight) : '');
    }
  }, [selectedActivity, pastWorkouts]);

  const freeFormSuggestion =
    selectedActivity?.metricType === 'sets' ? suggestNextSet(pastWorkouts, selectedActivity.id) : null;

  const activityById = new Map(activities.map((a) => [a.id, a]));

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

  // How many sets/whether a session has already been staged today for this
  // routine activity — drives both the per-card "✓ Hecho" badge and the
  // day's overall progress bar, so both stay in sync with the same source
  // of truth (the in-progress draft, not what's saved yet).
  function loggedCountFor(activity: ActivityOption): number {
    return activity.metricType === 'sets'
      ? loggedSets.filter((s) => s.exerciseId === activity.id).length
      : loggedSessions.filter((s) => s.activityId === activity.id).length;
  }

  function isActivityDone(activity: ActivityOption, target: Omit<RoutineActivityTarget, 'activityId'>): boolean {
    const count = loggedCountFor(activity);
    if (activity.metricType === 'sets' && target.targetSets) return count >= target.targetSets;
    return count > 0;
  }

  const completedCount = todayActivities.filter(({ activity, target }) =>
    isActivityDone(activity, target)
  ).length;
  const totalTodayCount = todayActivities.length;
  const progressPct = totalTodayCount > 0 ? Math.round((completedCount / totalTodayCount) * 100) : 0;

  // Copies every set/session from a previously logged day into today's
  // draft in one shot — for a rest day with no routine assigned, or to
  // bolt on a whole other discipline you already have a good log for,
  // without re-typing it one exercise at a time.
  function copyWorkout(workoutId: string) {
    const source = pastWorkouts.find((w) => w.id === workoutId);
    if (!source) return;

    if (source.sets.length > 0) {
      setLoggedSets((prev) => {
        const counts = new Map<string, number>();
        for (const s of prev) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
        const additions: LoggedSet[] = source.sets.map((s) => {
          const activity = activityById.get(s.exercise_id);
          const setNumber = (counts.get(s.exercise_id) ?? 0) + 1;
          counts.set(s.exercise_id, setNumber);
          return {
            exerciseId: s.exercise_id,
            exerciseName: activity ? fullActivityName(activity) : s.exercise_id,
            setNumber,
            reps: s.reps,
            weight: s.weight,
            rpe: s.rpe,
          };
        });
        return [...prev, ...additions];
      });
    }

    if (source.sessions.length > 0) {
      setLoggedSessions((prev) => [
        ...prev,
        ...source.sessions.map((s) => {
          const activity = activityById.get(s.activity_id);
          return {
            activityId: s.activity_id,
            activityName: activity ? fullActivityName(activity) : s.activity_id,
            durationMin: s.duration_min,
            distanceKm: s.distance_km,
          };
        }),
      ]);
    }

    setCopySourceId('');
    setError(null);
    setSavedMessage(null);
  }

  function disciplinesForPastWorkout(w: WorkoutWithLogs): string[] {
    const found = new Set<string>();
    if (w.sets.length > 0) found.add('gym');
    for (const s of w.sessions) {
      const discipline = activityById.get(s.activity_id)?.discipline;
      if (discipline) found.add(discipline);
    }
    return DISCIPLINES.map((d) => d.id).filter((id) => found.has(id));
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
      addLoggedSet(selectedActivity.id, fullActivityName(selectedActivity), parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const parsed = parseSessionInput(duration, distance, requiresDistance(selectedActivity));
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSession(selectedActivity.id, fullActivityName(selectedActivity), parsed);
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
      setSavedMessage(buildSavedMessage(loggedSets, pastWorkouts));
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

      {pastWorkouts.length > 0 && (
        <div className="card-brutal flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex flex-1 flex-col gap-2">
            <span className="label-brutal">Copiar un entrenamiento anterior</span>
            <select
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
              className="input-brutal"
            >
              <option value="">
                {todayActivities.length === 0
                  ? 'Elige un día para copiar aquí (sin rutina asignada hoy)'
                  : 'Elige un día para sumar otra disciplina hoy'}
              </option>
              {pastWorkouts.map((w) => {
                const labels = disciplinesForPastWorkout(w).map((id) => LABEL_BY_DISCIPLINE[id] ?? id);
                return (
                  <option key={w.id} value={w.id}>
                    {w.date}
                    {labels.length > 0 ? ` — ${labels.join(', ')}` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            onClick={() => copyWorkout(copySourceId)}
            disabled={!copySourceId}
            className="btn-brutal-sm shrink-0"
          >
            Copiar a este día
          </button>
        </div>
      )}

      {todayActivities.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">
              {date === new Date().toISOString().slice(0, 10) ? 'Hoy toca' : 'Ese día toca'}
            </p>
            <span className="font-mono text-xs text-paper-dim">
              {completedCount} de {totalTodayCount} completado{totalTodayCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="h-3 w-full border-2 border-paper-dim/30">
            <div
              className="h-full bg-acid transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {todayActivities.map(({ activity, target }) => {
              const count = loggedCountFor(activity);
              const progressLabel =
                activity.metricType === 'sets' && target.targetSets
                  ? `${count}/${target.targetSets} series`
                  : null;
              return (
                <RoutineActivityCard
                  key={activity.id}
                  activity={activity}
                  target={target}
                  workouts={pastWorkouts}
                  onAddSet={addLoggedSet}
                  onAddSession={addLoggedSession}
                  done={isActivityDone(activity, target)}
                  progressLabel={progressLabel}
                />
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleAddActivity} className="card-brutal flex flex-col gap-4">
        <p className="label-brutal text-acid">Agregar otra actividad</p>
        <ActivityPicker activities={activities} onSelect={setSelectedActivity} />
        {selectedActivity?.description && (
          <p className="font-mono text-xs text-paper-dim">{selectedActivity.description}</p>
        )}
        {freeFormSuggestion && (
          <p className="font-mono text-xs text-paper-dim">{suggestionHint(freeFormSuggestion)}</p>
        )}
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
                    {s.distanceKm !== null ? `${kmToMeters(s.distanceKm)} m` : '—'}
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
