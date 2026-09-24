import { useState } from 'react';
import MuscleBody from '../MuscleBody/MuscleBody';
import { muscleLabel } from '../../../lib/muscles';
import type { Dictionary } from '../../../i18n/es';

export interface ExerciseWithMuscles {
  id: string;
  name: string;
  equipment: string;
  instructions: string;
  muscles: string[];
  image?: string;
}

interface Props {
  exercises: ExerciseWithMuscles[];
  t: Dictionary['ejercicios'];
  muscleLabels: Dictionary['muscles'];
}

export default function MuscleExplorer({ exercises, t, muscleLabels }: Props) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  function handleSelectMuscle(id: string) {
    setSelectedMuscle((prev) => (prev === id ? null : id));
    setExpandedExercise(null);
  }

  const matchingExercises = selectedMuscle
    ? exercises.filter((ex) => ex.muscles.includes(selectedMuscle))
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <MuscleBody
        selectedMuscle={selectedMuscle}
        onSelectMuscle={handleSelectMuscle}
        t={{ loading: t.loading, webglUnsupported: t.webglUnsupported, muscleLabels }}
      />

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">
          {selectedMuscle ? muscleLabel(selectedMuscle, muscleLabels) : t.noMuscleSelected}
        </p>

        {!selectedMuscle && (
          <p className="font-mono text-sm text-paper-dim">{t.instructions}</p>
        )}

        {selectedMuscle && matchingExercises.length === 0 && (
          <p className="font-mono text-sm text-paper-dim">{t.emptyState}</p>
        )}

        <ul className="flex flex-col gap-2">
          {matchingExercises.map((ex) => {
            const isExpanded = expandedExercise === ex.id;
            return (
              <li key={ex.id} className="card-brutal">
                <button
                  type="button"
                  onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="font-display text-lg tracking-wide text-paper">{ex.name}</span>
                  <span className="font-mono text-xs text-acid">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-paper-dim/20 pt-3 font-mono text-sm text-paper-dim">
                    {ex.image && (
                      <img
                        src={`${import.meta.env.BASE_URL}exercises/${ex.image}`}
                        alt={ex.name}
                        loading="lazy"
                        className="aspect-video w-full rounded-card object-cover"
                      />
                    )}
                    <p>
                      <span className="text-paper-dim/70">{t.equipment}</span>
                      {ex.equipment}
                    </p>
                    <p>{ex.instructions}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
