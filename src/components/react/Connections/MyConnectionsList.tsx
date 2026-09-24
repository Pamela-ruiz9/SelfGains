import { useState } from 'react';
import type { ConnectionSummary } from '../../../lib/connections';
import { assignRoutineToStudent } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';
import type { Dictionary } from '../../../i18n/es';

function AssignRoutinePicker({
  studentId,
  routines,
  onAssigned,
  t,
}: {
  studentId: string;
  routines: Routine[];
  onAssigned: () => void;
  t: Dictionary['conexiones']['myConnectionsList']['assignRoutine'];
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
      setError(err instanceof Error ? err.message : t.assignError);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-brutal-sm">
        {t.button}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routines.length === 0 ? (
        <p className="font-mono text-xs text-paper-dim">{t.empty}</p>
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
        {t.cancel}
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
  t: Dictionary['conexiones']['myConnectionsList'];
  avatarT: Dictionary['sync']['avatar'];
}

export default function MyConnectionsList({
  connections,
  isTrainer,
  myRoutines,
  onRemove,
  onRoutineAssigned,
  t,
  avatarT,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      {connections.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{t.empty}</p>
      ) : (
        connections.map((c) => (
          <div key={c.connectionId} className="card-brutal flex items-center gap-4">
            <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} t={avatarT} />
            <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? t.unnamedUser}</p>
            <div className="flex flex-col items-end gap-2">
              {isTrainer && (
                <AssignRoutinePicker
                  studentId={c.userId}
                  routines={myRoutines}
                  onAssigned={onRoutineAssigned}
                  t={t.assignRoutine}
                />
              )}
              <button
                type="button"
                onClick={() => onRemove(c.connectionId)}
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                {t.unlink}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
