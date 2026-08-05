# Explorador muscular 3D — estado

Página `/ejercicios/`: cuerpo 3D rotable, click en un músculo → lista de ejercicios que lo trabajan. Plan original y spec en `docs/superpowers/plans/2026-08-04-selfgains-explorador-muscular-3d.md` y `docs/superpowers/specs/2026-08-04-selfgains-explorador-muscular-3d-design.md`.

## Completado

**Tres músculos nuevos (2026-08-05, mismo día que la fusión CSG)**
- Taxonomía: `oblicuos`, `lumbares`, `aductores` agregados a `src/lib/muscles.ts` (ahora 17 músculos).
- Overlays fusionados vía CSG: oblicuos (par, torso, a los costados del abdomen) y lumbares (torso, espalda baja) se unieron al brush `torso`; aductores (par, cara interna del muslo) se unió al brush `thigh-*`. No hizo falta tocar el sistema de raycasting/hover — solo agregar entradas a `buildFusedRegions()`.
- Ejercicios existentes re-etiquetados (sin crear ejercicios nuevos): `plancha-abdominal` → `+oblicuos`, `peso-muerto` → `+lumbares`, `sentadilla` y `zancadas` → `+aductores`.
- Verificado con Playwright: los 3 músculos nuevos son clickeables y hacen toggle; seleccionar "Aductores" muestra "Sentadilla con barra" y "Zancadas" en la lista.
- **Nota de entorno:** en sesiones largas de Playwright headless con muchos clicks seguidos (~400+), el browser terminó cerrándose solo (memoria limitada, ~5.7 GB total en esta VM) — no es un bug de la app, es un límite de la sesión de testing. Conviene buscar con early-stop (cortar en cuanto se encuentra el músculo) en vez de barridos exhaustivos que recorran todo el canvas.

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

**Pose más abierta + fusión geométrica real (2026-08-05)**

- Brazos y piernas ahora cuelgan en A-pose (tilt de ~14° en brazos, ~8° en piernas alrededor del eje Z, aplicado con un nuevo campo `rotation` en los part defs; `mirror()` invierte el signo del ángulo para el lado izquierdo).
- **La costura músculo/piel se resolvió de verdad**, no solo se camufló: se agregó `three-bvh-csg` (`Brush`/`Evaluator`/`ADDITION`) y torso, hombros, brazos y muslos ahora son una única malla fusionada por boolean union (7 `FusedRegion` en `buildFusedRegions()`), en vez de mallas superpuestas. Antebrazo/gemelos siguen siendo mallas propias (ya eran el límite del miembro, sin piel separada debajo).
- Cada músculo fusionado conserva su propio `MeshStandardMaterial` etiquetado con `userData.muscleId` + `userData.labelPosition`; el evaluador de CSG preserva esto como grupos de geometría (uno por material de origen). Hover/click resuelven el músculo golpeado buscando en qué grupo cae `event.faceIndex` (`resolveFusedHit`), ya no hay un mesh-por-músculo con su propio handler.
- Tres hallazgos no obvios durante la implementación, documentados para no repetirlos:
  - El perfil del torso (`LatheGeometry`) no es watertight (radios de los extremos ≠ 0) — hubo que taparlo con dos discos (`CircleGeometry` + `mergeGeometries` + `mergeVertices`) antes de usarlo como brush, si no el CSG cerca de esos bordes producía geometría degenerada.
  - `CapsuleGeometry` como overlay de músculo producía picos/triángulos degenerados en la unión con el cilindro base (bíceps/tríceps/cuádriceps/isquiotibiales) — se cambió a elipsoides (esfera unitaria + `scale` no uniforme), el mismo patrón que ya usaban pecho/dorsales/etc., y el problema desapareció.
  - `three-bvh-csg` requiere `three-mesh-bvh@>=0.9.7`, pero `@react-three/drei` fija `^0.8.3` — se resolvió con `"overrides": { "three-mesh-bvh": "^0.9.14" }` en `package.json` (instalado con `--legacy-peer-deps`). `three` se subió de `^0.170.0` a `^0.180.0` (requisito de `three-bvh-csg>=0.179.0`); fiber/drei ya aceptaban `>=0.156`/`>=0.159`, sin cambios de código necesarios.
- Verificado con Playwright headless: barridos de clicks sistemáticos (front + back + laterales, con rotación de cámara calibrada correctamente — ver nota abajo) confirmaron que los 14 músculos seleccionan bien y hacen toggle; hover muestra el tooltip correcto; `npm run build` limpio.
- **Nota para quien depure interacción con `OrbitControls` vía Playwright:** la velocidad de rotación se escala por `element.clientHeight`, no por el ancho — un drag de medio alto de canvas ≈ 180°. Asumir "ancho completo = 360°" lleva a probar el ángulo equivocado (pasé un buen rato pensando que había un bug de raycasting cuando en realidad estaba viendo casi el mismo frente, no la espalda).

## Lo que falta / limitaciones conocidas

- **Checklist manual del plan (Task 7)** — nunca lo corrió un humano en un navegador real. Cosas que el smoke test no cubre bien: sensación del drag táctil en mobile, ver el fallback cuando WebGL está deshabilitado, y una revisión visual subjetiva del modelo.
- **Micro caso límite de raycasting:** en el borde exacto donde dos regiones fusionadas *distintas* se tocan sin estar unionadas entre sí (ej. el borde superior de "pecho", muy cerca de la esfera de "shoulder-right"), un click justo en esa línea puede no togglear el músculo (el rayo resuelve al mesh vecino en vez de al bump). Clickeando el centro de cualquier bump (no su borde extremo) es 100% confiable — confirmado con barridos repetidos en los 14 músculos.
- **Bundle más grande:** el chunk de `MuscleExplorer` pasó de ~900 KB a ~1.03 MB minificado (three.js + fiber + drei + three-bvh-csg + three-mesh-bvh), y `vite` sigue avisando de esto en cada build. No se hizo code-splitting.
- Sin suite de tests automatizada (consistente con el resto del proyecto — no es un pendiente nuevo).
- Fuera de alcance explícito desde el spec original, sigue sin tocarse: planes predefinidos que referencien la taxonomía, animación del modelo, consumo de `videoUrl`, filtrado combinado (músculo + equipo).

## Si se retoma

- Correr el checklist manual (Task 7) en un navegador real, especialmente mobile touch y el fallback sin WebGL.
- Si el tamaño del bundle importa: `manualChunks` en `vite.config` o cargar `MuscleBody` con un import dinámico separado del resto de `MuscleExplorer`.
- Si el micro caso límite del borde entre regiones molesta: unir hombro+brazo (o hombro+torso) en un solo `buildFusedRegion` en vez de dos brushes separados que solo se tocan visualmente.
