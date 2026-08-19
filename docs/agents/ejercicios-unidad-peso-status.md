# Catálogo de ejercicios, unidad de peso y fix de Rutinas — estado

Segunda tanda de trabajo del 2026-08-19, después de `docs/agents/pulido-ux-post-conexiones-status.md`. Cubre tres pedidos sueltos de Pam: revisar/completar el catálogo de ejercicios, un bug real en el picker de rutinas, y unidad de peso opcional (kg/lb). Commits: `git log --oneline eb8cdff..019bd63`.

## Catálogo de ejercicios (`src/content/activities/`)

Pam pidió revisar duplicados puntuales y sumar lo que faltara, "si hace falta agrega, pero no dupliques":

- **Abductor/Aductor en máquina**: revisados, **no eran duplicados** — ya eran fichas correctas y distintas (abductor separa las piernas, aductor las junta). Sin cambios.
- **Extensión de cuádriceps vs. Hiperextensiones**: revisados, **son ejercicios distintos** (cuádriceps en máquina vs. lumbares/glúteos/isquiotibiales en banco romano). Sin cambios.
- **Remo sentado con polea** y **Puente de glúteo**: ya existían (`remo-polea-baja-sentado.md`, `puente-gluteo.md`). No se duplicaron.
- **Agregados** (6 fichas nuevas): `press-cerrado-banca.md`, `patada-triceps-mancuerna.md` (tríceps), `sentadilla-goblet.md`, `elevacion-piernas-banco.md` (piernas/abdomen), `natacion-crol-sculling.md`, `natacion-crol-zipper.md` (natación).
- De paso se encontraron y corrigieron **32 fichas más con acentos argentinos** ("Registrá", "arrastrá", "esperá") que se habían pasado en el barrido de voseo de la ronda anterior — ese barrido solo miró componentes/páginas, no `src/content/activities/`.
- Se agregó un aviso fijo "Calienta siempre antes de entrenar..." arriba de la pantalla de Registrar (`src/pages/registro/nuevo.astro`).

## Bug real encontrado: agregar un ejercicio repetido a un día fallaba en silencio

Pam reportó: "cuando edito una rutina, sobre todo en natación, no me deja agregar más de 3 ejercicios, el 4to hace que se agrega pero no se refleja en la lista". Investigación:

- Se intentó reproducir con datos sintéticos de muchas formas (mismo grupo, cruzando grupos de natación, editando una rutina ya guardada, mezclando gym, agregando a varios días distintos) — **en ningún caso se reprodujo un límite real de 3**.
- Se encontró la causa real leyendo `DayActivityPicker` en `CreateRoutineForm.tsx`: `handleAddToDay` ya evitaba agregar un `activityId` duplicado al mismo día (correcto, evita repetir un ejercicio), pero lo hacía devolviendo el estado sin cambios **sin ningún aviso** — y el formulario igual limpiaba los campos como si hubiera agregado algo. Si el usuario reintenta agregar sin cambiar la selección del desplegable (fácil en natación, que tiene selector de estilo + selector de drill), el 4to intento "parece que funcionó" pero no aparece nada nuevo.
- **Fix**: `handleAdd` ahora chequea el duplicado contra `dayEntries` antes de llamar a `onAdd`, y si ya está, muestra `"<nombre>" ya está agregado este día.` en vez de fallar callado. El aviso se limpia solo al cambiar de selección o al agregar algo distinto.
- Verificado con Playwright: reproducir el duplicado muestra el aviso; cambiar de selección lo limpia; agregar un ejercicio genuinamente distinto sigue funcionando.

## Unidad de peso opcional (kg/lb)

Pedido: "pon la posibilidad de registrar en libras o en kg, que sea opcional". Decisiones tomadas con Pam antes de implementar (`AskUserQuestion`):
- **Alcance**: solo el peso de las series de gym (Registrar + editar en Progreso). El peso corporal en Perfil (medidas) queda solo en kg — no se tocó.
- **Mecanismo**: preferencia fija por dispositivo (localStorage), elegible desde Perfil — mismo patrón que tema oscuro/claro, no un selector por carga individual.

Implementación, siguiendo el patrón ya establecido para distancia (`kmToMeters`/`metersToKm` en `src/lib/activities.ts`: el dato se guarda siempre en la unidad canónica, la conversión pasa solo en el borde de la UI):

- `src/lib/weightUnit.ts` (nuevo): `getWeightUnit()`/`setWeightUnit()` (localStorage, default `'kg'`), `kgToDisplay()`/`displayToKg()` (conversión con redondeo a 1 decimal).
- El peso sigue guardándose siempre en kg en `workout_sets.weight` — ninguna migración de datos, ningún cambio de schema.
- `parseSetInput()` en `WorkoutLogger.tsx` (compartida con `WorkoutHistory.tsx` para editar series existentes) ahora recibe la unidad y convierte a kg antes de devolver el valor que se guarda.
- Todo punto de la UI que muestra o pide un peso de serie de gym quedó unit-aware: `SetFields` (label dinámico "Peso (kg)"/"Peso (lb)"), la sugerencia de progresión, el mensaje de PR al guardar, la tabla de "vas a guardar", el historial en Progreso (`WorkoutHistory.tsx`), los récords personales (`PRGrid.tsx`), el gráfico de progreso (`ProgressChart.tsx`) y la resolución de conflictos offline (`ConflictResolution.tsx`).
- Selector "Unidad de peso" agregado en Perfil, mismo patrón visual que el selector Oscuro/Claro.

**Verificación**: `npm run build && npx tsc --noEmit` limpio (único error preexistente de `ProgressList.tsx`). Playwright contra Supabase real: se registró una serie en libras (44 lb) y se confirmó por consulta directa a la base que quedó guardada como `19.958064280000002` kg — la conversión es exacta (44 × 0.45359237). El historial de series viejas (guardadas en kg antes de este cambio) se muestra correctamente convertido a lb sin ningún cambio de datos.

## Reporte de bug que no resultó ser un bug

Pam reportó que "Compartir rutina" le decía que no tenía conexión pese a tener una. Se investigó el código (`getMyConnections()` es la misma función exacta que usa tanto "Mis conexiones" en Conexiones como el picker de Compartir en Rutinas — no hay forma de que difieran para el mismo usuario en el mismo momento) y se intentó reproducir con las dos cuentas de prueba, pero **no estaban conectadas entre sí en ese momento** (se habían desvinculado en algún punto de sesiones anteriores) y establecer una conexión nueva para probar quedó bloqueado por el clasificador de auto-mode (ver `notas-de-entorno-y-lecciones.md`). Antes de completar la reproducción, Pam confirmó que, revisando de nuevo, **ya funcionaba** — probablemente la conexión todavía no había terminado de sincronizar/aceptarse en el momento del primer intento. No se aplicó ningún cambio de código para esto.

## Lo que falta / no cubierto en esta ronda

- La unidad kg/lb no toca el peso corporal en Perfil (medidas) ni ningún otro campo de peso fuera de las series de gym — quedó así por decisión explícita, no es un olvido.
- No hay sincronización entre pestañas/dispositivos de la preferencia de unidad (localStorage puro, como tema/acento) — si el usuario cambia de unidad en un dispositivo, el resto no se entera hasta que también la cambien ahí. Igual que el resto de las preferencias de este tipo en la app, no se consideró necesario para el alcance pedido.
- El aviso de "Compartir sin conexión" que dio pie a la investigación de este documento no se resolvió con un cambio de código — si vuelve a aparecer, lo primero es confirmar si la conexión ya estaba aceptada (no solo pendiente) en el momento exacto del clic.
