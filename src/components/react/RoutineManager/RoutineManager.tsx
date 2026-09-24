import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  activateRoutine,
  daysElapsed,
  deactivateRoutine,
  deleteRoutine,
  getActiveRoutine,
  getMyRoutines,
  getRoutineById,
  weeksElapsed,
} from '../../../lib/routines';
import { getWorkoutsForCurrentUser } from '../../../lib/workouts';
import { weekAdherence } from '../../../lib/adherence';
import { entryActivityId, WEEKDAYS, type RoutineDays } from '../../../lib/weekdays';
import { getMyProfile } from '../../../lib/profile';
import type { ActiveRoutine, Routine } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import RoutineList, { type RoutineOption } from './RoutineList';
import CreateRoutineForm from './CreateRoutineForm';

// Una rutina de gym solo puede recomendarse si al menos un día referencia
// una actividad de disciplina 'gym' — running/natación/combate no tienen
// `sex` en su contenido y quedan fuera de este cálculo por completo.
function isGymPlan(days: RoutineDays, activities: ActivityOption[]): boolean {
  for (const day of WEEKDAYS) {
    for (const entry of days[day]) {
      const activity = activities.find((a) => a.id === entryActivityId(entry));
      if (activity) return activity.discipline === 'gym';
    }
  }
  return false;
}

// Un campo que el usuario sí completó y que contradice al plan lo descarta,
// sin importar qué diga el otro campo. Pero para que se recomiende hace
// falta que al menos un campo coincida activamente — un perfil vacío (o
// donde no se completó nada) nunca debe hacer que todo se vea "recomendado".
function isRecommendedGymPlan(
  plan: { level: string; sex?: 'femenino' | 'masculino' },
  profileSex: 'femenino' | 'masculino' | null,
  profileLevel: 'principiante' | 'intermedio' | 'avanzado' | null
): boolean {
  const planLevel = plan.level.toLowerCase();

  if (profileLevel !== null && planLevel !== profileLevel) return false;
  if (profileSex !== null && plan.sex !== undefined && plan.sex !== profileSex) return false;

  const levelAgrees = profileLevel !== null && planLevel === profileLevel;
  const sexAgrees = profileSex !== null && plan.sex !== undefined && plan.sex === profileSex;
  return levelAgrees || sexAgrees;
}

interface PredefinedRoutine {
  id: string;
  name: string;
  goal: string;
  level: string;
  sex?: 'femenino' | 'masculino';
  days: RoutineDays;
}

interface Props {
  predefinedRoutines: PredefinedRoutine[];
  activities: ActivityOption[];
  t: Dictionary['rutinas'];
  pickerT: Dictionary['registrar']['picker'];
  disciplinesT: Dictionary['disciplines'];
}

