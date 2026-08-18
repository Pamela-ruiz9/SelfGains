# SelfGains

App de fitness que combina tres pilares:

1. **Aprender a entrenar** — guías y planes predefinidos para principiantes.
2. **Construir un mejor yo** — progreso general, hábitos, motivación.
3. **Registro de entrenamientos** — series, reps, peso, progresión, PRs.

Este repo está en construcción por cortes incrementales. El primero cubre la
estructura base del proyecto y el registro de entrenamientos (series, reps,
peso, RPE) con historial simple.

## Stack

- [Astro](https://astro.build) (`output: 'static'`) como framework principal
- [React](https://react.dev) para las islas interactivas (formularios, gráficas)
- TypeScript en todo el proyecto
- [Tailwind CSS](https://tailwindcss.com) para estilos
- [Supabase](https://supabase.com) (Postgres + Auth), llamado directo desde el
  navegador — no hay backend propio
- Biblioteca de ejercicios y planes predefinidos como Astro Content
  Collections (Markdown versionado en el repo)
- [Three.js](https://threejs.org) + [React Three Fiber](https://r3f.docs.pmnd.rs)
  + [drei](https://github.com/pmndrs/drei) para el explorador muscular 3D
- Desplegado en GitHub Pages vía GitHub Actions

## Correr localmente

1. Clona el repo e instala dependencias:

   ```bash
   git clone https://github.com/Pamela-ruiz9/SelfGains.git
   cd SelfGains
   npm install
   ```

2. Crea un proyecto en [Supabase](https://supabase.com), corre
   `supabase/schema.sql` en el SQL Editor del proyecto, y copia la URL y la
   anon key desde Project Settings → API.

3. Copia `.env.example` a `.env` y completa los valores:

   ```
   PUBLIC_SUPABASE_URL=<tu-project-url>
   PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
   ```

4. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre `http://localhost:4321/SelfGains/`.

## Deploy

Cada push a `main` corre `.github/workflows/deploy.yml`, que construye el
sitio y lo publica en GitHub Pages
(`https://Pamela-ruiz9.github.io/SelfGains/`). El workflow necesita las
variables de repositorio `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`
configuradas en Settings → Secrets and variables → Actions → Variables.

## Estado del proyecto

- [x] Estructura base + registro de entrenamientos (auth, log de series,
      historial simple)
- [x] Explorador muscular 3D (`/ejercicios/`) — cuerpo rotable, click en un
      músculo para ver qué ejercicios lo trabajan (detalle en
      `docs/agents/muscle-explorer-3d-status.md`)
- [x] Planes predefinidos que referencien la taxonomía muscular
- [x] Sugerencia de progresión automática (autoregulada por RPE, con deload
      automático — detalle en `docs/agents/progreso-graficas-prs-status.md`)
- [x] Gráficas de progreso y cálculo de PRs (gym y cardio)
- [x] Entrenamiento multi-disciplina (gym, running, natación, combate —
      detalle en `docs/agents/multi-disciplina-status.md`)
- [x] Rutinas: predefinidas o propias, con targets por actividad, CRUD
      completo, adherencia semanal (detalle en `docs/agents/rutinas-status.md`)
- [x] Perfil de usuario: foto, medidas corporales, tema claro/oscuro y color
      de acento personalizable (detalle en
      `docs/agents/perfil-y-personalizacion-status.md`)
- [x] Progreso rediseñado: medidas corporales con historial, resumen y
      filtrado por disciplina (detalle en
      `docs/agents/progreso-graficas-prs-status.md`)
- [x] Nav móvil con barra inferior + UX de registro en vivo (copiar
      entrenamiento anterior, barra de progreso, botones grandes para cardio
      — detalle en `docs/agents/mobile-nav-y-registro-ux-status.md`)
- [x] Logo / favicon / ícono de app (detalle en
      `docs/agents/logo-identidad-status.md`)
- [x] PWA instalable + fluidez de navegación (manifest, service worker,
      transiciones de página — detalle en
      `docs/agents/pwa-instalable-status.md`)
- [x] Logueo offline + sincronización con detección de conflictos (detalle en
      `docs/agents/offline-sync-status.md`)
- [x] Endurecimiento offline: refresco de sesión, cuota de IndexedDB,
      coordinación entre pestañas (detalle en
      `docs/agents/offline-sync-hardening-status.md`)
- [x] Rol de entrenador + conexiones entre usuarios, asignación de rutinas
      (detalle en `docs/agents/rol-entrenador-status.md`)
- [ ] Suite de tests automatizada — toda la verificación hoy es manual vía
      Playwright contra Supabase real (ver
      `docs/agents/notas-de-entorno-y-lecciones.md`)
