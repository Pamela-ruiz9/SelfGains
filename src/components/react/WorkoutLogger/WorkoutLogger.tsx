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
  localDateStr,
  targetSummary,
  type RoutineActivityTarget,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName, kmToMeters, metersToKm, requiresDistance } from '../../../lib/activities';
import { displayToKg, getWeightUnit, kgToDisplay, type WeightUnit } from '../../../lib/weightUnit';
import {
  calculatePRs,
  suggestNextSet,
  type SuggestedSet,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import ActivityPicker, { DISCIPLINES, type ActivityOption } from '../ActivityPicker/ActivityPicker';
import CollapsibleSection from '../Shared/CollapsibleSection';
import { es } from '../../../i18n/es';
import type { Dictionary } from '../../../i18n/es';

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
  t: Dictionary['registrar'];
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

// `t` defaults straight to the Spanish dictionary (not a hand-copied
// constant) so consumers that haven't been wired up to pass a `t` slice yet
// — e.g. ProgressList/WorkoutHistory — stay backward-compatible without a
// second copy of this copy to keep in sync.
type SetValidationMessages = Pick<
  Dictionary['registrar']['logger']['validation'],
  'repsInvalid' | 'weightInvalid' | 'rpeInvalid'
>;

type SessionValidationMessages = Pick<
  Dictionary['registrar']['logger']['validation'],
  'durationInvalid' | 'distanceInvalid'
>;

// `weight` is the user-facing string in `weightUnit`; the returned weight is
// always in kg, which is what actually gets stored (DB column, PR math).
export function parseSetInput(
  reps: string,
  weight: string,
  rpe: string,
  weightUnit: WeightUnit = 'kg',
  t: SetValidationMessages = es.registrar.logger.validation
): ParsedSet | { error: string } {
  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const rpeNum = rpe === '' ? null : Number(rpe);

  if (!Number.isFinite(repsNum) || repsNum <= 0) {
    return { error: t.repsInvalid };
  }
  if (!Number.isFinite(weightNum) || weightNum < 0) {
    return { error: t.weightInvalid };
  }
  if (rpeNum !== null && (!Number.isFinite(rpeNum) || rpeNum < 0 || rpeNum > 10)) {
    return { error: t.rpeInvalid };
  }
  return { reps: repsNum, weight: displayToKg(weightNum, weightUnit), rpe: rpeNum };
}

// `distance` is the user-facing string in METERS; distanceKm on the way out
// is what actually gets stored (DB column, pace math elsewhere).
export function parseSessionInput(
  duration: string,
  distance: string,
  needsDistance: boolean,
  t: SessionValidationMessages = es.registrar.logger.validation
): ParsedSession | { error: string } {
  const durationNum = Number(duration);
  if (!Number.isFinite(durationNum) || durationNum <= 0) {
    return { error: t.durationInvalid };
  }
  if (!needsDistance) {
    return { durationMin: durationNum, distanceKm: null };
  }
  const distanceMetersNum = Number(distance);
  if (!Number.isFinite(distanceMetersNum) || distanceMetersNum <= 0) {
    return { error: t.distanceInvalid };
  }
  return { durationMin: durationNum, distanceKm: metersToKm(distanceMetersNum) };
}

// Compares each just-saved set against the PRs computed from workouts logged
// BEFORE this session (pastWorkouts doesn't include what was just saved), so
// a set that ties or beats the prior best gets called out by name.
function buildSavedMessage(
  justSaved: LoggedSet[],
  pastWorkouts: WorkoutWithSets[],
  weightUnit: WeightUnit,
  t: Dictionary['registrar']['logger']['saved']
): string {
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

  if (newPRs.length === 0) return t.success;
  const list = newPRs
    .map((pr) => `${pr.exerciseName} (${kgToDisplay(pr.weight, weightUnit)} ${weightUnit})`)
    .join(', ');
  return `${t.success} ${t.newPrPrefix} ${list}${t.newPrSuffixMark}`;
}

function suggestionHint(
  suggestion: SuggestedSet,
  weightUnit: WeightUnit,
  t: Dictionary['registrar']['logger']['suggestion']
): string {
  const weight = kgToDisplay(suggestion.weight, weightUnit);
  const base = `${t.prefix}: ${suggestion.reps} reps × ${weight} ${weightUnit}`;
  if (suggestion.status === 'progress') {
    return `${base} ${t.progress}`;
  }
  if (suggestion.status === 'deload') {
    return `${base} ${t.deload}`;
  }
  return `${base} ${t.same}`;
}

// `labels` defaults straight to the Spanish dictionary so consumers that
// haven't been wired up to pass a `labels` slice yet — e.g.
// ProgressList/WorkoutHistory — stay backward-compatible without a second
// copy of this copy to keep in sync.
type SetFieldsLabels = Dictionary['registrar']['logger']['fields']['set'];

export function SetFields({
  reps,
  weight,
  rpe,
  weightUnit = 'kg',
  onRepsChange,
  onWeightChange,
  onRpeChange,
  labels = es.registrar.logger.fields.set,
}: {
  reps: string;
  weight: string;
  rpe: string;
  weightUnit?: WeightUnit;
  onRepsChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  onRpeChange: (v: string) => void;
  labels?: SetFieldsLabels;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{labels.reps}</span>
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
        <span className="label-brutal">
          {labels.weight} ({weightUnit})
        </span>
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
        <span className="label-brutal">{labels.rpe}</span>
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
      <p className="col-span-3 font-mono text-xs text-paper-dim">{labels.rpeScale}</p>
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
  decreaseAriaLabel,
  increaseAriaLabel,
}: {
  label: string;
  value: string;
  step: number;
  presets: number[];
  unit: string;
  onChange: (v: string) => void;
  decreaseAriaLabel: string;
  increaseAriaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-brutal">{label}</span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onChange(bumpValue(value, -step))}
          aria-label={`${decreaseAriaLabel} ${step} ${unit}`}
          className="h-14 w-14 shrink-0 rounded-control border border-paper-dim/50 font-display text-2xl text-paper transition-transform duration-100 active:scale-95 active:border-acid active:text-acid"
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
          aria-label={`${increaseAriaLabel} ${step} ${unit}`}
          className="h-14 w-14 shrink-0 rounded-control border border-paper-dim/50 font-display text-2xl text-paper transition-transform duration-100 active:scale-95 active:border-acid active:text-acid"
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
            className={`h-12 min-w-[4.5rem] flex-1 rounded-control border font-mono text-sm transition-colors ${
              value === String(preset)
                ? 'pill-selected'
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

// `labels` defaults straight to the Spanish dictionary so consumers that
// haven't been wired up to pass a `labels` slice yet — e.g.
// ProgressList/WorkoutHistory — stay backward-compatible without a second
// copy of this copy to keep in sync.
type SessionFieldsLabels = Dictionary['registrar']['logger']['fields']['session'];

export function SessionFields({
  duration,
  distance,
  requiresDistance,
  onDurationChange,
  onDistanceChange,
  labels = es.registrar.logger.fields.session,
}: {
  duration: string;
  distance: string;
  requiresDistance: boolean;
  onDurationChange: (v: string) => void;
  onDistanceChange: (v: string) => void;
  labels?: SessionFieldsLabels;
}) {
  return (
    <div className="flex flex-col gap-4">
      {requiresDistance && (
        <SteppedNumberField
          label={labels.distance}
          value={distance}
          step={DISTANCE_STEP}
          presets={DISTANCE_PRESETS}
          unit="m"
          onChange={onDistanceChange}
          decreaseAriaLabel={labels.decreaseAriaLabel}
          increaseAriaLabel={labels.increaseAriaLabel}
        />
      )}
      <SteppedNumberField
        label={labels.duration}
        value={duration}
        step={DURATION_STEP}
        presets={DURATION_PRESETS}
        unit="min"
        onChange={onDurationChange}
        decreaseAriaLabel={labels.decreaseAriaLabel}
        increaseAriaLabel={labels.increaseAriaLabel}
      />
    </div>
  );
}

function RoutineActivityCard({
  activity,
  target,
  workouts,
  weightUnit,
  onAddSet,
  onAddSession,
  done,
  progressLabel,
  t,
}: {
  activity: ActivityOption;
  target: Omit<RoutineActivityTarget, 'activityId'>;
  workouts: WorkoutWithSets[];
  weightUnit: WeightUnit;
  onAddSet: (activityId: string, activityName: string, parsed: ParsedSet) => void;
  onAddSession: (activityId: string, activityName: string, parsed: ParsedSession) => void;
  done: boolean;
  progressLabel: string | null;
  t: Pick<Dictionary['registrar']['logger'], 'validation' | 'suggestion' | 'card' | 'fields'>;
}) {
  const suggestion =
    activity.metricType === 'sets' ? suggestNextSet(workouts, activity.id) : null;
  const goal = targetSummary(activity.metricType, target);
  const [reps, setReps] = useState(
    target.targetReps ? String(target.targetReps) : suggestion ? String(suggestion.reps) : ''
  );
  const [weight, setWeight] = useState(
    suggestion ? String(kgToDisplay(suggestion.weight, weightUnit)) : ''
  );
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState(
    target.targetDistanceKm ? String(kmToMeters(target.targetDistanceKm)) : ''
  );
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (activity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe, weightUnit, t.validation);
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
      const parsed = parseSessionInput(duration, distance, requiresDistance(activity), t.validation);
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
          <span className="shrink-0 rounded-control border border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
            {t.card.done}
          </span>
        )}
      </div>
      {activity.image && (
        <img
          src={`${import.meta.env.BASE_URL}exercises/${activity.image}`}
          alt={activity.name}
          loading="lazy"
          className="aspect-video w-full rounded-card object-cover"
        />
      )}
      {activity.description && (
        <p className="font-mono text-xs text-paper-dim">{activity.description}</p>
      )}
      {goal && (
        <p className="font-mono text-xs text-acid">
          {t.card.goalLabel}: {goal}
          {progressLabel && (
            <span className="text-paper-dim">
              {' '}
              — {t.card.progressPrefix} {progressLabel}
            </span>
          )}
        </p>
      )}
      {suggestion && (
        <p className="font-mono text-xs text-paper-dim">
          {suggestionHint(suggestion, weightUnit, t.suggestion)}
        </p>
      )}
      {activity.metricType === 'sets' ? (
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          weightUnit={weightUnit}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
          labels={t.fields.set}
        />
      ) : (
        <SessionFields
          duration={duration}
          distance={distance}
          requiresDistance={requiresDistance(activity)}
          onDurationChange={setDuration}
          onDistanceChange={setDistance}
          labels={t.fields.session}
        />
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button type="submit" className="btn-brutal-sm self-start">
        {activity.metricType === 'sets' ? t.card.addSet : t.card.addSession}
      </button>
    </form>
  );
}

export default function WorkoutLogger({ activities, plans, t }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => localDateStr());
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [loggedSessions, setLoggedSessions] = useState<LoggedSession[]>([]);
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [routineDaysMap, setRoutineDaysMap] = useState<RoutineDays | null>(null);
  const [todayActivities, setTodayActivities] = useState<TodayActivityEntry[]>([]);
  const [pastWorkouts, setPastWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [copySourceId, setCopySourceId] = useState('');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  // Independientes, no acordeón exclusivo: a diferencia de Progreso (una
  // pantalla de solo consulta), acá se suele necesitar tener "Hoy toca" y
  // "Agregar otra actividad" abiertas al mismo tiempo dentro del mismo
  // registro. Todas arrancan cerradas al entrar a la pantalla — el usuario
  // elige qué abrir, nada se le impone expandido de entrada.
  const [todaySectionOpen, setTodaySectionOpen] = useState(false);
  const [copySectionOpen, setCopySectionOpen] = useState(false);
  const [addActivitySectionOpen, setAddActivitySectionOpen] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [weightUnit] = useState<WeightUnit>(() => getWeightUnit());

  useEffect(() => {
    async function loadFromServer() {
      const { data } = await supabase.auth.getSession();
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
    }
    loadFromServer();
    window.addEventListener('selfgains:sync-complete', loadFromServer);
    return () => window.removeEventListener('selfgains:sync-complete', loadFromServer);
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
      setWeight(suggestion ? String(kgToDisplay(suggestion.weight, weightUnit)) : '');
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

  // Copies the selected sets/sessions from a previously logged day into
  // today's draft — for a rest day with no routine assigned, or to bolt on
  // a whole other discipline you already have a good log for, without
  // re-typing it one exercise at a time. Only the ids the user left ticked
  // in the checklist come along; anything they un-ticked is skipped.
  function copyWorkout(workoutId: string, setIds: Set<string>, sessionIds: Set<string>) {
    const source = pastWorkouts.find((w) => w.id === workoutId);
    if (!source) return;

    const setsToCopy = source.sets.filter((s) => setIds.has(s.id));
    const sessionsToCopy = source.sessions.filter((s) => sessionIds.has(s.id));

    if (setsToCopy.length > 0) {
      setLoggedSets((prev) => {
        const counts = new Map<string, number>();
        for (const s of prev) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
        const additions: LoggedSet[] = setsToCopy.map((s) => {
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

    if (sessionsToCopy.length > 0) {
      setLoggedSessions((prev) => [
        ...prev,
        ...sessionsToCopy.map((s) => {
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
    setSelectedSetIds(new Set());
    setSelectedSessionIds(new Set());
    setError(null);
    setSavedMessage(null);
  }

  function handleCopySourceChange(workoutId: string) {
    setCopySourceId(workoutId);
    const source = pastWorkouts.find((w) => w.id === workoutId);
    setSelectedSetIds(new Set(source ? source.sets.map((s) => s.id) : []));
    setSelectedSessionIds(new Set(source ? source.sessions.map((s) => s.id) : []));
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
      setError(t.logger.validation.noActivitySelected);
      return;
    }

    if (selectedActivity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe, weightUnit, t.logger.validation);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSet(selectedActivity.id, fullActivityName(selectedActivity), parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const parsed = parseSessionInput(
        duration,
        distance,
        requiresDistance(selectedActivity),
        t.logger.validation
      );
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
      setError(t.logger.validation.emptyWorkout);
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
      setSavedMessage(buildSavedMessage(loggedSets, pastWorkouts, weightUnit, t.logger.saved));
      setLoggedSets([]);
      setLoggedSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.logger.saved.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">{t.logger.loading}</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.logger.notLoggedIn.prefix}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.logger.notLoggedIn.link}
        </a>{' '}
        {t.logger.notLoggedIn.suffix}
      </p>
    );
  }

  const copySource = pastWorkouts.find((w) => w.id === copySourceId);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">{t.logger.dateLabel}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-brutal"
        />
      </label>

      {todayActivities.length > 0 && (
        <CollapsibleSection
          title={date === localDateStr() ? t.logger.today.titleToday : t.logger.today.titleOtherDay}
          open={todaySectionOpen}
          onToggle={() => setTodaySectionOpen((prev) => !prev)}
          badge={
            <span className="font-mono text-xs text-paper-dim">
              {completedCount} {t.logger.today.of} {totalTodayCount} {t.logger.today.completedLabel}
              {totalTodayCount === 1 ? '' : t.logger.today.completedPluralSuffix}
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            {totalTodayCount > 1 && (
              <div className="h-3 w-full overflow-hidden rounded-full border border-paper-dim/30 bg-surface-raised">
                <div
                  className="h-full bg-acid transition-all duration-300 [background-image:var(--gradient-acid)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {todayActivities.map(({ activity, target }) => {
                const count = loggedCountFor(activity);
                const progressLabel =
                  activity.metricType === 'sets' && target.targetSets
                    ? `${count}/${target.targetSets} ${t.logger.card.setsUnit}`
                    : null;
                return (
                  <RoutineActivityCard
                    key={activity.id}
                    activity={activity}
                    target={target}
                    workouts={pastWorkouts}
                    weightUnit={weightUnit}
                    onAddSet={addLoggedSet}
                    onAddSession={addLoggedSession}
                    done={isActivityDone(activity, target)}
                    progressLabel={progressLabel}
                    t={t.logger}
                  />
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {pastWorkouts.length > 0 && (
        <CollapsibleSection
          title={t.logger.copy.sectionTitle}
          open={copySectionOpen}
          onToggle={() => setCopySectionOpen((prev) => !prev)}
        >
          <div className="card-brutal flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="label-brutal">{t.logger.copy.dayLabel}</span>
              <select
                value={copySourceId}
                onChange={(e) => handleCopySourceChange(e.target.value)}
                className="input-brutal"
              >
                <option value="">
                  {todayActivities.length === 0
                    ? t.logger.copy.chooseNoRoutine
                    : t.logger.copy.chooseWithRoutine}
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
            {copySource && (
              <div className="flex flex-col gap-2">
                {copySource.sets.map((s) => {
                  const activity = activityById.get(s.exercise_id);
                  const name = activity ? fullActivityName(activity) : s.exercise_id;
                  return (
                    <label key={s.id} className="flex items-center gap-2 font-mono text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={selectedSetIds.has(s.id)}
                        onChange={(e) =>
                          setSelectedSetIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                      {name} — {t.logger.copy.set} {s.set_number}: {s.reps} {t.logger.copy.repsX}{' '}
                      {kgToDisplay(s.weight, weightUnit)} {weightUnit}
                      {s.rpe !== null ? ` (${t.logger.table.rpe} ${s.rpe})` : ''}
                    </label>
                  );
                })}
                {copySource.sessions.map((s) => {
                  const activity = activityById.get(s.activity_id);
                  const name = activity ? fullActivityName(activity) : s.activity_id;
                  return (
                    <label key={s.id} className="flex items-center gap-2 font-mono text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.has(s.id)}
                        onChange={(e) =>
                          setSelectedSessionIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                      {name} —{' '}
                      {s.distance_km !== null
                        ? `${kmToMeters(s.distance_km)} ${t.logger.copy.distanceIn} `
                        : ''}
                      {s.duration_min} {t.logger.copy.min}
                    </label>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => copyWorkout(copySourceId, selectedSetIds, selectedSessionIds)}
              disabled={selectedSetIds.size + selectedSessionIds.size === 0}
              className="btn-brutal-sm shrink-0 self-start"
            >
              {t.logger.copy.copySelected} ({selectedSetIds.size + selectedSessionIds.size})
            </button>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t.logger.addActivity.sectionTitle}
        open={addActivitySectionOpen}
        onToggle={() => setAddActivitySectionOpen((prev) => !prev)}
      >
        <form onSubmit={handleAddActivity} className="card-brutal flex flex-col gap-4">
          <ActivityPicker activities={activities} onSelect={setSelectedActivity} t={t.picker} />
          {selectedActivity?.image && (
            <img
              src={`${import.meta.env.BASE_URL}exercises/${selectedActivity.image}`}
              alt={selectedActivity.name}
              loading="lazy"
              className="aspect-video w-full rounded-card object-cover"
            />
          )}
          {selectedActivity?.description && (
            <p className="font-mono text-xs text-paper-dim">{selectedActivity.description}</p>
          )}
          {freeFormSuggestion && (
            <p className="font-mono text-xs text-paper-dim">
              {suggestionHint(freeFormSuggestion, weightUnit, t.logger.suggestion)}
            </p>
          )}
          {selectedActivity?.metricType === 'sets' && (
            <SetFields
              reps={reps}
              weight={weight}
              rpe={rpe}
              weightUnit={weightUnit}
              onRepsChange={setReps}
              onWeightChange={setWeight}
              onRpeChange={setRpe}
              labels={t.logger.fields.set}
            />
          )}
          {selectedActivity?.metricType === 'session' && (
            <SessionFields
              duration={duration}
              distance={distance}
              requiresDistance={requiresDistance(selectedActivity)}
              onDurationChange={setDuration}
              onDistanceChange={setDistance}
              labels={t.logger.fields.session}
            />
          )}
          <button type="submit" className="btn-brutal-sm self-start">
            {t.logger.addActivity.submit}
          </button>
        </form>
      </CollapsibleSection>

      {loggedSets.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-paper-dim/30">
          <table className="w-full min-w-[480px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">{t.logger.table.exercise}</th>
                <th className="px-3 py-2 font-normal">{t.logger.table.set}</th>
                <th className="px-3 py-2 font-normal">{t.logger.table.reps}</th>
                <th className="px-3 py-2 font-normal">
                  {t.logger.table.weight} ({weightUnit})
                </th>
                <th className="px-3 py-2 font-normal">{t.logger.table.rpe}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loggedSets.map((s, i) => (
                <tr key={i} className="border-b border-paper-dim/20">
                  <td className="px-3 py-2 font-body text-paper">{s.exerciseName}</td>
                  <td className="px-3 py-2 text-acid">{s.setNumber}</td>
                  <td className="px-3 py-2">{s.reps}</td>
                  <td className="px-3 py-2">{kgToDisplay(s.weight, weightUnit)}</td>
                  <td className="px-3 py-2">{s.rpe ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(i)}
                      className="text-blood hover:text-paper"
                    >
                      {t.logger.table.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loggedSessions.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-paper-dim/30">
          <table className="w-full min-w-[420px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">{t.logger.table.activity}</th>
                <th className="px-3 py-2 font-normal">{t.logger.table.distance}</th>
                <th className="px-3 py-2 font-normal">{t.logger.table.duration}</th>
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
                      {t.logger.table.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {savedMessage && (
        <p key={savedMessage} className="reveal border-l border-acid pl-3 font-mono text-sm text-acid">
          {savedMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleSaveWorkout}
        disabled={saving}
        className="btn-brutal self-start"
      >
        {saving ? t.logger.actions.saving : t.logger.actions.submit}
      </button>
    </div>
  );
}
