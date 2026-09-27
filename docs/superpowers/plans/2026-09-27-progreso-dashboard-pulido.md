# Pulido visual de Progreso y Rutinas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar el color de las tarjetas de rutina, arreglar el ícono de info del gráfico de progreso para que funcione con tap (no solo hover), y rediseñar la pantalla de Progreso con un lenguaje visual "ícono + glow" consistente, incluyendo un nuevo grid-selector de 4 tarjetas que reemplaza las secciones colapsables actuales.

**Architecture:** Un nuevo archivo de íconos SVG compartidos (`src/lib/progressIcons.tsx`) y un nuevo componente `GlowTile` (`src/components/react/Shared/GlowTile.tsx`) se aplican a los tiles existentes de `ProgressSummaryStrip`, `MeasurementsSummary`, `DisciplineSummary`, `PRGrid`, `CardioPRGrid` y `FitbitActivitySummary` sin tocar su lógica de datos. Un nuevo componente `ProgressSectionGrid` reemplaza las 4 `CollapsibleSection` de `ProgressList` por un grid 2×2 de `GlowTile`s que actúan como selector (tipo tabs) con un panel único debajo; los datos de vista previa de cada tarjeta (tendencia de peso, disciplina líder, último entrenamiento, actividad de hoy) se calculan con dos helpers nuevos en `src/lib/prs.ts`.

**Tech Stack:** Astro 5 + React (islands), Tailwind, TypeScript. Sin librerías nuevas — íconos SVG a mano, mismo patrón que `Nav.astro`.

---

## Spec de referencia

`docs/superpowers/specs/2026-09-27-progreso-dashboard-pulido-design.md`

## File Structure

- **Nuevo** `src/lib/progressIcons.tsx` — vocabulario de íconos SVG (componentes React) + `GLOW_PALETTE` (5 colores fijos para el tinte del glow, no ligados al acento del usuario).
- **Nuevo** `src/components/react/Shared/GlowTile.tsx` — tile compartido ícono+glow+label+valor(+sub opcional).
- **Nuevo** `src/components/react/ProgressList/ProgressSectionGrid.tsx` — grid-selector de 4 tarjetas + panel único.
- **Modificado** `src/lib/prs.ts` — 2 helpers nuevos (`weightTrend`, `topDiscipline`).
- **Nuevo** `tests/prs.test.mjs` — unit tests de esos 2 helpers.
- **Modificado**: `RoutinePreview.tsx`, `ProgressChart.tsx`, `ProgressSummaryStrip.tsx`, `MeasurementsSummary.tsx`, `DisciplineSummary.tsx`, `PRGrid.tsx`, `CardioPRGrid.tsx`, `FitbitActivitySummary.tsx`, `CollapsibleSection.tsx`, `ProgressList.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`.
- **Sin cambios**: `WorkoutHistory.tsx`, `MeasurementsChart.tsx`, `CardioProgressChart.tsx`, `AdherenceRing.tsx`.

---

### Task 1: Restaurar color en `RoutinePreview`

**Files:**
- Modify: `src/components/react/RoutineManager/RoutinePreview.tsx`

- [ ] **Step 1: Aplicar el color de acento al borde, al label del día y a los bullets**

El `<ul>` actual no tiene ningún bullet visible (el reset de Tailwind pone `list-style: none` en `ul` por defecto) — hay que reactivar `list-disc` explícitamente para que el punto exista, y luego colorearlo con la utilidad `marker:`.

Reemplazar el bloque de retorno completo (líneas 29-46) por:

```tsx
  return (
    <div className="flex flex-col gap-2 border-l border-acid pl-3">
      {scheduledDays.map((day) => (
        <div key={day}>
          <p className="label-brutal text-acid">{t.days[day]}</p>
          <ul className="list-disc space-y-0.5 pl-5 font-mono text-xs text-paper-dim marker:text-acid">
            {days[day].map((entry, i) => {
              const id = entryActivityId(entry);
              const activity = activities.find((a) => a.id === id);
              const label = activity ? fullActivityName(activity) : id;
              const summary = activity ? targetSummary(activity.metricType, entryTarget(entry)) : null;
              return <li key={i}>{summary ? `${label} (${summary})` : label}</li>;
            })}
          </ul>
        </div>
      ))}
    </div>
  );
```

- [ ] **Step 2: Verificar visualmente**

Run: `npm run build`
Expected: build limpio, sin errores de tipos.

