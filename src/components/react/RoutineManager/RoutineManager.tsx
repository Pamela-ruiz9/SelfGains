import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  activateRoutine,
  getActiveRoutine,
  getMyRoutines,
  getRoutineById,
  weeksElapsed,
} from '../../../lib/routines';
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
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [active, mine] = await Promise.all([getActiveRoutine(), getMyRoutines()]);
    setActiveRoutine(active);
    setMyRoutines(mine);
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
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la rutina.');
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
  const expired = activeRoutine ? elapsed >= activeRoutine.duration_weeks : false;

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
          </div>
        ) : (
          <div className="card-brutal">
            <p className="font-display text-2xl text-paper">{activeName ?? 'Rutina desconocida'}</p>
            <p className="font-mono text-sm text-paper-dim">
              Semana {Math.min(elapsed + 1, activeRoutine.duration_weeks)} de{' '}
              {activeRoutine.duration_weeks}
            </p>
          </div>
        )}
      </div>

      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <RoutineList
        title="Predefinidas"
        source="predefined"
        routines={predefinedOptions}
        activities={activities}
        emptyMessage="No hay rutinas predefinidas todavía."
        onActivate={handleActivate}
      />

      <RoutineList
        title="Mis rutinas"
        source="custom"
        routines={customOptions}
        activities={activities}
        emptyMessage="Todavía no creaste ninguna rutina propia."
        onActivate={handleActivate}
      />

      <CreateRoutineForm activities={activities} onCreated={refresh} />
    </div>
  );
}
