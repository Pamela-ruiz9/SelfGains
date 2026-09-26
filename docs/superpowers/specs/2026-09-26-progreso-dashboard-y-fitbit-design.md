# Progreso como dashboard, gráficas legibles, rutinas con bullets, imagen al crear e integración Fitbit — diseño

Pedido directo de Pam, en 6 puntos (el 6to se agregó a mitad del brainstorm): (1) si hay sesión activa, ir directo a Progreso al abrir la app en vez de mostrar la landing de registro; (2) convertir Progreso en un dashboard visualmente llamativo desde el primer vistazo; (3) las gráficas de progreso de ejercicios (1RM/peso/volumen) confundían a "Art" (usuario de prueba de Pam) por combinar 3 métricas con doble eje; (4) el texto de rutinas en las tarjetas viene todo junto, hay que separarlo por día y ejercicio; (5) mostrar la imagen del ejercicio al armar una rutina; (6) conectar con Fitbit para traer pasos/sueño/actividad.

Todo lo que sigue fue validado con mockups interactivos durante el brainstorm (franja de resumen, gráfica con pills/ejes/tooltip/embellecidos, tarjeta de rutina con bullets + imagen) — las decisiones de esas rondas están incorporadas abajo, no se repiten como "pendiente de decidir".

## 1. Ir directo a Progreso si hay sesión activa

`index.astro` (y su espejo `en/index.astro`) siguen existiendo tal cual para visitantes sin sesión — nada cambia en su contenido. Se agrega un tercer script `is:inline` en el `<head>` de `BaseLayout.astro` (junto a los dos que ya existen: redirect de locale y aplicación de tema pre-paint), gateado a que la ruta actual sea exactamente la home (`base` o `base + 'en/'`):

- Deriva la clave de `localStorage` que usa `@supabase/supabase-js` v2 por defecto (`sb-<ref>-auth-token`, donde `<ref>` sale de `PUBLIC_SUPABASE_URL`) y chequea si existe con un `access_token` no vacío.
- Si existe, redirige síncrono (`location.replace`) a `progreso/` (o `en/progreso/`) **antes** de que se pinte la landing — mismo mecanismo ya usado para evitar el flash de tema/idioma, no uno nuevo.
- Si no existe (o falla el parseo, `try/catch` de por medio), no hace nada — se ve la landing normal.

Esto es una heurística rápida, no la verificación real de sesión (esa la sigue haciendo `ProgressList` con `supabase.auth.getSession()` al cargar Progreso, como ya hace hoy). Si el token guardado está vencido y no se puede refrescar, el usuario simplemente aterriza en Progreso y ve el estado "no has iniciado sesión" con el link a Login que ya existe — no rompe nada, solo pierde el atajo esa vez.

**Riesgo aceptado:** si una futura versión de `@supabase/supabase-js` cambia el formato de esa clave de `localStorage`, este chequeo deja de detectar sesiones en silencio (sin crashear) y todos vuelven a ver la landing hasta navegar manualmente a Progreso. Documentado como nota en el código, no bloqueante.

## 2. Progreso como dashboard

Progreso ya tiene 3 secciones colapsables (Medidas, Disciplina, Entrenamientos), todas cerradas al entrar — eso no cambia. Se agrega una **franja de resumen siempre visible** arriba de esas 3 secciones (mockup aprobado, layout "ring grande a la izquierda + grid de tiles a la derecha"):

- **Ring de adherencia semanal** (izquierda, grande): reusa `weekAdherence()` de `src/lib/adherence.ts` (ya existe, hoy solo se muestra como texto en Rutinas) — `daysTrained`/`daysElapsed` de la semana actual, dibujado como anillo de progreso (SVG `conic-gradient` o `stroke-dasharray`, con el color de acento del usuario).
- **Grid de tiles** (derecha), cada uno solo se dibuja si hay data (sin huecos vacíos ni ceros falsos):
  - Último peso registrado (de Medidas).
  - PR más reciente (cualquier disciplina).
  - Total de entrenamientos registrados.
  - Cantidad de disciplinas con al menos un registro.
  - **% de grasa corporal** (ver sección 2.1) — solo si hay una medición con los datos necesarios.
  - **Pasos de hoy** (Fitbit, ver sección 6) — solo si hay cuenta conectada y Fitbit devolvió un valor para hoy.

### 2.1 % de grasa corporal (agregado mid-flight)