Este componente se usa en `RoutineList.tsx` y en `PendingRoutineShares.tsx` (Conexiones) — el cambio aplica a ambos automáticamente, no requiere tocar esos archivos.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/RoutineManager/RoutinePreview.tsx
git commit -m "fix(rutinas): restaurar color de acento en RoutinePreview"
```

---

### Task 2: Ícono (i) del gráfico — tap en vez de solo hover

**Files:**
- Modify: `src/components/react/ProgressList/ProgressChart.tsx`

- [ ] **Step 1: Agregar estado y togglear con click/teclado**

En touch no existe `:hover` real, así que el ícono `(i)` (que hoy depende 100% de `group-hover`) nunca se puede abrir en celular. La solución es agregar estado React y togglearlo con `onClick` (que en todos los navegadores móviles también dispara con un tap) — no hace falta un handler de touch aparte, y agregar uno junto a `onClick` arriesgaría un doble-toggle por la sintetización click-tras-touch del navegador.

Agregar el import de `useState` ya existe (línea 1 ya trae `useState`). Agregar el nuevo estado justo debajo de `metric`:

```tsx
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const [showInfo, setShowInfo] = useState(false);
```

Reemplazar el bloque del ícono de info (líneas 120-125 actuales) por:

```tsx
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowInfo((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowInfo((v) => !v);
              }
            }}
            className="group relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-paper-dim/60 text-xs text-paper-dim"
          >
            i
            <div
              className={`pointer-events-none absolute left-0 top-6 z-10 w-60 rounded-control border border-paper-dim/40 bg-surface p-3 text-xs text-paper-dim shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                showInfo ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {infoText}
            </div>
          </div>
```

El hover de desktop se mantiene intacto (las clases `group-hover:opacity-100`/`group-focus-within:opacity-100` siguen ahí); el tap ahora controla la misma opacidad vía la clase condicional `showInfo`.

- [ ] **Step 2: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio (mismo baseline conocido de `ProgressList.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/ProgressChart.tsx
git commit -m "fix(progreso): el ícono de info del gráfico responde a tap, no solo hover"
```

---

### Task 3: Vocabulario de íconos compartido

**Files:**
- Create: `src/lib/progressIcons.tsx`

- [ ] **Step 1: Crear el archivo con los íconos y la paleta de colores**

Mismo estilo de trazo que `Nav.astro` (`stroke="currentColor"`, sin relleno), pero como componentes React livianos (no strings HTML), ya que se consumen desde componentes React.

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio (mismo baseline conocido).

- [ ] **Step 3: Commit**

```bash
git add src/lib/progressIcons.tsx
git commit -m "feat(progreso): vocabulario de íconos SVG compartido + paleta de glow"
```

---

### Task 4: Componente compartido `GlowTile`

**Files:**
- Create: `src/components/react/Shared/GlowTile.tsx`

- [ ] **Step 1: Crear el componente**

Reemplaza el `card-brutal` plano donde se aplique este pulido. Renderiza como `<button>` si recibe `onClick` (tocable/seleccionable, como los tiles de Medidas/Disciplina), o como `<div>` de solo lectura si no (como los tiles de la franja de resumen).

```tsx
import type { ReactNode } from 'react';

interface GlowTileProps {
  icon: ReactNode;
  color: string;
  label: string;
  value: ReactNode;
  // Línea chica opcional debajo del valor — usada por ProgressSectionGrid
  // para el texto de contexto ("vs. hace 4 semanas", "último registrado").
  sub?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export default function GlowTile({ icon, color, label, value, sub, selected, onClick }: GlowTileProps) {
  const className = `card-brutal card-brutal-tap relative flex flex-col justify-between gap-2 overflow-hidden text-left transition-colors ${
    onClick ? 'hover:border-acid' : ''
  } ${selected ? 'border-acid' : ''}`;

  const content = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at 85% 10%, ${color}, transparent 65%)` }}
      />
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="label-brutal">{label}</span>
        <span className="h-5 w-5 shrink-0" style={{ color }}>
          {icon}
        </span>
      </div>
      <div className="relative z-10 flex flex-col gap-0.5">
        <span className="font-display text-xl text-paper">{value}</span>
        {sub !== undefined && <span className="font-mono text-xs text-paper-dim">{sub}</span>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Shared/GlowTile.tsx
git commit -m "feat(progreso): componente compartido GlowTile (ícono + glow + label + valor)"
```

---

### Task 5: Aplicar `GlowTile` a `ProgressSummaryStrip`

**Files:**
- Modify: `src/components/react/ProgressList/ProgressSummaryStrip.tsx`

- [ ] **Step 1: Reemplazar el `Tile` local por `GlowTile`**

Reemplazar el archivo completo:

```tsx
import AdherenceRing from './AdherenceRing';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, TrophyIcon, CalendarIcon, LayersIcon, DropletIcon, FootstepsIcon, GLOW_PALETTE } from '../../../lib/progressIcons';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  daysTrained: number;
  daysElapsed: number;
  lastWeightKg: number | null;
  weightUnit: 'kg' | 'lb';
  kgToDisplay: (kg: number, unit: 'kg' | 'lb') => number;
  recentPRLabel: string | null; // "Sentadilla — 92 kg" ya armado por el caller
  totalWorkouts: number;
  disciplineCount: number;
  bodyFatPercent: number | null;
  stepsToday: number | null;
  t: Dictionary['progreso']['summary'];
}

