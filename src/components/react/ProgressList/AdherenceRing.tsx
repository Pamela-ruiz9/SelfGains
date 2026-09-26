interface Props {
  daysTrained: number;
  daysElapsed: number;
  label: string;
}

export default function AdherenceRing({ daysTrained, daysElapsed, label }: Props) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fraction = daysElapsed > 0 ? daysTrained / daysElapsed : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--color-paper-dim)" strokeOpacity="0.2" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--color-acid)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="44" textAnchor="middle" fontSize="20" className="fill-paper" style={{ fontFamily: 'var(--font-display)' }}>
          {daysTrained}/{daysElapsed}
        </text>
        <text x="48" y="62" textAnchor="middle" fontSize="9" letterSpacing="0.05em" className="fill-paper-dim">
          {label}
        </text>
      </svg>
    </div>
  );
}
