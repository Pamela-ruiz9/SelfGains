import { useState } from 'react';
import type { ConnectionSummary } from '../../../lib/connections';
import { assignRoutineToStudent } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';

function AssignRoutinePicker({
  studentId,
  routines,
  onAssigned,
}: {
  studentId: string;
  routines: Routine[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign(routineId: string) {
    setSaving(true);
    setError(null);
    try {
      await assignRoutineToStudent(routineId, studentId);
      setOpen(false);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la rutina.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-brutal-sm">
        Asignar rutina
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routines.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">No tienes rutinas propias para asignar todavía.</p>
      ) : (
        routines.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={saving}
            onClick={() => handleAssign(r.id)}
            className="btn-brutal-sm text-left"
          >
            {r.name}
          </button>
        ))
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );
}

interface Props {
  connections: ConnectionSummary[];
  isTrainer: boolean;
  myRoutines: Routine[];
  onRemove: (connectionId: string) => void;
  onRoutineAssigned: () => void;
}

export default function MyConnectionsList({
  connections,
  isTrainer,
  myRoutines,
  onRemove,
  onRoutineAssigned,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Mis conexiones</p>
      {connections.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">Todavía no tienes ninguna conexión.</p>
      ) : (
        connections.map((c) => (
          <div key={c.connectionId} className="card-brutal flex items-center gap-4">
            <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
            <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
            <div className="flex flex-col items-end gap-2">
              {isTrainer && (
                <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={onRoutineAssigned} />
              )}
              <button
                type="button"
                onClick={() => onRemove(c.connectionId)}
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                Desvincular
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
