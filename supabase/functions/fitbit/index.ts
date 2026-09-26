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
    return jsonResponse({ error: 'exchange_failed' });
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
    return jsonResponse({ error: 'save_failed' });
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
    return jsonResponse({ error: 'not_connected' });
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
    return jsonResponse({ error: 'disconnected' });
  }

  const tokens = await refreshRes.json();
  const { error: updateError } = await supabaseAdmin
    .from('fitbit_connections')
    .update({ refresh_token: tokens.refresh_token })
    .eq('user_id', userId);
  if (updateError) {
    console.error('fitbit refresh_token update failed', updateError);
  }

  const fitbitHeaders = { Authorization: `Bearer ${tokens.access_token}` };
  const [activityRes, sleepRes] = await Promise.all([
    fetch(`https://api.fitbit.com/1/user/-/activities/date/${body.date}.json`, { headers: fitbitHeaders }),
    fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${body.date}.json`, { headers: fitbitHeaders }),
  ]);

  if (!activityRes.ok || !sleepRes.ok) {
    console.error('fitbit data request failed', activityRes.status, sleepRes.status);
    return jsonResponse({ error: 'fitbit_request_failed' });
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