Pam pidió %grasa/%músculo corporal. No hay fórmula confiable por circunferencias sin un dato que hoy no se registra: **circunferencia de cuello**. Con cuello agregado, sí se puede calcular %grasa real con el **método Navy** (usa cuello + cintura + altura, y cadera si es mujer — todo lo demás ya existe en `measurements`/`profiles`).

- **Migración:** `alter table measurements add column neck_cm numeric;` — mismo patrón que las demás circunferencias (opcional, por fecha).
- **Formulario:** `neck_cm` se agrega a `MEASUREMENT_FIELDS` en `ProfileForm.tsx` junto a cintura/cadera/brazo/pierna, con su i18n (`t.measurements.neck`).
- **Cálculo** (`src/lib/bodyComposition.ts`, función pura, testeable):
  - Hombres: `%BF = 495 / (1.0324 − 0.19077·log10(waist−neck) + 0.15456·log10(height)) − 450`
  - Mujeres: `%BF = 495 / (1.29579 − 0.35004·log10(waist+hip−neck) + 0.22100·log10(height)) − 450`
  - Requiere `sex` (de `profiles`, ya existe) + `neck_cm`/`waist_cm`/`height_cm` (+ `hip_cm` si mujer) de la medición. Si `height_cm` no está en esa entrada puntual (rara vez se vuelve a tipear, como ya señala el comentario existente en `MeasurementsSummary.tsx`), se cae a la altura más reciente conocida en una entrada anterior — sin eso, casi ninguna medición podría calcularse.
  - Si falta cualquier dato requerido, el cálculo devuelve `null` y ese tile/gráfico simplemente no aparece — nunca un número inventado.
- **Masa magra estimada** (sustituto de "% músculo", que no tiene fórmula confiable por circunferencias): `leanMassKg = weight_kg × (1 − %BF/100)`. Es peso real menos la grasa estimada (incluye músculo, hueso, órganos) — un número derivado de fórmulas válidas, no "% músculo puro".
- **Dónde se muestra:** %grasa entra en Medidas (nueva tarjeta+gráfico trackeable en el tiempo, mismo patrón que peso/cintura/etc.) **y** como tile en la franja de resumen de arriba. Masa magra estimada solo en Medidas (no compite por espacio en la franja, que ya tiene bastantes tiles).

## 3. Gráficas de progreso legibles (pills, sin doble eje, tooltip explicado)

Afecta solo `ProgressChart.tsx` (gimnasio: peso máximo / 1RM estimado / volumen). `CardioProgressChart.tsx` y `MeasurementsChart.tsx` ya son de un solo eje/una sola métrica — no tienen el problema, no se tocan.

**Antes:** un `ComposedChart` con doble eje Y — línea de peso máximo + línea de 1RM estimado en el eje izquierdo, barras de volumen en el eje derecho (números mucho más grandes por ser peso×reps sumado). Confuso incluso siendo técnicamente correcto: dos escalas muy distintas en el mismo cuadro, sin indicación de qué línea corresponde a cuál eje.

**Ahora:** un solo gráfico, una métrica visible a la vez, elegida con 3 pills debajo del título (mockup aprobado):

- **● Peso máximo** — línea sólida, color de acento.
- **┄ 1RM estimado** — línea punteada, color distinto (rosa/blood) — visualmente distinguible de "peso máximo" de un vistazo, no solo por el color.
- **▮ Volumen total** — barras (se queda igual que hoy, ahora sola en su propio gráfico).

Cada pill trae su propio eje Y con escala automática acorde a esa métrica sola (0-100kg para peso/1RM, escala de miles para volumen) — sin compartir eje con nada más, así no hay forma de que una escala "se vea enorme" por culpa de otra métrica.

**Ícono (i) junto al título**, con tooltip/tap que **cambia según la pill activa** (mockup lo corrigió: al principio explicaba 1RM sin importar qué estuviera seleccionado):
- Peso máximo: "la serie más pesada que levantaste ese día, tal cual la registraste (sin ninguna fórmula)."
- 1RM estimado: "el peso máximo que probablemente podrías levantar en una repetición, calculado con la fórmula de Epley: peso × (1 + reps/30). Es una estimación, no un peso que hayas levantado literalmente."
- Volumen total: "la suma de peso × repeticiones de todas las series de ese ejercicio en la sesión."

