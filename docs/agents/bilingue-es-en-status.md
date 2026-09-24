# App bilingüe ES/EN — status

Pedido directo de Pam: "ahora ayudame a cambiar a bilingue". Decisión de alcance tomada en el brainstorming: dividir en dos rondas independientes. **Ambas rondas están completas**: la Ronda 1 (infraestructura i18n + traducción de la interfaz, mergeada a `main`) y la Ronda 2 (traducción del contenido de ejercicios y rutinas) — ver la sección "Ronda 2 — contenido (completa)" al final de este doc.

- Spec: `docs/superpowers/specs/2026-09-23-bilingue-es-en-design.md`
- Plan: `docs/superpowers/plans/2026-09-23-bilingue-es-en.md` (17 tareas)
- Ejecución: `superpowers:subagent-driven-development`, worktree `bilingue-es-en` (vía `EnterWorktree`)
- Mergeado a `main`: commit `afc7e3e` (2026-09-23), pusheado a `origin/main`

## Qué se construyó

Ruteo i18n nativo de Astro (`astro:i18n`): español sin prefijo (como siempre), inglés bajo `/en/...` (`prefixDefaultLocale: false`). Diccionario propio en `src/i18n/{es,en,index}.ts` — `en.ts` tipado como `Dictionary = typeof es` (sin `as const`, ver nota de corrección abajo), así que al build de TypeScript le falla si `en.ts` le falta una clave que sí está en `es.ts`. Cada página `.astro` calcula su propio `locale` desde `Astro.currentLocale` y pasa la porción del diccionario que corresponda como prop a los islands de React (React no tiene acceso a `Astro.currentLocale`, corre en el cliente).

Namespaces del diccionario: `nav`, `auth` (login/signup/forgotPassword/resetPassword), `home`, `perfil`, `ejercicios`, `rutinas`, `registrar`, `progreso`, `conexiones`, `sync` (sincronización/invitación/sync banner/install prompt/avatar compartido), `disciplines` (agregado en un fix tardío, ver abajo).

Selector de idioma en dos lugares (mockup aprobado en el brainstorming, opción "los dos combinados"):
1. Toggle ES/EN en `Nav.astro`, siempre visible (header, no solo desktop) — un click cambia de idioma preservando la pantalla actual.
2. Selector en Perfil, junto a Apariencia — mismo lugar que tema/acento.

Persistencia: `localStorage` (clave `selfgains-locale`) + columna `profiles.locale` en Supabase cuando hay sesión (mismo patrón dual que `theme`/`accent_color`). Detección de idioma del navegador en la primera visita real (sin preferencia guardada todavía), nunca vuelve a mirar el navegador después. 13 páginas espejo en inglés bajo `src/pages/en/*.astro` — copias casi literales de las páginas en español (Astro deriva `currentLocale` de la carpeta `en/`, así que ninguna página necesita lógica especial; solo cambian las rutas de import por el nivel de carpeta extra).

## Bugs reales encontrados durante la ejecución (no en el diseño original, en el código)

