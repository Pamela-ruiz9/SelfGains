# Integración con Fitbit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la cuenta de Fitbit del usuario y mostrar pasos/sueño/actividad diaria (FC en reposo, calorías, minutos activos) en Progreso, sin guardar ningún token en el navegador ni en una tabla legible por el cliente.

**Architecture:** Primera pieza de este proyecto con código server-side propio: una Supabase Edge Function (`supabase/functions/fitbit`) que hace todo el trabajo sensible (intercambio de código→tokens, refresh, y las llamadas a la API de Fitbit) — el cliente nunca ve un token de Fitbit, solo llama a la función con su sesión de Supabase normal. Una tabla nueva (`fitbit_connections`) guarda el `refresh_token` con columnas bloqueadas para lectura desde el cliente.

**Tech Stack:** Supabase Edge Function (Deno, `jsr:@supabase/supabase-js@2`), la tabla/RLS de siempre, Astro+React para la UI. Sin librería de OAuth — son 2 llamadas HTTP simples (`POST /oauth2/token`, `GET` a los endpoints de series de tiempo de Fitbit).

**Spec:** `docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md`, sección 6.

**Depende de:** `docs/superpowers/plans/2026-09-26-progreso-dashboard-ux.md` ya mergeado a `main` — el Task 7 de ese plan (`ProgressSummaryStrip`) se modifica acá para agregar el tile de pasos, y ese componente tiene que existir primero.

---

## Antes de empezar

Ejecutar en un worktree aislado (`superpowers:using-git-worktrees`) creado **desde `main` después de mergear el plan de UX** — rama sugerida `fitbit-integracion`. El CLI de Supabase (`supabase`, v2.110 confirmado instalado) ya está logueado y linkeado a este proyecto.

---

### Task 1 (manual, hacerla primero — no bloquea el resto del código): Registrar la app en Google Cloud (Google Health API)

**Actualizado 2026-09-26** — Fitbit discontinuó su Web API clásica el mismo día que se escribió este plan; el registro en dev.fitbit.com ya está cerrado. Se reemplaza por la nueva Google Health API (ver spec sección 6.5). Este task lo hace Pam directamente, en paralelo mientras el resto de los tasks de código avanzan — ningún otro task depende de tener las credenciales reales para *escribir* el código, solo para *probarlo* de punta a punta (Task 9).

- [ ] **Step 1:** Ir a https://console.cloud.google.com/, crear un proyecto nuevo (o usar uno existente) para SelfGains.
- [ ] **Step 2:** Habilitar la Google Health API para ese proyecto (buscar "Google Health API" en la biblioteca de APIs de la consola y habilitarla), y crear un OAuth 2.0 Client ID:
  - Tipo de aplicación: **Web application** (server).
  - **Authorized redirect URIs**, agregar **dos** líneas:
    - `https://Pamela-ruiz9.github.io/SelfGains/fitbit-callback/` (producción)
    - `http://localhost:4321/SelfGains/fitbit-callback/` (para probar local con `astro preview`, puerto 4321 por defecto — confirmar el puerto real que muestra la consola y ajustar si es distinto)
  - Guardar. Copiar el **Client ID** y el **Client Secret**.
- [ ] **Step 3:** En la pantalla de consentimiento OAuth ("OAuth consent screen" / "Audience"), agregar los scopes de Google Health que hacen falta (buscarlos por nombre en el picker de scopes):
  - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
  - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
  - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
- [ ] **Step 4 (importante, sin esto no funciona):** en la misma pantalla de consentimiento, agregar como **"Test users"** la cuenta de Google real que se va a usar para probar (la tuya, y la de cualquier beta tester como Art). Estos scopes son "Restricted" — sin esto, Google rechaza la autorización. Mientras la app tenga menos de 100 test users no hace falta ningún trámite adicional (no hay que pasar por la revisión de seguridad de terceros que Google exige para apps grandes) — cada usuario nuevo que quiera conectar su salud simplemente se agrega a mano acá.
- [ ] **Step 5:** Pasar el Client ID y el Client Secret al agente — van a hacer falta en el Task 3 (secret de la Edge Function) y en el Task 6 (variable de entorno del build).

---

### Task 2: Migración — tabla `fitbit_connections`

**Files:**
- Modify: `supabase/schema.sql` (agregar al final)

- [ ] **Step 1: Agregar la tabla, RLS y grants a `supabase/schema.sql`**

