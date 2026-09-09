# 1RM estimado y volumen total en Progreso — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica en `docs/roadmap-ideas.md` ("Progreso": "no hay 1RM estimado; no hay gráfico de volumen total"). Proceso: spec (`docs/superpowers/specs/2026-09-08-1rm-y-volumen-total-design.md`) → plan (`docs/superpowers/plans/2026-09-08-1rm-y-volumen-total.md`) → implementación con subagent-driven-development.

## Qué se hizo

`progressForExercise` (`src/lib/prs.ts`) ahora acumula, por cada fecha en que se logueó el ejercicio, el 1RM estimado más alto entre todos los sets de ese día (fórmula de Epley: `weight * (1 + reps / 30)`) y el volumen total (`peso × reps` sumado de todos los sets, no solo el más pesado) además del peso máximo que ya calculaba. `ProgressChart.tsx` pasó de `LineChart` a `ComposedChart` de Recharts con dos ejes Y: el izquierdo con la línea sólida de peso máximo y una nueva línea punteada de 1RM estimado (para diferenciarla visualmente de un dato medido), el derecho con barras de volumen detrás de las líneas. Se agregó leyenda y el tooltip pasó a mostrar las tres series. Solo gimnasio — cardio no tiene el concepto (no registra peso×reps), así que `CardioProgressChart.tsx` no se tocó.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada task (único error preexistente esperado en `ProgressList.tsx`).
- Playwright contra la cuenta de prueba real (`crud-e2e-1786826288@gmail.com`): se registró Sentadilla con barra en dos sesiones — 2026-09-05 con dos sets en la misma sesión (100 kg × 1 rep y 90 kg × 5 reps) y 2026-08-20 con un set (80 kg × 3 reps) — para tener más de un punto en la gráfica y un caso donde el set más pesado no da el mejor 1RM. En `/progreso/` → "Resumen por disciplina" → Gym → Sentadilla con barra, la gráfica mostró las tres series (línea sólida "Peso máximo", línea punteada "1RM estimado", barras "Volumen") con su leyenda. El tooltip del punto 2026-09-05 confirmó exactamente lo esperado: `Peso máximo: 100 kg`, `1RM estimado: 105 kg` (del set de 90 kg×5, no del set más pesado de 100 kg×1, que hubiera dado ≈103.3 kg) y `Volumen: 550 kg` (suma de ambos sets). Repetido con la preferencia de unidad en lb: el mismo tooltip mostró `Peso máximo: 220.5 lb`, `1RM estimado: 231.5 lb` y `Volumen: 1212.5 lb`, conversión correcta de los mismos valores en kg. Datos de prueba (los entrenamientos de 2026-09-05 y 2026-08-20) borrados al terminar vía "Eliminar día" en el historial de `/progreso/`; los datos preexistentes de la cuenta (Abductor en máquina, 2026-08-18) no se tocaron. La preferencia de unidad es local al navegador (`localStorage`, ver `src/lib/weightUnit.ts`) y no persiste entre sesiones de Playwright, así que no queda ningún estado de esa prueba en la cuenta en sí.

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): volumen agregado de todos los ejercicios en un día, comparar/superponer más de un ejercicio en la misma gráfica, filtro por rango de fechas, fórmula alternativa configurable (solo Epley).
