import { muscleLabel } from '../../../lib/muscles';
import { groupPRsByMuscle, type ExercisePR } from '../../../lib/prs';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  prs: ExercisePR[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
}

export default function PRGrid({ prs, exercises, onSelectExercise }: Props) {
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
  const groups = groupPRsByMuscle(prs, exercises);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">Récords personales</p>
      {groups.map((group) => (
        <div key={group.muscleId} className="flex flex-col gap-3">
          <p className="label-brutal">{muscleLabel(group.muscleId)}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <button
                key={pr.exerciseId}
                type="button"
                onClick={() => onSelectExercise(pr.exerciseId)}
                className="card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid"
              >
                <span className="font-display text-xl text-paper">
                  {exerciseNameById.get(pr.exerciseId) ?? pr.exerciseId}
                </span>
                <span className="font-mono text-sm text-acid">{pr.weight} kg</span>
                <span className="font-mono text-xs text-paper-dim">{pr.date}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