```sql
-- Integración Fitbit (docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md
-- sección 6). refresh_token nunca debe poder leerse desde el cliente — ni
-- siquiera de la fila propia. Solo la Edge Function (service_role, bypassea
-- RLS/grants) inserta/actualiza/lee esa columna.
create table fitbit_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fitbit_user_id text not null,
  refresh_token text not null,
  scope text not null,
  connected_at timestamptz not null default now()
);

alter table fitbit_connections enable row level security;

create policy "Users can see their own connection" on fitbit_connections
  for select using (auth.uid() = user_id);
create policy "Users can disconnect their own account" on fitbit_connections
  for delete using (auth.uid() = user_id);

-- Mismo patrón que connection_requests/routine_shares: un revoke de tabla
-- completa + grant de columnas puntuales, porque un revoke de una sola
-- columna no alcanza contra el grant de tabla completa que Supabase ya le
-- da a `authenticated` por defecto.
revoke select, insert, update on fitbit_connections from authenticated;
grant select (user_id, fitbit_user_id, scope, connected_at) on fitbit_connections to authenticated;
```

- [ ] **Step 2: Correr la migración contra la base real**

```bash
cat > /tmp/fitbit-connections-migration.sql <<'EOF'
create table fitbit_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fitbit_user_id text not null,
  refresh_token text not null,
  scope text not null,
  connected_at timestamptz not null default now()
);

alter table fitbit_connections enable row level security;

create policy "Users can see their own connection" on fitbit_connections
  for select using (auth.uid() = user_id);
create policy "Users can disconnect their own account" on fitbit_connections
  for delete using (auth.uid() = user_id);

revoke select, insert, update on fitbit_connections from authenticated;
grant select (user_id, fitbit_user_id, scope, connected_at) on fitbit_connections to authenticated;
EOF
supabase db query --linked --file /tmp/fitbit-connections-migration.sql
rm /tmp/fitbit-connections-migration.sql
```

Expected: sin errores. Si `db query` no existe en esta versión del CLI, correr `supabase db --help` y usar el subcomando equivalente (mismo comentario que en el plan de UX, Task 2).

- [ ] **Step 3: Confirmar desde el cliente que un usuario NO puede leer `refresh_token`**

```bash
cat > /tmp/verify-fitbit-grants.sql <<'EOF'
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'fitbit_connections' and grantee = 'authenticated';
EOF
supabase db query --linked --file /tmp/verify-fitbit-grants.sql
rm /tmp/verify-fitbit-grants.sql
```

Expected: solo filas para `user_id`, `fitbit_user_id`, `scope`, `connected_at` — ninguna fila con `column_name = 'refresh_token'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): tabla fitbit_connections con refresh_token bloqueado para el cliente"
```

---

### Task 3: Edge Function `fitbit` — intercambio y refresh de tokens

**Actualizado 2026-09-26 (ver spec sección 6.5):** el código de esta task ya se implementó y deployó una vez contra la Fitbit Web API clásica (`api.fitbit.com`), pero esa API se discontinuó el mismo día — hay que reescribir el intercambio/refresh de tokens y las llamadas de datos contra la **Google Health API** en su lugar. Los pasos de abajo (scaffold, secrets, deploy, commit) siguen siendo los mismos; lo que cambia es el contenido real de `index.ts`:

- **Token exchange/refresh:** endpoints estándar de Google OAuth 2.0 — `https://accounts.google.com/o/oauth2/v2/auth` (autorización, usado del lado del cliente en el Task 4) y `https://oauth2.googleapis.com/token` (intercambio y refresh, usado acá). El intercambio inicial necesita `grant_type=authorization_code`; el refresh, `grant_type=refresh_token`. A diferencia de Fitbit, Google **no garantiza devolver un `refresh_token` en cada refresh** (solo Fitbit rotaba en cada llamada) — conservar el `refresh_token` ya guardado si la respuesta del refresh no trae uno nuevo, actualizar solo si viene.
- **Datos:** base `https://health.googleapis.com`, patrón `POST /v4/users/{userId}/dataTypes/{dataType}/dataPoints:dailyRollUp` con un `windowSize` de 1 día, una llamada por `dataType` (`steps`, `sleep`, `daily-resting-heart-rate`, `active-energy-burned`, `active-zone-minutes`) en vez de las 2 llamadas de Fitbit (`activities`/`sleep`). El **formato exacto de la respuesta JSON no está confirmado** (documentación de Google todavía incompleta el día de la migración) — implementar el parseo de forma defensiva (nunca asumir una key sin chequear su tipo, igual que ya hace el código actual con `typeof summary.steps === 'number'`) y esperar tener que ajustar el mapeo exacto una vez que el Task 9 (verificación con una cuenta real) revele la forma real de la respuesta.
- **Scopes:** `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`, `https://www.googleapis.com/auth/googlehealth.sleep.readonly`, `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly` (usados del lado del cliente en el Task 4, no acá).
- Los nombres `FITBIT_CLIENT_ID`/`FITBIT_CLIENT_SECRET` (secrets) y `fitbit_connections` (tabla) se mantienen tal cual por ahora, aunque técnicamente ya no son de Fitbit — evita otra migración/rename innecesario; es un detalle interno, no visible para el usuario.

