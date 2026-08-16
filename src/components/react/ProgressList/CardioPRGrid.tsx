import { DISCIPLINES, type ActivityOption } from '../ActivityPicker/ActivityPicker';
import { fullActivityName, kmToMeters } from '../../../lib/activities';
import { formatPace, groupCardioPRsByDiscipline, type CardioPR } from '../../../lib/prs';

interface Props {
  prs: CardioPR[];
  activities: ActivityOption[];
  onSelectActivity: (id: string) => void;
}

export default function CardioPRGrid({ prs, activities, onSelectActivity }: Props) {
  const nameById = new Map(activities.map((a) => [a.id, fullActivityName(a)]));
  const labelByDiscipline = new Map(DISCIPLINES.map((d) => [d.id as string, d.label]));
  const groups = groupCardioPRsByDiscipline(prs, activities);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">Récords de cardio</p>
      {groups.map((group) => (
        <div key={group.discipline} className="flex flex-col gap-3">
          <p className="label-brutal">{labelByDiscipline.get(group.discipline) ?? group.discipline}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <button
                key={pr.activityId}
                type="button"
                onClick={() => onSelectActivity(pr.activityId)}
                className="card-brutal flex flex-col gap-1 text-left transition-colors hover:border-acid"
              >
                <span className="font-display text-xl text-paper">
                  {nameById.get(pr.activityId) ?? pr.activityId}
                </span>
                <span className="font-mono text-sm text-acid">{formatPace(pr.paceMinPerKm)}</span>
                <span className="font-mono text-xs text-paper-dim">
                  {kmToMeters(pr.distanceKm)} m · {pr.durationMin} min
                </span>
                <span className="font-mono text-xs text-paper-dim">{pr.date}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
