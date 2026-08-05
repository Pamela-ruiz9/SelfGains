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
- [ ] Planes predefinidos y biblioteca de ejercicios completa
- [ ] Sugerencia de progresión automática
- [ ] Gráficas de progreso y cálculo de PRs