**Files:**
- Create: `supabase/functions/fitbit/index.ts`

- [ ] **Step 1: Scaffoldear la función con el CLI**

```bash
supabase functions new fitbit
```

Esto crea `supabase/functions/fitbit/index.ts` con un handler de ejemplo (y, si no existía, `supabase/config.toml`) — confirmar con `git status` qué archivos aparecieron antes de seguir, y commitear `supabase/config.toml` si es nuevo.

- [ ] **Step 2: Reemplazar el contenido de `supabase/functions/fitbit/index.ts`**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

// Intercambia el `code` de la redirección de Fitbit por tokens y guarda el
// refresh_token — nunca el access_token, que es de corta duración y se
// vuelve a pedir en cada llamada de "data" vía refresh.
async function handleConnect(
  body: { code: string; redirectUri: string },
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string
): Promise<Response> {
  const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=authorization_code&code=${encodeURIComponent(body.code)}&redirect_uri=${encodeURIComponent(body.redirectUri)}&client_id=${clientId}`,
  });

  if (!tokenRes.ok) {
    console.error('fitbit connect exchange failed', await tokenRes.text());
    return jsonResponse({ error: 'exchange_failed' }, 400);
  }

  const tokens = await tokenRes.json();
  const { error } = await supabaseAdmin.from('fitbit_connections').upsert(
    {
      user_id: userId,
      fitbit_user_id: tokens.user_id,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('fitbit connect upsert failed', error);
    return jsonResponse({ error: 'save_failed' }, 500);
  }

  return jsonResponse({ success: true });
}

// Refresca el access_token (rota el refresh_token en cada llamada — Fitbit
// invalida el anterior, así que hay que persistir el nuevo cada vez) y trae
// el resumen de actividad + sueño de una fecha. Nunca devuelve ningún token
// al cliente.
async function handleData(
  body: { date: string },
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string
): Promise<Response> {
  const { data: connection } = await supabaseAdmin
    .from('fitbit_connections')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (!connection) {
    return jsonResponse({ error: 'not_connected' }, 404);
  }

  const refreshRes = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(connection.refresh_token as string)}`,
  });

  if (!refreshRes.ok) {
    // Token revocado desde la app de Fitbit, o vencido más allá de lo
    // recuperable — se interpreta como desconectado (ver spec sección 6.4).
    await supabaseAdmin.from('fitbit_connections').delete().eq('user_id', userId);
    return jsonResponse({ error: 'disconnected' }, 401);
  }

  const tokens = await refreshRes.json();
  await supabaseAdmin
    .from('fitbit_connections')
    .update({ refresh_token: tokens.refresh_token })
    .eq('user_id', userId);

  const fitbitHeaders = { Authorization: `Bearer ${tokens.access_token}` };
  const [activityRes, sleepRes] = await Promise.all([
    fetch(`https://api.fitbit.com/1/user/-/activities/date/${body.date}.json`, { headers: fitbitHeaders }),
    fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${body.date}.json`, { headers: fitbitHeaders }),
  ]);

  if (!activityRes.ok || !sleepRes.ok) {
    console.error('fitbit data request failed', activityRes.status, sleepRes.status);
    return jsonResponse({ error: 'fitbit_request_failed' }, 502);
  }

  const activity = await activityRes.json();
  const sleep = await sleepRes.json();
  const summary = activity.summary ?? {};
  const sleepEntries = Array.isArray(sleep.sleep) ? sleep.sleep : [];
  const totalSleepMinutes = sleepEntries.reduce(
    (sum: number, s: { minutesAsleep?: number }) => sum + (s.minutesAsleep ?? 0),
    0
  );

  return jsonResponse({
    steps: typeof summary.steps === 'number' ? summary.steps : null,
    restingHeartRate: typeof summary.restingHeartRate === 'number' ? summary.restingHeartRate : null,
    caloriesOut: typeof summary.caloriesOut === 'number' ? summary.caloriesOut : null,
    activeMinutes:
      typeof summary.fairlyActiveMinutes === 'number' && typeof summary.veryActiveMinutes === 'number'
        ? summary.fairlyActiveMinutes + summary.veryActiveMinutes
        : null,
    sleepMinutes: totalSleepMinutes > 0 ? totalSleepMinutes : null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const fitbitClientId = Deno.env.get('FITBIT_CLIENT_ID')!;
  const fitbitClientSecret = Deno.env.get('FITBIT_CLIENT_SECRET')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const supabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) {
    return jsonResponse({ error: 'invalid_session' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    if (body.action === 'connect') {
      return await handleConnect(body, userData.user.id, supabaseAdmin, fitbitClientId, fitbitClientSecret);
    }
    if (body.action === 'data') {
      return await handleData(body, userData.user.id, supabaseAdmin, fitbitClientId, fitbitClientSecret);
    }
    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('fitbit function error', err);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});
```

- [ ] **Step 3: Configurar los secrets de la función**

`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase automáticamente en toda Edge Function — solo hacen falta los dos de Fitbit (usar el Client ID/Secret reales del Task 1; los valores de abajo son placeholders):

```bash
supabase secrets set FITBIT_CLIENT_ID=<client-id-de-dev.fitbit.com>
supabase secrets set FITBIT_CLIENT_SECRET=<client-secret-de-dev.fitbit.com>
```

(`secrets set` opera sobre el proyecto ya linkeado — no acepta un flag `--linked`; si hiciera falta apuntar a otro proyecto explícitamente, es `--project-ref <ref>`, confirmado con `supabase secrets set --help`.)

- [ ] **Step 4: Deployar la función**

```bash
supabase functions deploy fitbit
```

(Mismo caso: `functions deploy` también opera sobre el proyecto linkeado por defecto, sin flag `--linked`.)

Expected: deploy exitoso. `supabase functions list` ahora muestra `fitbit`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/fitbit supabase/config.toml
git commit -m "feat(fitbit): Edge Function para intercambio/refresh de tokens y datos diarios"
```

(Ajustar qué archivos exactos agregar según lo que `supabase functions new` haya generado — puede incluir un `deno.json`/`.npmrc` dentro de `supabase/functions/fitbit/` que también hay que commitear.)

---

### Task 4: `src/lib/fitbit.ts` — cliente delgado

**Actualizado 2026-09-26 (ver spec sección 6.5):** esta task ya se implementó contra Fitbit; casi todo se mantiene igual (`consumeFitbitOAuthState`, `connectFitbit`, `getFitbitConnectionStatus`, `disconnectFitbit`, `getFitbitDailyData` no cambian — siguen llamando a la misma Edge Function/tabla). Lo único que cambia es **`buildFitbitAuthorizeUrl`**, que ahora arma la URL de autorización de Google en vez de la de Fitbit:

- Base: `https://accounts.google.com/o/oauth2/v2/auth` (en vez de `https://www.fitbit.com/oauth2/authorize`).
- `scope` pasa a ser los 3 scopes de Google separados por espacio: `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.sleep.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly` (reemplaza la constante `FITBIT_SCOPE`).
- Agregar dos parámetros nuevos, obligatorios para que Google devuelva un `refresh_token` utilizable: `access_type=offline` y `prompt=consent`.
- El resto de la función (generar y guardar el `state` en `sessionStorage`, devolver la URL armada) no cambia.

**Files:**
- Create: `src/lib/fitbit.ts`

- [ ] **Step 1: Implementar**

```ts
import { supabase } from './supabase';

export interface FitbitConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
}

export interface FitbitDailyData {
  steps: number | null;
  restingHeartRate: number | null;
  caloriesOut: number | null;
  activeMinutes: number | null;
  sleepMinutes: number | null;
}

const FITBIT_SCOPE = 'activity sleep heartrate';
const OAUTH_STATE_KEY = 'selfgains-fitbit-oauth-state';

export function fitbitRedirectUri(base: string): string {
  return `${window.location.origin}${base}fitbit-callback/`;
}

// Guarda un `state` random en sessionStorage (protección CSRF estándar de
// OAuth) y devuelve la URL de autorización de Fitbit lista para redirigir.
export function buildFitbitAuthorizeUrl(clientId: string, base: string): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: fitbitRedirectUri(base),
    scope: FITBIT_SCOPE,
    state,
  });
  return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
}

// Compara el `state` devuelto por Fitbit contra el que se guardó antes de
// redirigir — si no coincide (o no había ninguno guardado), es una
// respuesta que no vino de un flujo iniciado por esta app.
export function consumeFitbitOAuthState(returnedState: string | null): boolean {
  const saved = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return saved !== null && saved === returnedState;
}

export async function connectFitbit(code: string, base: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('fitbit', {
    body: { action: 'connect', code, redirectUri: fitbitRedirectUri(base) },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function getFitbitConnectionStatus(): Promise<FitbitConnectionStatus> {
  const { data, error } = await supabase
    .from('fitbit_connections')
    .select('connected_at')
    .maybeSingle();
  if (error) throw error;
  return { connected: data !== null, connectedAt: data?.connected_at ?? null };
}

export async function disconnectFitbit(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');
  const { error } = await supabase.from('fitbit_connections').delete().eq('user_id', user.id);
  if (error) throw error;
}

// Devuelve null si no hay cuenta conectada o si Fitbit no tiene datos para
// esa fecha (nunca lanza en esos dos casos — sí lanza en errores reales,
// como falla de red).
export async function getFitbitDailyData(date: string): Promise<FitbitDailyData | null> {
  const { data, error } = await supabase.functions.invoke('fitbit', {
    body: { action: 'data', date },
  });
  if (error) throw error;
  if (data?.error === 'not_connected' || data?.error === 'disconnected') return null;
  if (data?.error) throw new Error(data.error);
  return data as FitbitDailyData;
}
```

- [ ] **Step 2: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio (todavía nada lo importa — se conecta en los próximos tasks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/fitbit.ts
git commit -m "feat(fitbit): cliente delgado (OAuth, status, disconnect, datos diarios)"
```

---

### Task 5: Variable de entorno `PUBLIC_FITBIT_CLIENT_ID`

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: `.env.example`**

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_FITBIT_CLIENT_ID=
```

- [ ] **Step 2: `.github/workflows/deploy.yml`**

En el step `npm run build`, agregar la variable nueva junto a las dos que ya existen:

```yaml
      - run: npm run build
        env:
          PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}
          PUBLIC_FITBIT_CLIENT_ID: ${{ vars.PUBLIC_FITBIT_CLIENT_ID }}
```

- [ ] **Step 3 (manual, Pam): agregar el valor real en dos lugares**

1. En el `.env` local (no versionado): agregar la línea `PUBLIC_FITBIT_CLIENT_ID=<el-client-id-del-Task-1>`.
2. En GitHub: repo → Settings → Secrets and variables → Actions → pestaña **Variables** → New repository variable → `PUBLIC_FITBIT_CLIENT_ID` = el mismo Client ID (es público, por eso va como `vars`, no `secrets`, igual que `PUBLIC_SUPABASE_URL`).

- [ ] **Step 4: Commit**

```bash
git add .env.example .github/workflows/deploy.yml
git commit -m "chore(fitbit): variable de entorno PUBLIC_FITBIT_CLIENT_ID"
```

---

### Task 6: Página de callback

**Files:**
- Create: `src/pages/fitbit-callback.astro`

- [ ] **Step 1: Implementar**

Página neutral, sin layout de nav/tema — solo procesa el `code` y redirige. Deliberadamente **no** usa `BaseLayout` (evita el script de redirect de idioma, que pisaría el query string antes de poder leerlo — ver spec sección 6.3).

El `<script>` de abajo es un módulo real (sin `is:inline`), con imports de verdad — **no** `define:vars` (esa directiva exige `is:inline`, que a su vez no permite imports relativos reales; un script sin `is:inline` sí los soporta y ya es el patrón que usa este mismo repo en `src/components/astro/Nav.astro:135-157`). `import.meta.env.BASE_URL` funciona igual acá que en cualquier otro módulo del proyecto, sin necesidad de pasarlo desde el frontmatter.

```astro
---
---
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conectando con Fitbit… · SelfGains</title>
  </head>
  <body style="background:#0c0c0a; color:#f4f1e4; font-family: sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
    <p id="status">Conectando con Fitbit…</p>
    <script>
      import { consumeFitbitOAuthState, connectFitbit } from '../lib/fitbit';

      const base = import.meta.env.BASE_URL;
      const statusEl = document.getElementById('status')!;

      function fail(message: string) {
        statusEl.textContent = message;
      }

      function goToPerfil(delayMs: number) {
        let localePreference = 'es';
        try {
          localePreference = localStorage.getItem('selfgains-locale') || 'es';
        } catch {
          // localStorage puede fallar en navegación privada — se queda en 'es'.
        }
        const perfilPath = localePreference === 'en' ? base + 'en/perfil/' : base + 'perfil/';
        setTimeout(() => window.location.replace(perfilPath), delayMs);
      }

      async function run() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const returnedState = params.get('state');
        const errorParam = params.get('error');

        if (errorParam) {
          fail('Fitbit no autorizó la conexión. Volviendo a tu perfil…');
          goToPerfil(2000);
          return;
        }
        if (!code) {
          fail('Falta el código de autorización. Volviendo a tu perfil…');
          goToPerfil(2000);
          return;
        }
        if (!consumeFitbitOAuthState(returnedState)) {
          fail('No se pudo validar la respuesta de Fitbit (state inválido). Volviendo a tu perfil…');
          goToPerfil(2000);
          return;
        }

        try {
          await connectFitbit(code, base);
          statusEl.textContent = '¡Listo! Volviendo a tu perfil…';
        } catch (err) {
          console.error(err);
          fail('No se pudo completar la conexión con Fitbit. Volviendo a tu perfil…');
        } finally {
          goToPerfil(1200);
        }
      }

      run();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio, y `dist/fitbit-callback/index.html` existe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/fitbit-callback.astro
git commit -m "feat(fitbit): página de callback del flujo OAuth"
```

---

### Task 7: Conectar/desconectar Fitbit en Perfil

**Files:**
- Create: `src/components/react/Profile/FitbitConnection.tsx`
- Modify: `src/components/react/Profile/ProfileForm.tsx`
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts` (nuevo namespace `perfil.fitbit`)

- [ ] **Step 1: Traducciones**

En `src/i18n/es.ts`, dentro de `perfil` (junto a `language`/`appearance`):

```ts
    fitbit: {
      label: 'Fitbit',
      connect: 'Conectar con Fitbit',
      connected: 'Conectado a Fitbit',
      disconnect: 'Desconectar',
      disconnecting: 'Desconectando...',
      loadError: 'No se pudo consultar el estado de la conexión con Fitbit.',
      disconnectError: 'No se pudo desconectar Fitbit.',
    },
```

En `src/i18n/en.ts`, mismo lugar:

```ts
    fitbit: {
      label: 'Fitbit',
      connect: 'Connect with Fitbit',
      connected: 'Connected to Fitbit',
      disconnect: 'Disconnect',
      disconnecting: 'Disconnecting...',
      loadError: 'Could not check the Fitbit connection status.',
      disconnectError: 'Could not disconnect Fitbit.',
    },
```

- [ ] **Step 2: `FitbitConnection.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  buildFitbitAuthorizeUrl,
  disconnectFitbit,
  getFitbitConnectionStatus,
} from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  t: Dictionary['perfil']['fitbit'];
}

export default function FitbitConnection({ t }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFitbitConnectionStatus()
      .then((status) => setConnected(status.connected))
      .catch(() => setError(t.loadError));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectFitbit();
      setConnected(false);
    } catch {
      setError(t.disconnectError);
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    const clientId = import.meta.env.PUBLIC_FITBIT_CLIENT_ID;
    const base = import.meta.env.BASE_URL;
    window.location.href = buildFitbitAuthorizeUrl(clientId, base);
  }

  if (connected === null) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.label}</p>
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      {connected ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-paper-dim">{t.connected}</span>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-brutal-sm"
          >
            {disconnecting ? t.disconnecting : t.disconnect}
          </button>
        </div>
      ) : (
        <button type="button" onClick={handleConnect} className="btn-brutal-sm">
          {t.connect}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Conectarlo en `ProfileForm.tsx`**

Import: `import FitbitConnection from './FitbitConnection';`

Insertar el componente justo después del bloque `language` (después de la línea 364, `</div>` que cierra ese bloque, y antes de `<div className="flex flex-col gap-3"><p className="label-brutal text-acid">{t.appearance.label}</p>`):

```tsx
      <FitbitConnection t={t.fitbit} />
```

- [ ] **Step 4: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 5: Verificación manual**

Con la cuenta de prueba: entrar a Perfil, ver el botón "Conectar con Fitbit" (sin conexión previa). No hace falta completar el flujo real todavía (eso es el Task 9, una vez que el Task 1 esté listo) — solo confirmar que el botón aparece y que no rompe el resto del formulario.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Profile/FitbitConnection.tsx src/components/react/Profile/ProfileForm.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(perfil): conectar/desconectar Fitbit"
```

---

### Task 8: Sección "Actividad diaria" en Progreso

**Files:**
- Create: `src/components/react/ProgressList/FitbitActivitySummary.tsx`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`
- Modify: `src/components/react/ProgressList/ProgressSummaryStrip.tsx` (tile de pasos)
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts`

- [ ] **Step 1: Traducciones**

En `src/i18n/es.ts`, namespace nuevo `progreso.fitbitActivity` (junto a `workoutHistory`) y una clave nueva en `progreso.summary` (agregada por el plan de UX, Task 7):

```ts
    fitbitActivity: {
      title: 'Actividad diaria (Fitbit)',
      steps: 'Pasos',
      restingHeartRate: 'FC en reposo',
      calories: 'Calorías',
      activeMinutes: 'Minutos activos',
      sleep: 'Sueño',
      loadError: 'No se pudo traer los datos de Fitbit. Probá de nuevo más tarde.',
      disconnectedError: 'La conexión con Fitbit se perdió — reconectala desde Perfil.',
      empty: 'Fitbit todavía no tiene datos para hoy.',
    },
```

Y en `progreso.summary`, agregar `stepsToday: 'Pasos hoy'` (después de `bodyFat`).

En `src/i18n/en.ts`, mismo lugar:

```ts
    fitbitActivity: {
      title: 'Daily activity (Fitbit)',
      steps: 'Steps',
      restingHeartRate: 'Resting HR',
      calories: 'Calories',
      activeMinutes: 'Active minutes',
      sleep: 'Sleep',
      loadError: "Couldn't fetch Fitbit data. Try again later.",
      disconnectedError: 'The Fitbit connection was lost — reconnect it from Profile.',
      empty: "Fitbit doesn't have data for today yet.",
    },
```

Y en `progreso.summary`: `stepsToday: 'Steps today'`.

- [ ] **Step 2: `FitbitActivitySummary.tsx`**

Cada tile solo se dibuja si el dato correspondiente no es `null` — mismo criterio que el resto del dashboard. `minutesAsleep` viene en minutos, se muestra como "Xh Ym".

```tsx
import type { FitbitDailyData } from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  data: FitbitDailyData;
  t: Dictionary['progreso']['fitbitActivity'];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-brutal flex flex-col gap-1">
      <span className="label-brutal">{label}</span>
      <span className="font-display text-xl text-paper">{value}</span>
    </div>
  );
}

