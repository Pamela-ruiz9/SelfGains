import type { ReactNode } from 'react';

interface GlowTileProps {
  icon: ReactNode;
  color: string;
  label: string;
  value: ReactNode;
  // Línea chica opcional debajo del valor — usada por ProgressSectionGrid
  // para el texto de contexto ("vs. hace 4 semanas", "último registrado").
  sub?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export default function GlowTile({ icon, color, label, value, sub, selected, onClick }: GlowTileProps) {
  const className = `card-brutal card-brutal-tap relative flex flex-col justify-between gap-2 overflow-hidden text-left transition-colors ${
    onClick ? 'hover:border-acid' : ''
  } ${selected ? 'border-acid' : ''}`;

  const content = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at 85% 10%, ${color}, transparent 65%)` }}
      />
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="label-brutal">{label}</span>
        <span className="h-5 w-5 shrink-0" style={{ color }}>
          {icon}
        </span>
      </div>
      <div className="relative z-10 flex flex-col gap-0.5">
        <span className="font-display text-xl text-paper">{value}</span>
        {sub !== undefined && <span className="font-mono text-xs text-paper-dim">{sub}</span>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
