import { useEffect, useState } from 'react';

export interface ActivityOption {
  id: string;
  name: string;
  discipline: 'gym' | 'running' | 'natacion' | 'combate';
  metricType: 'sets' | 'session';
}

export const DISCIPLINES: { id: ActivityOption['discipline']; label: string }[] = [
  { id: 'gym', label: 'Gym' },
  { id: 'running', label: 'Running' },
  { id: 'natacion', label: 'Natación' },
  { id: 'combate', label: 'Combate' },
];

interface Props {
  activities: ActivityOption[];
  /**
   * Fires on mount, on tab switch (auto-selects the first activity of the
   * new discipline), and on dropdown change. This is a "current selection"
   * report, not a commit/add signal — consumers that need an explicit add
   * action must gate it behind their own trigger (e.g. a separate button).
   */
  onSelect: (activity: ActivityOption | null) => void;
}

export default function ActivityPicker({ activities, onSelect }: Props) {
  const [discipline, setDiscipline] = useState<ActivityOption['discipline']>('gym');
  const filtered = activities.filter((a) => a.discipline === discipline);
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? '');

  useEffect(() => {
    onSelect(filtered.find((a) => a.id === selectedId) ?? null);
  }, [selectedId]);

  function handleDisciplineChange(next: ActivityOption['discipline']) {
    setDiscipline(next);
    const nextFiltered = activities.filter((a) => a.discipline === next);
    setSelectedId(nextFiltered[0]?.id ?? '');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {DISCIPLINES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleDisciplineChange(d.id)}
            className={
              d.id === discipline
                ? 'btn-brutal-sm border-acid bg-acid text-ink'
                : 'btn-brutal-sm opacity-60'
            }
          >
            {d.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Actividad</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="input-brutal"
        >
          {filtered.length === 0 ? (
            <option value="">Sin actividades en esta disciplina</option>
          ) : (
            filtered.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}