export default function FitbitActivitySummary({ data, t }: Props) {
  const hasAnyData =
    data.steps !== null ||
    data.restingHeartRate !== null ||
    data.caloriesOut !== null ||
    data.activeMinutes !== null ||
    data.sleepMinutes !== null;

  if (!hasAnyData) {
    return <p className="font-mono text-sm text-paper-dim">{t.empty}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.steps !== null && <Tile label={t.steps} value={data.steps.toLocaleString()} />}
      {data.restingHeartRate !== null && (
        <Tile label={t.restingHeartRate} value={`${data.restingHeartRate} bpm`} />
      )}
      {data.caloriesOut !== null && <Tile label={t.calories} value={`${data.caloriesOut} kcal`} />}
      {data.activeMinutes !== null && (
        <Tile label={t.activeMinutes} value={formatMinutes(data.activeMinutes)} />
      )}
      {data.sleepMinutes !== null && <Tile label={t.sleep} value={formatMinutes(data.sleepMinutes)} />}
    </div>
  );
}
```

- [ ] **Step 3: Conectar en `ProgressList.tsx`**

1. Imports nuevos: `FitbitActivitySummary` de `./FitbitActivitySummary`, `{ getFitbitConnectionStatus, getFitbitDailyData, type FitbitDailyData }` de `../../../lib/fitbit`, `{ localDateStr }` de `../../../lib/weekdays`.
2. Nuevo estado: `const [fitbitConnected, setFitbitConnected] = useState(false);`, `const [fitbitData, setFitbitData] = useState<FitbitDailyData | null>(null);`, `const [fitbitError, setFitbitError] = useState<string | null>(null);`.
3. Extender el tipo de `openSection` para incluir `'actividad'`: `const [openSection, setOpenSection] = useState<'medidas' | 'disciplina' | 'entrenamientos' | 'actividad' | null>(null);` y agregar `'actividad'` a la firma de `toggleSection`.
4. Nuevo `useEffect` (después del que ya carga `workouts`/`measurements`), que solo corre si `isLoggedIn`:

```ts
  useEffect(() => {
    if (!isLoggedIn) return;
    getFitbitConnectionStatus()
      .then(async (status) => {
        setFitbitConnected(status.connected);
        if (!status.connected) return;
        try {
          const data = await getFitbitDailyData(localDateStr());
          setFitbitData(data);
        } catch {
          setFitbitError(t.fitbitActivity.loadError);
        }
      })
      .catch(() => {
        // No se pudo ni chequear el estado de conexión — se trata igual
        // que "no conectado", el resto de Progreso sigue funcionando.
      });
  }, [isLoggedIn]);
