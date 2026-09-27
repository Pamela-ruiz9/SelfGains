import type { ComponentType } from 'react';
import { DISCIPLINE_COLORS } from '../../../lib/activities';
import type { DisciplineSummary as DisciplineSummaryEntry } from '../../../lib/prs';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { DumbbellIcon, RunIcon, WaveIcon, GloveIcon, LayersIcon } from '../../../lib/progressIcons';

interface Props {
  summaries: DisciplineSummaryEntry[];
  selected: string | null;
  onSelect: (discipline: string | null) => void;
  t: Dictionary['progreso']['disciplineSummary'];
  disciplinesT: Dictionary['disciplines'];
}

type KnownDiscipline = 'gym' | 'running' | 'natacion' | 'combate';

const DISCIPLINE_ICON: Record<KnownDiscipline, ComponentType<{ className?: string }>> = {
  gym: DumbbellIcon,
  running: RunIcon,
  natacion: WaveIcon,
  combate: GloveIcon,
};

export default function DisciplineSummary({ summaries, selected, onSelect, t, disciplinesT }: Props) {
  const LABEL_BY_DISCIPLINE: Record<string, string> = disciplinesT;
  if (summaries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => {
          const Icon = DISCIPLINE_ICON[s.discipline as KnownDiscipline] ?? LayersIcon;
          return (
            <GlowTile
              key={s.discipline}
              icon={<Icon className="h-5 w-5" />}
              color={DISCIPLINE_COLORS[s.discipline] ?? 'var(--color-paper-dim)'}
              label={LABEL_BY_DISCIPLINE[s.discipline] ?? s.discipline}
              selected={selected === s.discipline}
              onClick={() => onSelect(selected === s.discipline ? null : s.discipline)}
              value={
                <>
                  {s.sessionCount} {s.sessionCount === 1 ? t.sessionCountSingular : t.sessionCountPlural}
                </>
              }
              sub={
                s.setCount !== null
                  ? `${s.setCount} ${t.totalSets}`
                  : s.totalMinutes !== null
                    ? `${s.totalMinutes} ${t.totalMinutes}`
                    : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
