# Pulido visual de Progreso y Rutinas — diseño

Pedido directo de Pam, surgido de probar en vivo la integración de Google Health recién shippeada. Validado con mockups interactivos (color de rutinas, franja de resumen "más llamativa", reorganización de las 4 secciones de Progreso como grid-selector).

- Spec/plan previos relevantes: `docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md` (dashboard + Google Health), `docs/superpowers/plans/2026-09-26-progreso-dashboard-ux.md`.

## 1. Rutinas: restaurar el color en `RoutinePreview`

Al reusar `RoutinePreview` (Task 9 del plan de UX) para arreglar el texto corrido de las tarjetas de rutina, quedó con la paleta gris que ya tenía ese componente — pero el mockup original que Pam aprobó tenía el día en color de acento y los bullets también coloreados. Cambio puntual en `src/components/react/RoutineManager/RoutinePreview.tsx`:

- El label de cada día (`{t.days[day]}`) pasa de `label-brutal` (gris) a `label-brutal text-acid`.
- El borde izquierdo del bloque de días pasa de `border-paper-dim/40` a `border-acid` (o `border-l-2` con el color de acento).
- El bullet de cada `<li>` (hoy generado vía `list-style` o un `::before`) pasa a usar `--color-acid` en vez de gris.

Este componente se usa en 2 lugares (`RoutineList.tsx` y `PendingRoutineShares`) — el cambio de color aplica a ambos por igual, sin alcance adicional.

## 2. Ícono (i) del gráfico de progreso: tap en vez de hover

`ProgressChart.tsx`'s ícono `(i)` usa `group-hover:opacity-100 group-focus-within:opacity-100` — no funciona en touch (no hay estado `:hover` real en un celular). Cambio: agregar estado React (`const [showInfo, setShowInfo] = useState(false)`) y togglearlo con `onClick`/`onTouchEnd` en el ícono, controlando la visibilidad del tooltip por clase condicional en vez de solo CSS `:hover`. Mantener el hover como bonus para quien sí tenga mouse (desktop), pero el tap debe funcionar siempre. Agregar `role="button"` y `tabIndex={0}` al ícono para accesibilidad de teclado (ya señalado como deuda menor en una revisión anterior).

## 3. Vocabulario de íconos (nuevo, compartido)

Siguiendo la convención ya establecida en `Nav.astro` (íconos SVG dibujados a mano, `stroke="currentColor"`, sin librería externa — ver su constante `ICONS`), se crea un archivo nuevo `src/lib/progressIcons.tsx` con un set chico y reusable de íconos lineales (mismo estilo trazo que los del Nav), como componentes React livianos (`function ScaleIcon(props: {className?: string})`, etc.), no como strings HTML (a diferencia de Nav.astro, que es Astro puro — estos se usan desde React):

| Ícono | Uso |
|---|---|
| `ScaleIcon` (balanza) | Peso — franja de resumen, tarjeta "Medidas" del grid, tile de peso en Medidas |
| `TapeMeasureIcon` (cinta) | Cintura/cadera/cuello/brazo/pierna — tiles de Medidas |
| `DropletIcon` (gota) | % grasa |
| `MuscleIcon` (bíceps) | Masa magra |
| `TrophyIcon` (trofeo) | PR reciente — franja de resumen, tiles de PRGrid/CardioPRGrid |
| `CalendarIcon` (calendario) | Entrenamientos — franja de resumen, tarjeta "Entrenamientos" del grid |
| `LayersIcon` (capas) | Disciplinas — franja de resumen, tarjeta "Disciplina" del grid |
| `DumbbellIcon` / `RunIcon` / `WaveIcon` / `GloveIcon` | Gym / Running / Natación / Combate — tiles de `DisciplineSummary` |
| `FootstepsIcon` (pasos) | Pasos — franja de resumen, tile de Google Health |
| `HeartIcon` (corazón) | Frecuencia cardíaca — tile de Google Health |
| `FlameIcon` (llama) | Calorías — franja de resumen (tarjeta "Actividad" del grid), tile de Google Health |
| `TimerIcon` (cronómetro) | Minutos activos — tile de Google Health |
| `MoonIcon` (luna) | Sueño — tile de Google Health |
| `PulseIcon` (pulso) | Tarjeta "Actividad (Google Health)" del grid |

14 íconos en total, varios reusados en 2-3 lugares (no se duplica ninguno). Se descarta hacer un ícono distinto por cada campo de Medidas (cintura/cadera/cuello/brazo/pierna comparten `TapeMeasureIcon`, solo cambia el color) — reduce el trabajo de curación sin perder variedad visual (el color ya distingue cada tile).

## 4. Estilo "ícono + glow" — clase/patrón compartido

Se define un patrón visual reusable (no necesariamente una única clase Tailwind, puede ser un componente `GlowTile` en `src/components/react/Shared/GlowTile.tsx`) que reemplaza el `card-brutal` plano donde se aplique este pulido:

```tsx
interface GlowTileProps {
  icon: React.ReactNode; // uno de los íconos de la sección 3
  color: string; // var(--color-acid) u otro hex/var — define el tinte del glow y del ícono
  label: string;
  value: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}
```

Renderiza: fondo con un `radial-gradient` sutil del `color` recibido (glow, opacidad baja, mismo lenguaje que ya usa el resto de la app desde "brutal-glass"), el ícono arriba en una esquina, el label chico arriba, el valor grande abajo. Si `onClick` está presente, es un `<button>` (tocable/seleccionable, como los tiles de Medidas/Disciplina hoy); si no, es un `<div>` de solo lectura (como los tiles de la franja de resumen).