```

5. Renderizar la 4ta sección, después de la de `Entrenamientos` (dentro del mismo `<div className="flex flex-col gap-6">`), solo si `fitbitConnected`:

```tsx
      {fitbitConnected && (
        <CollapsibleSection
          title={t.fitbitActivity.title}
          open={openSection === 'actividad'}
          onToggle={() => toggleSection('actividad')}
        >
          {fitbitError ? (
            <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{fitbitError}</p>
          ) : fitbitData ? (
            <FitbitActivitySummary data={fitbitData} t={t.fitbitActivity} />
          ) : (
            <p className="font-mono text-sm text-paper-dim">{t.list.loading}</p>
          )}
        </CollapsibleSection>
      )}
```

- [ ] **Step 4: Tile de "Pasos hoy" en `ProgressSummaryStrip`**

En `src/components/react/ProgressList/ProgressSummaryStrip.tsx`, agregar la prop `stepsToday: number | null` a `Props` y renderizar un tile más (después del de `bodyFat`):

```tsx
        {stepsToday !== null && <Tile label={t.stepsToday} value={stepsToday.toLocaleString()} />}
```

(Agregar `stepsToday` a la lista de props desestructuradas de la función también.)

Y en `ProgressList.tsx`, pasarlo desde el `<ProgressSummaryStrip .../>` ya existente (Task 7 del plan de UX):

```tsx
        stepsToday={fitbitData?.steps ?? null}