export default function ProgressSummaryStrip({
  daysTrained,
  daysElapsed,
  lastWeightKg,
  weightUnit,
  kgToDisplay,
  recentPRLabel,
  totalWorkouts,
  disciplineCount,
  bodyFatPercent,
  stepsToday,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <AdherenceRing daysTrained={daysTrained} daysElapsed={daysElapsed} label={t.adherenceLabel} />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {lastWeightKg !== null && (
          <GlowTile
            icon={<ScaleIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[0]}
            label={t.lastWeight}
            value={`${kgToDisplay(lastWeightKg, weightUnit)} ${weightUnit}`}
          />
        )}
        {recentPRLabel !== null && (
          <GlowTile
            icon={<TrophyIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[2]}
            label={t.recentPR}
            value={recentPRLabel}
          />
        )}
        {totalWorkouts > 0 && (
          <GlowTile
            icon={<CalendarIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[1]}
            label={t.totalWorkouts}
            value={String(totalWorkouts)}
          />
        )}
        {disciplineCount > 0 && (
          <GlowTile
            icon={<LayersIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[3]}
            label={t.disciplines}
            value={String(disciplineCount)}
          />
        )}
        {bodyFatPercent !== null && (
          <GlowTile
            icon={<DropletIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[4]}
            label={t.bodyFat}
            value={`${bodyFatPercent} %`}
          />
        )}
        {stepsToday !== null && (
          <GlowTile
            icon={<FootstepsIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[0]}
            label={t.stepsToday}
            value={stepsToday.toLocaleString()}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/ProgressSummaryStrip.tsx
git commit -m "feat(progreso): franja de resumen usa GlowTile"
```

---

### Task 6: Aplicar `GlowTile` a `MeasurementsSummary`

**Files:**
- Modify: `src/components/react/ProgressList/MeasurementsSummary.tsx`

- [ ] **Step 1: Reemplazar los botones `card-brutal` por `GlowTile`, manteniendo `onClick`/`selected`**

Cintura/cadera/cuello/brazo/pierna comparten `TapeMeasureIcon`, solo cambia el color (ciclando por `GLOW_PALETTE`).

Reemplazar el archivo completo:

```tsx
import type { Measurement } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../../../lib/bodyComposition';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, TapeMeasureIcon, DropletIcon, MuscleIcon, GLOW_PALETTE } from '../../../lib/progressIcons';

type MeasurementFieldLabelKey = keyof Dictionary['progreso']['measurementsSummary']['fields'];

// Sin estatura a propósito: no cambia para un adulto, así que no tiene
// sentido como tarjeta de progreso en el tiempo — sigue existiendo como
// campo en Perfil, solo se saca de acá.
// `labelKey` (not a hardcoded label) so both this component and
// ProgressList — which needs the label too, for MeasurementsChart — can
// resolve the translated text from whichever locale's `t` they were
// handed, instead of duplicating the copy.
export const MEASUREMENT_DISPLAY_FIELDS: {
  key: keyof Measurement;
  labelKey: MeasurementFieldLabelKey;
  unit: string;
}[] = [
  { key: 'weight_kg', labelKey: 'weight', unit: 'kg' },
  { key: 'waist_cm', labelKey: 'waist', unit: 'cm' },
  { key: 'hip_cm', labelKey: 'hip', unit: 'cm' },
  { key: 'neck_cm', labelKey: 'neck', unit: 'cm' },
  { key: 'arm_cm', labelKey: 'arm', unit: 'cm' },
  { key: 'leg_cm', labelKey: 'leg', unit: 'cm' },
];

// El peso usa ScaleIcon; el resto de los campos de cinta métrica comparten
// TapeMeasureIcon — solo el color (GLOW_PALETTE, cíclico) los distingue.
const FIELD_ICON: Record<string, (props: { className?: string }) => JSX.Element> = {
  weight_kg: ScaleIcon,
  waist_cm: TapeMeasureIcon,
  hip_cm: TapeMeasureIcon,
  neck_cm: TapeMeasureIcon,
  arm_cm: TapeMeasureIcon,
  leg_cm: TapeMeasureIcon,
};

interface Props {
  latest: Measurement | null;
  sex: 'femenino' | 'masculino' | null;
  selected: string | null;
  onSelect: (key: string | null) => void;
  t: Dictionary['progreso']['measurementsSummary'];
}

export default function MeasurementsSummary({ latest, sex, selected, onSelect, t }: Props) {
  if (!latest) return null;
  const available = MEASUREMENT_DISPLAY_FIELDS.filter(({ key }) => latest[key] !== null);

  const bodyFatPercent = estimateBodyFatPercent({
    sex,
    neckCm: latest.neck_cm,
    waistCm: latest.waist_cm,
    hipCm: latest.hip_cm,
    heightCm: latest.height_cm,
  });
  const leanMassKg =
    latest.weight_kg !== null ? estimateLeanMassKg(latest.weight_kg, bodyFatPercent) : null;

  if (available.length === 0 && bodyFatPercent === null) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {available.map(({ key, labelKey, unit }, index) => {
          const Icon = FIELD_ICON[key];
          return (
            <GlowTile
              key={key}
              icon={<Icon className="h-5 w-5" />}
              color={GLOW_PALETTE[index % GLOW_PALETTE.length]}
              label={t.fields[labelKey]}
              value={
                <>
                  {latest[key]} <span className="text-sm text-paper-dim">{unit}</span>
                </>
              }
              selected={selected === key}
              onClick={() => onSelect(selected === key ? null : key)}
            />
          );
        })}
        {bodyFatPercent !== null && (
          <GlowTile
            icon={<DropletIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[4]}
            label={t.fields.bodyFat}
            value={
              <>
                {bodyFatPercent} <span className="text-sm text-paper-dim">%</span>
              </>
            }
            selected={selected === 'body_fat_percent'}
            onClick={() => onSelect(selected === 'body_fat_percent' ? null : 'body_fat_percent')}
          />
        )}
        {leanMassKg !== null && (
          <GlowTile
            icon={<MuscleIcon className="h-5 w-5" />}
            color={GLOW_PALETTE[2]}
            label={t.fields.leanMass}
            value={
              <>
                {leanMassKg} <span className="text-sm text-paper-dim">kg</span>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/MeasurementsSummary.tsx
git commit -m "feat(progreso): tiles de Medidas usan GlowTile"
```

---

### Task 7: Aplicar `GlowTile` a `DisciplineSummary`

**Files:**
- Modify: `src/components/react/ProgressList/DisciplineSummary.tsx`

- [ ] **Step 1: Reemplazar los botones por `GlowTile`, reusando `DISCIPLINE_COLORS`**

```tsx
import { DISCIPLINE_COLORS } from '../../../lib/activities';
import type { DisciplineSummary as DisciplineSummaryEntry } from '../../../lib/prs';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { DumbbellIcon, RunIcon, WaveIcon, GloveIcon } from '../../../lib/progressIcons';

interface Props {
  summaries: DisciplineSummaryEntry[];
  selected: string | null;
  onSelect: (discipline: string | null) => void;
  t: Dictionary['progreso']['disciplineSummary'];
  disciplinesT: Dictionary['disciplines'];
}

const DISCIPLINE_ICON: Record<string, (props: { className?: string }) => JSX.Element> = {
  gym: DumbbellIcon,
  running: RunIcon,
  natacion: WaveIcon,
  combate: GloveIcon,
};

export default function DisciplineSummary({ summaries, selected, onSelect, t, disciplinesT }: Props) {
  const LABEL_BY_DISCIPLINE: Record<string, string> = disciplinesT;
  if (summaries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((s) => {
          const Icon = DISCIPLINE_ICON[s.discipline] ?? DumbbellIcon;
          return (
            <GlowTile
              key={s.discipline}
              icon={<Icon className="h-5 w-5" />}
              color={DISCIPLINE_COLORS[s.discipline] ?? 'var(--color-acid)'}
              label={LABEL_BY_DISCIPLINE[s.discipline] ?? s.discipline}
              selected={selected === s.discipline}
              onClick={() => onSelect(selected === s.discipline ? null : s.discipline)}
              value={
                <>
                  {s.sessionCount} {s.sessionCount === 1 ? t.sessionCountSingular : t.sessionCountPlural}
                </>
              }
              sub={
                s.setCount !== null
                  ? `${s.setCount} ${t.totalSets}`
                  : s.totalMinutes !== null
                    ? `${s.totalMinutes} ${t.totalMinutes}`
                    : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
```

Nota: `DISCIPLINE_COLORS['gym']` vale `var(--color-acid)` (string CSS válida) — funciona igual como valor de `color` en `GlowTile` que un hex literal.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/DisciplineSummary.tsx
git commit -m "feat(progreso): tarjetas de disciplina usan GlowTile"
```

---

### Task 8: Aplicar `GlowTile` a `PRGrid` y `CardioPRGrid`

**Files:**
- Modify: `src/components/react/ProgressList/PRGrid.tsx`
- Modify: `src/components/react/ProgressList/CardioPRGrid.tsx`

Ambas listas pueden tener muchas tarjetas (un récord por ejercicio/actividad) — para no volverlas ruidosas, todas usan el mismo `TrophyIcon` y el mismo color de acento (`var(--color-acid)`), no una paleta variable por tarjeta (escape hatch explícito de la spec, sección 5).

- [ ] **Step 1: `PRGrid.tsx`**

Reemplazar el `<button className="card-brutal card-brutal-tap ...">` (líneas 47-59) por un `GlowTile`. Archivo completo:

```tsx
import { Fragment, useState, type ReactNode } from 'react';
import { muscleLabel } from '../../../lib/muscles';
import { groupPRsByMuscle, type ExercisePR } from '../../../lib/prs';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { TrophyIcon } from '../../../lib/progressIcons';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  prs: ExercisePR[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
  selectedExerciseId: string | null;
  chart: ReactNode;
  t: Dictionary['progreso']['prGrid'];
  muscleLabels: Dictionary['muscles'];
}

export default function PRGrid({
  prs,
  exercises,
  onSelectExercise,
  selectedExerciseId,
  chart,
  t,
  muscleLabels,
}: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
  const groups = groupPRsByMuscle(prs, exercises);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">{t.title}</p>
      {groups.map((group) => (
        <div key={group.muscleId} className="flex flex-col gap-3">
          <p className="label-brutal">{muscleLabel(group.muscleId, muscleLabels)}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <Fragment key={pr.exerciseId}>
                <GlowTile
                  icon={<TrophyIcon className="h-5 w-5" />}
                  color="var(--color-acid)"
                  onClick={() => onSelectExercise(pr.exerciseId)}
                  selected={pr.exerciseId === selectedExerciseId}
                  label={exerciseNameById.get(pr.exerciseId) ?? pr.exerciseId}
                  value={`${kgToDisplay(pr.weight, weightUnit)} ${weightUnit}`}
                  sub={pr.date}
                />
                {pr.exerciseId === selectedExerciseId && (
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
```

- [ ] **Step 2: `CardioPRGrid.tsx`**

Archivo completo:

```tsx
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
                  sub={`${kmToMeters(pr.distanceKm)} m · ${pr.durationMin} min · ${pr.date}`}
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
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ProgressList/PRGrid.tsx src/components/react/ProgressList/CardioPRGrid.tsx
git commit -m "feat(progreso): tarjetas de récords usan GlowTile"
```

---

### Task 9: Aplicar `GlowTile` a `FitbitActivitySummary` (y exportar `formatMinutes`)

**Files:**
- Modify: `src/components/react/ProgressList/FitbitActivitySummary.tsx`

`formatMinutes` se exporta porque `ProgressSectionGrid` (Task 12) la necesita para formatear la vista previa de "minutos activos" cuando no hay calorías disponibles.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import type { FitbitDailyData } from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';
import GlowTile from '../Shared/GlowTile';
import { FootstepsIcon, HeartIcon, FlameIcon, TimerIcon, MoonIcon, GLOW_PALETTE } from '../../../lib/progressIcons';

interface Props {
  data: FitbitDailyData;
  t: Dictionary['progreso']['fitbitActivity'];
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FitbitActivitySummary({ data, t }: Props) {
  const hasAnyData =
    data.steps !== null ||
    data.restingHeartRate !== null ||
    data.caloriesOut !== null ||
    data.activeMinutes !== null ||
    data.sleepMinutes !== null;

  if (!hasAnyData) {
    return <p className="font-mono text-sm text-paper-dim">{t.empty}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.steps !== null && (
        <GlowTile
          icon={<FootstepsIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[0]}
          label={t.steps}
          value={data.steps.toLocaleString()}
        />
      )}
      {data.restingHeartRate !== null && (
        <GlowTile
          icon={<HeartIcon className="h-5 w-5" />}
          color="var(--color-blood)"
          label={t.restingHeartRate}
          value={`${data.restingHeartRate} bpm`}
        />
      )}
      {data.caloriesOut !== null && (
        <GlowTile
          icon={<FlameIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[3]}
          label={t.calories}
          value={`${Math.round(data.caloriesOut)} kcal`}
        />
      )}
      {data.activeMinutes !== null && (
        <GlowTile
          icon={<TimerIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[1]}
          label={t.activeMinutes}
          value={formatMinutes(Math.round(data.activeMinutes))}
        />
      )}
      {data.sleepMinutes !== null && (
        <GlowTile
          icon={<MoonIcon className="h-5 w-5" />}
          color={GLOW_PALETTE[2]}
          label={t.sleep}
          value={formatMinutes(data.sleepMinutes)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/FitbitActivitySummary.tsx
git commit -m "feat(progreso): tiles de actividad de Google Health usan GlowTile"
```

---

### Task 10: Scroll automático al desplegar una sección colapsable

**Files:**
- Modify: `src/components/react/Shared/CollapsibleSection.tsx`

Aplica a todo uso restante de `CollapsibleSection` fuera de Progreso (Registrar, etc. — las 4 de Progreso se eliminan en Task 13).

- [ ] **Step 1: Agregar el ref y el efecto**

Reemplazar el archivo completo:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  // Shown next to the title even while collapsed — for a quick-glance
  // indicator (e.g. "3 de 5 completados") without opening the section.
  badge?: ReactNode;
  children: ReactNode;
}

// Colapsada se ve y se siente como btn-brutal-sm (borde, fondo, padding,
// hover) para que quede claro que se puede tocar — abierta vuelve al
// texto plano de siempre, ya que ahí el contexto de "esto es una sección"
// es obvio por el contenido debajo.
export default function CollapsibleSection({ title, open, onToggle, badge, children }: CollapsibleSectionProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Solo dispara cuando `open` pasa a true (no en cada render, no al
  // cerrar) — así el usuario no tiene que bajar manualmente a ver lo que
  // acaba de desplegar.
  useEffect(() => {
    if (open) {
      buttonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [open]);

  return (
    <div className="flex flex-col gap-3">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={
          open
            ? 'flex w-full items-center justify-between gap-3 text-left'
            : 'flex w-full items-center justify-between gap-3 rounded-control border border-paper/30 bg-surface-raised px-4 py-3 text-left text-paper transition duration-150 hover:bg-acid hover:text-on-accent hover:[background-image:var(--gradient-acid)] active:scale-[0.98]'
        }
      >
        <span className="flex items-center gap-3">
          <p className={open ? 'label-brutal text-acid' : 'font-display text-base uppercase tracking-wide'}>
            {title}
          </p>
          {badge}
        </span>
        <span
          className={
            open ? 'font-mono text-lg leading-none text-paper-dim' : 'font-display text-xl leading-none'
          }
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="flex flex-col gap-6">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Shared/CollapsibleSection.tsx
git commit -m "feat(shared): CollapsibleSection hace scroll suave al desplegarse"
```

---

### Task 11: Helpers de vista previa en `prs.ts`

**Files:**
- Modify: `src/lib/prs.ts`
- Create: `tests/prs.test.mjs`

Estos dos helpers alimentan las 4 tarjetas del grid-selector (Task 12): `weightTrend` para "Medidas" (mismo criterio de 4 semanas que el badge de tendencia de `ProgressChart.tsx`, aplicado al peso en vez de a un ejercicio) y `topDiscipline` para "Disciplina" (la disciplina con más sesiones, usada dos veces desde `ProgressList` — una vez con los entrenamientos de los últimos 7 días, y como fallback con todos).

- [ ] **Step 1: Agregar los helpers al final de `src/lib/prs.ts`**

```ts

export interface WeightTrend {
  deltaKg: number; // positivo = subió, negativo = bajó
}

// Compara el último peso registrado contra el primero con fecha >= 28 días
// antes — mismo criterio que el badge de tendencia de ProgressChart.tsx,
// aplicado a `measurements` en vez de a un ejercicio. Null si no hay
// suficiente historial de peso (0 o 1 medición con peso, o todas caen
// dentro de la ventana de 4 semanas).
export function weightTrend(
  measurements: { date: string; weight_kg: number | null }[]
): WeightTrend | null {
  const withWeight = measurements.filter(
    (m): m is { date: string; weight_kg: number } => m.weight_kg !== null
  );
  if (withWeight.length === 0) return null;
  const latest = withWeight[withWeight.length - 1];
  const latestDate = new Date(latest.date);
  const fourWeeksAgo = new Date(latestDate);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const baseline = withWeight.find((m) => new Date(m.date) >= fourWeeksAgo);
  if (!baseline || baseline.date === latest.date) return null;
  return { deltaKg: Math.round((latest.weight_kg - baseline.weight_kg) * 10) / 10 };
}

// La disciplina con más sesiones dentro de la lista de resúmenes recibida
// (el caller decide el alcance: todo el historial, o solo una ventana de
// fechas ya filtrada). Null si la lista está vacía.
export function topDiscipline(summaries: DisciplineSummary[]): DisciplineSummary | null {
  if (summaries.length === 0) return null;
  return summaries.reduce((best, s) => (s.sessionCount > best.sessionCount ? s : best), summaries[0]);
}
```

- [ ] **Step 2: Escribir los tests**

```mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { weightTrend, topDiscipline } from '../src/lib/prs.ts';

test('weightTrend: sin mediciones de peso devuelve null', () => {
  assert.equal(weightTrend([]), null);
  assert.equal(weightTrend([{ date: '2026-09-01', weight_kg: null }]), null);
});

test('weightTrend: una sola medición devuelve null (no hay línea base distinta)', () => {
  const result = weightTrend([{ date: '2026-09-01', weight_kg: 80 }]);
  assert.equal(result, null);
});

test('weightTrend: baja de peso da un delta negativo', () => {
  // 2026-08-05 -> 2026-09-01 son 27 días, dentro de la ventana de 28 días
  // (si fuera más vieja que la ventana, quedaría fuera y no habría base
  // distinta de la última medición — ver el siguiente test).
  const result = weightTrend([
    { date: '2026-08-05', weight_kg: 80 },
    { date: '2026-09-01', weight_kg: 78.5 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, -1.5);
});

test('weightTrend: sube de peso da un delta positivo', () => {
  const result = weightTrend([
    { date: '2026-08-05', weight_kg: 78.5 },
    { date: '2026-09-01', weight_kg: 80 },
  ]);
  assert.ok(result !== null);
  assert.equal(result.deltaKg, 1.5);
});

test('weightTrend: única medición previa cae fuera de la ventana de 4 semanas -> null', () => {
  // 31 días de diferencia: el único punto anterior a la última medición
  // queda excluido de "los últimos 28 días", así que no hay línea base
  // distinta de la propia última medición.
  const result = weightTrend([
    { date: '2026-08-01', weight_kg: 80 },
    { date: '2026-09-01', weight_kg: 78.5 },
  ]);
  assert.equal(result, null);
});

test('weightTrend: ignora una línea base a menos de 4 semanas (usa la más antigua dentro de la ventana)', () => {
  const result = weightTrend([
    { date: '2026-08-25', weight_kg: 79 },
    { date: '2026-08-28', weight_kg: 79.5 },
    { date: '2026-09-01', weight_kg: 80 },
  ]);
  // Ninguna medición cae 28+ días antes de la última (2026-09-01) — la
  // primera con fecha >= "hace 4 semanas" termina siendo la más vieja de
  // la lista (2026-08-25), que es distinta de la última, así que sí hay
  // un delta calculable.
  assert.ok(result !== null);
  assert.equal(result.deltaKg, 1);
});

test('topDiscipline: lista vacía devuelve null', () => {
  assert.equal(topDiscipline([]), null);
});

test('topDiscipline: devuelve la disciplina con más sesiones', () => {
  const result = topDiscipline([
    { discipline: 'gym', sessionCount: 2, totalMinutes: null, setCount: 10 },
    { discipline: 'running', sessionCount: 5, totalMinutes: 120, setCount: null },
  ]);
  assert.equal(result?.discipline, 'running');
});
```

- [ ] **Step 3: Correr los tests**

Run: `node --test tests/prs.test.mjs`
Expected: todos los tests en verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prs.ts tests/prs.test.mjs
git commit -m "feat(progreso): helpers weightTrend y topDiscipline para el grid-selector"
```

---

### Task 12: i18n — namespace `sectionGrid`

**Files:**
- Modify: `src/i18n/es.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Agregar el namespace en `es.ts`**

Insertar justo después del bloque `summary: { ... },` (después de la línea `stepsToday: 'Pasos hoy',` y su cierre `},`, antes de `measurementsSummary: {`):

```ts
    sectionGrid: {
      weightTrendSub: 'vs. hace 4 semanas',
      measurementsCountSub: 'mediciones registradas',
      noDataYet: 'Sin entrenamientos aún',
      disciplineAllTimeSub: 'tu foco general',
      today: 'Hoy',
      yesterday: 'Ayer',
      lastWorkoutSub: 'último registrado',
      caloriesSub: 'quemadas hoy',
      activeMinutesSub: 'activos hoy',
      heartRateSub: 'FC en reposo hoy',
    },
```

- [ ] **Step 2: Agregar el namespace equivalente en `en.ts`**

Mismo punto de inserción (después de `summary: { ... },`, antes de `measurementsSummary: {`):

```ts
    sectionGrid: {
      weightTrendSub: 'vs. 4 weeks ago',
      measurementsCountSub: 'measurements logged',
      noDataYet: 'No workouts yet',
      disciplineAllTimeSub: 'your overall focus',
      today: 'Today',
      yesterday: 'Yesterday',
      lastWorkoutSub: 'last logged',
      caloriesSub: 'burned today',
      activeMinutesSub: 'active today',
      heartRateSub: 'resting HR today',
    },
```

- [ ] **Step 3: Verificar paridad de tipos**

Run: `npx tsc --noEmit`
Expected: limpio — `en.ts` está tipado como `Dictionary = typeof es`, así que si falta una clave en cualquiera de los dos archivos el build falla.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(i18n): textos del grid-selector de Progreso (es/en)"
```

---

### Task 13: Componente `ProgressSectionGrid`

**Files:**
- Create: `src/components/react/ProgressList/ProgressSectionGrid.tsx`

Grid 2×2 de 4 `GlowTile`s que actúan como selector (tipo tabs) — ninguna seleccionada por default. Cada tarjeta muestra un dato que NO repite la franja de resumen (peso actual, PR, total de entrenamientos, disciplinas, %grasa, pasos ya están ahí). Tocar una tarjeta activa/desactiva su panel; solo un panel visible a la vez.

- [ ] **Step 1: Crear el componente**

```tsx
import type { ReactNode } from 'react';
import GlowTile from '../Shared/GlowTile';
import { ScaleIcon, LayersIcon, CalendarIcon, PulseIcon, GLOW_PALETTE } from '../../../lib/progressIcons';
import { localDateStr } from '../../../lib/weekdays';
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
  // null => Google Health no conectado, o conectado pero sin ningún dato
  // mostrable — la tarjeta "Actividad" no aparece en absoluto.
  activityPreview: ActivityPreview | null;
  // Contenido completo de cada panel, ya armado por ProgressList (misma
  // lógica/JSX que antes vivía dentro de cada CollapsibleSection).
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
  const yesterday = localDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
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

  if (activityPreview) {
    cards.push({
      key: 'actividad',
      icon: <PulseIcon className="h-5 w-5" />,
      color: GLOW_PALETTE[3],
      label: activityTitle,
      value: activityPreview.value,
      sub: activityPreview.sub,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <GlowTile
            key={card.key}
            icon={card.icon}
            color={card.color}
            label={card.label}
            value={card.value}
            sub={card.sub}
            selected={active === card.key}
            onClick={() => onSelect(card.key)}
          />
        ))}
      </div>
      {active !== null && <div className="flex flex-col gap-6">{panels[active]}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio (referencia a `panels[active]` — TypeScript angosta `active` a `SectionKey` dentro del bloque `active !== null && ...`).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/ProgressSectionGrid.tsx
git commit -m "feat(progreso): nuevo grid-selector de 4 tarjetas para las secciones"
```

---

### Task 14: Reemplazar las 4 `CollapsibleSection` en `ProgressList` por `ProgressSectionGrid`

**Files:**
- Modify: `src/components/react/ProgressList/ProgressList.tsx`

Este es el task de integración: quita `openSection`/`toggleSection` y las 4 `<CollapsibleSection>`, arma los datos de vista previa con los helpers de Task 11, y arma el objeto `panels` con exactamente el mismo JSX que hoy vive dentro de cada sección (sin tocar la lógica de esos componentes internos).

- [ ] **Step 1: Actualizar los imports**

Reemplazar el bloque de imports (líneas 1-37) por:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout, getSessionsForWorkout } from '../../../lib/workouts';
import { getMyMeasurements } from '../../../lib/measurements';
import { getMyProfile } from '../../../lib/profile';
import { estimateBodyFatPercent } from '../../../lib/bodyComposition';
import {
  calculatePRs,
  groupPRsByMuscle,
  progressForExercise,
  calculateCardioPRs,
  groupCardioPRsByDiscipline,
  progressForCardioActivity,
  progressForMeasurement,
  summarizeByDiscipline,
  mostRecentPR,
  weightTrend,
  topDiscipline,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import { weekAdherence } from '../../../lib/adherence';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import { getFitbitConnectionStatus, getFitbitDailyData, type FitbitDailyData } from '../../../lib/fitbit';
import { localDateStr } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import type { Measurement } from '../../../types/db';
import DisciplineSummary from './DisciplineSummary';
import FitbitActivitySummary, { formatMinutes } from './FitbitActivitySummary';
import MeasurementsSummary, { MEASUREMENT_DISPLAY_FIELDS } from './MeasurementsSummary';
import MeasurementsChart from './MeasurementsChart';
import PRGrid from './PRGrid';
import ProgressChart from './ProgressChart';
import CardioPRGrid from './CardioPRGrid';
import CardioProgressChart from './CardioProgressChart';
import ProgressSectionGrid, { type SectionKey } from './ProgressSectionGrid';
import ProgressSummaryStrip from './ProgressSummaryStrip';
import WorkoutHistory from './WorkoutHistory';
import type { Dictionary } from '../../../i18n/es';
```

- [ ] **Step 2: Reemplazar el estado `openSection`/`toggleSection` por `activeSection`/`toggleSection`**

Reemplazar (líneas 81-89 actuales):

```tsx
  // Todas arrancan cerradas al entrar a la pestaña — el usuario elige qué
  // abrir, nada se le impone expandido de entrada.
  const [openSection, setOpenSection] = useState<
    'medidas' | 'disciplina' | 'entrenamientos' | 'actividad' | null
  >(null);

  function toggleSection(section: 'medidas' | 'disciplina' | 'entrenamientos' | 'actividad') {
    setOpenSection((prev) => (prev === section ? null : section));
  }
```

por:

```tsx
  // Ninguna tarjeta arranca activa — el usuario elige cuál abrir, nada se
  // le impone expandido de entrada. Tocar la misma tarjeta activa la cierra.
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  function toggleSection(section: SectionKey) {
    setActiveSection((prev) => (prev === section ? null : section));
  }
```

- [ ] **Step 3: Calcular los datos de vista previa del grid, justo antes del `return (...)` final**

Insertar este bloque inmediatamente antes de la línea `return (` que abre el JSX final (después del cálculo existente de `bodyFatPercent`, línea ~244):

```tsx
  const weightTrendResult = weightTrend(measurements);
  const weightTrendKg = weightTrendResult?.deltaKg ?? null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = localDateStr(sevenDaysAgo);
  const recentWorkouts = workouts.filter((w) => w.date >= sevenDaysAgoStr);
  const weekTopDiscipline = topDiscipline(summarizeByDiscipline(recentWorkouts, activities));
  const allTimeTopDiscipline = topDiscipline(disciplineSummaries);
  const leadingDisciplineInfo = weekTopDiscipline
    ? { discipline: weekTopDiscipline.discipline, sessionCount: weekTopDiscipline.sessionCount, isThisWeek: true }
    : allTimeTopDiscipline
      ? { discipline: allTimeTopDiscipline.discipline, sessionCount: allTimeTopDiscipline.sessionCount, isThisWeek: false }
      : null;

  const mostRecentWorkoutDate =
    workouts.length > 0 ? workouts.reduce((max, w) => (w.date > max ? w.date : max), workouts[0].date) : null;

  const activityPreview =
    !fitbitConnected || !fitbitData
      ? null
      : fitbitData.caloriesOut !== null
        ? { value: `${Math.round(fitbitData.caloriesOut)} kcal`, sub: t.sectionGrid.caloriesSub }
        : fitbitData.activeMinutes !== null
          ? { value: formatMinutes(Math.round(fitbitData.activeMinutes)), sub: t.sectionGrid.activeMinutesSub }
          : fitbitData.restingHeartRate !== null
            ? { value: `${fitbitData.restingHeartRate} bpm`, sub: t.sectionGrid.heartRateSub }
            : null;

  const panels: Record<SectionKey, ReactNode> = {
    medidas: (
      <>
        <MeasurementsSummary
          latest={latestMeasurement}
          sex={sex}
          selected={selectedMeasurement}
          onSelect={setSelectedMeasurement}
          t={t.measurementsSummary}
        />
        {selectedMeasurement === 'body_fat_percent' ? (
          <MeasurementsChart
            label={t.measurementsSummary.fields.bodyFat}
            unit="%"
            points={measurements
              .map((m) => ({
                date: m.date,
                value: estimateBodyFatPercent({
                  sex,
                  neckCm: m.neck_cm,
                  waistCm: m.waist_cm,
                  hipCm: m.hip_cm,
                  heightCm: m.height_cm,
                }),
              }))
              .filter((p): p is { date: string; value: number } => p.value !== null)}
          />
        ) : (
          selectedMeasurementField && (
            <MeasurementsChart
              label={t.measurementsSummary.fields[selectedMeasurementField.labelKey]}
              unit={selectedMeasurementField.unit}
              points={progressForMeasurement(measurements, selectedMeasurementField.key)}
            />
          )
        )}
      </>
    ),
    disciplina: (
      <>
        <DisciplineSummary
          summaries={disciplineSummaries}
          selected={selectedDiscipline}
          onSelect={setSelectedDiscipline}
          t={t.disciplineSummary}
          disciplinesT={disciplinesT}
        />

        {selectedDiscipline === 'gym' && (
          <PRGrid
            prs={prs}
            exercises={exercises}
            onSelectExercise={setSelectedExerciseId}
            selectedExerciseId={selectedExerciseId}
            t={t.prGrid}
            muscleLabels={musclesT}
            chart={
              selectedExerciseId && (
                <ProgressChart
                  exerciseId={selectedExerciseId}
                  points={progressForExercise(workouts, selectedExerciseId)}
                  exercises={exercises}
                  onSelectExercise={setSelectedExerciseId}
                  t={t.progressChart}
                />
              )
            }
          />
        )}

        {(selectedDiscipline === 'running' || selectedDiscipline === 'natacion') && (
          <CardioPRGrid
            prs={cardioPrsForSelected}
            activities={cardioActivitiesForSelected}
            onSelectActivity={setSelectedCardioActivityId}
            selectedActivityId={selectedCardioActivityId}
            t={t.cardioPrGrid}
            disciplinesT={disciplinesT}
            chart={
              selectedCardioActivityId && (
                <CardioProgressChart
                  activityId={selectedCardioActivityId}
                  points={progressForCardioActivity(workouts, selectedCardioActivityId)}
                  activities={cardioActivitiesForSelected}
                  onSelectActivity={setSelectedCardioActivityId}
                  t={t.cardioProgressChart}
                />
              )
            }
          />
        )}

        {selectedDiscipline === 'combate' && (
          <p className="font-mono text-sm text-paper-dim">{t.list.combateNoRecords}</p>
        )}
      </>
    ),
    entrenamientos: (
      <WorkoutHistory
        workouts={workouts}
        exerciseNames={exerciseNames}
        activities={activities}
        onChanged={loadWorkouts}
        filterDiscipline={selectedDiscipline}
        t={t.workoutHistory}
        registrarT={registrarT}
        disciplinesT={disciplinesT}
      />
    ),
    actividad: fitbitError ? (
      <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{fitbitError}</p>
    ) : fitbitData ? (
      <FitbitActivitySummary data={fitbitData} t={t.fitbitActivity} />
    ) : (
      <p className="font-mono text-sm text-paper-dim">{t.list.loading}</p>
    ),
  };
```

- [ ] **Step 4: Reemplazar el JSX final**

Reemplazar todo el bloque de retorno (desde `return (` hasta el `</div>);` final, líneas ~246-397) por:

```tsx
  return (
    <div className="flex flex-col gap-6">
      <ProgressSummaryStrip
        daysTrained={adherence.daysTrained}
        daysElapsed={adherence.daysElapsed}
        lastWeightKg={latestMeasurement?.weight_kg ?? null}
        weightUnit={weightUnit}
        kgToDisplay={kgToDisplay}
        recentPRLabel={recentPR ? `${recentPR.label} — ${recentPR.display}` : null}
        totalWorkouts={workouts.length}
        disciplineCount={disciplineCount}
        bodyFatPercent={bodyFatPercent}
        stepsToday={fitbitData?.steps ?? null}
        t={t.summary}
      />
      <ProgressSectionGrid
        active={activeSection}
        onSelect={toggleSection}
        weightTrendKg={weightTrendKg}
        measurementsCount={measurements.length}
        leadingDiscipline={leadingDisciplineInfo}
        mostRecentWorkoutDate={mostRecentWorkoutDate}
        activityPreview={activityPreview}
        panels={panels}
        disciplinesT={disciplinesT}
        disciplineSummaryT={t.disciplineSummary}
        sectionsT={t.list.sections}
        activityTitle={t.fitbitActivity.title}
        t={t.sectionGrid}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio (mismo baseline conocido). El import de `CollapsibleSection` ya no se usa en este archivo — confirmar que no quedó ninguna referencia suelta.

Run: `grep -n "CollapsibleSection\|openSection" src/components/react/ProgressList/ProgressList.tsx`
Expected: sin resultados.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/ProgressList/ProgressList.tsx
git commit -m "feat(progreso): ProgressList usa el grid-selector en vez de las 4 secciones colapsables"
```

---

## Verificación final

1. `npm run build && npx tsc --noEmit` — limpio (mismo baseline conocido: un error preexistente en `ProgressList.tsx`'s `Measurement[]` type y ruido de Deno-globals en la función Edge, ambos ya documentados como esperados/no relacionados).
2. `node --test tests/*.test.mjs` — todos los tests en verde, incluyendo los nuevos de `prs.test.mjs`.
3. Recorrido manual con `npx astro preview` contra la cuenta real, en **ambos temas** (claro/oscuro) y **ambos idiomas** (es/en):
   - Rutinas: el día y los bullets de cada tarjeta se ven en color de acento.
   - Progreso → gráfico de un ejercicio: tocar el ícono `(i)` en celular (o simular touch) abre el tooltip; en desktop, el hover también lo sigue abriendo.
   - Franja de resumen: los 6 tiles con ícono + glow.
   - Grid-selector: las 4 tarjetas (o 3 si Google Health no está conectado), cada una con su preview correcto (tendencia de peso o conteo de mediciones; disciplina líder de la semana o de siempre; fecha relativa del último entrenamiento; calorías/minutos/FC de hoy). Tocar una la activa y muestra su panel completo debajo; tocar otra cambia el panel; tocar la misma la cierra.
   - Dentro de cada panel: tiles de Medidas, tarjetas de Disciplina, tarjetas de PRGrid/CardioPRGrid y tiles de Google Health, todos con ícono + glow.
   - Registrar: confirmar que sus `CollapsibleSection` siguen funcionando igual, con el nuevo scroll suave al desplegarse.
