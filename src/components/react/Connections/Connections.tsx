import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile } from '../../../lib/profile';
import {
  createOrRegenerateInviteCode,
  getMyConnections,
  getMyInviteCode,
  inviteLink,
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
import { getMyRoutines } from '../../../lib/routines';
import type { Routine } from '../../../types/db';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import InviteLinkCard from './InviteLinkCard';
import RedeemCodeForm from './RedeemCodeForm';
import UserSearch from './UserSearch';
import IncomingRequests from './IncomingRequests';
import TrainerSearch from './TrainerSearch';
import PendingRoutineShares from './PendingRoutineShares';
import MyConnectionsList from './MyConnectionsList';

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
  const [actingShareId, setActingShareId] = useState<string | null>(null);

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

  async function handleAcceptTrainerRequest(requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      await refresh();
      setNearbyTrainers((prev) =>
        prev.map((t) => (t.requestId === requestId ? { ...t, status: 'connected', requestId: null } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud.');
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
    setActingShareId(share.shareId);
    try {
      await acceptRoutineShare(share.shareId);
      setPreviewShareId((id) => (id === share.shareId ? null : id));
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo agregar la rutina.');
    } finally {
      setActingShareId(null);
    }
  }

  async function handleRejectShare(shareId: string) {
    setShareActionError(null);
    setActingShareId(shareId);
    try {
      await rejectRoutineShare(shareId);
      setPreviewShareId((id) => (id === shareId ? null : id));
      await refresh();
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : 'No se pudo rechazar.');
    } finally {
      setActingShareId(null);
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
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <InviteLinkCard code={code} copied={copied} onShare={handleShare} onCopy={handleCopy} />

      <RedeemCodeForm value={redeemInput} onChange={setRedeemInput} onSubmit={handleRedeem} />

      <UserSearch
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSubmit={handleSearch}
        results={searchResults}
        searching={searching}
        hasSearched={hasSearched}
        onSendRequest={handleSendRequest}
        onAcceptFromSearch={handleAcceptFromSearch}
      />

      <IncomingRequests
        requests={incomingRequests}
        onAccept={handleAcceptIncoming}
        onReject={handleRejectIncoming}
      />

      <TrainerSearch
        open={showTrainerSearch}
        onToggle={setShowTrainerSearch}
        center={trainerCenter}
        onMapMove={(lat, lng) => setTrainerCenter([lat, lng])}
        radiusKm={trainerRadiusKm}
        onRadiusChange={setTrainerRadiusKm}
        trainers={nearbyTrainers}
        selectedTrainerId={selectedTrainerId}
        onMarkerClick={setSelectedTrainerId}
        sentRequests={sentTrainerRequests}
        onConnect={handleConnectTrainer}
        onAcceptRequest={handleAcceptTrainerRequest}
      />

      <PendingRoutineShares
        shares={pendingShares}
        previewShareId={previewShareId}
        previewDays={previewDays}
        actingShareId={actingShareId}
        error={shareActionError}
        activities={activities}
        onPreview={handlePreviewShare}
        onAccept={handleAcceptShare}
        onReject={handleRejectShare}
      />

      <MyConnectionsList
        connections={connections}
        isTrainer={isTrainer}
        myRoutines={myRoutines}
        onRemove={handleRemove}
        onRoutineAssigned={refresh}
      />
    </div>
  );
}