- **`Dictionary` con `as const` rompía las traducciones al inglés.** El plan original tenía `export const es = {...} as const;` — eso fija cada string a su tipo literal exacto (`"Ejercicios"` en vez de `string`), así que `en: Dictionary` exigía las mismas strings en español, haciendo imposible poner inglés. Encontrado por el implementador de la Tarea 2 antes de shippear; corregido (sin `as const`) tanto en el código como en el plan.
- **Las páginas espejo en `/en/` no compilaban.** El plan afirmaba que quedaban "a la misma profundidad relativa" que sus originales y por eso los imports no necesitaban tocarse — falso, la carpeta `en/` agrega un nivel para TODAS las páginas. Copias verdaderamente byte-por-byte rompían el build entero (no solo las rutas en inglés). Corregido: cada espejo necesita un `../` extra en cada import relativo, nada más.
- **Los labels de disciplina (Gym/Running/Natación/Combate) nunca se tradujeron.** Encontrados en la revisión holística final — vivían en un array `DISCIPLINES` hardcodeado en `ActivityPicker.tsx`, consumidos sin traducir en 6 componentes (incluido uno no listado originalmente, `DisciplineSummary.tsx`, encontrado al arreglar los otros 5). Es contenido de UI (labels de filtro), no nombres de ejercicios — sí estaba en alcance de esta ronda. Corregido con un namespace `disciplines` nuevo.
- **El toggle de idioma del Nav no persistía la elección — dos rondas de fix.** Primero: el toggle navegaba bien pero nunca escribía `localStorage` (solo Perfil lo hacía) — como la PWA instalada reabre siempre en la `start_url` en español del manifest, la elección se perdía en el próximo arranque. Fix 1 agregó un listener de click que escribe `localStorage` antes de navegar. Pero el listener se attacheaba directo al `<a>` en la carga inicial, y el `ClientRouter` de Astro reemplaza ese nodo en cualquier navegación interna — el caso común, no el raro — dejando el listener huérfano después del primer click en cualquier otro link. Fix 2 (encontrado en la re-revisión del fix 1): delegación de eventos en `document` en vez de en el `<a>`, ya que `document` nunca se reemplaza.

## Verificación

`npm run build && npx tsc --noEmit` limpios en cada tarea (único error preexistente y no relacionado: `ProgressList.tsx:187`, confirmado antes de este branch). Recorrido Playwright completo contra `npx astro preview`: las 26 páginas (13 ES + 13 EN), `<html lang>` correcto en cada una, nav/formularios/mensajes de error simulados en inglés, toggle de idioma probado desde varias pantallas en ambas direcciones (incluido después de navegación interna, el caso que rompía el Fix 1), persistencia confirmada tras recargar y tras simular un relanzamiento de la PWA instalada (nueva pestaña en la `start_url`). Contenido de ejercicios/rutinas confirmado en español en ambos idiomas — comportamiento esperado, no un bug.

**Pendiente manual, ya resuelto por Pam:** la migración `alter table profiles add column locale ...` se documentó en el plan (Tarea 5) pero no se pudo correr desde el agente — Pam la corrió a mano en el SQL Editor de Supabase el 2026-09-24.

## Deuda técnica chica (no bloqueante, encontrada en las revisiones de esta ronda)

- El diccionario (`src/i18n/`) tiene texto duplicado entre namespaces (`loading: 'Cargando...'` aparece igual 9 veces, el patrón de 3 claves `notLoggedIn: {prefix, link, suffix}` se repite en 5 namespaces). Se evaluó un namespace `common` compartido en varias tareas y se descartó cada vez por "no repite lo suficiente" — con todos los namespaces ya armados, esa evaluación ya no es cierta. Candidato para un refactor futuro chico, sin apuro.
- ~~`CreateRoutineForm.tsx` no le pasaba `t`/`disciplines` a `ActivityPicker`~~ — resuelto 2026-09-24: `pickerT`/`disciplinesT` fluyen desde las páginas `rutinas` → `RoutineManager` → `CreateRoutineForm` → `ActivityPicker`.
- Manifest de la PWA (nombre/descripción al instalar) y el service worker (no precachea `/en/`) quedaron fuera de alcance a propósito — cambios chicos y aislados para cuando se quiera.
- Templates de email de Supabase (confirmación de cuenta, recuperar contraseña) siguen en español — se configuran desde el dashboard de Supabase, no desde este repo.
- Deuda derivada de la Ronda 2 (contenido), con detalle en la sección siguiente: `GROUP_LABELS`/`MUSCLES[].label` duplicados con el diccionario; CI sin `npm test`; exports sin uso en `content-i18n.ts`; bloque de carga+localización repetido en 6 páginas ×2; fallback de `progreso`; pulido del test de cobertura; nits de contenido en español; notas de gusto en inglés.

## Ronda 2 — contenido (completa)

Se tradujo al inglés el contenido de **86 actividades** (`src/content/activities`) y **9 planes** (`src/content/plans`). Estado: rama `bilingue-contenido`, pendiente de merge a `main` (quien haga el merge actualiza esta línea). Fecha: 2026-09-24.