export default function RoutineManager({ predefinedRoutines, activities, t, pickerT, disciplinesT }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [activeRoutine, setActiveRoutine] = useState<ActiveRoutine | null>(null);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [activeCustomRoutine, setActiveCustomRoutine] = useState<Routine | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [profileSex, setProfileSex] = useState<'femenino' | 'masculino' | null>(null);
  const [profileLevel, setProfileLevel] = useState<
    'principiante' | 'intermedio' | 'avanzado' | null
  >(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [addRoutineTab, setAddRoutineTab] = useState<'custom' | 'predefined'>('custom');

  async function refresh() {
    const [active, mine, workouts, profile] = await Promise.all([
      getActiveRoutine(),
      getMyRoutines(),
      getWorkoutsForCurrentUser(),
      getMyProfile(),
    ]);
    setActiveRoutine(active);
    setMyRoutines(mine);
    setWorkoutDates(new Set(workouts.map((w) => w.date)));
    setProfileSex(profile?.sex ?? null);
    setProfileLevel(profile?.training_level ?? null);
    if (active?.source === 'custom') {
      setActiveCustomRoutine(await getRoutineById(active.routine_ref));
    } else {
      setActiveCustomRoutine(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) await refresh();
    });
  }, []);

  async function handleActivate(source: 'predefined' | 'custom', ref: string, weeks: number) {
    setError(null);
    if (!Number.isFinite(weeks) || weeks <= 0) {
      setError(t.weeksDurationError);
      return;
    }
    try {
      await activateRoutine(source, ref, weeks);
      setShowAddRoutine(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.activateError);
    }
  }

  async function handleDeactivate() {
    setError(null);
    try {
      await deactivateRoutine();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deactivateError);
    }
  }

  function handleEditRoutine(ref: string) {
    const routine = myRoutines.find((r) => r.id === ref);
    if (routine) {
      setEditingRoutine(routine);
      setAddRoutineTab('custom');
      setShowAddRoutine(true);
    }
  }

  async function handleDeleteRoutine(ref: string) {
    if (!confirm(t.deleteConfirm)) return;
    setError(null);
    try {
      await deleteRoutine(ref);
      if (activeRoutine?.source === 'custom' && activeRoutine.routine_ref === ref) {
        await deactivateRoutine();
      }
      if (editingRoutine?.id === ref) setEditingRoutine(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteError);
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">{t.loading}</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.notLoggedIn.prefix}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.notLoggedIn.link}
        </a>{' '}
        {t.notLoggedIn.suffix}
      </p>
    );
  }

  const activeName =
    activeRoutine?.source === 'predefined'
      ? predefinedRoutines.find((p) => p.id === activeRoutine.routine_ref)?.name
      : activeCustomRoutine?.name;

  const elapsed = activeRoutine ? weeksElapsed(activeRoutine.started_at) : 0;
  const days = activeRoutine ? daysElapsed(activeRoutine.started_at) : 0;
  const expired = activeRoutine ? elapsed >= activeRoutine.duration_weeks : false;

  const adherence = activeRoutine ? weekAdherence(workoutDates) : null;

  const predefinedOptions: RoutineOption[] = predefinedRoutines
    .map((p) => ({
      ref: p.id,
      name: p.name,
      subtitle: `${p.goal} · ${p.level}`,
      days: p.days,
      recommended:
        isGymPlan(p.days, activities) && isRecommendedGymPlan(p, profileSex, profileLevel),
    }))
    // Sort es estable — dentro de "recomendadas" y "resto" se conserva el
    // orden alfabético que ya trae `predefinedRoutines` desde la página.
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));

  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
    assignedByName: r.assigned_by_name,
    originalAuthorName: r.original_author_name,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.active.sectionTitle}</p>
        {!activeRoutine ? (
          <p className="font-mono text-sm text-paper-dim">{t.active.none}</p>
        ) : expired ? (
          <div className="card-brutal border-blood/60">
            <p className="font-mono text-sm text-blood">
              {t.active.expiredPrefix} "{activeName ?? t.active.unknownName}"{' '}
              {t.active.expiredWeeksAgo} {elapsed - activeRoutine.duration_weeks + 1}{' '}
              {t.active.expiredSuffix}
            </p>
            <p className="mt-2 font-mono text-sm text-paper-dim">
              {t.active.expiredHintPrefix}{' '}
              <a
                href={`${import.meta.env.BASE_URL}perfil/`}
                className="text-acid underline underline-offset-4 hover:text-paper"
              >
                {t.active.expiredHintLink}
              </a>{' '}
              {t.active.expiredHintSuffix}
            </p>
          </div>
        ) : (
          <div className="card-brutal flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-paper">
                {activeName ?? t.active.unknownRoutine}
              </p>
              <p className="font-mono text-sm text-paper-dim">
                {t.active.weekLabel} {Math.min(elapsed + 1, activeRoutine.duration_weeks)}{' '}
                {t.active.of} {activeRoutine.duration_weeks} — {t.active.dayLabel}{' '}
                {Math.min(days + 1, activeRoutine.duration_weeks * 7)} {t.active.of}{' '}
                {activeRoutine.duration_weeks * 7}
              </p>
              {adherence && adherence.daysElapsed > 0 && (
                <p className="font-mono text-sm text-paper-dim">
                  {t.active.adherencePrefix} {adherence.daysTrained} {t.active.of}{' '}
                  {adherence.daysElapsed} {t.active.adherenceSuffix}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDeactivate}
              className="shrink-0 rounded-control border border-blood bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
            >
              {t.active.deactivate}
            </button>
          </div>
        )}
      </div>

      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <RoutineList
        title={t.list.myRoutinesTitle}
        source="custom"
        routines={customOptions}
        activities={activities}
        emptyMessage={t.list.myRoutinesEmpty}
        onActivate={handleActivate}
        onEdit={handleEditRoutine}
        onDelete={handleDeleteRoutine}
        t={t}
      />

      {!showAddRoutine ? (
        <button
          type="button"
          onClick={() => setShowAddRoutine(true)}
          className="btn-brutal self-start"
        >
          {t.addRoutine.toggle}
        </button>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">{t.addRoutine.sectionTitle}</p>
            <button
              type="button"
              onClick={() => {
                setShowAddRoutine(false);
                setEditingRoutine(null);
              }}
              className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
            >
              {t.addRoutine.close}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddRoutineTab('custom')}
              className={
                addRoutineTab === 'custom'
                  ? 'btn-brutal-sm pill-selected'
                  : 'btn-brutal-sm'
              }
            >
              {t.addRoutine.tabCustom}
            </button>
            <button
              type="button"
              onClick={() => setAddRoutineTab('predefined')}
              className={
                addRoutineTab === 'predefined'
                  ? 'btn-brutal-sm pill-selected'
                  : 'btn-brutal-sm'
              }
            >
              {t.addRoutine.tabPredefined}
            </button>
          </div>

          {addRoutineTab === 'custom' ? (
            <CreateRoutineForm
              activities={activities}
              editingRoutine={editingRoutine}
              onSaved={() => {
                setEditingRoutine(null);
                setShowAddRoutine(false);
                refresh();
              }}
              onCancelEdit={() => setEditingRoutine(null)}
              t={t}
              pickerT={pickerT}
              disciplinesT={disciplinesT}
            />
          ) : (
            <RoutineList
              title={t.list.predefinedTitle}
              source="predefined"
              routines={predefinedOptions}
              activities={activities}
              emptyMessage={t.list.predefinedEmpty}
              onActivate={handleActivate}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}
