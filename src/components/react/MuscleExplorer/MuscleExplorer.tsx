import { useState } from 'react';
import MuscleBody from '../MuscleBody/MuscleBody';
import { muscleLabel } from '../../../lib/muscles';

export interface ExerciseWithMuscles {
  id: string;
  name: string;
  equipment: string;
  instructions: string;
  muscles: string[];
}

interface Props {
  exercises: ExerciseWithMuscles[];
}

export default function MuscleExplorer({ exercises }: Props) {
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
      <MuscleBody selectedMuscle={selectedMuscle} onSelectMuscle={handleSelectMuscle} />

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">
          {selectedMuscle ? muscleLabel(selectedMuscle) : 'Ningún músculo seleccionado'}
        </p>

        {!selectedMuscle && (
          <p className="font-mono text-sm text-paper-dim">
            Haz click en un músculo del modelo para ver qué ejercicios lo trabajan. Puedes
            rotar el modelo arrastrando con el mouse o el dedo.
          </p>
        )}

        {selectedMuscle && matchingExercises.length === 0 && (
          <p className="font-mono text-sm text-paper-dim">
            Todavía no hay ejercicios registrados para este músculo.
          </p>
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
                    <p>
                      <span className="text-paper-dim/70">Equipo: </span>
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
