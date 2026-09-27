import { useEffect, useRef, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  // Shown next to the title even while collapsed — for a quick-glance
  // indicator (e.g. "3 de 5 completados") without opening the section.
  badge?: ReactNode;
  children: ReactNode;
}

// Colapsada se ve y se siente como btn-brutal-sm (borde, fondo, padding,
// hover) para que quede claro que se puede tocar — abierta vuelve al
// texto plano de siempre, ya que ahí el contexto de "esto es una sección"
// es obvio por el contenido debajo.
export default function CollapsibleSection({ title, open, onToggle, badge, children }: CollapsibleSectionProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Solo dispara cuando `open` pasa a true (no en cada render, no al
  // cerrar) — así el usuario no tiene que bajar manualmente a ver lo que
  // acaba de desplegar.
  useEffect(() => {
    if (open) {
      buttonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [open]);

  return (
    <div className="flex flex-col gap-3">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={
          open
            ? 'flex w-full scroll-mt-20 items-center justify-between gap-3 text-left'
            : 'flex w-full scroll-mt-20 items-center justify-between gap-3 rounded-control border border-paper/30 bg-surface-raised px-4 py-3 text-left text-paper transition duration-150 hover:bg-acid hover:text-on-accent hover:[background-image:var(--gradient-acid)] active:scale-[0.98]'
        }
      >
        <span className="flex items-center gap-3">
          <p className={open ? 'label-brutal text-acid' : 'font-display text-base uppercase tracking-wide'}>
            {title}
          </p>
          {badge}
        </span>
        <span
          className={
            open ? 'font-mono text-lg leading-none text-paper-dim' : 'font-display text-xl leading-none'
          }
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="flex flex-col gap-6">{children}</div>}
    </div>
  );
}
