import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import { DISCIPLINE_COLORS } from '../../../lib/activities';
import type { DisciplineSummary as DisciplineSummaryEntry } from '../../../lib/prs';

interface Props {
  summaries: DisciplineSummaryEntry[];
  selected: string | null;
  onSelect: (discipline: string | null) => void;
}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

export default function DisciplineSummary({ summaries, selected, onSelect }: Props) {
  if (summaries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Disciplinas que practicás</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => (
          <button
            key={s.discipline}
            type="button"
            onClick={() => onSelect(selected === s.discipline ? null : s.discipline)}
            style={{ borderTopColor: DISCIPLINE_COLORS[s.discipline] ?? undefined }}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 border-t-4 text-left transition-colors hover:border-acid ${
              selected === s.discipline ? 'border-acid' : ''
            }`}
          >
            <span className="font-display text-xl text-paper">
              {LABEL_BY_DISCIPLINE[s.discipline] ?? s.discipline}
            </span>
            <span className="font-mono text-sm text-acid">
              {s.sessionCount} {s.sessionCount === 1 ? 'día entrenado' : 'días entrenados'}
            </span>
            {s.setCount !== null && (
              <span className="font-mono text-xs text-paper-dim">{s.setCount} series totales</span>
            )}
            {s.totalMinutes !== null && (
              <span className="font-mono text-xs text-paper-dim">{s.totalMinutes} min totales</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
