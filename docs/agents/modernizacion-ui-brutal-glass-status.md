# Modernización visual "brutal-glass" — status

Pedido directo de Pam: "vamos a modernizar la UI de nuestra app, que se vea mas renovada, moderna limpia, sin cambiar estructura y formas". Spec, plan y ejecución completa vía `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development`, en el worktree `ui-brutal-glass`.

- Spec: `docs/superpowers/specs/2026-09-22-modernizacion-ui-brutal-glass-design.md`
- Plan: `docs/superpowers/plans/2026-09-22-modernizacion-ui-brutal-glass.md`

## Qué cambió

Sistema neo-brutalista original (bordes duros de 2px, sombras offset sin blur, textura de ruido) → dirección "brutal-glass": esquinas redondeadas (`--radius-card`/`--radius-control`), vidrio translúcido con blur en tarjetas (oscuro) / sólido opaco sin blur (claro), sombras con glow vía `color-mix()`, sin textura de ruido. 5 clases compartidas reescritas (`.btn-brutal`, `.btn-brutal-outline`, `.btn-brutal-sm`, `.card-brutal`, `.input-brutal`) más ~55 usos sueltos de `border-2`/variantes corregidos a mano en 29 archivos (más numerosos de lo que el spec original estimó — corregido durante la planificación).

## Degradado de acento (agregado mid-flight, pedido directo de Pam durante la ejecución)

El acento pasa de verde ácido liso a 3 presets de degradado curados con mockups (F1 azul→morado, F2 morado→magenta, F3 cian→azul — nuevo default), que **conviven** con el selector de color sólido libre que ya existía en Perfil (no lo reemplazan, confirmado explícitamente). Mecanismo: dos variables CSS (`--color-acid` sólido para texto/borde, `--gradient-acid` para rellenos), dos clases compartidas nuevas (`.pill-selected`, `.fill-acid-on`) que reemplazan un patrón repetido a mano en ~27 lugares de toda la app. `theme.ts`/`BaseLayout.astro` (script pre-paint duplicado a propósito, documentado con nota cruzada) aplican las 3 variables juntas; compatible con cualquier hex libre ya guardado.

## Ejecución

17 tasks (1, 2, 2b, 3, 4, 5, 6, 7, 8, 8b, 9, 10, 11, 12, 13, 14, 15), cada uno con implementador + spec-review + code-quality-review independientes, todos en `docs/agents/notas-de-entorno-y-lecciones.md`-style rigor. Dos rondas de fixes post-review encontradas por los reviewers (no por el implementador):
- Task 2b: faltaba el comentario recíproco en `theme.ts` apuntando a la duplicación manual en `BaseLayout.astro` — corregido.
- Task 9: el color-input nativo mostraba negro en vez del color representativo del degradado activo, y las 3 swatches de degradado se quedaron en `border-2` mientras las 6 sólidas ya habían pasado a `border` — ambos corregidos.

Revisión final holística (Task 16, post-plan) sobre los 18 commits del branch encontró 2 hallazgos "Important", ambos cerrados:
- El plan caracterizaba el cambio de default de `accent_color` en `schema.sql` como "inerte" — en realidad es código alcanzable (`upsertProfile()` hace upsert parcial; la primera escritura de un usuario nuevo puede no incluir `accent_color` y cae al default). El cambio en sí (`'#d7ff3f'` → `'f3'`) era correcto y necesario (evita un flash visible verde→degradado); solo la documentación estaba mal — corregida.
- El recorrido de Playwright original (Task 15) no cubrió Home, `/ejercicios`, `/conexiones`, `/sincronizacion` pese a que la rama los tocaba. Spot-check adicional (ambos temas, cuenta de prueba real) confirmó cero errores de consola y renderizado correcto en las 4 pantallas.

## Verificación

`npm run build && npx tsc --noEmit` limpios en cada task (único error preexistente y no relacionado: `ProgressList.tsx`, confirmado antes de este branch). Recorrido Playwright completo contra `npx astro preview` + Supabase real (`crud-e2e-1786826288@gmail.com`): Nav (desktop/mobile), Rutinas, Registrar, Progreso, Perfil (los 3 degradados + color libre + persistencia local y en Supabase), login/error states, Home, Ejercicios (explorador 3D), Conexiones, Sincronización — ambos temas, cero errores de consola, cero regresiones funcionales. Cuenta de prueba repuesta a tema oscuro/degradado F3 al terminar.

## Lo que no cambió (a propósito)

Estructura de páginas, formularios, navegación, lógica de negocio, RLS, copy en español, paleta base (ink/surface/paper/blood), tipografía. Fuera de esta ronda: favicon y el color activo del explorador muscular 3D (`MuscleBody.tsx`'s `COLOR_ACTIVE`, un material de Three.js) siguen con el verde ácido fijo — no leen `--color-acid` en runtime hoy; enchufarlos es trabajo aparte no pedido.
