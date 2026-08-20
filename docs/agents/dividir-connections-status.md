# Dividir Connections.tsx — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — `Connections.tsx` tenía ~690 líneas y seis secciones de UI en un solo archivo. Refactor puro, elegido directamente por el usuario. Proceso: brainstorming (una sola pregunta: qué enfoque de split) → spec (`docs/superpowers/specs/2026-08-20-dividir-connections-design.md`) → plan (`docs/superpowers/plans/2026-08-20-dividir-connections.md`) → implementación con subagent-driven-development, un task por componente.

## Qué se hizo

Se extrajeron 7 componentes de presentación pura (reciben props y callbacks, sin fetch propio) a `src/components/react/Connections/`: `InviteLinkCard`, `RedeemCodeForm`, `UserSearch`, `IncomingRequests`, `TrainerSearch`, `PendingRoutineShares`, `MyConnectionsList` (este último incluye `AssignRoutinePicker`, movido tal cual). `Connections.tsx` sigue siendo dueño de todo el estado, `refresh()`, y los `useEffect` de geolocalización/mapa — solo cambió qué JSX renderiza. `inviteLink()` se movió de una función local a `src/lib/connections.ts` para no duplicarla entre el padre y `InviteLinkCard`.

Mismo patrón que ya usa `RoutineManager.tsx`/`RoutineList.tsx` en este proyecto — no se introdujo una convención nueva.

`Connections.tsx` bajó de ~690 a **375 líneas**. El plan había estimado 220-260 — la estimación quedó corta porque no contempló que el archivo legítimamente sigue dueño de 24 `useState`, 3 `useEffect` y 14 funciones handler (coordinando 7 componentes hijos), no solo el JSX que se movió. Confirmado en la revisión de calidad del último task: el tamaño final es proporcional a lo que un componente orquestador de este alcance necesita retener, sin código muerto ni duplicación.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios después de cada uno de los 7 tasks de extracción (único error preexistente esperado en `ProgressList.tsx`, no relacionado).
- Cada task pasó revisión de spec compliance y de calidad de código independientes, ninguna con issues críticos ni importantes.
- Playwright contra la cuenta de prueba real, ejercitando los 7 flujos de `/conexiones/` (link de invitación —generar, copiar, regenerar—, canjear código inválido, buscar usuarios, solicitudes entrantes, buscador de entrenadores —abrir, cambiar radio, cerrar—, rutinas compartidas pendientes, mis conexiones) para confirmar cero cambios de comportamiento. Sin errores de consola, sin crashes.

## Lo que falta / no cubierto en esta ronda

- Nada de comportamiento cambió — es puramente estructural. La deuda técnica restante de Conexiones (condición de carrera en `acceptRoutineShare`, falta de constraint único en `routine_shares`) sigue en `docs/roadmap-ideas.md`, sin tocar.
