import { es } from '../../../i18n/es';
import type { Dictionary } from '../../../i18n/es';

interface AvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  isTrainer?: boolean;
  size?: number;
  // Optional with a Spanish default as a safety net for any caller that
  // doesn't pass one; every current call site (ProfileForm, UserSearch,
  // IncomingRequests, MyConnectionsList, TrainerSearch) passes a real
  // value explicitly.
  t?: Dictionary['sync']['avatar'];
}

export default function Avatar({
  avatarUrl,
  displayName,
  isTrainer = false,
  size = 56,
  t = es.sync.avatar,
}: AvatarProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-paper-dim/40 bg-surface">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName ?? t.defaultAlt} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-xl text-paper-dim">
            {(displayName ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {isTrainer && (
        <span
          aria-label={t.trainerLabel}
          title={t.trainerLabel}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-ink fill-acid-on font-display text-sm"
        >
          ★
        </span>
      )}
    </div>
  );
}