```

- [ ] **Step 5: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 6: Verificación manual (sin Fitbit conectado todavía)**

Con la cuenta de prueba, sin conexión Fitbit: confirmar que Progreso se ve exactamente igual que antes (ni la sección "Actividad diaria" ni el tile "Pasos hoy" aparecen) — cero regresión para quien no usa Fitbit.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/ProgressList/FitbitActivitySummary.tsx src/components/react/ProgressList/ProgressList.tsx src/components/react/ProgressList/ProgressSummaryStrip.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(progreso): sección de actividad diaria de Fitbit + tile de pasos"
```

---

### Task 9: Verificación end-to-end real con una cuenta de Fitbit

**Requiere que el Task 1 (registro en dev.fitbit.com) y el Task 5 (variables de entorno, incluida la local en `.env`) ya estén completos.**

**Files:** ninguno propio.

- [ ] **Step 1: Build limpio de punta a punta**

Run: `npm run build && npx tsc --noEmit && npm test`
Expected: build de 27 páginas (26 + `fitbit-callback`), único error preexistente de `ProgressList.tsx`, tests en verde.

- [ ] **Step 2: Flujo de conexión completo contra `astro preview`**

Con la cuenta de prueba real logueada en SelfGains y una cuenta de Fitbit real de prueba (puede ser la personal de Pam, o crear una gratis en fitbit.com si prefiere no usar la real):