**Tooltip por punto** (Recharts `<Tooltip>`, ya existe el patrón en el código actual — se mantiene): al tocar/pasar el mouse por un punto o barra, muestra "`<Métrica> — <fecha>: <valor>`".

**Embellecidos aprobados en el mockup** (se agregan encima de todo lo anterior, sin sacar nada):
1. Relleno degradado semitransparente bajo la línea (color de acento).
2. Glow sutil en la línea (mismo lenguaje visual que el resto de la app usa desde la modernización "brutal-glass" — sombras con glow vía `color-mix()`).
3. El punto más alto de la serie (el PR) se destaca: más grande, en verde, con etiqueta "PR" — en vez de un punto igual a los demás.
4. Badge de tendencia junto al título del ejercicio (p. ej. "▲ +6% vs. hace 4 semanas"), comparando el punto más reciente contra el primer punto registrado con fecha ≥28 días atrás (el más cercano a 4 semanas hacia el pasado, no necesariamente exacto) de la misma métrica. Si no hay ningún punto con esa antigüedad (historial más corto que 4 semanas), el badge no se muestra.

## 4. Tarjetas de rutina: bullets por día y ejercicio

`RoutineList.tsx`'s `RoutineCard` hoy renderiza `daysSummary()` — una función que arma un solo string ("Lunes: Sentadilla (4x8 @ 60kg), Press banca (3x10) · Miércoles: ...") mostrado en un único `<p>`. Es exactamente el "todo junto separado por espacios" que reportó Art.

**Fix:** `RoutinePreview.tsx` ya existe y ya resuelve esto — se usa hoy en la vista previa de rutinas compartidas pendientes (`PendingRoutineShares`), con un `<div>` por día (label + `<ul>` de bullets por ejercicio). `RoutineCard` reemplaza su `<p>{daysSummary(...)}</p>` por `<RoutinePreview days={routine.days} activities={activities} t={t} />` directamente. `daysSummary()` queda sin uso y se borra. Cero componentes nuevos, cero diseño nuevo que inventar — es reusar algo que ya está bien hecho en otro lugar de la misma app.

## 5. Imagen del ejercicio al crear una rutina

El dato ya viaja completo hasta donde hace falta: `content.config.ts` define `image` en el schema de actividades, `localizeActivity()` ya lo incluye en el objeto que devuelve, `rutinas/index.astro` ya pasa esas actividades (con imagen) a `RoutineManager` → `CreateRoutineForm` → `ActivityPicker`, y `DayActivityPicker` (dentro de `CreateRoutineForm.tsx`) ya guarda el `ActivityOption` completo seleccionado en su estado `selected`. La imagen simplemente nunca se pintaba.

**Fix:** en `DayActivityPicker`, justo debajo de `<ActivityPicker />` (mismo lugar donde ya se muestra `selected?.description`), agregar el mismo bloque `<img>` que ya existe en `WorkoutLogger.tsx` (líneas ~463-470) para Registrar:

```tsx
{selected?.image && (
  <img
    src={`${import.meta.env.BASE_URL}exercises/${selected.image}`}
    alt={selected.name}
    loading="lazy"
    className="aspect-video w-full rounded-card object-cover"
  />
)}
```

Si el ejercicio no tiene foto curada (no todos la tienen, ver `docs/agents/imagenes-ejercicios-curacion.md`), el bloque no se dibuja — sin hueco vacío ni ícono roto, mismo comportamiento que ya tiene Registrar hoy.

## 6. Conectar con Fitbit

De las apps de salud típicas, **solo Fitbit** tiene una API web pública integrable sin una app nativa (Apple Health/HealthKit no expone API web; Google Fit está en proceso de discontinuación por Google). Esto es, en la práctica, "conectar tu cuenta de Fitbit", no "conectar cualquier app de salud".

**Métricas:** pasos diarios, sueño, y un bloque de "actividad" (frecuencia cardíaca, calorías, minutos activos). Sin peso de báscula Fitbit (se descartó para no pisar los datos que el usuario ya tipea a mano en Medidas). Cada métrica se muestra solo si Fitbit devuelve datos para esa fecha — nunca un tile/gráfico vacío.

**Sincronización:** al abrir la app, no en segundo plano — sin cron job, sin infraestructura de sincronización programada. Los datos son tan frescos como la última vez que se abrió Progreso, que para pasos/sueño/actividad diaria es más que suficiente.

