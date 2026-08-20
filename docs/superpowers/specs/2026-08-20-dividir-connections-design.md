# Dividir Connections.tsx — diseño

Ítem de deuda técnica de `docs/roadmap-ideas.md` (compilado desde `docs/agents/descubrimiento-conexiones-status.md`): `Connections.tsx` tiene ~690 líneas y seis secciones de UI en un solo archivo — "conviene dividirlo antes de sumarle una séptima". Es un refactor puro, elegido directamente por el usuario sin pregunta de producto abierta.

**Pedido:** dividir el archivo en componentes más chicos, sin cambiar comportamiento, estilos ni flujo de datos.

**Explícitamente fuera de esta ronda:**
- Cualquier cambio de comportamiento, copy, o estilos visuales.
- Fusionar o reordenar las 6 secciones existentes (buscar usuarios vs. solicitudes entrantes se mantienen separadas aunque se solapen temáticamente, tal como están hoy).
- Mover el fetching de datos a los componentes hijos — ver "Enfoque técnico elegido" abajo.

## Enfoque técnico elegido

**Componentes de presentación puros, estado centralizado en el padre.** Las 6 secciones de la UI (más el sub-componente `AssignRoutinePicker` ya existente) pasan a ser componentes que solo reciben props (datos + callbacks) — ninguno hace su propio fetch a Supabase. `Connections.tsx` sigue siendo dueño de absolutamente todo el estado, de `refresh()`, y de los `useEffect` de geolocalización/mapa de entrenadores; solo cambia qué JSX se renderiza (llamadas a los componentes nuevos en vez de markup inline).

La razón de no separar también el estado/data-fetching por sección (una alternativa que se consideró y se descartó explícitamente con el usuario): `refresh()` hoy actualiza a la vez el estado de varias secciones distintas — por ejemplo, aceptar una solicitud entrante (`handleAcceptIncoming`) llama a `refresh()`, que recarga tanto `incomingRequests` como `connections` (entre otras cosas) en una sola pasada. Si cada sección tuviera su propio estado y fetch independiente, aceptar una solicitud en una sección tendría que avisarle a la sección "Mis conexiones" para que también se actualice — o cada sección duplicaría fetches, con riesgo real de mostrar datos desactualizados entre secciones. Mantener el estado centralizado evita ese problema por completo, a costa de que el padre siga siendo relativamente grande (~220-260 líneas estimadas, bajando de ~690) — un tamaño razonable para un componente que solo orquesta estado y ya no compone directamente todo el JSX.

Este es el mismo patrón ya establecido en el proyecto para `RoutineManager.tsx` (dueño del estado) / `RoutineList.tsx` (presentación pura) — no se introduce una convención nueva.

## Archivos

Todos nuevos, en `src/components/react/Connections/` (junto al `Connections.tsx` existente):

- **`InviteLinkCard.tsx`** — sección "Mi link de invitación". Props: `code: string | null`, `copied: boolean`, `onShare: () => void`, `onCopy: () => void`.
- **`RedeemCodeForm.tsx`** — sección "Conectarme con un código". Props: `value: string`, `onChange: (value: string) => void`, `onSubmit: (e: FormEvent) => void`.
- **`UserSearch.tsx`** — sección "Buscar usuarios" (form + lista de resultados). Props: `query: string`, `onQueryChange: (value: string) => void`, `onSubmit: (e: FormEvent) => void`, `results: SearchResult[]`, `searching: boolean`, `hasSearched: boolean`, `onSendRequest: (userId: string) => void`, `onAcceptFromSearch: (userId: string, requestId: string) => void`.
- **`IncomingRequests.tsx`** — sección "Solicitudes de conexión". Props: `requests: IncomingRequest[]`, `onAccept: (requestId: string) => void`, `onReject: (requestId: string) => void`.
- **`TrainerSearch.tsx`** — sección "Buscador de entrenadores" (toggle + radio + mapa + lista). Props: `open: boolean`, `onToggle: (open: boolean) => void`, `center: [number, number] | null`, `onMapMove: (lat: number, lng: number) => void`, `radiusKm: number`, `onRadiusChange: (km: number) => void`, `trainers: VisibleTrainer[]`, `selectedTrainerId: string | null`, `onMarkerClick: (id: string) => void`, `sentRequests: Set<string>`, `onConnect: (userId: string) => void`, `onAcceptRequest: (requestId: string) => void`.
- **`PendingRoutineShares.tsx`** — sección "Rutinas compartidas pendientes". Props: `shares: PendingRoutineShare[]`, `previewShareId: string | null`, `previewDays: RoutineDays | null`, `actingShareId: string | null`, `error: string | null`, `activities: ActivityOption[]`, `onPreview: (share: PendingRoutineShare) => void`, `onAccept: (share: PendingRoutineShare) => void`, `onReject: (shareId: string) => void`.
- **`MyConnectionsList.tsx`** — sección "Mis conexiones". Incluye `AssignRoutinePicker` (se mueve tal cual desde `Connections.tsx`, sin cambios). Props: `connections: ConnectionSummary[]`, `isTrainer: boolean`, `myRoutines: Routine[]`, `onRemove: (connectionId: string) => void`, `onRoutineAssigned: () => void`.

`Connections.tsx` (modificado, no recreado): conserva todo el estado/handlers/effects actuales byte por byte; el único cambio es que el `return (...)` compone los 7 componentes de arriba en vez de tener el markup de cada sección inline.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (único error preexistente esperado en `ProgressList.tsx`).
- Playwright contra la cuenta de prueba real, ejercitando los 6 flujos de la pantalla (generar/copiar/regenerar link; canjear un código; buscar un usuario y conectar; aceptar/rechazar una solicitud entrante; buscar entrenadores cercanos y conectarse; ver/aceptar/rechazar una rutina compartida; asignar una rutina y desvincularse) para confirmar que ningún comportamiento cambió tras el split.