- Spec: `docs/superpowers/specs/2026-09-24-bilingue-contenido-design.md`
- Plan: `docs/superpowers/plans/2026-09-24-bilingue-contenido.md` (13 tareas, 0–12)
- Ejecución: `superpowers:subagent-driven-development`, worktree `bilingue-contenido` (rama `bilingue-contenido`, creada desde el HEAD local, no desde `origin/main`)

### Decisiones de diseño (brainstorming)

- Campos `*_en` dentro de cada `.md` (no una colección paralela), obligatorios en el schema de Zod (`z.string().min(1)`): una traducción faltante rompe el build.
- Actividades: `name_en` + `instructions_en`. Planes: `name_en` + `goal_en` (el cuerpo del plan no se muestra en ningún lado, así que no lleva `instructions_en`). Los valores son YAML de una línea entre comillas dobles.
- Imágenes reusadas tal cual, sin curación por idioma.
- Quién tradujo: el agente tradujo los 95 archivos; primero los nombres, y Pam aprobó esa lista antes de traducir el resto. Después Pam revisó la app en inglés (esto reemplaza el "yo traduzco todo" que se había hablado en la Ronda 1).

### Qué se construyó

- Helper `src/lib/content-i18n.ts` (puro, corre bajo node): `localizeActivity`, `localizePlan`; recibe el diccionario como argumento `vocab`.
- Namespaces nuevos del diccionario: `equipment` (14 valores, clave = valor en español del `.md`), `planLevels`, `groups` (estilos de natación), `muscles` (17 + "Otros").
- `fullActivityName` y `ActivityPicker` usan un `groupLabel` ya traducido. `muscleLabel(id, labels?)` recibe las etiquetas por props (no por context: se renderizan dentro del Canvas de R3F) a través de MuscleBody / MuscleExplorer / PRGrid / ProgressList.
- Las 10 páginas de contenido (5 ES + 5 EN espejo) usan el helper. `level` sigue siendo la clave en español porque `isRecommendedGymPlan` la compara con el nivel del perfil; para mostrar se usa `levelLabel`. Los props de las páginas se recortan a lo que usa cada island. La lista de ejercicios de Progreso se ordena por el nombre traducido.
- Infra de tests: `npm test` = `node --test tests/*.test.mjs` (Node 22 quita los tipos; sin vitest). Tests de muscles, activities (`fullActivityName`), content-i18n (22, con casos borde) y content-coverage (lee cada `.md` con js-yaml: las traducciones existen y difieren del español, con una allow-list explícita de 12 `name_en` idénticos, como Face pull, Hip thrust, Catch-up y nombres de plan como Full body; los diccionarios cubren todo equipment/level/group/muscle usado). Total 28 tests. `js-yaml` agregado como devDependency (^4.3.2).

### Problemas reales encontrados durante la ejecución (no estaban en el diseño)

- La Ronda 1 se había salteado los 17 nombres de músculos: seguían en español en la UI en inglés. Se detectó al explorar el código antes de diseñar y se arregló acá.
- `level` parecía traducible pero es una clave de lógica (habría roto "recomendadas" en inglés) → `levelLabel` solo para mostrar.
- El script `npm test` del plan (`node --test tests/`) falló en Node 22 (trata `tests/` como módulo) → `tests/*.test.mjs`.
- `npm install --save-dev js-yaml` resolvió js-yaml 5.x, que no tiene export default, y el test de cobertura fallaba → se fijó ^4.
- Dos subagentes compilando a la vez en el mismo worktree chocaron en `dist/` (race de rmdir en la limpieza de Astro): no correr builds en paralelo.
- La revisión de traducciones encontró problemas reales en el texto FUENTE en español, corregidos con aprobación de la dueña del producto: el texto de la máquina abductor/aductor describía la posición de los cojines al revés o de forma ambigua ("cojines interiores/exteriores" → "por fuera/por dentro de las rodillas"), y el press cerrado decía "manos casi juntas" (→ "manos al ancho de hombros o un poco más cerradas").
- Una ronda de revisión atrapó inglés poco idiomático (p. ej. "kick continuously for 6 kicks", "in a plane other than the frontal one"): 3 rondas de pulido. Face pull dijo brevemente "pulley" en vez de "cable" (el término del diccionario) y se corrigió.

