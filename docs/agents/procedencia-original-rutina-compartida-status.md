# Procedencia original de una rutina reasignada — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica documentado en `docs/agents/rol-entrenador-status.md` ("Lo que falta"): reasignar una rutina ya recibida de otro entrenador pisaba `assigned_by_name` en silencio, perdiendo la procedencia original. Proceso: spec (`docs/superpowers/specs/2026-09-09-procedencia-original-rutina-compartida-design.md`) → plan (`docs/superpowers/plans/2026-09-09-procedencia-original-rutina-compartida.md`) → implementación con subagent-driven-development.

## Qué se hizo

`routines` ganó una columna `original_author_name`, que viaja intacta de salto en salto en vez de guardarse la cadena completa: `assignRoutineToStudent` (`src/lib/routines.ts`) ahora la calcula — si la rutina que se reasigna nunca fue compartida antes, el asignador actual ES el original; si ya venía compartida, se propaga el `original_author_name` (o `assigned_by_name`) de la rutina origen sin tocar. `assigned_by_name` sigue significando lo mismo de siempre: quién te la compartió a vos directamente. La UI (`RoutineList.tsx`) agrega "(originalmente de X)" a la leyenda "Compartida por: Y" solo cuando ambos nombres difieren — el caso común de un solo salto se ve exactamente igual que antes. Filas existentes se backfillearon con `original_author_name = assigned_by_name` (mejor dato disponible, no se puede reconstruir una cadena que no se trackeaba). No se restringió reasignar rutinas recibidas — sigue permitido, por decisión explícita del usuario.

## Verificación

- **Build y tipos:** `npm run build` limpio (13 páginas generadas sin errores). `npx tsc --noEmit` mostró únicamente el error preexistente y no relacionado en `ProgressList.tsx:183` (`Measurement[]` vs. tipo indexado por string) — confirmado que ya existía antes de esta feature, no se tocó.
- **Cuentas de prueba:** `crud-e2e-1786826288@gmail.com` (display_name "Cuenta Test A E2E") y `rutinastest1786031687911@gmail.com` (display_name "Cuenta Test B E2E"), ya conectadas entre sí de sesiones anteriores. Ambas ya tenían `is_trainer = true` desde antes — no hizo falta activarlo en ninguna, así que no queda nada que revertir en ese campo. Se resetearon las contraseñas de ambas a un valor conocido vía `supabase db query --linked --file` (SQL con `crypt(...)` escrito a un archivo temporal) — el clasificador de auto-mode NO bloqueó el comando en esta sesión.
- **Primer salto (Step 4):** logueada como cuenta A, se creó la rutina custom "Test Procedencia — 20260909-1442" (un ejercicio, lunes, Abductor en máquina 4x10) y se asignó a la conexión con cuenta B desde `/conexiones/` → "Asignar rutina". Logueada como cuenta B, `/rutinas/` mostró la tarjeta "TEST PROCEDENCIA — 20260909-1442" con el texto exacto:
  > Compartida por: Cuenta Test A E2E

  Sin ningún paréntesis, como se esperaba (un solo salto, `assigned_by_name === original_author_name`). Confirmado también a nivel de base de datos: la copia de B tenía `assigned_by_name = "Cuenta Test A E2E"` y `original_author_name = "Cuenta Test A E2E"` (idénticos).
- **Segundo salto (Step 5):** todavía como cuenta B, en `/conexiones/` el picker de "Asignar rutina" listó la rutina recién recibida ("TEST PROCEDENCIA — 20260909-1442") junto a las demás — confirmado que el picker no filtra rutinas recibidas, por diseño. Se asignó de vuelta a la conexión con cuenta A. Logueada como cuenta A, `/rutinas/` mostró ahora dos tarjetas con ese nombre: la original que A había creado (sin línea "Compartida por") y la nueva copia recibida de B, con el texto exacto:
  > Compartida por: Cuenta Test B E2E (originalmente de Cuenta Test A E2E)

  Esta es la verificación clave de toda la feature: el nombre original (Cuenta Test A E2E) sobrevivió el segundo salto en vez de pisarse con el nombre de quien reasignó (Cuenta Test B E2E). Confirmado a nivel de base de datos: la tercera copia (de vuelta en A) tenía `assigned_by_name = "Cuenta Test B E2E"` y `original_author_name = "Cuenta Test A E2E"` — distintos entre sí, como corresponde.
  Captura de pantalla tomada con Playwright del estado final en `/rutinas/` de cuenta A mostrando ambas tarjetas.
- **Limpieza (Step 6):** se borraron desde `/rutinas/`, con el botón "Eliminar" de cada tarjeta, las tres rutinas de prueba (la original en A, la copia recibida en B, la copia de vuelta en A). Confirmado en base de datos que no queda ninguna fila `routines` con nombre `Test Procedencia%`. Ambas cuentas quedaron con exactamente las rutinas preexistentes que tenían antes de esta ronda (incluida una rutina "Rutina compartida E2E (renombrada por B)" en la cuenta B, dejada de una sesión anterior, no tocada). No hizo falta desconectar las cuentas ni revertir `is_trainer` en ninguna.
- Servidor de desarrollo (`npm run dev`) levantado y apagado limpiamente al terminar; confirmado sin procesos zombie de `astro dev` / `esbuild` antes y después de la corrida.

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): bloquear/advertir al reasignar una rutina recibida, guardar la cadena completa de nombres intermedios (solo se guarda la raíz), sincronizar retroactivamente si alguien cambia su `display_name` después de haber sido citado en una asignación.