**Dónde vive:** botón "Conectar con Fitbit" en Perfil (junto a Apariencia/Idioma). Las métricas aparecen en Progreso como una **4ta sección colapsable**, "Actividad diaria", junto a Medidas/Disciplina/Entrenamientos — con gráficos de pasos/sueño/FC por fecha.

### 6.1 Por qué hace falta una Edge Function (cambio de arquitectura)

SelfGains es hoy 100% estático + Supabase, sin nada corriendo en un servidor propio. Fitbit rompe eso por dos motivos:

1. **El intercambio código→tokens y el refresh de tokens** necesitan un client secret. Cualquier variable usada en el build de un sitio estático termina en el JS que se manda al navegador — no hay forma de esconder un secret ahí. Hace falta algo que corra server-side.
2. **CORS:** la Web API de Fitbit (`api.fitbit.com`) no está pensada para llamarse directo desde JS de navegador en cualquier origen — no hay garantía de que el fetch funcione desde el cliente aunque se tuviera el token. Proxear las llamadas de datos a través del mismo lugar que maneja los tokens evita este problema por completo, y de paso el `access_token` nunca sale del servidor ni pasa por el navegador.

Se resuelve con **una Supabase Edge Function** (`supabase/functions/fitbit/index.ts`) — la primera pieza de este proyecto que corre código server-side propio, aparte de Postgres/RLS. No es un servidor custom nuevo (Vercel, Node, etc.): sigue siendo infraestructura de Supabase, desplegada con el mismo CLI que ya se usa para todo lo demás (`supabase functions deploy`).

La función atiende 2 acciones (autenticada con el JWT del usuario, vía el header `Authorization` que Supabase ya inyecta):

- **`connect`**: recibe el `code` de la redirección de Fitbit, lo intercambia por `access_token`/`refresh_token` (usando el client secret, que vive solo en un secret de la Edge Function — `supabase secrets set FITBIT_CLIENT_SECRET=...`, nunca en el bundle del cliente), y guarda (`upsert` por `user_id`, para permitir reconectar después de un `disconnect`) `refresh_token` + `fitbit_user_id` + `scope` en `fitbit_connections` (con el `service_role`, sin pasar por RLS).
- **`data`**: recibe un rango de fechas y qué métricas hacen falta; internamente lee el `refresh_token` guardado, lo refresca si el `access_token` está vencido, llama a los endpoints de series de tiempo de Fitbit (`/1/user/-/activities/steps/date/.../....json`, `/1.2/user/-/sleep/date/.../....json`, etc.) y devuelve solo el JSON ya normalizado al cliente — nunca ningún token.

El cliente (React, en Progreso) nunca ve ni guarda un token de Fitbit — solo llama a esta función con su sesión de Supabase normal, igual que ya llama a `supabase.from(...)` para todo lo demás.

### 6.2 Tabla `fitbit_connections`

```sql
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

-- El refresh_token nunca debe poder leerse desde el cliente, ni siquiera de
-- la fila propia — la política de SELECT de arriba solo controla qué FILAS
-- se ven, no qué COLUMNAS. Mismo patrón ya usado en connection_requests y
-- routine_shares: un revoke de tabla completa + grant de columnas puntuales,
-- porque Supabase ya le da a `authenticated` un grant de tabla completa por
-- defecto y un revoke de una sola columna no alcanza contra eso.
revoke select, insert, update on fitbit_connections from authenticated;
grant select (user_id, fitbit_user_id, scope, connected_at) on fitbit_connections to authenticated;
-- insert/update solo los hace la Edge Function con el service_role (bypassea RLS/grants) — el cliente nunca inserta ni actualiza esta tabla directamente.
```

Desconectar (`delete`) sí lo hace el cliente directo (`supabase.from('fitbit_connections').delete()...`), sin pasar por la función — no expone nada sensible, RLS ya lo scopea a la fila propia.

### 6.3 Flujo de conexión (callback estático)

Página nueva, sin mirror en inglés (no tiene UI propia, solo lógica): `src/pages/fitbit-callback.astro`. Se registra como `redirect_uri` en dev.fitbit.com. Al aterrizar ahí con `?code=...&state=...` en la URL:

1. Lee `code` de `location.search`.
2. Llama a la Edge Function (`action: 'connect'`) con ese código.
3. Redirige a Perfil, en el locale que corresponda (usando la preferencia ya guardada en `localStorage`, mismo helper `localePath` que ya existe).

