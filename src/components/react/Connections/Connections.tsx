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
import {
  DEFAULT_MAP_CENTER,
  getVisibleTrainersNear,
  type VisibleTrainer,
} from '../../../lib/trainerProfiles';
import {
  acceptRoutineShare,
  getPendingRoutineShares,
  getSharedRoutinePreview,
  rejectRoutineShare,
  type PendingRoutineShare,
} from '../../../lib/routineShares';
import { assignRoutineToStudent, getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';
import RoutinePreview from '../RoutineManager/RoutinePreview';

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

interface Props {
  activities: ActivityOption[];
}

export default function Connections({ activities }: Props) {
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

  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [trainerCenter, setTrainerCenter] = useState<[number, number] | null>(null);
  const [trainerRadiusKm, setTrainerRadiusKm] = useState(10);
  const [nearbyTrainers, setNearbyTrainers] = useState<VisibleTrainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [sentTrainerRequests, setSentTrainerRequests] = useState<Set<string>>(new Set());

  const [pendingShares, setPendingShares] = useState<PendingRoutineShare[]>([]);
  const [previewShareId, setPreviewShareId] = useState<string | null>(null);
  const [previewDays, setPreviewDays] = useState<RoutineDays | null>(null);
  const [shareActionError, setShareActionError] = useState<string | null>(null);

  async function refresh() {
    const [profile, myCode, myConnections, routines, incoming, shares] = await Promise.all([
      getMyProfile(),
      getMyInviteCode(),
      getMyConnections(),
      getMyRoutines(),
      getIncomingRequests(),
      getPendingRoutineShares(),
    ]);
    setIsTrainer(profile?.is_trainer ?? false);
    setCode(myCode);
    setConnections(myConnections);
    setMyRoutines(routines);
    setIncomingRequests(incoming);
    setPendingShares(shares);
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

  useEffect(() => {
    if (!showTrainerSearch || trainerCenter) return;
    if (!navigator.geolocation) {
      setTrainerCenter(DEFAULT_MAP_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setTrainerCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setTrainerCenter(DEFAULT_MAP_CENTER)
    );
  }, [showTrainerSearch, trainerCenter]);

  useEffect(() => {
    if (!trainerCenter) return;
    getVisibleTrainersNear(trainerCenter[0], trainerCenter[1], trainerRadiusKm)
      .then(setNearbyTrainers)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.'));
  }, [trainerCenter, trainerRadiusKm]);

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

  async function handleConnectTrainer(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSentTrainerRequests((prev) => new Set(prev).add(userId));
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
      if (hasSearched) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
      if (hasSearched) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  async function handlePreviewShare(share: PendingRoutineShare) {
    setShareActionError(null);
    try {
      const routine = await getSharedRoutinePreview(share.routineId);
      setPreviewDays(routine?.days ?? null);
      setPreviewShareId(share.shareId);
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo cargar la rutina.');
    }
  }

  async function handleAcceptShare(share: PendingRoutineShare) {
    setShareActionError(null);
    try {
      await acceptRoutineShare(share.shareId);
      setPreviewShareId(null);
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo agregar la rutina.');
    }
  }

  async function handleRejectShare(shareId: string) {
    setShareActionError(null);
    try {
      await rejectRoutineShare(shareId);
      setPreviewShareId(null);
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo rechazar.');
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

      {!showTrainerSearch ? (
        <button type="button" onClick={() => setShowTrainerSearch(true)} className="btn-brutal self-start">
          + Buscar entrenadores cerca
        </button>
      ) : (
        <div className="card-brutal flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-brutal text-acid">Buscador de entrenadores</p>
            <button
              type="button"
              onClick={() => setShowTrainerSearch(false)}
              className="font-mono text-xs text-paper-dim hover:text-paper"
            >
              Cerrar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-brutal">Radio</span>
            {[5, 10, 20, 50].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setTrainerRadiusKm(km)}
                className={
                  trainerRadiusKm === km ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
                }
              >
                {km} km
              </button>
            ))}
          </div>
          {trainerCenter && (
            <MapPicker
              center={trainerCenter}
              markers={nearbyTrainers.map((t) => ({
                id: t.user_id,
                lat: t.lat!,
                lng: t.lng!,
                label: t.displayName ?? 'Entrenador',
              }))}
              onMarkerClick={setSelectedTrainerId}
              onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
              height={280}
            />
          )}
          {nearbyTrainers.length === 0 ? (
            <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
          ) : (
            nearbyTrainers.map((t) => (
              <div
                key={t.user_id}
                className={
                  selectedTrainerId === t.user_id
                    ? 'card-brutal flex flex-col gap-2 border-acid'
                    : 'card-brutal flex flex-col gap-2'
                }
              >
                <div className="flex items-center gap-3">
                  <Avatar avatarUrl={t.avatarUrl} displayName={t.displayName} isTrainer />
                  <div>
                    <p className="font-display text-lg text-paper">{t.displayName ?? 'Sin nombre'}</p>
                    <p className="font-mono text-xs text-paper-dim">{t.distanceKm.toFixed(1)} km</p>
                  </div>
                </div>
                {t.disciplines.length > 0 && (
                  <p className="font-mono text-xs text-paper-dim">{t.disciplines.join(', ')}</p>
                )}
                {t.bio && <p className="font-mono text-sm text-paper">{t.bio}</p>}
                {t.rate_amount !== null && (
                  <p className="font-mono text-xs text-paper-dim">
                    {t.rate_amount}
                    {t.rate_currency ? ` ${t.rate_currency}` : ''} / {t.rate_period}
                  </p>
                )}
                {sentTrainerRequests.has(t.user_id) ? (
                  <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnectTrainer(t.user_id)}
                    className="btn-brutal-sm self-start"
                  >
                    Conectar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Rutinas compartidas pendientes</p>
        {shareActionError && <p className="font-mono text-xs text-blood">{shareActionError}</p>}
        {pendingShares.length === 0 ? (
          <p className="font-mono text-sm text-paper-dim">No tenés propuestas de rutina pendientes.</p>
        ) : (
          pendingShares.map((share) => (
            <div key={share.shareId} className="card-brutal flex flex-col gap-3">
              <p className="font-mono text-sm text-paper">
                <span className="text-acid">{share.fromDisplayName ?? 'Alguien'}</span> te propuso "
                {share.routineName}"
              </p>
              {previewShareId === share.shareId && previewDays && (
                <RoutinePreview days={previewDays} activities={activities} />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => handlePreviewShare(share)} className="btn-brutal-sm">
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptShare(share)}
                  className="btn-brutal-sm border-acid bg-acid text-on-accent"
                >
                  Agregar a mis rutinas
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectShare(share.shareId)}
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
