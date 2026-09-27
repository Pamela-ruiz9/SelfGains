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

type CivilDate = { year: number; month: number; day: number };

function parseCivilDate(dateStr: string): CivilDate {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

// `range` en la API de Google Health es un intervalo cerrado-abierto de
// fechas civiles — para pedir un solo día, `end` tiene que ser el día
// calendario siguiente.
function nextCivilDate(date: CivilDate): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Trae el resumen diario ("dailyRollUp") de un dataType de Google Health.
// Cada dataType es una llamada HTTP independiente y resiliente por su
// cuenta: si falla o la respuesta no tiene la forma esperada, se loguea y
// se devuelve null — nunca se tira abajo toda la respuesta por un solo
// dataType, así cada métrica aparece solo si hay datos (mismo criterio que
// ya usa el resto de la app).
async function fetchDailyRollup(
  dataType: string,
  accessToken: string,
  start: CivilDate,
  end: CivilDate
): Promise<unknown | null> {
  try {
    const res = await fetch(
      `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        // El `range` de Google Health espera cada extremo como un
        // `CivilDateTime` — un objeto con un campo `date` anidado, no un
        // {year,month,day} plano — confirmado contra el discovery doc real
        // de la API (health.googleapis.com/$discovery/rest?version=v4) tras
        // que la forma plana devolviera 400 "Unknown name year at
        // 'range.start'" en producción.
        body: JSON.stringify({
          range: { start: { date: start }, end: { date: end } },
          windowSizeDays: 1,
        }),
      }
    );
    if (!res.ok) {
      console.error(`google health ${dataType} request failed`, res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`google health ${dataType} request threw`, err);
    return null;
  }
}

function firstRollupPoint(response: unknown): Record<string, unknown> | null {
  if (
    response &&
    typeof response === 'object' &&
    Array.isArray((response as { rollupDataPoints?: unknown }).rollupDataPoints)
  ) {
    const first = (response as { rollupDataPoints: unknown[] }).rollupDataPoints[0];
    if (first && typeof first === 'object') {
      return first as Record<string, unknown>;
    }
  }
  return null;
}

// Nunca asume que una clave existe — cada campo se valida con typeof antes
// de usarse, igual que hacía el parseo de la respuesta de Fitbit. Los
// campos int64 de Google Health (ej. countSum, sumInPeakHeartZone) vienen
// serializados como STRING, no number, por convención de la API — hay que
// aceptar ambos.
function numberField(point: Record<string, unknown> | null, outerKey: string, innerKey: string): number | null {
  if (!point) return null;
  const outer = point[outerKey];
  if (!outer || typeof outer !== 'object') return null;
  const value = (outer as Record<string, unknown>)[innerKey];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

// Suma un conjunto de campos int64-como-string dentro del mismo objeto
// externo — usado para activeZoneMinutes, que viene partido en 3 zonas de
// FC en vez de un solo total.
function sumIntStringFields(
  point: Record<string, unknown> | null,
  outerKey: string,
  innerKeys: string[]
): number | null {
  if (!point) return null;
  const outer = point[outerKey];
  if (!outer || typeof outer !== 'object') return null;
  const record = outer as Record<string, unknown>;
  let sum = 0;
  let sawAny = false;
  for (const key of innerKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      sum += Number(value);
      sawAny = true;
    } else if (typeof value === 'number') {
      sum += value;
      sawAny = true;
    }
  }
  return sawAny ? sum : null;
}

// FC en reposo: Google Health la modela como un rango personal
// (beatsPerMinuteMin/Max), no un promedio único — se muestra el punto medio
// de ese rango como el número más representativo para un tile de una sola
// cifra.
function restingHeartRateField(point: Record<string, unknown> | null): number | null {
  if (!point) return null;
  const outer = point['restingHeartRatePersonalRange'];
  if (!outer || typeof outer !== 'object') return null;
  const record = outer as Record<string, unknown>;
  const min = record['beatsPerMinuteMin'];
  const max = record['beatsPerMinuteMax'];
  if (typeof min === 'number' && typeof max === 'number') {
    return Math.round((min + max) / 2);
  }
  return null;
}

// Intercambia el `code` de la redirección de Google por tokens y guarda el
// refresh_token — nunca el access_token, que es de corta duración y se
// vuelve a pedir en cada llamada de "data" vía refresh.
async function handleConnect(
  body: { code: string; redirectUri: string },
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string
): Promise<Response> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      redirect_uri: body.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    console.error('google health connect exchange failed', await tokenRes.text());
    return jsonResponse({ error: 'exchange_failed' });
  }

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    // Sin refresh_token no hay nada que guardar — sin `access_type=offline`
    // + `prompt=consent` en la URL de autorización, Google puede omitirlo.
    console.error('google health connect: no refresh_token in response', tokens);
    return jsonResponse({ error: 'exchange_failed' });
  }

  const { error } = await supabaseAdmin.from('fitbit_connections').upsert(
    {
      user_id: userId,
      // Google no devuelve un id de usuario propio en el token, y las
      // llamadas a la API de datos direccionan al usuario autenticado como
      // literal "me" en la URL — esta columna queda con un valor fijo, solo
      // para satisfacer el NOT NULL (ya no se usa funcionalmente).
      fitbit_user_id: 'me',
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('google health connect upsert failed', error);
    return jsonResponse({ error: 'save_failed' });
  }

  return jsonResponse({ success: true });
}

// Refresca el access_token y trae el resumen de actividad + sueño de una
// fecha. A diferencia de Fitbit, Google no garantiza un refresh_token nuevo
// en cada llamada de refresh (solo a veces) — se persiste el nuevo únicamente
// si vino uno; si no, se conserva el que ya había. Nunca devuelve ningún
// token al cliente.
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
    return jsonResponse({ error: 'not_connected' });
  }

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token as string,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!refreshRes.ok) {
    // Token revocado desde la cuenta de Google, o vencido más allá de lo
    // recuperable — se interpreta como desconectado (ver spec sección 6.4).
    await supabaseAdmin.from('fitbit_connections').delete().eq('user_id', userId);
    return jsonResponse({ error: 'disconnected' });
  }

  const tokens = await refreshRes.json();
  if (tokens.refresh_token) {
    const { error: updateError } = await supabaseAdmin
      .from('fitbit_connections')
      .update({ refresh_token: tokens.refresh_token })
      .eq('user_id', userId);
    if (updateError) {
      console.error('google health refresh_token update failed', updateError);
    }
  }

  const start = parseCivilDate(body.date);
  const end = nextCivilDate(start);

  const [stepsRes, sleepRes, restingHrRes, activeEnergyRes, activeZoneRes] = await Promise.all([
    fetchDailyRollup('steps', tokens.access_token, start, end),
    fetchDailyRollup('sleep', tokens.access_token, start, end),
    fetchDailyRollup('daily-resting-heart-rate', tokens.access_token, start, end),
    fetchDailyRollup('active-energy-burned', tokens.access_token, start, end),
    fetchDailyRollup('active-zone-minutes', tokens.access_token, start, end),
  ]);

  return jsonResponse({
    // Todos los campos de abajo (salvo sleep) están confirmados contra el
    // discovery doc real de la API (health.googleapis.com/$discovery/rest?
    // version=v4) — no contra documentación HTML resumida, que resultó
    // imprecisa (nombres en camelCase, algunos como string-int64, FC en
    // reposo es un rango min/max sin promedio, minutos activos viene
    // partido en 3 zonas de FC). `steps.countSum` es int64-como-string, por
    // eso `numberField` acepta string además de number.
    steps: numberField(firstRollupPoint(stepsRes), 'steps', 'countSum'),
    restingHeartRate: restingHeartRateField(firstRollupPoint(restingHrRes)),
    caloriesOut: numberField(firstRollupPoint(activeEnergyRes), 'activeEnergyBurned', 'kcalSum'),
    activeMinutes: sumIntStringFields(firstRollupPoint(activeZoneRes), 'activeZoneMinutes', [
      'sumInPeakHeartZone',
      'sumInFatBurnHeartZone',
      'sumInCardioHeartZone',
    ]),
    // Sleep NO aparece como campo del DailyRollupDataPoint en el discovery
    // doc — a diferencia de los otros 4, no es un dataType que se pueda
    // pedir vía dataPoints:dailyRollUp (sleep se modela como sesiones con
    // inicio/fin, no como un total diario acumulable). Esta llamada sigue
    // ahí y falla de forma resiliente (null, sin romper el resto) mientras
    // se investiga el endpoint correcto para sesiones de sueño — pendiente,
    // no es un bug de mapeo como los otros 4 eran.
    sleepMinutes: numberField(firstRollupPoint(sleepRes), 'sleep', 'durationMinutesSum'),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Los nombres de secret siguen diciendo "FITBIT_*" por continuidad interna
  // con lo ya deployado — ahora contienen el Client ID/Secret del proyecto
  // de Google Cloud (OAuth "Web Server"), no credenciales de Fitbit.
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
