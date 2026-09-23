import { useMemo } from 'react';
import type { VisibleTrainer } from '../../../lib/trainerProfiles';
import Avatar from '../Shared/Avatar';
import MapPicker from '../Shared/MapPicker';

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
}: Props) {
  const trainerMarkers = useMemo(
    () =>
      trainers.map((t) => ({
        id: t.user_id,
        lat: t.lat!,
        lng: t.lng!,
        label: t.displayName ?? 'Entrenador',
      })),
    [trainers]
  );

  if (!open) {
    return (
      <button type="button" onClick={() => onToggle(true)} className="btn-brutal self-start">
        + Buscar entrenadores cerca
      </button>
    );
  }

  return (
    <div className="card-brutal flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-brutal text-acid">Buscador de entrenadores</p>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="rounded-control border border-paper-dim/60 bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-paper-dim transition duration-150 hover:border-paper hover:text-paper active:scale-95"
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
            onClick={() => onRadiusChange(km)}
            className={radiusKm === km ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {km} km
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
        <p className="font-mono text-sm text-paper-dim">No hay entrenadores visibles en este radio.</p>
      ) : (
        trainers.map((t) => {
          const effectiveStatus = sentRequests.has(t.user_id) ? 'request-sent' : t.status;
          return (
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
              {effectiveStatus === 'connected' && (
                <p className="font-mono text-xs text-paper-dim">Ya conectado</p>
              )}
              {effectiveStatus === 'request-sent' && (
                <p className="font-mono text-xs text-paper-dim">Solicitud enviada</p>
              )}
              {effectiveStatus === 'request-received' && t.requestId && (
                <button type="button" onClick={() => onAcceptRequest(t.requestId!)} className="btn-brutal-sm">
                  Aceptar
                </button>
              )}
              {effectiveStatus === 'none' && (
                <button
                  type="button"
                  onClick={() => onConnect(t.user_id)}
                  className="btn-brutal-sm self-start"
                >
                  Conectar
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