1. Perfil → "Conectar con Fitbit" → autorizar en la pantalla de Fitbit → confirmar que vuelve a Perfil y ahora muestra "Conectado a Fitbit".
2. Ir a Progreso → confirmar que aparece el tile "Pasos hoy" en la franja de resumen (si Fitbit ya tiene pasos registrados hoy) y la sección "Actividad diaria" con los datos reales.
3. Confirmar en el dashboard de Supabase (Table Editor) que `fitbit_connections` tiene una fila para el usuario de prueba, y que el campo `refresh_token` **no es visible** al consultarlo como usuario `authenticated` desde el SQL Editor con `set role authenticated;` primero (confirma que el grant de columnas funciona).

- [ ] **Step 3: Desconexión**

Perfil → "Desconectar" → confirmar que vuelve a mostrar "Conectar con Fitbit", y que Progreso deja de mostrar la sección/tile de Fitbit en la próxima carga.

- [ ] **Step 4: Simular una desconexión desde el lado de Fitbit**

Desde fitbit.com (configuración de la cuenta → Apps), revocar el acceso de la app SelfGains sin usar el botón "Desconectar" de SelfGains. Volver a abrir Progreso en SelfGains y confirmar que la sección de Fitbit se comporta como "no conectado" (no un error visible sin explicación) — según el diseño, el primer intento de refresh falla, se borra la fila de `fitbit_connections`, y el usuario simplemente no ve la sección hasta que reconecte desde Perfil.

- [ ] **Step 5: Sin cambios de código esperados**

Si algo de lo anterior falla, volver al task correspondiente, corregir, y repetir la verificación — no hay commit propio de este task salvo que haya que arreglar algo.
