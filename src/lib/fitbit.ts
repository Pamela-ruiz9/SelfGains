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

const GOOGLE_HEALTH_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.sleep.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';
const OAUTH_STATE_KEY = 'selfgains-fitbit-oauth-state';

export function fitbitRedirectUri(base: string): string {
  return `${window.location.origin}${base}fitbit-callback/`;
}

// Guarda un `state` random en sessionStorage (protección CSRF estándar de
// OAuth) y devuelve la URL de autorización de Google (Google Health API)
// lista para redirigir.
export function buildFitbitAuthorizeUrl(clientId: string, base: string): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: fitbitRedirectUri(base),
    scope: GOOGLE_HEALTH_SCOPE,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Compara el `state` devuelto por Google contra el que se guardó antes de
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
