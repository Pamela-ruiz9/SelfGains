# SelfGains — Estructura base + Registro de entrenamientos (MVP corte 1)

## Visión del proyecto

SelfGains es una app de fitness construida sobre 3 pilares:

1. **Aprender a entrenar** — guías y planes predefinidos para principiantes.
2. **Construir un mejor yo** — progreso general, hábitos, motivación.
3. **Registro de entrenamientos** — series, reps, peso, progresión, PRs.

Este documento cubre el diseño del **primer corte**: la estructura base del proyecto y el registro de entrenamientos (pilar 3). Los pilares 1 y 2 se implementan en cortes posteriores, cada uno con su propio spec.

## Stack técnico

- **Astro** (`output: 'static'`) como framework principal.
- **React** para islas interactivas (formularios, gráficas).
- **TypeScript** en todo el proyecto.
- **Tailwind CSS** para estilos.
- **Supabase** (Postgres + Auth) para datos y usuarios, llamado directo desde el cliente (browser) — no hay backend propio.
- **GitHub Pages** como hosting, con `base: '/SelfGains/'` en `astro.config.mjs`, desplegado vía GitHub Actions en cada push a `main`.

### Por qué este stack

- Astro + islas de React permite moverse rápido con contenido mayormente estático (guías, planes, biblioteca de ejercicios) y solo pagar el costo de JS donde hay interactividad real.
- Supabase evita escribir un backend propio para auth y datos de usuario, sin bloquear una migración futura si se necesita lógica de servidor (se puede añadir un adapter SSR de Astro más adelante sin rehacer el frontend).
- GitHub Pages es gratis y suficiente para un MVP de un solo desarrollador; al ser sitio estático, toda la lógica de datos vive en el cliente hablando con Supabase (protegido por RLS).

## Arquitectura de datos y contenido

### Contenido estático (Astro Content Collections, `src/content/`)

- **`exercises`** — biblioteca de ejercicios: `id`, `name`, `muscleGroup`, `equipment`, `instructions`, `videoUrl?`.
- **`plans`** — planes predefinidos (principiante fuerza/hipertrofia): `id`, `name`, `goal`, `level`, `days[]`, cada día referencia ejercicios de `exercises` con series/reps objetivo. *(Fuera de alcance en el corte 1; el schema se deja preparado pero solo `exercises` se puebla en este corte.)*

Justificación: son datos de referencia que casi no cambian, no son datos de usuario, y se benefician de versionado en git y validación de schema en build time.

### Datos de usuario (Supabase Postgres, con RLS por `user_id`)

- **`workouts`** — sesión registrada: `id`, `user_id`, `date`, `plan_id?` (nullable), `notes?`.
- **`workout_sets`** — serie registrada: `id`, `workout_id`, `exercise_id` (slug del content collection), `set_number`, `reps`, `weight`, `rpe?`.

PRs y gráficas de progreso se calculan derivando de `workout_sets` (no se persisten como tabla aparte). Sugerencia de progresión: lógica en cliente (`src/lib/progression.ts`), comparando el último registro de un ejercicio contra el objetivo del plan. *(Fuera de alcance del corte 1 — se deja el archivo con la función preparada para implementar en el siguiente corte.)*

Auth: Supabase Auth, email/password.

## Estructura de carpetas

```
SelfGains/
├── .github/
│   └── workflows/
│       └── deploy.yml          # build + deploy a GitHub Pages en push a main
├── public/                     # assets estáticos (favicon, etc.)
├── src/
│   ├── content/
│   │   ├── config.ts            # schemas (zod) de las collections
│   │   ├── exercises/           # *.md o *.yaml — biblioteca de ejercicios
│   │   └── plans/                # *.md o *.yaml — planes predefinidos
│   ├── components/
│   │   ├── react/                # islas React interactivas
│   │   │   ├── WorkoutLogger/    # registrar rutina (series/reps/peso/RPE)
│   │   │   ├── ProgressChart/    # gráficas de historial (corte futuro)
│   │   │   └── ProgressionSuggestion/  # (corte futuro)
│   │   └── astro/                # componentes Astro estáticos (layout, cards, nav)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro           # dashboard / inicio
│   │   ├── entrenar/
│   │   │   ├── index.astro       # elegir plan o entrenamiento libre (corte futuro)
│   │   │   └── [planId].astro    # detalle de plan predefinido (corte futuro)
│   │   ├── registro/
│   │   │   └── nuevo.astro       # página que monta <WorkoutLogger />
│   │   ├── progreso/
│   │   │   └── index.astro       # historial (sin gráficas en este corte)
│   │   ├── login.astro
│   │   └── registro-cuenta.astro # signup
│   ├── lib/
│   │   ├── supabase.ts           # cliente Supabase (browser)
│   │   ├── workouts.ts           # funciones CRUD de workouts/sets
│   │   └── progression.ts        # lógica de sugerencia de progresión (corte futuro)
│   ├── types/
│   │   └── db.ts                 # tipos generados/manuales de Supabase
│   └── styles/
│       └── global.css            # Tailwind entrypoint
├── supabase/
│   └── schema.sql                # DDL: tablas, RLS policies
├── astro.config.mjs               # output: 'static', base: '/SelfGains/'
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

`lib/` separa acceso a datos (Supabase) y lógica de negocio (progresión) de la UI. `entrenar/` y `progreso/` reflejan los 3 pilares en la navegación desde el inicio, aunque su contenido se implemente en cortes futuros.

## Alcance del corte 1

**Incluido:**

- Scaffold del proyecto (Astro + React + TS + Tailwind, configurado para GitHub Pages).
- Conexión a Supabase: Auth (email/password), tablas `workouts` + `workout_sets`, RLS policies.
- Content collection `exercises` con un set básico (~15-20 ejercicios comunes).
- Página `registro/nuevo.astro` con la isla `<WorkoutLogger />`: elegir ejercicio de la biblioteca, agregar series (reps, peso, RPE opcional), guardar en Supabase.
- Página simple de historial (`progreso/index.astro`) listando entrenamientos guardados, sin gráficas.
- Login/signup básico.
- Pipeline de deploy a GitHub Pages funcionando de punta a punta.

**Explícitamente fuera de este corte** (quedan para specs futuras):

- Planes predefinidos completos y su navegación (`entrenar/`).
- Sugerencia de progresión automática.
- Gráficas de progreso.
- Cálculo y visualización de PRs.

## Manejo de errores

Validación de formulario en el cliente (reps/peso numéricos y requeridos). Si falla el guardado en Supabase (red, RLS), se muestra un mensaje de error inline y el formulario no se limpia hasta que el guardado sea exitoso, para no perder lo ya ingresado.

## Testing

Para este corte, pruebas manuales guiadas (checklist) al final del plan de implementación. Al ser UI simple y CRUD directo, no se justifica aún una suite automatizada. Se puede introducir Vitest más adelante si la lógica de progresión (corte futuro) se vuelve compleja.
