import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
import { logMeasurement } from '../../../lib/measurements';
import { applyTheme, DEFAULT_ACCENT, type ThemeMode } from '../../../lib/theme';
import { getActiveRoutine, weeksElapsed } from '../../../lib/routines';
import { DEFAULT_MAP_CENTER, getMyTrainerProfile, upsertTrainerProfile } from '../../../lib/trainerProfiles';
import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import MapPicker from '../Shared/MapPicker';
import type { Profile } from '../../../types/db';

const MEASUREMENT_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: 'weight_kg', label: 'Peso (kg)' },
  { key: 'height_cm', label: 'Estatura (cm)' },
  { key: 'waist_cm', label: 'Cintura (cm)' },
  { key: 'hip_cm', label: 'Cadera (cm)' },
  { key: 'arm_cm', label: 'Brazo (cm)' },
  { key: 'leg_cm', label: 'Pierna (cm)' },
];

const ACCENT_PRESETS = ['#d7ff3f', '#3fd7ff', '#ff3fb8', '#ff9c3f', '#8f3fff', '#3fff8f'];

export default function ProfileForm() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);

  const [trainerVisible, setTrainerVisible] = useState(false);
  const [trainerPin, setTrainerPin] = useState<[number, number] | null>(null);
  const [trainerDisciplines, setTrainerDisciplines] = useState<string[]>([]);
  const [trainerBio, setTrainerBio] = useState('');
  const [trainerRateAmount, setTrainerRateAmount] = useState('');
  const [trainerRateCurrency, setTrainerRateCurrency] = useState('ARS');
  const [trainerRatePeriod, setTrainerRatePeriod] = useState<'clase' | 'mes' | 'hora'>('clase');
  const [savingTrainerProfile, setSavingTrainerProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) return;

      setEmail(data.session!.user.email ?? '');

      // Google sign-in gives us a photo/name for free via user_metadata — use
      // it as the default avatar/nombre until the user sets their own, same
      // pattern as most apps that support Google login.
      const googleMeta = data.session!.user.user_metadata ?? {};
      const googleAvatar: string | null = googleMeta.avatar_url ?? googleMeta.picture ?? null;
      const googleName: string | null = googleMeta.full_name ?? googleMeta.name ?? null;

      const profile = await getMyProfile();
      if (profile) {
        setTheme(profile.theme);
        setAccentColor(profile.accent_color);
        setIsTrainer(profile.is_trainer);
        if (profile.is_trainer) {
          const trainerProfile = await getMyTrainerProfile();
          if (trainerProfile) {
            setTrainerVisible(trainerProfile.is_visible);
            if (trainerProfile.lat !== null && trainerProfile.lng !== null) {
              setTrainerPin([trainerProfile.lat, trainerProfile.lng]);
            }
            setTrainerDisciplines(trainerProfile.disciplines);
            setTrainerBio(trainerProfile.bio ?? '');
            setTrainerRateAmount(trainerProfile.rate_amount?.toString() ?? '');
            setTrainerRateCurrency(trainerProfile.rate_currency ?? 'ARS');
            setTrainerRatePeriod(trainerProfile.rate_period ?? 'clase');
          }
        }
        setMeasurements({
          weight_kg: profile.weight_kg?.toString() ?? '',
          height_cm: profile.height_cm?.toString() ?? '',
          waist_cm: profile.waist_cm?.toString() ?? '',
          hip_cm: profile.hip_cm?.toString() ?? '',
          arm_cm: profile.arm_cm?.toString() ?? '',
          leg_cm: profile.leg_cm?.toString() ?? '',
        });

        const backfill: Partial<Profile> = {};
        if (!profile.avatar_url && googleAvatar) backfill.avatar_url = googleAvatar;
        if (!profile.display_name && googleName) backfill.display_name = googleName;

        setAvatarUrl(profile.avatar_url ?? googleAvatar);
        setDisplayName(profile.display_name ?? googleName ?? '');

        if (Object.keys(backfill).length > 0) {
          await upsertProfile(backfill);
        }
      } else {
        setAvatarUrl(googleAvatar);
        setDisplayName(googleName ?? '');
      }

      const active = await getActiveRoutine();
      if (active) {
        setRoutineExpired(weeksElapsed(active.started_at) >= active.duration_weeks);
      }
    });
  }, []);

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingPhoto(true);
    try {
      const url = await uploadAvatar(file);
      await upsertProfile({ avatar_url: url });
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  async function handleThemeChange(next: ThemeMode) {
    setTheme(next);
    applyTheme(next, accentColor);
    try {
      await upsertProfile({ theme: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el tema.');
    }
  }

  async function handleAccentChange(next: string) {
    setAccentColor(next);
    applyTheme(theme, next);
    try {
      await upsertProfile({ accent_color: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el color.');
    }
  }

  async function handleTrainerToggle(next: boolean) {
    setIsTrainer(next);
    try {
      await upsertProfile({ is_trainer: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  }

  function toggleTrainerDiscipline(id: string) {
    setTrainerDisciplines((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function handleSaveTrainerProfile() {
    setError(null);
    setSavedMessage(null);
    setSavingTrainerProfile(true);
    try {
      const amount = trainerRateAmount === '' ? null : Number(trainerRateAmount);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        throw new Error('La tarifa debe ser un número válido.');
      }
      const pin = trainerPin ?? DEFAULT_MAP_CENTER;
      await upsertTrainerProfile({
        is_visible: trainerVisible,
        lat: pin[0],
        lng: pin[1],
        disciplines: trainerDisciplines,
        bio: trainerBio.trim() || null,
        rate_amount: amount,
        rate_currency: trainerRateCurrency.trim() || null,
        rate_period: trainerRatePeriod,
      });
      setSavedMessage('Buscador de entrenadores guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSavingTrainerProfile(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const parsed: Record<string, number | null> = {};
      for (const { key, label } of MEASUREMENT_FIELDS) {
        const raw = measurements[key] ?? '';
        if (raw === '') {
          parsed[key] = null;
          continue;
        }
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0) {
          throw new Error(`${label}: debe ser un número válido.`);
        }
        parsed[key] = num;
      }
      await upsertProfile({ display_name: displayName.trim() || null, ...parsed });
      await logMeasurement(parsed);
      setSavedMessage('Perfil guardado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = import.meta.env.BASE_URL;
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tu perfil.
      </p>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-10">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-paper-dim/40 bg-surface">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl text-paper-dim">
              {(displayName || email).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="btn-brutal-outline w-fit cursor-pointer px-4 py-2 text-sm">
            {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
              disabled={uploadingPhoto}
            />
          </label>
          <span className="font-mono text-xs text-paper-dim">{email}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Apariencia</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={theme === 'dark' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            Oscuro
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={theme === 'light' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            Claro
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => handleAccentChange(color)}
              style={{ backgroundColor: color }}
              className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${
                accentColor.toLowerCase() === color ? 'scale-110 border-paper' : 'border-paper-dim/40'
              }`}
            />
          ))}
          <input
            type="color"
            value={accentColor}
            onChange={(e) => handleAccentChange(e.target.value)}
            aria-label="Elegir color personalizado"
            className="h-8 w-8 cursor-pointer border-2 border-paper-dim/40 bg-transparent p-0"
          />
        </div>
      </div>

      {routineExpired && (
        <div className="card-brutal border-acid">
          <p className="font-mono text-sm text-paper">
            Tu rutina activa venció — buen momento para actualizar tus medidas y ver cómo vas.
          </p>
        </div>
      )}

      <label className="flex items-center gap-3 font-mono text-sm text-paper">
        <input
          type="checkbox"
          checked={isTrainer}
          onChange={(e) => handleTrainerToggle(e.target.checked)}
          className="h-5 w-5 accent-acid"
        />
        Soy entrenador
      </label>

      {isTrainer && (
        <div className="card-brutal flex flex-col gap-4">
          <p className="label-brutal text-acid">Buscador de entrenadores</p>
          <MapPicker
            center={trainerPin ?? DEFAULT_MAP_CENTER}
            draggableMarker={trainerPin ?? DEFAULT_MAP_CENTER}
            onDraggableMarkerMove={(lat, lng) => setTrainerPin([lat, lng])}
            height={220}
          />
          <p className="font-mono text-xs text-paper-dim">Arrastrá el pin hasta tu zona de trabajo.</p>
          <label className="flex items-center gap-3 font-mono text-sm text-paper">
            <input
              type="checkbox"
              checked={trainerVisible}
              onChange={(e) => setTrainerVisible(e.target.checked)}
              className="h-5 w-5 accent-acid"
            />
            Visible en el buscador
          </label>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleTrainerDiscipline(d.id)}
                className={
                  trainerDisciplines.includes(d.id)
                    ? 'btn-brutal-sm border-acid bg-acid text-on-accent'
                    : 'btn-brutal-sm'
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="label-brutal">Bio corta</span>
            <textarea
              value={trainerBio}
              onChange={(e) => setTrainerBio(e.target.value)}
              rows={3}
              className="input-brutal"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Monto</span>
              <input
                type="number"
                value={trainerRateAmount}
                onChange={(e) => setTrainerRateAmount(e.target.value)}
                min={0}
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Moneda</span>
              <input
                type="text"
                value={trainerRateCurrency}
                onChange={(e) => setTrainerRateCurrency(e.target.value)}
                placeholder="ARS"
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Período</span>
              <select
                value={trainerRatePeriod}
                onChange={(e) => setTrainerRatePeriod(e.target.value as 'clase' | 'mes' | 'hora')}
                className="input-brutal"
              >
                <option value="clase">Por clase</option>
                <option value="mes">Por mes</option>
                <option value="hora">Por hora</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveTrainerProfile}
            disabled={savingTrainerProfile}
            className="btn-brutal-sm self-start"
          >
            {savingTrainerProfile ? 'Guardando...' : 'Guardar buscador'}
          </button>
          {error && <p className="font-mono text-xs text-blood">{error}</p>}
          {savedMessage && <p className="font-mono text-xs text-acid">{savedMessage}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Nombre en la app</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
            className="input-brutal"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-2">
              <span className="label-brutal">{label}</span>
              <input
                type="number"
                value={measurements[key] ?? ''}
                onChange={(e) => setMeasurements((prev) => ({ ...prev, [key]: e.target.value }))}
                min={0}
                step="0.1"
                disabled={saving}
                className="input-brutal"
              />
            </label>
          ))}
        </div>

        {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        {savedMessage && (
          <p className="border-l-2 border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
        )}

        <button type="submit" disabled={saving} className="btn-brutal self-start">
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleLogout}
        className="self-start font-mono text-sm text-blood underline underline-offset-4 hover:text-paper"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
