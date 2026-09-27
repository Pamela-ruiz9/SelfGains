import { Fragment, type ReactNode } from 'react';
import { type ActivityOption } from '../ActivityPicker/ActivityPicker';
import { fullActivityName, kmToMeters } from '../../../lib/activities';
import { formatPace, groupCardioPRsByDiscipline, type CardioPR } from '../../../lib/prs';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { TrophyIcon } from '../../../lib/progressIcons';

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
                <GlowTile
                  icon={<TrophyIcon className="h-5 w-5" />}
                  color="var(--color-acid)"
                  onClick={() => onSelectActivity(pr.activityId)}
                  selected={pr.activityId === selectedActivityId}
                  label={nameById.get(pr.activityId) ?? pr.activityId}
                  value={formatPace(pr.paceMinPerKm)}
                  sub={
                    <>
                      {kmToMeters(pr.distanceKm)} m · {pr.durationMin} min
                      <br />
                      {pr.date}
                    </>
                  }
                />
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
