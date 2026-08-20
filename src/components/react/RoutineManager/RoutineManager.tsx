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
}

export default function RoutineManager({ predefinedRoutines, activities }: Props) {
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
      setError('La duración debe ser un número de semanas mayor a 0.');
      return;
    }
    try {
      await activateRoutine(source, ref, weeks);
      setShowAddRoutine(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la rutina.');
    }
  }

  async function handleDeactivate() {
    setError(null);
    try {
      await deactivateRoutine();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar la rutina.');
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
    if (!confirm('¿Eliminar esta rutina? Esta acción no se puede deshacer.')) return;
    setError(null);
    try {
      await deleteRoutine(ref);
      if (activeRoutine?.source === 'custom' && activeRoutine.routine_ref === ref) {
        await deactivateRoutine();
      }
      if (editingRoutine?.id === ref) setEditingRoutine(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la rutina.');
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
        para ver y armar tus rutinas.
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

  const activeRoutineDays: RoutineDays | null =
    activeRoutine?.source === 'predefined'
      ? predefinedRoutines.find((p) => p.id === activeRoutine.routine_ref)?.days ?? null
      : activeCustomRoutine?.days ?? null;
  const adherence = activeRoutineDays ? weekAdherence(activeRoutineDays, workoutDates) : null;

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
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Rutina activa</p>
        {!activeRoutine ? (
          <p className="font-mono text-sm text-paper-dim">
            No tienes ninguna rutina activa todavía. Elige una predefinida o crea la tuya abajo.
          </p>
        ) : expired ? (
          <div className="card-brutal border-blood/60">
            <p className="font-mono text-sm text-blood">
              Tu rutina "{activeName ?? 'desconocida'}" venció hace{' '}
              {elapsed - activeRoutine.duration_weeks + 1} semana(s). ¿Elegís una nueva abajo?
            </p>
            <p className="mt-2 font-mono text-sm text-paper-dim">
              Aprovechá para{' '}
              <a
                href={`${import.meta.env.BASE_URL}perfil/`}
                className="text-acid underline underline-offset-4 hover:text-paper"
              >
                actualizar tus medidas
              </a>{' '}
              y ver tu progreso.
            </p>
          </div>
        ) : (
          <div className="card-brutal flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-paper">{activeName ?? 'Rutina desconocida'}</p>
              <p className="font-mono text-sm text-paper-dim">
                Semana {Math.min(elapsed + 1, activeRoutine.duration_weeks)} de{' '}
                {activeRoutine.duration_weeks} — día{' '}
                {Math.min(days + 1, activeRoutine.duration_weeks * 7)} de{' '}
                {activeRoutine.duration_weeks * 7}
              </p>
              {adherence && adherence.scheduledDays > 0 && (
                <p className="font-mono text-sm text-paper-dim">
                  Esta semana: {adherence.completedDays} de {adherence.scheduledDays} días
                  cumplidos
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDeactivate}
              className="shrink-0 border-2 border-blood bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
            >
              Desactivar
            </button>
          </div>
        )}
      </div>

      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <RoutineList
        title="Mis rutinas"
        source="custom"
        routines={customOptions}
        activities={activities}
        emptyMessage="Todavía no creaste ninguna rutina propia."
        onActivate={handleActivate}
        onEdit={handleEditRoutine}
        onDelete={handleDeleteRoutine}
      />

      {!showAddRoutine ? (
        <button
          type="button"
          onClick={() => setShowAddRoutine(true)}
          className="btn-brutal self-start"
        >
          + Agregar nueva rutina
        </button>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">Agregar nueva rutina</p>
            <button
              type="button"
              onClick={() => {
                setShowAddRoutine(false);
                setEditingRoutine(null);
              }}
              className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
            >
              Cerrar
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddRoutineTab('custom')}
              className={
                addRoutineTab === 'custom'
                  ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                  : 'btn-brutal-sm'
              }
            >
              Crear la mía
            </button>
            <button
              type="button"
              onClick={() => setAddRoutineTab('predefined')}
              className={
                addRoutineTab === 'predefined'
                  ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                  : 'btn-brutal-sm'
              }
            >
              Elegir predefinida
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
            />
          ) : (
            <RoutineList
              title="Predefinidas"
              source="predefined"
              routines={predefinedOptions}
              activities={activities}
              emptyMessage="No hay rutinas predefinidas todavía."
              onActivate={handleActivate}
            />
          )}
        </div>
      )}
    </div>
  );
}