### Verificación

- `npm test` 28/28; `npx tsc --noEmit` solo con el error preexistente de `ProgressList.tsx` (`Measurement[]`); `npm run build` con 26 páginas.
- Props de los islands de las páginas en español comparados contra un build previo al cambio: solo difieren los campos nuevos y los 3 arreglos intencionales de español.
- El HTML construido de `/en/` no tiene nombres de actividades/planes en español (solo la clave `level` oculta: "Principiante"/"Intermedio").
- Pasada automatizada con Playwright en `/ejercicios/` (EN + ES): títulos de músculos 3D ("CHEST/ABS/BICEPS/QUADS"), equipamiento e instrucciones en inglés, toggle de idioma en ambos sentidos, sin errores de consola.
- Las pantallas con login (rutinas, registro, progreso, conexiones en `/en/`) las revisó Pam a mano con su cuenta y quedaron OK en inglés.
- NO verificado en navegador: el texto del tooltip 3D al hacer hover en inglés (el texto WebGL no está en el DOM; el título del músculo al lado sí se verificó).
- Integridad de datos (revisión final): nada persiste nombres localizados; las escrituras guardan ids (`exercise_id`/`activity_id`/`routine_ref`) o texto tipeado por el usuario; los planes predefinidos no se pueden copiar a rutinas propias; los nombres localizados viven solo en estado de React.

### Deuda técnica / backlog derivado de las revisiones

- `GROUP_LABELS` en `src/lib/activities.ts` y `MUSCLES[].label` en `src/lib/muscles.ts` duplican `es.groups`/`es.muscles` (ahora solo fallback / orden): armarlos desde el diccionario para tener una única fuente.
- CI (`.github/workflows/deploy.yml`) corre solo `npm ci` + `npm run build`, no `npm test`: agregarlo. El schema igual rompe el build ante un campo faltante, pero traducciones idénticas al español o claves faltantes en el diccionario solo se detectan en local.
- Exports sin uso `Locale`, `LocalizedActivity`, `LocalizedPlan` en `src/lib/content-i18n.ts`.
- Helper compartido para cargar y localizar actividades: el bloque `getCollection → localizeActivity → recortar → ordenar` se repite en 6 páginas ×2. Se dejó así a propósito porque las páginas ES/EN son copias espejo.
- `progreso` usa `muscle: a.muscles?.[0] ?? ''`: debería caer en 'Otros' (`UNKNOWN_MUSCLE` en `src/lib/prs.ts`).
- Pulido del test de cobertura (`tests/content-coverage.test.mjs`): usar `fileURLToPath` para rutas con espacios, juntar todas las fallas en vez de frenar en la primera, que la allow-list falle si una entrada deja de ser idéntica, y `.trim()` en el schema de Zod para los `*_en` (`src/content.config.ts`).
- Comentario de una línea sobre `levelLabel` en `PredefinedRoutine` de `RoutineManager`.
- Nits del contenido en español detectados y NO cambiados: typo "mantendiendo" en `natacion-crol-fingertip-drag` (→ "manteniendo"); `remo-al-menton` lista equipamiento "Barra o mancuernas" pero el texto describe solo barra; `natacion-dorso-patada` se llama "Patada (tabla)"/"Kick (board)" pero el texto no menciona tabla.
- Gustos de inglés dejados como están (Pam puede ajustar): `Others` vs `Other` para el bucket de músculos, `Cable` vs `Cable machine`, "glove work" en la clase de boxeo (podría ser pad work).

### Sigue fuera de alcance (sin cambios)

Manifest de la PWA y service worker sin traducir/precachear para `/en/`; templates de email de Supabase en español; refactor del namespace `common` del diccionario.
