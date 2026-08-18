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
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActiveRoutine, Routine } from '../../../types/db';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import RoutineList, { type RoutineOption } from './RoutineList';
import CreateRoutineForm from './CreateRoutineForm';

interface PredefinedRoutine {
  id: string;
  name: string;
  goal: string;
  level: string;
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
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [addRoutineTab, setAddRoutineTab] = useState<'custom' | 'predefined'>('custom');

  async function refresh() {
    const [active, mine, workouts] = await Promise.all([
      getActiveRoutine(),
      getMyRoutines(),
      getWorkoutsForCurrentUser(),
    ]);
    setActiveRoutine(active);
    setMyRoutines(mine);
    setWorkoutDates(new Set(workouts.map((w) => w.date)));
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

  const predefinedOptions: RoutineOption[] = predefinedRoutines.map((p) => ({
    ref: p.id,
    name: p.name,
    subtitle: `${p.goal} · ${p.level}`,
    days: p.days,
  }));

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
            No tenés ninguna rutina activa todavía. Elegí una predefinida o creá la tuya abajo.
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
              className="shrink-0 font-mono text-xs text-blood hover:text-paper"
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
              className="font-mono text-xs text-paper-dim hover:text-paper"
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
