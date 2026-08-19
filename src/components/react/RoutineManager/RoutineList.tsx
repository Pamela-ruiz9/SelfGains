import { useState } from 'react';
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  weekdayLabel,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
import { getMyConnections, type ConnectionSummary } from '../../../lib/connections';
import { proposeRoutineShare } from '../../../lib/routineShares';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
}

interface RoutineListProps {
  title: string;
  source: 'predefined' | 'custom';
  routines: RoutineOption[];
  activities: ActivityOption[];
  emptyMessage: string;
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
  onEdit?: (ref: string) => void;
  onDelete?: (ref: string) => void;
}

function daysSummary(days: RoutineDays, activities: ActivityOption[]): string {
  return WEEKDAYS.filter((day) => days[day].length > 0)
    .map((day) => {
      const names = days[day].map((entry) => {
        const id = entryActivityId(entry);
        const activity = activities.find((a) => a.id === id);
        const label = activity ? fullActivityName(activity) : id;
        const summary = activity ? targetSummary(activity.metricType, entryTarget(entry)) : null;
        return summary ? `${label} (${summary})` : label;
      });
      return `${weekdayLabel(day)}: ${names.join(', ')}`;
    })
    .join(' · ');
}

function ShareRoutinePicker({ routineId }: { routineId: string }) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<ConnectionSummary[] | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (connections === null) {
      setError(null);
      try {
        setConnections(await getMyConnections());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar tus conexiones.');
      }
    }
  }

  async function handleShare(toUserId: string) {
    setSharing(toUserId);
    setError(null);
    try {
      await proposeRoutineShare(routineId, toUserId);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo compartir la rutina.');
    } finally {
      setSharing(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
      >
        Compartir
      </button>
    );
  }

  if (done) {
    return <p className="font-mono text-xs text-paper-dim">Propuesta enviada.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {connections === null && !error && (
        <p className="font-mono text-xs text-paper-dim">Cargando...</p>
      )}
      {connections !== null && connections.length === 0 && (
        <p className="font-mono text-xs text-paper-dim">No tienes conexiones todavía.</p>
      )}
      {connections !== null &&
        connections.length > 0 &&
        connections.map((c) => (
          <button
            key={c.userId}
            type="button"
            disabled={sharing !== null}
            onClick={() => handleShare(c.userId)}
            className="text-left font-mono text-xs text-paper hover:text-acid"
          >
            {sharing === c.userId ? 'Compartiendo...' : c.displayName ?? 'Sin nombre'}
          </button>
        ))}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );
}

function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
  onEdit,
  onDelete,
}: {
  routine: RoutineOption;
  source: 'predefined' | 'custom';
  activities: ActivityOption[];
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
  onEdit?: (ref: string) => void;
  onDelete?: (ref: string) => void;
}) {
  const [weeks, setWeeks] = useState('8');

  return (
    <div className="card-brutal flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-paper">{routine.name}</p>
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
          {routine.assignedByName && (
            <p className="font-mono text-xs text-paper-dim">Compartida por: {routine.assignedByName}</p>
          )}
        </div>
        {source === 'custom' && (
          <div className="flex shrink-0 flex-col items-end gap-2 font-mono text-xs">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onEdit?.(routine.ref)}
                className="border-2 border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper transition duration-150 hover:border-paper hover:bg-paper hover:text-ink active:scale-95"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(routine.ref)}
                className="border-2 border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                Eliminar
              </button>
            </div>
            {!routine.assignedByName && <ShareRoutinePicker routineId={routine.ref} />}
          </div>
        )}
      </div>
      <p className="font-mono text-sm text-paper-dim">{daysSummary(routine.days, activities)}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={weeks}
          onChange={(e) => setWeeks(e.target.value)}
          min={1}
          className="input-brutal w-20"
        />
        <span className="label-brutal">semanas</span>
        <button
          type="button"
          onClick={() => onActivate(source, routine.ref, Number(weeks))}
          className="btn-brutal-sm ml-auto"
        >
          Activar
        </button>
      </div>
    </div>
  );
}

export default function RoutineList({
  title,
  source,
  routines,
  activities,
  emptyMessage,
  onActivate,
  onEdit,
  onDelete,
}: RoutineListProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{title}</p>
      {routines.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.ref}
              routine={routine}
              source={source}
              activities={activities}
              onActivate={onActivate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
