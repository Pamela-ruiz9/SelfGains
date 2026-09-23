import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import { DISCIPLINE_COLORS } from '../../../lib/activities';
import type { DisciplineSummary as DisciplineSummaryEntry } from '../../../lib/prs';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  summaries: DisciplineSummaryEntry[];
  selected: string | null;
  onSelect: (discipline: string | null) => void;
  t: Dictionary['progreso']['disciplineSummary'];
}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

export default function DisciplineSummary({ summaries, selected, onSelect, t }: Props) {
  if (summaries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => (
          <button
            key={s.discipline}
            type="button"
            onClick={() => onSelect(selected === s.discipline ? null : s.discipline)}
            style={{ borderTopColor: DISCIPLINE_COLORS[s.discipline] ?? undefined }}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 border-t text-left transition-colors hover:border-acid ${
              selected === s.discipline ? 'border-acid' : ''
            }`}
          >
            <span className="font-display text-xl text-paper">
              {LABEL_BY_DISCIPLINE[s.discipline] ?? s.discipline}
            </span>
            <span className="font-mono text-sm text-acid">
              {s.sessionCount} {s.sessionCount === 1 ? t.sessionCountSingular : t.sessionCountPlural}
            </span>
            {s.setCount !== null && (
              <span className="font-mono text-xs text-paper-dim">
                {s.setCount} {t.totalSets}
              </span>
            )}
            {s.totalMinutes !== null && (
              <span className="font-mono text-xs text-paper-dim">
                {s.totalMinutes} {t.totalMinutes}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
