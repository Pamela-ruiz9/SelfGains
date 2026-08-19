import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  // Shown next to the title even while collapsed — for a quick-glance
  // indicator (e.g. "3 de 5 completados") without opening the section.
  badge?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleSection({ title, open, onToggle, badge, children }: CollapsibleSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3">
          <p className="label-brutal text-acid">{title}</p>
          {badge}
        </span>
        <span className="font-mono text-lg leading-none text-paper-dim">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="flex flex-col gap-6">{children}</div>}
    </div>
  );
}
