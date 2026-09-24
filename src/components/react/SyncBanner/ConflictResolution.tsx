import { useEffect, useState } from 'react';
import type { ConflictItem } from '../../../lib/offlineDb';
import { getConflicts, patchCacheArray, removeConflict } from '../../../lib/offlineQueue';
import { updateSessionRemote, updateSetRemote } from '../../../lib/workouts';
import type { Workout, WorkoutSession, WorkoutSet } from '../../../types/db';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { Dictionary } from '../../../i18n/es';

const weightUnit = getWeightUnit();

type ConflictResolutionT = Dictionary['sync']['conflictResolution'];

function describeSetPayload(payload: Record<string, unknown>, t: ConflictResolutionT): string {
  const weight = kgToDisplay(Number(payload.weight), weightUnit);
  return `${payload.reps} ${t.measure.reps} ${t.measure.times} ${weight}${weightUnit}${payload.rpe ? ` (${t.measure.rpe} ${payload.rpe})` : ''}`;
}

function describeSessionPayload(payload: Record<string, unknown>, t: ConflictResolutionT): string {
  const duration = `${payload.durationMin} ${t.measure.min}`;
  return payload.distanceKm ? `${payload.distanceKm} ${t.measure.distanceIn} ${duration}` : duration;
}

function describeSessionSnapshot(snapshot: Record<string, unknown>, t: ConflictResolutionT): string {
  const duration = `${snapshot.duration_min} ${t.measure.min}`;
  return snapshot.distance_km ? `${snapshot.distance_km} ${t.measure.distanceIn} ${duration}` : duration;
}

function describeMine(conflict: ConflictItem, t: ConflictResolutionT): string {
  const { type, payload } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(payload, t);
  if (type === 'updateSession') return describeSessionPayload(payload, t);
  return t.mineNoLongerExists;
}

function describeTheirs(conflict: ConflictItem, t: ConflictResolutionT): string {
  if (!conflict.serverSnapshot) return t.theirsNoLongerExists;
  const { type } = conflict.queueItem;
  if (type === 'updateSet') return describeSetPayload(conflict.serverSnapshot, t);
  if (type === 'updateSession') return describeSessionSnapshot(conflict.serverSnapshot, t);
  return JSON.stringify(conflict.serverSnapshot);
}

interface Props {
  t: ConflictResolutionT;
}

export default function ConflictResolution({ t }: Props) {
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
      } else if (queueItem.type === 'createWorkout') {
        // Un createWorkout offline que falló por una razón que no es de red
        // deja un workout fantasma (id temporal) pegado en el caché — hay
        // que sacarlo, además de cualquier set/sesión hijo que haya quedado
        // huérfano bajo esa misma clave temporal.
        const userId = (queueItem.payload as { userId?: string }).userId;
        if (userId && queueItem.tempId) {
          await patchCacheArray<Workout>(`workouts:${userId}`, (items) =>
            items.filter((w) => w.id !== queueItem.tempId)
          );
        }
        if (queueItem.tempId) {
          await patchCacheArray<WorkoutSet>(`sets:${queueItem.tempId}`, () => []);
          await patchCacheArray<WorkoutSession>(`sessions:${queueItem.tempId}`, () => []);
        }
      } else if (queueItem.type === 'deleteWorkout') {
        // Un delete offline que falló por una razón que no es de red deja el
        // caché creyendo que el workout ya no existe, sin forma de saber su
        // estado real sin volver a pedirlo — se invalida la lista completa
        // para que el próximo fetch online la reponga con la verdad.
        const userId = (queueItem.payload as { userId?: string }).userId;
        if (userId) await patchCacheArray<Workout>(`workouts:${userId}`, () => []);
      } else if (queueItem.type === 'deleteSet' && workoutId) {
        await patchCacheArray<WorkoutSet>(`sets:${workoutId}`, () => []);
      } else if (queueItem.type === 'deleteSession' && workoutId) {
        await patchCacheArray<WorkoutSession>(`sessions:${workoutId}`, () => []);
      }
      await removeConflict(conflict.id!);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.discardError);
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
      setError(err instanceof Error ? err.message : t.applyError);
    }
  }

  if (loading) return <p className="font-mono text-sm text-paper-dim">{t.loading}</p>;

  if (conflicts.length === 0) {
    return <p className="font-mono text-sm text-paper-dim">{t.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="card-brutal flex flex-col gap-3">
          <p className="label-brutal text-acid">
            {t.typeLabels[conflict.queueItem.type as keyof typeof t.typeLabels] ?? conflict.queueItem.type}
          </p>
          <p className="font-mono text-sm text-paper">
            {t.mineLabel} <span className="text-paper-dim">{describeMine(conflict, t)}</span>
          </p>
          <p className="font-mono text-sm text-paper">
            {t.serverLabel} <span className="text-paper-dim">{describeTheirs(conflict, t)}</span>
          </p>
          <div className="flex gap-2">
            {conflict.serverSnapshot && (
              <button type="button" onClick={() => keepMine(conflict)} className="btn-brutal-sm">
                {t.keepMine}
              </button>
            )}
            <button type="button" onClick={() => discard(conflict)} className="btn-brutal-sm opacity-60">
              {conflict.serverSnapshot ? t.discardUseServer : t.discardMine}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
