import { Fragment, type ReactNode } from 'react';
import { type ActivityOption } from '../ActivityPicker/ActivityPicker';
import { fullActivityName, kmToMeters } from '../../../lib/activities';
import { formatPace, groupCardioPRsByDiscipline, type CardioPR } from '../../../lib/prs';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  prs: CardioPR[];
  activities: ActivityOption[];
  onSelectActivity: (id: string) => void;
  selectedActivityId: string | null;
  chart: ReactNode;
  t: Dictionary['progreso']['cardioPrGrid'];
  disciplinesT: Dictionary['disciplines'];
}

export default function CardioPRGrid({
  prs,
  activities,
  onSelectActivity,
  selectedActivityId,
  chart,
  t,
  disciplinesT,
}: Props) {
  const nameById = new Map(activities.map((a) => [a.id, fullActivityName(a)]));
  const labelByDiscipline = new Map(Object.entries(disciplinesT));
  const groups = groupCardioPRsByDiscipline(prs, activities);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">{t.title}</p>
      {groups.map((group) => (
        <div key={group.discipline} className="flex flex-col gap-3">
          <p className="label-brutal">{labelByDiscipline.get(group.discipline) ?? group.discipline}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <Fragment key={pr.activityId}>
                <button
                  type="button"
                  onClick={() => onSelectActivity(pr.activityId)}
                  className="card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid"
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
                {pr.activityId === selectedActivityId && (
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
