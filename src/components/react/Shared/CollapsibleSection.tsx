import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <p className="label-brutal text-acid">{title}</p>
        <span className="font-mono text-lg leading-none text-paper-dim">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="flex flex-col gap-6">{children}</div>}
    </div>
  );
}
