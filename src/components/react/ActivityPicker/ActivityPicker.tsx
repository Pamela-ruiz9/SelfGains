import { useEffect, useState } from 'react';
import { groupLabel, KNOWN_GROUPS } from '../../../lib/activities';
import { es } from '../../../i18n/es';
import type { Dictionary } from '../../../i18n/es';

export interface ActivityOption {
  id: string;
  name: string;
  discipline: 'gym' | 'running' | 'natacion' | 'combate';
  metricType: 'sets' | 'session';
  group?: string;
  description?: string;
  image?: string;
}

// Los labels ya NO viven acá — vienen del namespace `disciplines` del
// diccionario (ver src/i18n/es.ts / en.ts), para que se traduzcan por
// locale. Este array solo define el orden/ids de las 4 disciplinas.
export const DISCIPLINES: { id: ActivityOption['discipline'] }[] = [
  { id: 'gym' },
  { id: 'running' },
  { id: 'natacion' },
  { id: 'combate' },
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
  // Optional: CreateRoutineForm (RoutineManager) renders this without a
  // locale yet, so it falls back to Spanish there until that call site gets
  // wired up in a future pass.
  t?: Dictionary['registrar']['picker'] & { disciplines: Dictionary['disciplines'] };
}

function groupsIn(activities: ActivityOption[]): string[] {
  const present = new Set(activities.map((a) => a.group).filter((g): g is string => !!g));
  const known = KNOWN_GROUPS.filter((g) => present.has(g));
  const unknown = [...present].filter((g) => !KNOWN_GROUPS.includes(g)).sort();
  return [...known, ...unknown];
}

export default function ActivityPicker({
  activities,
  onSelect,
  t = { ...es.registrar.picker, disciplines: es.disciplines },
}: Props) {
  const [discipline, setDiscipline] = useState<ActivityOption['discipline']>('gym');
  const byDiscipline = activities.filter((a) => a.discipline === discipline);
  const groups = groupsIn(byDiscipline);

  const [group, setGroup] = useState<string | undefined>(groups[0]);
  const filtered = groups.length > 0 ? byDiscipline.filter((a) => a.group === group) : byDiscipline;

  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? '');

  useEffect(() => {
    onSelect(filtered.find((a) => a.id === selectedId) ?? null);
  }, [selectedId]);

  function handleDisciplineChange(next: ActivityOption['discipline']) {
    setDiscipline(next);
    const nextByDiscipline = activities.filter((a) => a.discipline === next);
    const nextGroups = groupsIn(nextByDiscipline);
    const nextGroup = nextGroups[0];
    setGroup(nextGroup);
    const nextFiltered =
      nextGroups.length > 0 ? nextByDiscipline.filter((a) => a.group === nextGroup) : nextByDiscipline;
    setSelectedId(nextFiltered[0]?.id ?? '');
  }

  function handleGroupChange(nextGroup: string) {
    setGroup(nextGroup);
    const nextFiltered = byDiscipline.filter((a) => a.group === nextGroup);
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
                ? 'btn-brutal-sm pill-selected'
                : 'btn-brutal-sm opacity-60'
            }
          >
            {t.disciplines[d.id]}
          </button>
        ))}
      </div>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => handleGroupChange(g)}
              className={
                g === group
                  ? 'btn-brutal-sm pill-selected'
                  : 'btn-brutal-sm opacity-60'
              }
            >
              {groupLabel(g)}
            </button>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{t.activityLabel}</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="input-brutal"
        >
          {filtered.length === 0 ? (
            <option value="">{t.noActivities}</option>
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
