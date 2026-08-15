import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import type { DisciplineSummary as DisciplineSummaryEntry } from '../../../lib/prs';

interface Props {
  summaries: DisciplineSummaryEntry[];
}

const LABEL_BY_DISCIPLINE: Record<string, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
);

export default function DisciplineSummary({ summaries }: Props) {
  if (summaries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">Disciplinas que practicás</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => (
          <div key={s.discipline} className="card-brutal flex flex-col gap-1">
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
          </div>
        ))}
      </div>
    </div>
  );
}