Este componente reemplaza el `Tile`/`function Tile()` que hoy vive duplicado dentro de `ProgressSummaryStrip.tsx` y `FitbitActivitySummary.tsx` (ambos se actualizan para usar el nuevo `GlowTile` compartido en vez de su propia función `Tile` local — elimina la duplicación de paso).

## 5. Dónde se aplica `GlowTile` (reemplaza `card-brutal`/`Tile` planos)

- **`ProgressSummaryStrip.tsx`**: los 6 tiles (peso, PR, entrenamientos, disciplinas, %grasa, pasos) — íconos: Scale/Trophy/Calendar/Layers/Droplet/Footsteps.
- **`MeasurementsSummary.tsx`**: los tiles de Medidas (peso, cintura, cadera, cuello, brazo, pierna, %grasa, masa magra) — mantienen su `onClick`/`selected` (siguen siendo seleccionables para elegir qué gráfico ver).
- **`DisciplineSummary.tsx`**: las 4 tarjetas de disciplina — íconos Dumbbell/Run/Wave/Glove, color por disciplina (reusa `DISCIPLINE_COLORS` de `src/lib/activities.ts`, ya existente).
- **`PRGrid.tsx` / `CardioPRGrid.tsx`**: cada tarjeta de récord — ícono `TrophyIcon`, color por disciplina/músculo (a definir un mapeo simple; puede ser el mismo `--color-acid` para todos si no hay una paleta por músculo ya definida — no inventar una taxonomía de color nueva solo para esto).
- **`FitbitActivitySummary.tsx`**: los 5 tiles (pasos, FC, calorías, minutos activos, sueño) — íconos Footsteps/Heart/Flame/Timer/Moon.

**Qué NO se toca:** `WorkoutHistory.tsx` (375 líneas, filas de entrenamientos editables con formularios inline, no tiles de un vistazo — no es un buen fit para el patrón ícono+glow; se deja como está, ya tiene su propio color por disciplina vía tags existentes).

## 6. Grid-selector: reemplaza las 4 secciones colapsables de Progreso

Nuevo componente `src/components/react/ProgressList/ProgressSectionGrid.tsx`:

- Grid 2×2 (una columna en mobile muy angosto si hace falta, `grid-cols-2` alcanza para el ancho mínimo de 400px del proyecto) de 4 `GlowTile` grandes, NINGUNO seleccionado por default (arranca sin panel abierto abajo, coincide con "todo cerrado" que ya era el comportamiento).
- Cada tarjeta muestra un dato que **no** duplica la franja de resumen (sección 5 del spec anterior):
  - **Medidas** (ícono `ScaleIcon`): tendencia de peso vs. hace 4 semanas (`▲`/`▼` + kg, mismo patrón de cálculo ya usado para el trend badge del gráfico de ejercicio — reusar esa lógica, adaptada a la métrica "peso" de `measurements` en vez de un ejercicio). Si no hay suficiente historial, mostrar el número de mediciones registradas en su lugar.
  - **Disciplina** (ícono `LayersIcon`): la disciplina con más sesiones en los últimos 7 días (nombre + cantidad). Si no hay ninguna esta semana, mostrar la disciplina con más sesiones en total.
  - **Entrenamientos** (ícono `CalendarIcon`): fecha del entrenamiento más reciente, relativa ("Hoy" / "Ayer" / la fecha) — no el conteo total (eso ya está en la franja).
  - **Actividad (Google Health)** (ícono `PulseIcon`): calorías de hoy (la franja ya muestra pasos) — si no hay calorías pero sí otro dato, mostrar ese; si Google Health no está conectado, esta tarjeta no aparece en absoluto (mismo criterio que ya existe para el resto de la sección de actividad).
- Tocar una tarjeta la marca como activa (borde/glow más intenso) y muestra, en un panel único debajo del grid, el contenido COMPLETO de esa sección — los mismos componentes que ya existen hoy dentro de cada `CollapsibleSection` (`MeasurementsSummary`+`MeasurementsChart`, `DisciplineSummary`+`PRGrid`/`CardioPRGrid`, `WorkoutHistory`, `FitbitActivitySummary`), sin cambios a su lógica interna más allá del pulido de la sección 5.
- Tocar otra tarjeta cambia cuál panel se muestra (mutuamente excluyente, como un tab — nunca dos paneles abiertos a la vez). Tocar la misma tarjeta que ya está activa la cierra (vuelve a "todo cerrado").
- `ProgressList.tsx` reemplaza sus 4 `<CollapsibleSection>` + el estado `openSection`/`toggleSection` por este único componente nuevo, pasándole todos los props que hoy cada sección recibía directamente.
- `CollapsibleSection.tsx` (el componente compartido) **no se borra** — sigue en uso en Registrar y en cualquier otro lado que lo use fuera de Progreso.

## 7. Scroll automático al desplegar una sección colapsable

Aplica a **todo uso restante de `CollapsibleSection`** (ya no a las 4 de Progreso, que pasan al grid-selector de la sección 6, pero sí a Registrar y cualquier otro lugar). En `CollapsibleSection.tsx`: al abrir (`open` pasa a `true`), hacer `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })` sobre el botón/header de la sección — usando un `useEffect` que dispare solo cuando `open` cambia a `true` (no en cada render, no al cerrar).

## Verificación

`npm run build && npx tsc --noEmit` limpios (mismo baseline conocido). Recorrido Playwright contra `npx astro preview` + cuenta real: confirmar el color en tarjetas de rutina, el ícono (i) respondiendo a tap en el gráfico, la franja de resumen con íconos, el grid-selector de Progreso (las 4 tarjetas, cada preview con el dato correcto, apertura/cierre mutuamente excluyente, scroll suave), los tiles internos de cada panel con ícono+glow, y que Registrar siga funcionando igual (scroll suave nuevo, resto sin cambios). Confirmar visualmente en ambos temas (claro/oscuro) y ambos idiomas.
