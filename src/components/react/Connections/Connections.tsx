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
import type { Dictionary } from '../../../i18n/es';

interface Props {
  activities: ActivityOption[];
  t: Dictionary['conexiones'];
  routinePreviewT: Pick<Dictionary['rutinas'], 'preview' | 'days'>;
  avatarT: Dictionary['sync']['avatar'];
}

export default function Connections({ activities, t, routinePreviewT, avatarT }: Props) {
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
          setError(err instanceof Error ? err.message : t.errors.loadError);
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
      .catch((err) => setError(err instanceof Error ? err.message : t.errors.loadMapError));
  }, [trainerCenter, trainerRadiusKm]);

  async function handleShare() {
    setError(null);
    try {
      const newCode = await createOrRegenerateInviteCode();
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generateCodeError);
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.copyLinkError);
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
      setError(err instanceof Error ? err.message : t.errors.redeemError);
    }
  }

  async function handleRemove(connectionId: string) {
    if (!confirm(t.removeConfirm)) return;
    try {
      await removeConnection(connectionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.removeError);
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
      setError(err instanceof Error ? err.message : t.errors.searchError);
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
      setError(err instanceof Error ? err.message : t.errors.sendRequestError);
    }
  }

  async function handleConnectTrainer(userId: string) {
    setError(null);
    try {
      await sendConnectionRequest(userId);
      setSentTrainerRequests((prev) => new Set(prev).add(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.sendRequestError);
    }
  }

  async function handleAcceptTrainerRequest(requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      await refresh();
      setNearbyTrainers((prev) =>
        prev.map((tr) => (tr.requestId === requestId ? { ...tr, status: 'connected', requestId: null } : tr))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.acceptRequestError);
    }
  }

  async function handleAcceptFromSearch(userId: string, requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      setSearchResults((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'connected' } : r)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.acceptRequestError);
    }
  }

  async function handleAcceptIncoming(requestId: string) {
    setError(null);
    try {
      await acceptConnectionRequest(requestId);
      await refresh();
      if (hasSearched) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.acceptRequestError);
    }
  }

  async function handleRejectIncoming(requestId: string) {
    setError(null);
    try {
      await rejectConnectionRequest(requestId);
      await refresh();
      if (hasSearched) setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.rejectRequestError);
    }
  }

  async function handlePreviewShare(share: PendingRoutineShare) {
    setShareActionError(null);
    try {
      const routine = await getSharedRoutinePreview(share.routineId);
      setPreviewDays(routine?.days ?? null);
      setPreviewShareId(share.shareId);
    } catch (err) {
      setShareActionError(err instanceof Error ? err.message : t.errors.loadRoutinePreviewError);
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
      setShareActionError(err instanceof Error ? err.message : t.errors.addRoutineError);
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
      setShareActionError(err instanceof Error ? err.message : t.errors.rejectShareError);
    } finally {
      setActingShareId(null);
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">{t.loading}</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.notLoggedIn.prefix}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.notLoggedIn.link}
        </a>{' '}
        {t.notLoggedIn.suffix}
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <InviteLinkCard code={code} copied={copied} onShare={handleShare} onCopy={handleCopy} t={t.inviteLinkCard} />

      <RedeemCodeForm value={redeemInput} onChange={setRedeemInput} onSubmit={handleRedeem} t={t.redeemCodeForm} />

      <UserSearch
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSubmit={handleSearch}
        results={searchResults}
        searching={searching}
        hasSearched={hasSearched}
        onSendRequest={handleSendRequest}
        onAcceptFromSearch={handleAcceptFromSearch}
        t={t.userSearch}
        avatarT={avatarT}
      />

      <IncomingRequests
        requests={incomingRequests}
        onAccept={handleAcceptIncoming}
        onReject={handleRejectIncoming}
        t={t.incomingRequests}
        avatarT={avatarT}
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
        t={t.trainerSearch}
        avatarT={avatarT}
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
        t={t.pendingRoutineShares}
        routinePreviewT={routinePreviewT}
      />

      <MyConnectionsList
        connections={connections}
        isTrainer={isTrainer}
        myRoutines={myRoutines}
        onRemove={handleRemove}
        onRoutineAssigned={refresh}
        t={t.myConnectionsList}
        avatarT={avatarT}
      />
    </div>
  );
}
