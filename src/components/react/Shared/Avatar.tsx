interface AvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  isTrainer?: boolean;
  size?: number;
}

export default function Avatar({ avatarUrl, displayName, isTrainer = false, size = 56 }: AvatarProps) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-paper-dim/40 bg-surface">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName ?? 'Avatar'} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-xl text-paper-dim">
            {(displayName ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {isTrainer && (
        <span
          aria-label="Entrenador"
          title="Entrenador"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-acid font-display text-sm text-on-accent"
        >
          ★
        </span>
      )}
    </div>
  );
}
