# App bilingüe ES/EN — status

Pedido directo de Pam: "ahora ayudame a cambiar a bilingue". Decisión de alcance tomada en el brainstorming: dividir en dos rondas independientes. Esta ronda (completa, mergeada) cubre **infraestructura i18n + traducción de la interfaz**. La **Ronda 2 — traducción de contenido** (nombres/instrucciones de ejercicios y rutinas) queda pendiente, con su propio brainstorm — ver la sección final de este doc.

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

## Lo que falta — Ronda 2 (contenido, para arrancar en otra sesión)

**Alcance:** traducir nombres e instrucciones de los ~86 archivos de contenido (`src/content/activities/*.md`, `src/content/plans/*.md`) — hoy siguen en español en ambos idiomas, a propósito, aunque toda la interfaz ya responde en inglés. Necesita su propio brainstorming (`superpowers:brainstorming`) antes de spec/plan — no arrancar directo a implementar.

**Preguntas abiertas para ese brainstorming, ya discutidas parcialmente en el de esta ronda:**
- **Esquema de datos**: ¿un campo `name_en`/`instructions_en` por archivo, un content collection paralelo en inglés, o algo con Astro's i18n content collections? El content collection actual (`src/content.config.ts`) no tiene locale hoy — hay que decidir la forma antes de tocar 86 archivos.
- **Curación de imágenes compartida vs. separada por idioma**: se discutió explícitamente en el brainstorming de esta ronda y se descartó curar por separado (duplica trabajo, genera inconsistencia visual — mismo ejercicio con fotos distintas según idioma). Decisión tentativa: las imágenes ya curadas (`public/exercises/*.webp`, ver `docs/agents/imagenes-ejercicios-curacion.md`) se reusan tal cual para la versión en inglés — una foto no tiene idioma. Si en algún momento se quiere auditar la curación existente como control de calidad, es más barato pedir una re-revisión de lo ya curado que duplicar el trabajo entero — se puede hacer en cualquier momento, sin depender de esta ronda. Confirmar esta decisión (o revisarla) al arrancar el brainstorming.
- **Quién traduce**: en el brainstorming de esta ronda se preguntó explícitamente y Pam eligió "yo traduzco todo, vos revisás al final" (en vez de que el agente traduzca todo) — confirmar si ese mismo approach aplica a 86 archivos de contenido o si conviene un mecanismo distinto dado el volumen.
- **Tono/tecnicismos de gimnasio en inglés**: nombres de ejercicios y equipamiento tienen convenciones específicas en inglés (ej. "Press banca" → "Bench press", no una traducción literal) — vale la pena revisar el estilo de esta ronda (`Dictionary` en `src/i18n/en.ts`) como referencia de tono ya aprobado, pero el vocabulario de fitness necesita su propia pasada de calidad.

**No depende de nada más** — la infraestructura completa (ruteo, diccionario, selector de idioma, persistencia, páginas espejo) ya está en `main` y no necesita cambios para que la Ronda 2 arranque.
