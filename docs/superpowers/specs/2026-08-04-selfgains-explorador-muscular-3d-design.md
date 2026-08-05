# SelfGains — Explorador muscular 3D (corte 2)

## Visión

Extiende el pilar "Aprender a entrenar" con una sección donde el usuario explora un cuerpo humano 3D rotable, hace click en un músculo, y ve qué ejercicios (de la biblioteca ya existente) lo trabajan. Es la primera funcionalidad de personalización/exploración por ejercicio del proyecto, construida sobre la biblioteca de ejercicios del corte 1.

## Decisiones de alcance

- **Estilo visual del cuerpo 3D:** figura low-poly geométrica (cápsulas/bloques), no anatomía fotorrealista. Se construye 100% con código (Three.js), sin depender de assets 3D externos ni de licencias de terceros — elegido explícitamente sobre la alternativa de buscar un modelo anatómico realista en la web, cuyo resultado no estaba garantizado.
- **Detalle muscular:** taxonomía de 14 músculos específicos (no los ~7 grupos amplios que ya existían), para que el click sea preciso.
- **Ubicación:** página nueva `/ejercicios/`, con su propio link en el nav.
- **Detalle al seleccionar un músculo:** lista de ejercicios con expandible por ejercicio (equipo + instrucciones, ya existentes en el content collection).
- **Rotación:** libre 360° con mouse/touch (`OrbitControls`), no hay botón frente/espalda separado — rotar cubre ambos lados.

## Stack adicional

- `three`
- `@react-three/fiber` — renderiza la escena Three.js de forma declarativa dentro de React.
- `@react-three/drei` — utilidades sobre r3f, específicamente `OrbitControls`.

Sigue siendo un sitio 100% estático: todo corre en el navegador, sin servidor ni build-time rendering del 3D.

## Modelo de datos

### Taxonomía muscular (código, no content collection)

`src/lib/muscles.ts` exporta una lista fija de 14 músculos (es código, no contenido editable por no-programadores, así que no amerita un content collection):

```ts
export interface Muscle {
  id: string;
  label: string;
}

export const MUSCLES: Muscle[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'dorsales', label: 'Dorsales' },
  { id: 'trapecio', label: 'Trapecio' },
  { id: 'deltoide-frontal', label: 'Deltoide frontal' },
  { id: 'deltoide-lateral', label: 'Deltoide lateral' },
  { id: 'deltoide-posterior', label: 'Deltoide posterior' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebrazo', label: 'Antebrazo' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'gemelos', label: 'Gemelos' },
];
```

### Cambio al schema de ejercicios (`src/content.config.ts`)

El campo `muscleGroup: z.string()` se reemplaza por `muscles: z.array(z.string())` — un ejercicio puede trabajar más de un músculo (ej. `dominadas` → dorsales + bíceps + antebrazo). Esto permite que los 18 ejercicios existentes, re-etiquetados, cubran los 14 músculos sin necesidad de agregar ejercicios nuevos.

Este cambio de schema obliga a re-escribir el frontmatter de los 18 archivos `.md` en `src/content/exercises/` (cambiar `muscleGroup: X` por `muscles: [id1, id2, ...]`).

### Impacto en código existente (corte 1)

- `src/pages/registro/nuevo.astro`: hoy pasa `muscleGroup: e.data.muscleGroup` como prop a `WorkoutLogger`. Se recalcula ahí mismo como un string legible uniendo los labels de `e.data.muscles` vía la taxonomía (`muscles.map(id => muscleLabel(id)).join(', ')`), y se sigue pasando bajo el mismo nombre de prop `muscleGroup` — así `WorkoutLogger.tsx` no requiere ningún cambio.
- Ningún otro archivo del corte 1 lee `muscleGroup` directamente del content collection.

## Componentes

```
src/
├── lib/
│   └── muscles.ts                    # taxonomía de 14 músculos
├── components/react/
│   ├── MuscleBody/
│   │   └── MuscleBody.tsx            # escena 3D (r3f), presentacional
│   └── MuscleExplorer/
│       └── MuscleExplorer.tsx        # estado + MuscleBody + panel de ejercicios
└── pages/
    └── ejercicios/
        └── index.astro               # carga exercises + muscles, monta MuscleExplorer
```

**`MuscleBody.tsx`** — props: `selectedMuscle: string | null`, `onSelectMuscle: (id: string) => void`. Renderiza un `<Canvas>` de r3f con una figura humana armada de formas geométricas simples, una por músculo de la taxonomía, más piezas no interactivas (cabeza, torso base, extremidades base) para que la figura se vea completa. Cada mesh de músculo:

- Cambia de color al hover (acento acid).
- Se mantiene resaltado si `selectedMuscle` coincide con su id.
- Dispara `onSelectMuscle(id)` al click (toggle: click sobre el ya seleccionado lo deselecciona).

`OrbitControls` de `@react-three/drei` habilita rotación libre con mouse/touch y zoom limitado.

**`MuscleExplorer.tsx`** — props: `exercises: ExerciseWithMuscles[]` (id, name, equipment, instructions, muscles). Mantiene `selectedMuscle` en estado, renderiza `MuscleBody` a un lado y, al otro, la lista de ejercicios filtrados por `selectedMuscle` (o un placeholder "selecciona un músculo" si no hay selección). Cada ítem de la lista es expandible (estado local por ítem) mostrando equipo + instrucciones.

**`src/pages/ejercicios/index.astro`** — en build time, `getCollection('exercises')` y mapea a `{id, name, equipment, instructions: entry.body, muscles: entry.data.muscles}`. Pasa esa lista y monta `<MuscleExplorer client:load exercises={...} />`. Se agrega el link "Ejercicios" a `Nav.astro`.

## Manejo de errores

Si WebGL no está disponible en el navegador, `MuscleBody` debe mostrar un mensaje de fallback en vez de un canvas roto o una pantalla en blanco (verificar disponibilidad de WebGL antes de montar el `<Canvas>`, o capturar el error de r3f si el contexto falla al crearse).

## Explícitamente fuera de este corte

- Planes predefinidos que referencien la taxonomía muscular (siguen fuera de alcance, ya lo estaban desde el corte 1).
- Animación del modelo (solo rotación manual por el usuario, sin poses ni animaciones automáticas).
- Uso del campo `videoUrl` del schema de ejercicios (existe desde el corte 1, sigue sin consumirse).
- Filtrado combinado (ej. por músculo + equipo disponible) — solo filtro por músculo seleccionado.

## Testing

Igual que el resto del proyecto: sin suite automatizada, verificación manual. Limitación conocida: no hay navegador headless funcional en este entorno de desarrollo (falta una librería de sistema), así que la implementación no puede autoverificarse visualmente — la revisión del modelo 3D (que rote bien, que los músculos se vean distinguibles, que el click funcione) depende de que el usuario lo pruebe en su propio navegador.
