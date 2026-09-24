import type { PendingRoutineShare } from '../../../lib/routineShares';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import RoutinePreview from '../RoutineManager/RoutinePreview';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  shares: PendingRoutineShare[];
  previewShareId: string | null;
  previewDays: RoutineDays | null;
  actingShareId: string | null;
  error: string | null;
  activities: ActivityOption[];
  onPreview: (share: PendingRoutineShare) => void;
  onAccept: (share: PendingRoutineShare) => void;
  onReject: (shareId: string) => void;
  t: Dictionary['conexiones']['pendingRoutineShares'];
  routinePreviewT: Pick<Dictionary['rutinas'], 'preview' | 'days'>;
}

export default function PendingRoutineShares({
  shares,
  previewShareId,
  previewDays,
  actingShareId,
  error,
  activities,
  onPreview,
  onAccept,
  onReject,
  t,
  routinePreviewT,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      {shares.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{t.empty}</p>
      ) : (
        shares.map((share) => (
          <div key={share.shareId} className="card-brutal flex flex-col gap-3">
            <p className="font-mono text-sm text-paper">
              <span className="text-acid">{share.fromDisplayName ?? t.fromUnknown}</span>{' '}
              {t.proposed} "
              {share.routineName}"
            </p>
            {previewShareId === share.shareId && previewDays && (
              <RoutinePreview days={previewDays} activities={activities} t={routinePreviewT} />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onPreview(share)}
                disabled={actingShareId === share.shareId}
                className="btn-brutal-sm"
              >
                {t.view}
              </button>
              <button
                type="button"
                onClick={() => onAccept(share)}
                disabled={actingShareId === share.shareId}
                className="btn-brutal-sm pill-selected"
              >
                {actingShareId === share.shareId ? t.adding : t.addToMyRoutines}
              </button>
              <button
                type="button"
                onClick={() => onReject(share.shareId)}
                disabled={actingShareId === share.shareId}
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                {t.reject}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
