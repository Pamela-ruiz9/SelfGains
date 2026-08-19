import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile } from '../../../lib/profile';
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  redeemInviteCode,
  removeConnection,
  type ConnectionSummary,
} from '../../../lib/connections';
import {
  acceptConnectionRequest,
  getIncomingRequests,
  rejectConnectionRequest,
  searchUsers,
  sendConnectionRequest,
  type IncomingRequest,
  type SearchResult,
} from '../../../lib/connectionRequests';
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import Avatar from '../Shared/Avatar';

function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}c/#${code}`;
}

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
        <p className="font-mono text-xs text-paper-dim">No tenés rutinas propias para asignar todavía.</p>
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
        className="font-mono text-xs text-paper-dim hover:text-paper"
      >
        Cancelar
      </button>
    </div>
  );
}

export default function Connections() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [redeemInput, setRedeemInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  async function refresh() {
    const [profile, myCode, myConnections, routines, incoming] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
      getIncomingRequests(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
    setIncomingRequests(incoming);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) {
        try {
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
        }
      }
    });
  }, []);

  async function handleShare() {
    setError(null);
    try {
      const newCode = await createOrRegenerateInviteCode();
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link.');
    }
  }

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await redeemInviteCode(redeemInput);
      setRedeemInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con ese código.');
    }
  }

  async function handleRemove(connectionId: string) {
    if (!confirm('¿Desvincularte de esta persona?')) return;
    try {
      await removeConnection(connectionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular.');
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSearching(true);
    setHasSearched(true);
    try {
      setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSearchResults((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, status: 'request-sent' } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    }
  }

  async function handleAcceptFromSearch(userId: string, requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      setSearchResults((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'connected' } : r)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleAcceptIncoming(requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      await refresh();
      if (searchQuery.trim()) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
      if (searchQuery.trim()) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud.');
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
        para ver tus conexiones.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Mi link de invitación</p>
        {code ? (
          <div className="flex flex-col gap-2">
            <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleCopy} className="btn-brutal-sm">
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button type="button" onClick={handleShare} className="btn-brutal-sm opacity-60">
                Regenerar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleShare} className="btn-brutal-sm self-start">
            Generar mi link
          </button>
        )}
      </div>

      <form onSubmit={handleRedeem} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Conectarme con un código</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="AB3F9K"
            className="input-brutal"
          />
          <button type="submit" className="btn-brutal-sm shrink-0">
            Conectar
          </button>
        </div>
      </form>

      <form onSubmit={handleSearch} className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Buscar usuarios</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre"
            className="input-brutal"
          />
          <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {hasSearched && searchResults.length === 0 && (
          <p className="font-mono text-sm text-paper-dim">No se encontraron usuarios.</p>
        )}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((r) => (
              <div key={r.userId} className="card-brutal flex items-center gap-4">
                <Avatar avatarUrl={r.avatarUrl} displayName={r.displayName} isTrainer={r.isTrainer} />
                <p className="flex-1 font-display text-xl text-paper">{r.displayName ?? 'Sin nombre'}</p>
                {r.status === 'connected' && (
                  <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
                )}
                {r.status === 'request-sent' && (
                  <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                )}
                {r.status === 'request-received' && r.requestId && (
                  <button
                    type="button"
                    onClick={() => handleAcceptFromSearch(r.userId, r.requestId!)}
                    className="btn-brutal-sm"
                  >
                    Aceptar
                  </button>
                )}
                {r.status === 'none' && (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(r.userId)}
                    className="btn-brutal-sm"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Solicitudes de conexión</p>
        {incomingRequests.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés solicitudes pendientes.</p>
        ) : (
          incomingRequests.map((req) => (
            <div key={req.requestId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? 'Sin nombre'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptIncoming(req.requestId)}
                  className="btn-brutal-sm"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectIncoming(req.requestId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Mis conexiones</p>
        {connections.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">Todavía no tenés ninguna conexión.</p>
        ) : (
          connections.map((c) => (
            <div key={c.connectionId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={c.avatarUrl} displayName={c.displayName} isTrainer={c.isTrainer} />
              <p className="flex-1 font-display text-xl text-paper">{c.displayName ?? 'Sin nombre'}</p>
              <div className="flex flex-col items-end gap-2">
                {isTrainer && (
                  <AssignRoutinePicker studentId={c.userId} routines={myRoutines} onAssigned={refresh} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(c.connectionId)}
                  className="font-mono text-xs text-blood hover:text-paper"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
