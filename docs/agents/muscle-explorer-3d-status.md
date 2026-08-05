# Explorador muscular 3D — estado

Página `/ejercicios/`: cuerpo 3D rotable, click en un músculo → lista de ejercicios que lo trabajan. Plan original y spec en `docs/superpowers/plans/2026-08-04-selfgains-explorador-muscular-3d.md` y `docs/superpowers/specs/2026-08-04-selfgains-explorador-muscular-3d-design.md`.

## Completado

**Implementación base (plan original, Tasks 1–6)**
- `src/lib/muscles.ts` — taxonomía de 14 músculos.
- `src/content.config.ts` + los 18 `.md` de `src/content/exercises/` — `muscleGroup: string` → `muscles: string[]`.
- `three` / `@react-three/fiber` / `@react-three/drei` instalados.
- `src/components/react/MuscleBody/MuscleBody.tsx` — escena r3f.
- `src/components/react/MuscleExplorer/MuscleExplorer.tsx` — estado + panel de ejercicios.
- `src/pages/ejercicios/index.astro` + link en `Nav.astro` + fix del label en `registro/nuevo.astro`.

Commits: `7650c7f`, `4993767`, `36e22cb`, `6a1654f`, `0d01a39`, `08433d7`, `bcb715e`, `50fd153`, `1d3a430`.

**Iteración de realismo del cuerpo 3D (post-launch, mismo día)**

El primer resultado se veía como bloques/esferas flotando ("blockman"). Tres pasadas sucesivas, cada una construida sobre la anterior:

1. `6d43134` — mannequin con proporciones humanas: `RoundedBox` en vez de cajas duras, esferas de articulación en hombros/codos/rodillas, sin gaps entre piezas. Seguía leyéndose como partes separadas ("figura de artista", ball-and-socket).
2. `8a6831b` — torso como una sola malla continua (`LatheGeometry`, perfil revuelto de cadera a cuello, achatado en Z) en vez de tres cajas apiladas; brazos/piernas como cilindros que se afinan hacia cada articulación en vez de cápsulas de radio uniforme. Esto fue el salto real de "objetos apilados" a "silueta de un cuerpo".
3. `757a2f3` — los overlays de músculo (pecho, dorsales, trapecio, abdomen, deltoides, bíceps/tríceps, cuádriceps/isquiotibiales) pasaron de cajas planas a elipsoides poco profundos, mayormente hundidos en la piel base, para que se lean como definición muscular y no como placas pegadas. Se agregó tooltip: al hacer hover sobre cualquier músculo aparece su nombre flotando (`Html` de drei), sin necesidad de click.

## Verificación hecha

- `npm run build` limpio después de cada cambio (6 páginas, sin errores de tipos/schema).
- Smoke test con Playwright headless (Chromium vía `npx playwright`) en cada iteración: la página carga, el canvas renderiza, rotación por drag funciona, hover resalta y muestra el tooltip con el nombre correcto, click selecciona/deselecciona y filtra la lista de ejercicios (probado con "Abdomen" → "Plancha abdominal"), sin errores de consola.
- **Nota:** el spec original decía que no había navegador headless disponible en el entorno — sí lo hay (`npx playwright install chromium` funciona), así que las próximas iteraciones ya no dependen de que un humano abra el navegador para verificar lo básico.

## Lo que falta / limitaciones conocidas

- **Checklist manual del plan (Task 7)** — nunca lo corrió un humano en un navegador real. Cosas que el smoke test no cubre bien: sensación del drag táctil en mobile, ver el fallback cuando WebGL está deshabilitado, y una revisión visual subjetiva del modelo (el Playwright headless usa software rendering vía SwiftShader, que es más lento y puede verse ligeramente distinto a un GPU real).
- **Los músculos siguen siendo mallas separadas**, solo mejor camufladas (más hundidas, más redondeadas, mismo tono de color). Si se mira de cerca o desde ciertos ángulos, todavía se nota una costura sutil entre cada overlay y la piel base. La fusión geométrica real (CSG boolean union, ej. `three-bvh-csg`, o un único mesh con regiones pintadas por vértice/UV) no se implementó — es un cambio bastante más grande y no se hizo porque el trade-off complejidad/beneficio no se evaluó con el usuario.
- **Bundle grande:** el chunk de `MuscleExplorer` pesa ~900 KB minificado (three.js + fiber + drei), y `vite` avisa de esto en cada build. No se hizo code-splitting ni se redujo qué se importa de drei.
- Sin suite de tests automatizada (consistente con el resto del proyecto — no es un pendiente nuevo).
- Fuera de alcance explícito desde el spec original, sigue sin tocarse: planes predefinidos que referencien la taxonomía, animación del modelo, consumo de `videoUrl`, filtrado combinado (músculo + equipo).

## Si se retoma

- Correr el checklist manual (Task 7) en un navegador real, especialmente mobile touch y el fallback sin WebGL.
- Si la costura entre músculo y piel sigue sin convencer de cerca: evaluar CSG (`three-bvh-csg`) o un mesh único con vertex colors — implica repensar cómo se hace el raycasting por músculo (hoy es un mesh = un músculo = un handler; con geometría fusionada hay que mapear cara/grupo → muscleId).
- Si el tamaño del bundle importa: `manualChunks` en `vite.config` o cargar `MuscleBody` con un import dinámico separado del resto de `MuscleExplorer`.
