# Imágenes de ejercicios — diseño

Pedido de Pam: agregar una imagen (idealmente animada) a cada ejercicio del catálogo. Durante el brainstorm se acotó a imágenes estáticas por peso, y se descartó explícitamente sumar soporte bilingüe (ES/EN) a esta ronda — eso queda como un brainstorm propio a futuro, sin relación con esta feature.

## Alcance

Los **52 ejercicios de gym** (`discipline: gym`, `metricType: sets` en `src/content/activities/`) — son los únicos que hoy aparecen en el explorador muscular y tienen un movimiento único fotografiable. Los 34 de running/natación/combate quedan fuera: son clases/sesiones, no un movimiento puntual, y la fuente de imágenes elegida tampoco los cubre.

## Fuente de las imágenes

[`free-exercise-db`](https://github.com/yuhonas/free-exercise-db) (dominio público, confirmado por búsqueda durante el brainstorm) — dataset de ~800 ejercicios en inglés con imágenes estáticas. Se descargan y guardan copias en este repo (no se hotlinkea a GitHub en runtime): cero dependencia externa, cero riesgo de derechos, funciona offline. Verificar el archivo `LICENSE` del dataset al momento de bajar las imágenes, como chequeo de seguridad antes de commitear cualquier archivo.

Se descarta wger.de (requiere atribución por imagen, CC-BY-SA) y las APIs pagas con GIFs (ExerciseDB/WorkoutX — dependencia externa con límite de uso gratuito) por agregar complejidad que esta ronda no necesita.

## Formato y almacenamiento

- Cada imagen se preprocesa **una sola vez**, al curarla (no en cada build de Astro): redimensionada a ~480px de ancho, convertida a WebP.
- Se guardan en `public/exercises/<id>.webp`, donde `<id>` es el mismo que usa Astro Content Collections para cada archivo (el nombre del `.md` sin extensión — ej. `abductor-maquina.md` → `public/exercises/abductor-maquina.webp`).
- Si el dataset trae varias fotos por ejercicio (posición inicial/final), se usa una sola — la que mejor muestre la forma completa del movimiento, a criterio de quien cura.

## Schema (`src/content.config.ts`)

Nuevo campo opcional en la variante `sets` (gym) del discriminated union:

```ts
image: z.string().optional(), // nombre de archivo en public/exercises/, ej. "abductor-maquina.webp"
```

No se toca la variante `session` (running/natación/combate) — no está en alcance. El campo `videoUrl` que ya existe (sin usar en ningún lado del código, confirmado por grep durante el brainstorm) queda intacto — es un placeholder de otra idea (video real) que no se reutiliza ni se borra en esta ronda, para no mezclar conceptos.

## Dónde se muestra

En los dos lugares que ya muestran la descripción de un ejercicio:

1. **`MuscleExplorer.tsx`** (pantalla Ejercicios) — dentro de la tarjeta expandible de cada ejercicio, arriba del texto de equipo/instrucciones.
2. **`WorkoutLogger.tsx`** (pantalla Registrar) — en la tarjeta del ejercicio activo, arriba de la descripción.

Tratamiento visual (consistente con la dirección "brutal-glass" ya aplicada a toda la app): `rounded-card`, `object-cover`, relación de aspecto fija (`aspect-video`) para que no salte el layout mientras carga, `loading="lazy"`, `alt` con el nombre del ejercicio (accesibilidad). Si un ejercicio no tiene `image` todavía, la tarjeta se ve exactamente igual que hoy — sin hueco reservado ni ícono roto.

`getCollection('activities')` ya se llama server-side en `src/pages/ejercicios/index.astro` y en el componente que arma la lista de `ActivityOption` para `WorkoutLogger` — el campo `image` se agrega a esos mapeos existentes (`ExerciseWithMuscles`, `ActivityOption`) como un string opcional más, igual que `equipment`/`description` hoy. La URL final se arma como `` `${import.meta.env.BASE_URL}exercises/${image}` ``, mismo patrón que ya usa el resto de la app para assets de `public/` (confirmado en `Nav.astro`/`BaseLayout.astro`).

## Curación de las 52 imágenes

Para cada uno de los 52 ejercicios: buscar en el índice de `free-exercise-db` (nombre + equipo + músculo, traduciendo el criterio ya que el dataset está en inglés) la entrada que mejor represente el mismo movimiento, descargar su imagen, preprocesarla y guardarla con el `id` correspondiente.

Cada match se registra con un nivel de confianza en `docs/agents/imagenes-ejercicios-curacion.md` (uno de: **match directo** — mismo ejercicio, mismo equipo; **match aproximado** — mismo movimiento/músculo, equipo o variante distinta; **sin match razonable** — no se agrega imagen, el ejercicio queda sin `image` en esta ronda). Los matches que no sean "directo" se listan explícitamente al final para que Pam los revise antes de darlos por buenos — una imagen mal emparejada podría mostrar la forma incorrecta de un ejercicio, así que no se asume automáticamente que "algo parecido" es suficiente.

## Qué NO cambia

- Los 34 ejercicios de running/natación/combate — sin imagen en esta ronda.
- El campo `videoUrl` — sigue sin usarse, no se toca.
- Ninguna lógica de negocio, RLS, ni estructura de rutinas/registro de entrenamientos.
- Soporte bilingüe — explícitamente fuera de esta ronda, es su propio brainstorm futuro.

## Verificación

Sin suite automatizada, por convención del proyecto. `npm run build && npx tsc --noEmit` limpios. Recorrido visual con Playwright: Ejercicios (varios músculos, confirmar que las tarjetas con imagen se ven bien y las sin imagen no tienen hueco), Registrar (activar un ejercicio con imagen y uno sin ella). Confirmar en el reporte final de curación cuántos de los 52 quedaron con match directo vs. aproximado vs. sin imagen, para que Pam los revise antes de mergear.
