# 1RM estimado y volumen total en Progreso — diseño

Item de deuda técnica documentado en `docs/roadmap-ideas.md` ("Progreso"): "no hay 1RM estimado; no hay gráfico de volumen total (solo peso máximo/ritmo por sesión)". Esta ronda cierra ambos puntos, solo para gimnasio — cardio no tiene el concepto de 1RM/volumen porque no registra peso×reps, solo distancia/tiempo, así que `CardioProgressChart.tsx` no cambia.

## Alcance

Solo `src/lib/prs.ts` (cálculo) y `src/components/react/ProgressList/ProgressChart.tsx` (visualización). `PRGrid.tsx` y la tarjeta de PR no cambian — el 1RM y el volumen viven únicamente en la gráfica, no en el número de récord que ya se muestra arriba.

## Cálculo (`src/lib/prs.ts`)

`ProgressPoint` pasa de:

```ts
export interface ProgressPoint {
  date: string;
  maxWeight: number;
}
```

a:

```ts
export interface ProgressPoint {
  date: string;
  maxWeight: number;
  estimated1RM: number;
  volume: number;
}
```

Fórmula de Epley para 1RM estimado de un set: `weight * (1 + reps / 30)`.

`progressForExercise(workouts, exerciseId)` recorre los sets de cada fecha igual que hoy, pero ahora acumula tres cosas por fecha en vez de una:
- `maxWeight`: el peso del set más pesado ese día (sin cambios respecto a hoy).
- `estimated1RM`: el **mayor** 1RM estimado entre todos los sets de ese ejercicio ese día — no necesariamente el del set más pesado. Un set de 90kg×5 (1RM≈105kg) puede superar a uno de 100kg×1 (1RM≈103.3kg) en la misma sesión, y en ese caso gana el de 90kg×5.
- `volume`: suma de `peso × reps` de **todos** los sets de ese ejercicio ese día (no solo el más pesado).

Todo se calcula y almacena en kg (igual que el resto del archivo) — la conversión a la unidad elegida por el usuario (kg/lb) pasa a ocurrir solo en el componente de UI, con `kgToDisplay`, igual que ya hace `maxWeight` hoy. `estimated1RM` se redondea a 1 decimal en el cálculo (antes de cualquier conversión de unidad); `volume` no se redondea (es una suma de valores ya enteros/decimales razonables, y `kgToDisplay` ya redondea al mostrarse).

`calculatePRs`, `groupPRsByMuscle` y todo lo demás en el archivo no cambian.

## Visualización (`ProgressChart.tsx`)

Pasa de `LineChart` (una sola serie) a `ComposedChart` de Recharts, con dos ejes Y:

- **Eje izquierdo, `yAxisId="weight"` (kg):**
  - Línea sólida "Peso máximo" — `stroke="var(--color-acid)"`, igual que hoy.
  - Línea punteada "1RM estimado" — `stroke="var(--color-blood)"`, `strokeDasharray="4 4"` para diferenciarla visualmente de un dato medido directamente (el 1RM es una estimación, no algo que se levantó).
- **Eje derecho, `yAxisId="volume"` (kg totales):**
  - `Bar` "Volumen" detrás de las líneas — `fill="var(--color-paper-dim)"`, `fillOpacity={0.35}` para que no compita visualmente con las líneas.
- **Leyenda:** se agrega `<Legend />` de Recharts (antes no hacía falta con una sola serie) — mismo `fontFamily: 'JetBrains Mono, monospace'` que el resto de los textos de la gráfica.
- **Tooltip:** `ChartTooltip` se extiende para recibir los tres valores del `payload` y mostrar las tres líneas (peso, 1RM est., volumen — cada uno con su unidad), en vez de solo el peso.
- Los tres valores pasan por `kgToDisplay(valor, weightUnit)` al armar `displayPoints`, igual que hoy hace `maxWeight`.

El selector de ejercicio, el título con el nombre del ejercicio, y el resto del layout de la tarjeta no cambian. La inserción inline de la gráfica dentro de `PRGrid` (cambio reciente) tampoco se toca.

## Casos borde

- **Reps altas (ej. 20+):** Epley sobreestima el 1RM en ese rango — limitación conocida y aceptada de la fórmula, no se corrige con casos especiales.
- **`weight: 0`** (ejercicios de peso corporal, si se llegan a loguear así): da `estimated1RM: 0` y `volume: 0` para ese set — no rompe el cálculo, esa línea/barra simplemente queda en cero ese día.
- **Un ejercicio con una sola sesión:** el gráfico sigue mostrando un solo punto por serie (línea + barra), igual que ya pasa hoy con la línea de peso.

## Explícitamente fuera de esta ronda

- Cardio (`CardioProgressChart.tsx`, `CardioPR`, `progressForCardioActivity`) — no aplica, no hay peso×reps.
- Comparar/superponer más de un ejercicio en la misma gráfica.
- Filtro por rango de fechas.
- Volumen total agregado de todos los ejercicios en un día (se evaluó como opción y se descartó a favor de mantenerlo por-ejercicio, consistente con el resto de la página).
- 1RM/volumen configurable por fórmula alternativa (Brzycki, etc.) — se fija Epley.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (ignorando el error preexistente ya documentado en `ProgressList.tsx`, no relacionado).
- Playwright contra la cuenta de prueba real: cargar un ejercicio con al menos dos sesiones, y una sesión con varios sets de distinto peso/reps (para confirmar que el punto de 1RM elige el set de mayor 1RM estimado, no necesariamente el más pesado, y que el volumen suma todos los sets del día). Confirmar visualmente las tres series (línea peso, línea punteada 1RM, barras volumen), la leyenda, y el tooltip con los tres valores. Probar con la preferencia de unidad en kg y en lb.
