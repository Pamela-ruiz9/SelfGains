export interface Muscle {
  id: string;
  label: string;
}

export const MUSCLES: Muscle[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'dorsales', label: 'Dorsales' },
  { id: 'trapecio', label: 'Trapecio' },
  { id: 'deltoide-frontal', label: 'Deltoide frontal' },
  { id: 'deltoide-lateral', label: 'Deltoide lateral' },
  { id: 'deltoide-posterior', label: 'Deltoide posterior' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebrazo', label: 'Antebrazo' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'oblicuos', label: 'Oblicuos' },
  { id: 'lumbares', label: 'Lumbares' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'aductores', label: 'Aductores' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'gemelos', label: 'Gemelos' },
];

export function muscleLabel(id: string): string {
  return MUSCLES.find((m) => m.id === id)?.label ?? id;
}