Es una página dedicada y separada de Perfil a propósito: el script de redirect de locale que ya corre en `BaseLayout.astro` (pre-paint, en cada carga completa) redirigiría `/perfil/?code=...` a `/en/perfil/` **sin preservar el query string**, perdiendo el código antes de poder procesarlo. Una página neutral sin ese script evita el choque por completo.

**Paso manual de Pam** (documentado en el plan, con instrucciones exactas): crear la app en [dev.fitbit.com](https://dev.fitbit.com) (tipo "Personal" o "Server"), con `redirect_uri` = `https://Pamela-ruiz9.github.io/SelfGains/fitbit-callback/` (producción) y, para probar localmente, la URL equivalente de `astro preview`. De ahí sale el Client ID (público, va en `PUBLIC_FITBIT_CLIENT_ID`) y el Client Secret (privado, va solo en `supabase secrets set FITBIT_CLIENT_SECRET=...`). La migración SQL y el deploy de la Edge Function sí los puede correr el agente directamente (CLI de Supabase ya está logueado y linkeado a este proyecto) — a diferencia de la migración de `locale`, esto no debería necesitar que Pam la corra a mano.

### 6.4 Qué pasa si algo falla

Si la llamada a la Edge Function falla (Fitbit caído, token revocado desde la app de Fitbit, rate limit, sin conexión), la sección "Actividad diaria" muestra un mensaje de error acotado a esa sección — mismo patrón que ya usa `ProgressList` para sus otros errores — sin romper el resto de Progreso. Si el usuario revocó el acceso desde Fitbit directamente (fuera de SelfGains), el primer intento de refresh falla con un error identificable de Fitbit — se interpreta como desconectado y se borra la fila de `fitbit_connections`, mostrando de nuevo el botón "Conectar con Fitbit" en Perfil.

## Fuera de alcance (a propósito)

- Sincronización en segundo plano de Fitbit (cron/Edge Function programada) — se decidió explícitamente en contra, ver sección 6.
- Importar peso desde la báscula de Fitbit a Medidas — se decidió explícitamente en contra, para no pisar los datos manuales existentes.
- Apple Health / Google Fit — no viable sin app nativa (Apple) o en proceso de discontinuación (Google), ver sección 6.
- "% músculo" real — no existe fórmula confiable por circunferencias; se sustituye por masa magra estimada (sección 2.1).
- Cualquier cambio a `CardioProgressChart`/`MeasurementsChart` — ya son de una sola métrica/eje, no tienen el problema de la sección 3.

## Verificación

Sin suite automatizada nueva más allá de lo que ya existe (`npm test`), por convención del proyecto — salvo `bodyComposition.ts` (sección 2.1), que sí es candidato natural a tests unitarios puros (como `content-i18n.ts`) dado que es una fórmula con casos borde (sexo no definido, datos faltantes, hombre vs. mujer). `npm run build && npx tsc --noEmit` limpios (único error preexistente esperado: `ProgressList.tsx`).

Recorrido Playwright contra `npx astro preview` + la cuenta de prueba real:
- Sesión activa → abrir `/` y `/en/` aterriza directo en Progreso, sin flash de la landing; sin sesión, la landing se ve normal.
- Franja de resumen: ring de adherencia correcto contra los entrenamientos reales de la cuenta de prueba; cada tile aparece/desaparece según haya o no datos (probar con una cuenta con y sin medidas).
- %grasa: registrar una medición completa (cuello+cintura+cadera+altura+sexo en Perfil) y confirmar que el número calculado coincide con la fórmula Navy a mano; confirmar que falta un dato (p. ej. sin cuello) esconde el tile en vez de mostrar un número raro.
- Gráfica de progreso: cambiar entre las 3 pills en un ejercicio con historial real, confirmar que cada una tiene su propio eje/escala, que el ícono (i) cambia de texto según la pill activa, y que el tooltip por punto muestra la fecha y el valor correctos.
- Tarjetas de rutina: confirmar que una rutina con varios días/ejercicios se lee separada por día con bullets, no como párrafo corrido.
- Crear rutina: seleccionar un ejercicio con foto curada y uno sin ella, confirmar que la imagen aparece/no aparece según corresponda.
- Fitbit: flujo completo de conexión con una cuenta de Fitbit real de prueba (autorizar → vuelta a Perfil → sección "Actividad diaria" con datos reales en Progreso), desconectar y confirmar que el botón vuelve a "Conectar", y simular un token revocado para confirmar el mensaje de error acotado.
