import { useEffect, useState } from 'react';
import { flushQueue } from '../../../lib/workouts';
import { getConflictCount, getQueueCount } from '../../../lib/offlineQueue';

export default function SyncBanner() {
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);

  async function refresh() {
    setPending(await getQueueCount());
    setConflicts(await getConflictCount());
  }

  useEffect(() => {
    refresh();

    async function trySync() {
      if (navigator.onLine) {
        await flushQueue();
        await refresh();
      }
    }
    trySync();

    window.addEventListener('online', trySync);
    window.addEventListener('selfgains:sync-complete', refresh);
    window.addEventListener('selfgains:queue-changed', refresh);
    return () => {
      window.removeEventListener('online', trySync);
      window.removeEventListener('selfgains:sync-complete', refresh);
      window.removeEventListener('selfgains:queue-changed', refresh);
    };
  }, []);

  if (conflicts === 0 && pending === 0) return null;

  const base = import.meta.env.BASE_URL;

  if (conflicts > 0) {
    return (
      <a
        href={`${base}sincronizacion/`}
        className="reveal block border-b-2 border-blood bg-surface px-4 py-2 text-center font-mono text-sm text-blood hover:text-paper"
      >
        {conflicts} {conflicts === 1 ? 'conflicto' : 'conflictos'} — revisar
      </a>
    );
  }

  return (
    <p className="reveal border-b-2 border-acid bg-surface px-4 py-2 text-center font-mono text-sm text-paper-dim">
      {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} de sincronizar
    </p>
  );
}
