import type { ReactNode } from 'react';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, LayersIcon, CalendarIcon, PulseIcon, GLOW_PALETTE } from '../../../lib/progressIcons';
import { localDateStr, localYesterdayStr } from '../../../lib/weekdays';
import type { Dictionary } from '../../../i18n/es';

export type SectionKey = 'medidas' | 'disciplina' | 'entrenamientos' | 'actividad';

export interface LeadingDisciplineInfo {
  discipline: string;
  sessionCount: number;
  isThisWeek: boolean;
}

export interface ActivityPreview {
  value: string;
  sub: string;
}

interface Props {
  active: SectionKey | null;
  onSelect: (section: SectionKey) => void;
  weightTrendKg: number | null;
  measurementsCount: number;
  leadingDiscipline: LeadingDisciplineInfo | null;
  mostRecentWorkoutDate: string | null;
  activityPreview: ActivityPreview | null;
  showActivityCard: boolean;
  panels: Record<SectionKey, ReactNode>;
  disciplinesT: Dictionary['disciplines'];
  disciplineSummaryT: Dictionary['progreso']['disciplineSummary'];
  sectionsT: Dictionary['progreso']['list']['sections'];
  activityTitle: string;
  t: Dictionary['progreso']['sectionGrid'];
}

export default function ProgressSectionGrid({
  active,
  onSelect,
  weightTrendKg,
  measurementsCount,
  leadingDiscipline,
  mostRecentWorkoutDate,
  activityPreview,
  showActivityCard,
  panels,
  disciplinesT,
  disciplineSummaryT,
  sectionsT,
  activityTitle,
  t,
}: Props) {
  const labelByDiscipline: Record<string, string> = disciplinesT;

  const measurementsValue =
    weightTrendKg !== null
      ? `${weightTrendKg >= 0 ? '▲' : '▼'} ${Math.abs(weightTrendKg)} kg`
      : String(measurementsCount);
  const measurementsSub = weightTrendKg !== null ? t.weightTrendSub : t.measurementsCountSub;

  const disciplineValue = leadingDiscipline
    ? labelByDiscipline[leadingDiscipline.discipline] ?? leadingDiscipline.discipline
    : '—';
  const disciplineSub = leadingDiscipline
    ? leadingDiscipline.isThisWeek
      ? `${leadingDiscipline.sessionCount} ${
          leadingDiscipline.sessionCount === 1
            ? disciplineSummaryT.sessionCountSingular
            : disciplineSummaryT.sessionCountPlural
        }`
      : t.disciplineAllTimeSub
    : t.noDataYet;

  const today = localDateStr();
  const yesterday = localYesterdayStr();
  const workoutsValue =
    mostRecentWorkoutDate === null
      ? '—'
      : mostRecentWorkoutDate === today
        ? t.today
        : mostRecentWorkoutDate === yesterday
          ? t.yesterday
          : mostRecentWorkoutDate;
  const workoutsSub = mostRecentWorkoutDate === null ? t.noDataYet : t.lastWorkoutSub;

  const cards: {
    key: SectionKey;
    icon: ReactNode;
    color: string;
    label: string;
    value: string;
    sub: string;
  }[] = [
    {
      key: 'medidas',
      icon: <ScaleIcon className="h-5 w-5" />,
      color: GLOW_PALETTE[0],
      label: sectionsT.measurements,
      value: measurementsValue,
      sub: measurementsSub,
    },
    {
      key: 'disciplina',
      icon: <LayersIcon className="h-5 w-5" />,
      color: GLOW_PALETTE[1],
      label: sectionsT.discipline,
      value: disciplineValue,
      sub: disciplineSub,
    },
    {
      key: 'entrenamientos',
      icon: <CalendarIcon className="h-5 w-5" />,
      color: GLOW_PALETTE[2],
      label: sectionsT.workouts,
      value: workoutsValue,
      sub: workoutsSub,
    },
  ];

  if (showActivityCard) {
    cards.push({
      key: 'actividad',
      icon: <PulseIcon className="h-5 w-5" />,
      color: GLOW_PALETTE[3],
      label: activityTitle,
      value: activityPreview?.value ?? '—',
      sub: activityPreview?.sub ?? t.viewDetails,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, index) => (
          <div
            key={card.key}
            className={cards.length % 2 === 1 && index === cards.length - 1 ? 'col-span-2' : undefined}
          >
            <GlowTile
              icon={card.icon}
              color={card.color}
              label={card.label}
              value={card.value}
              sub={card.sub}
              selected={active === card.key}
              onClick={() => onSelect(card.key)}
            />
          </div>
        ))}
      </div>
      {active !== null && <div className="flex flex-col gap-6">{panels[active]}</div>}
    </div>
  );
}
