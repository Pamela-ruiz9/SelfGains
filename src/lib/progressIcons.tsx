interface IconProps {
  className?: string;
}

// Atributos SVG compartidos por todos los íconos de este archivo — mismo
// lenguaje visual que Nav.astro (trazo lineal, currentColor, sin relleno).
function svgProps(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
}

// 5 colores fijos para el tinte del glow de cada GlowTile — deliberadamente
// NO usan --color-acid (el acento personalizable del usuario): si todas las
// tarjetas usaran el mismo acento, perderían la variedad visual que el
// mockup aprobado mostraba (cyan/púrpura/verde/naranja/rosa). Mismo criterio
// que DISCIPLINE_COLORS en activities.ts (colores categóricos fijos).
export const GLOW_PALETTE = ['#3fd7ff', '#8f3fff', '#3fff8f', '#ff9f3f', '#ff3fb8'] as const;

export function ScaleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="4" y="9" width="16" height="10" rx="2" />
      <path d="M9 9a3 3 0 1 1 6 0" />
    </svg>
  );
}

export function TapeMeasureIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <path d="M7 10v2M11 10v2M15 10v2M19 10v2" />
    </svg>
  );
}

export function DropletIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3s6 7.5 6 12a6 6 0 1 1-12 0c0-4.5 6-12 6-12Z" />
    </svg>
  );
}

export function MuscleIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M5 15c0-4.5 2.2-8 5.5-8 2 0 3.3 1.4 3.3 3 0 1.1-.6 2-1.6 2.6 2.3.4 4.3 2 4.3 4.9 0 3.3-2.8 5.5-6.7 5.5-2.2 0-3.9-1-4.5-2.6" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3M9 20h6M10 17h4v3h-4z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}

// Mismo trazo que el ícono "ejercicios" de Nav.astro — reusado tal cual para
// que "Gym" se vea igual en toda la app.
export function DumbbellIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M8 12h8" />
    </svg>
  );
}

export function RunIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 17c0-2 1-3.5 3-3.5l4-3.5 3 1 4 1.5c2 .7 3 1.8 3 3.5H3Z" />
      <path d="M3 17h18" />
    </svg>
  );
}

export function WaveIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  );
}

export function GloveIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 13V9a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1h2Z" />
    </svg>
  );
}

export function FootstepsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <ellipse cx="8" cy="8" rx="2.3" ry="3.3" transform="rotate(-15 8 8)" />
      <ellipse cx="16" cy="16" rx="2.3" ry="3.3" transform="rotate(15 16 16)" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 20s-7-4.3-9-8.3C1.2 8 2.8 5 5.8 5c2 0 3.4 1.4 4.2 2.8C10.8 6.4 12.2 5 14.2 5c3 0 4.6 3 2.8 6.7C19 15.7 12 20 12 20Z" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 22c-4 0-6.5-2.7-6.5-6.2C5.5 12 8 9 9.5 6c.3 2 1.2 3.5 2.5 3.5 1.5 0 1-2 .5-3.5 3 1.5 6 5 6 9.8 0 3.7-2.5 6.2-6.5 6.2Z" />
    </svg>
  );
}

export function TimerIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M10 2h4M12 2v3" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function PulseIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 12h4l1.5-4 3 8 2-6 1.5 2H21" />
    </svg>
  );
}
