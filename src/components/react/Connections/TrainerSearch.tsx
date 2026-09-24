import { useMemo } from 'react';
import type { VisibleTrainer } from '../../../lib/trainerProfiles';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  open: boolean;
  onToggle: (open: boolean) => void;
  center: [number, number] | null;
  onMapMove: (lat: number, lng: number) => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  trainers: VisibleTrainer[];
  selectedTrainerId: string | null;
  onMarkerClick: (id: string) => void;
  sentRequests: Set<string>;
  onConnect: (userId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  t: Dictionary['conexiones']['trainerSearch'];
  avatarT: Dictionary['sync']['avatar'];
}

export default function TrainerSearch({
  open,
  onToggle,
  center,
  onMapMove,
  radiusKm,
  onRadiusChange,
  trainers,
  selectedTrainerId,
  onMarkerClick,
  sentRequests,
  onConnect,
  onAcceptRequest,
  t,
  avatarT,
}: Props) {
  const trainerMarkers = useMemo(
    () =>
      trainers.map((tr) => ({
        id: tr.user_id,
        lat: tr.lat!,
        lng: tr.lng!,
        label: tr.displayName ?? t.defaultTrainerLabel,
      })),
    [trainers, t.defaultTrainerLabel]
  );

  if (!open) {
    return (
      <button type="button" onClick={() => onToggle(true)} className="btn-brutal self-start">
        {t.toggleOpen}
      </button>
    );
  }

  return (
    <div className="card-brutal flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-brutal text-acid">{t.title}</p>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
        >
          {t.close}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="label-brutal">{t.radiusLabel}</span>
        {[5, 10, 20, 50].map((km) => (
          <button
            key={km}
            type="button"
            onClick={() => onRadiusChange(km)}
            className={radiusKm === km ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {km} {t.kmUnit}
          </button>
        ))}
      </div>
      {center && (
        <MapPicker
          center={center}
          markers={trainerMarkers}
          onMarkerClick={onMarkerClick}
          onMapMove={onMapMove}
          height={280}
        />
      )}
      {trainers.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{t.empty}</p>
      ) : (
        trainers.map((tr) => {
          const effectiveStatus = sentRequests.has(tr.user_id) ? 'request-sent' : tr.status;
          return (
            <div
              key={tr.user_id}
              className={
                selectedTrainerId === tr.user_id
                  ? 'card-brutal flex flex-col gap-2 border-acid'
                  : 'card-brutal flex flex-col gap-2'
              }
            >
              <div className="flex items-center gap-3">
                <Avatar avatarUrl={tr.avatarUrl} displayName={tr.displayName} isTrainer t={avatarT} />
                <div>
                  <p className="font-display text-lg text-paper">{tr.displayName ?? t.unnamedUser}</p>
                  <p className="font-mono text-xs text-paper-dim">{tr.distanceKm.toFixed(1)} {t.kmUnit}</p>
                </div>
              </div>
              {tr.disciplines.length > 0 && (
                <p className="font-mono text-xs text-paper-dim">{tr.disciplines.join(', ')}</p>
              )}
              {tr.bio && <p className="font-mono text-sm text-paper">{tr.bio}</p>}
              {tr.rate_amount !== null && (
                <p className="font-mono text-xs text-paper-dim">
                  {tr.rate_amount}
                  {tr.rate_currency ? ` ${tr.rate_currency}` : ''} /{' '}
                  {tr.rate_period ? t.period[tr.rate_period] : ''}
                </p>
              )}
              {effectiveStatus === 'connected' && (
                <p className="font-mono text-xs text-paper-dim">{t.alreadyConnected}</p>
              )}
              {effectiveStatus === 'request-sent' && (
                <p className="font-mono text-xs text-paper-dim">{t.requestSent}</p>
              )}
              {effectiveStatus === 'request-received' && tr.requestId && (
                <button type="button" onClick={() => onAcceptRequest(tr.requestId!)} className="btn-brutal-sm">
                  {t.accept}
                </button>
              )}
              {effectiveStatus === 'none' && (
                <button
                  type="button"
                  onClick={() => onConnect(tr.user_id)}
                  className="btn-brutal-sm self-start"
                >
                  {t.connect}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
