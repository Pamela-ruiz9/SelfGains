import { useEffect, useState } from 'react';
import type { ConflictItem } from '../../../lib/offlineDb';
import { getConflicts, patchCacheArray, removeConflict } from '../../../lib/offlineQueue';
import { updateSessionRemote, updateSetRemote } from '../../../lib/workouts';
import type { WorkoutSession, WorkoutSet } from '../../../types/db';

const TYPE_LABEL: Record<string, string> = {
  createWorkout: 'Entrenamiento nuevo',
  addSet: 'Serie nueva',
  addSession: 'Sesión nueva',
  updateSet: 'Edición de una serie',
  deleteSet: 'Borrado de una serie',
  updateSession: 'Edición de una sesión',
  deleteSession: 'Borrado de una sesión',
  deleteWorkout: 'Borrado de un entrenamiento',
}

function describeSetPayload(payload: Record<string, unknown>): string {
  return `${payload.reps} reps × ${payload.weight}kg${payload.rpe ? ` (RPE ${payload.rpe})` : ''}`;
}

function describeSessionPayload(payload: Record<string, unknown>): string {
  const duration = `${payload.durationMin} min`;
  return payload.distanceKm ? `${payload.distanceKm} km en ${duration}` : duration;
}

function describeMine(conflict: ConflictItem): string {
  const { type, payload } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(payload);
  if (type === 'updateSession') return describeSessionPayload(payload);
  return 'este entrenamiento ya no existe en el servidor';
}

function describeTheirs(conflict: ConflictItem): string {
  if (!conflict.serverSnapshot) return 'Ya no existe en el servidor.';
  const { type } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(conflict.serverSnapshot);
  if (type === 'updateSession') return describeSessionPayload(conflict.serverSnapshot);
  return JSON.stringify(conflict.serverSnapshot);
}

export default function ConflictResolution() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConflicts()
      .then(setConflicts)
      .finally(() => setLoading(false));
  }, []);

  async function discard(conflict: ConflictItem) {
    const { queueItem } = conflict;
    const workoutId = (queueItem.payload as { workoutId?: string }).workoutId;
    try {
      if (queueItem.type === 'addSet' && queueItem.tempId && workoutId) {
        await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
          items.filter((s) => s.id !== queueItem.tempId)
        );
      } else if (queueItem.type === 'addSession' && queueItem.tempId && workoutId) {
        await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
          items.filter((s) => s.id !== queueItem.tempId)
        );
      } else if (queueItem.type === 'updateSet' && workoutId) {
        const p = queueItem.payload as { setId: string };
        await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, (items) =>
          conflict.serverSnapshot
            ? items.map((s) => (s.id === p.setId ? (conflict.serverSnapshot as unknown as WorkoutSet) : s))
            : items.filter((s) => s.id !== p.setId)
        );
      } else if (queueItem.type === 'updateSession' && workoutId) {
        const p = queueItem.payload as { sessionId: string };
        await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, (items) =>
          conflict.serverSnapshot
            ? items.map((s) => (s.id === p.sessionId ? (conflict.serverSnapshot as unknown as WorkoutSession) : s))
            : items.filter((s) => s.id !== p.sessionId)
        );
      }
      await removeConflict(conflict.id!);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descartar el cambio.');
    }
  }

  async function keepMine(conflict: ConflictItem) {
    const { queueItem } = conflict;
    try {
      if (queueItem.type === 'updateSet') {
        const p = queueItem.payload as { setId: string; reps: number; weight: number; rpe: number | null };
        await updateSetRemote(p.setId, p.reps, p.weight, p.rpe ?? undefined);
      } else if (queueItem.type === 'updateSession') {
        const p = queueItem.payload as { sessionId: string; durationMin: number; distanceKm: number | null };
        await updateSessionRemote(p.sessionId, p.durationMin, p.distanceKm ?? undefined);
      }
      await removeConflict(conflict.id!);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el cambio.');
    }
  }

  if (loading) return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;

  if (conflicts.length === 0) {
    return <p className="font-mono text-sm text-paper-dim">No hay conflictos pendientes.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="card-brutal flex flex-col gap-3">
          <p className="label-brutal text-acid">{TYPE_LABEL[conflict.queueItem.type] ?? conflict.queueItem.type}</p>
          <p className="font-mono text-sm text-paper">
            Vos: <span className="text-paper-dim">{describeMine(conflict)}</span>
          </p>
          <p className="font-mono text-sm text-paper">
            Servidor: <span className="text-paper-dim">{describeTheirs(conflict)}</span>
          </p>
          <div className="flex gap-2">
            {conflict.serverSnapshot && (
              <button type="button" onClick={() => keepMine(conflict)} className="btn-brutal-sm">
                Mantener el mío
              </button>
            )}
            <button type="button" onClick={() => discard(conflict)} className="btn-brutal-sm opacity-60">
              {conflict.serverSnapshot ? 'Descartar y usar el del servidor' : 'Descartar mi cambio'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
