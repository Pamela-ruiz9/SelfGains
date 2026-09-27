import { Fragment, useState, type ReactNode } from 'react';
import { muscleLabel } from '../../../lib/muscles';
import { groupPRsByMuscle, type ExercisePR } from '../../../lib/prs';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { TrophyIcon } from '../../../lib/progressIcons';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  prs: ExercisePR[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
  selectedExerciseId: string | null;
  chart: ReactNode;
  t: Dictionary['progreso']['prGrid'];
  muscleLabels: Dictionary['muscles'];
}

export default function PRGrid({
  prs,
  exercises,
  onSelectExercise,
  selectedExerciseId,
  chart,
  t,
  muscleLabels,
}: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
  const groups = groupPRsByMuscle(prs, exercises);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">{t.title}</p>
      {groups.map((group) => (
        <div key={group.muscleId} className="flex flex-col gap-3">
          <p className="label-brutal">{muscleLabel(group.muscleId, muscleLabels)}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <Fragment key={pr.exerciseId}>
                <GlowTile
                  icon={<TrophyIcon className="h-5 w-5" />}
                  color="var(--color-acid)"
                  onClick={() => onSelectExercise(pr.exerciseId)}
                  selected={pr.exerciseId === selectedExerciseId}
                  label={exerciseNameById.get(pr.exerciseId) ?? pr.exerciseId}
                  value={`${kgToDisplay(pr.weight, weightUnit)} ${weightUnit}`}
                  sub={pr.date}
                />
                {pr.exerciseId === selectedExerciseId && (
                  <div className="sm:col-span-2 lg:col-span-3">{chart}</div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
