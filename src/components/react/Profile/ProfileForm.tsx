import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteMyAccount, getMyProfile, uploadAvatar, upsertProfile } from '../../../lib/profile';
import { logMeasurement } from '../../../lib/measurements';
import { ACCENT_GRADIENTS, applyTheme, DEFAULT_ACCENT, type AccentGradientId, type ThemeMode } from '../../../lib/theme';
import { getWeightUnit, setWeightUnit, type WeightUnit } from '../../../lib/weightUnit';
import { getActiveRoutine, weeksElapsed } from '../../../lib/routines';
import { DEFAULT_MAP_CENTER, getMyTrainerProfile, upsertTrainerProfile } from '../../../lib/trainerProfiles';
import { DISCIPLINES } from '../ActivityPicker/ActivityPicker';
import MapPicker from '../Shared/MapPicker';
import Avatar from '../Shared/Avatar';
import type { Profile } from '../../../types/db';
import type { Dictionary } from '../../../i18n';

const ACCENT_PRESETS = ['#d7ff3f', '#3fd7ff', '#ff3fb8', '#ff9c3f', '#8f3fff', '#3fff8f'];

export default function ProfileForm({
  t,
  avatarT,
}: {
  t: Dictionary['perfil'];
  avatarT: Dictionary['sync']['avatar'];
}) {
  const MEASUREMENT_FIELDS: { key: keyof Profile; label: string }[] = [
    { key: 'weight_kg', label: t.measurements.weight },
    { key: 'height_cm', label: t.measurements.height },
    { key: 'waist_cm', label: t.measurements.waist },
    { key: 'hip_cm', label: t.measurements.hip },
    { key: 'arm_cm', label: t.measurements.arm },
    { key: 'leg_cm', label: t.measurements.leg },
  ];
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [locale, setLocale] = useState<'es' | 'en'>('es');
  // string, no AccentGradientId — accentColor termina guardando tanto ids de
  // preset ("f1"/"f2"/"f3") como hex sueltos del selector de color libre,
  // y también lo que venga de profile.accent_color (columna text en
  // Supabase, sin CHECK que restrinja el formato).
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT);
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() => getWeightUnit());
  const [sex, setSex] = useState<'femenino' | 'masculino' | null>(null);
  const [trainingLevel, setTrainingLevel] = useState<
    'principiante' | 'intermedio' | 'avanzado' | null
  >(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routineExpired, setRoutineExpired] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);

  const [trainerVisible, setTrainerVisible] = useState(false);
  const [trainerPin, setTrainerPin] = useState<[number, number] | null>(null);
  const [trainerDisciplines, setTrainerDisciplines] = useState<string[]>([]);
  const [trainerBio, setTrainerBio] = useState('');
  const [trainerRateAmount, setTrainerRateAmount] = useState('');
  const [trainerRateCurrency, setTrainerRateCurrency] = useState('MXN');
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
        setLocale(profile.locale);
        setAccentColor(profile.accent_color);
        setIsTrainer(profile.is_trainer);
        setSex(profile.sex);
        setTrainingLevel(profile.training_level);
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
            setTrainerRateCurrency(trainerProfile.rate_currency ?? 'MXN');
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
      setError(err instanceof Error ? err.message : t.photo.uploadError);
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
      setError(err instanceof Error ? err.message : t.appearance.themeSaveError);
    }
  }

  async function handleLocaleChange(next: 'es' | 'en') {
    setLocale(next);
    try {
      localStorage.setItem('selfgains-locale', next);
    } catch {}
    try {
      await upsertProfile({ locale: next });
    } catch (err) {
      // La navegación de abajo corre igual, con o sin error — el banner de
      // error nunca llega a pintarse, así que esto es solo para debug.
      console.error(err);
    }
    const base = import.meta.env.BASE_URL;
    window.location.href = next === 'en' ? `${base}en/perfil/` : `${base}perfil/`;
  }

  async function handleAccentChange(next: string) {
    setAccentColor(next);
    applyTheme(theme, next);
    try {
      await upsertProfile({ accent_color: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appearance.colorSaveError);
    }
  }

  function handleWeightUnitChange(next: WeightUnit) {
    setWeightUnitState(next);
    setWeightUnit(next);
  }

  async function handleSexChange(next: 'femenino' | 'masculino' | null) {
    setSex(next);
    try {
      await upsertProfile({ sex: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sex.saveError);
    }
  }

  async function handleTrainingLevelChange(next: 'principiante' | 'intermedio' | 'avanzado' | null) {
    setTrainingLevel(next);
    try {
      await upsertProfile({ training_level: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.trainingLevel.saveError);
    }
  }

  async function handleTrainerToggle(next: boolean) {
    setIsTrainer(next);
    try {
      await upsertProfile({ is_trainer: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.trainer.toggleSaveError);
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
        throw new Error(t.trainer.invalidRate);
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
      setSavedMessage(t.trainer.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.trainer.saveError);
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
          throw new Error(`${label}: ${t.measurements.invalidNumber}`);
        }
        parsed[key] = num;
      }
      await upsertProfile({ display_name: displayName.trim() || null, ...parsed });
      await logMeasurement(parsed);
      setSavedMessage(t.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = import.meta.env.BASE_URL;
  }

  async function handleDeleteAccount() {
    if (!confirm(t.deleteAccount.confirm)) {
      return;
    }
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      window.location.href = import.meta.env.BASE_URL;
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t.deleteAccount.error);
      setDeletingAccount(false);
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">{t.loading}</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.notLoggedIn.prefix}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.notLoggedIn.link}
        </a>{' '}
        {t.notLoggedIn.suffix}
      </p>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-10">
      <div className="flex items-center gap-4">
        <Avatar avatarUrl={avatarUrl} displayName={displayName || email} isTrainer={isTrainer} size={80} t={avatarT} />
        <div className="flex flex-col gap-1">
          <label className="btn-brutal-outline w-fit cursor-pointer px-4 py-2 text-sm">
            {uploadingPhoto ? t.photo.uploading : t.photo.change}
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
        <p className="label-brutal text-acid">{t.language.label}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleLocaleChange('es')}
            className={locale === 'es' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.language.es}
          </button>
          <button
            type="button"
            onClick={() => handleLocaleChange('en')}
            className={locale === 'en' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.language.en}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.appearance.label}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={theme === 'dark' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.appearance.dark}
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={theme === 'light' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.appearance.light}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(ACCENT_GRADIENTS) as [AccentGradientId, (typeof ACCENT_GRADIENTS)[AccentGradientId]][]).map(
            ([id, preset]) => (
              <button
                key={id}
                type="button"
                aria-label={`${t.appearance.gradientAriaLabel} ${id}`}
                onClick={() => handleAccentChange(id)}
                style={{ backgroundImage: preset.gradient }}
                className={`h-8 w-8 rounded-full border transition-transform duration-150 ${
                  accentColor === id ? 'scale-110 border-paper' : 'border-paper-dim/40'
                }`}
              />
            )
          )}
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`${t.appearance.colorAriaLabel} ${color}`}
              onClick={() => handleAccentChange(color)}
              style={{ backgroundColor: color }}
              className={`h-8 w-8 rounded-full border transition-transform duration-150 ${
                accentColor.toLowerCase() === color ? 'scale-110 border-paper' : 'border-paper-dim/40'
              }`}
            />
          ))}
          <input
            type="color"
            value={
              accentColor.startsWith('#')
                ? accentColor
                : (ACCENT_GRADIENTS[accentColor as AccentGradientId]?.solid ?? '#000000')
            }
            onChange={(e) => handleAccentChange(e.target.value)}
            aria-label={t.appearance.customColorAriaLabel}
            className="h-8 w-8 cursor-pointer rounded-control border border-paper-dim/40 bg-transparent p-0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.weightUnit.label}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleWeightUnitChange('kg')}
            className={
              weightUnit === 'kg' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.weightUnit.kg}
          </button>
          <button
            type="button"
            onClick={() => handleWeightUnitChange('lb')}
            className={
              weightUnit === 'lb' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.weightUnit.lb}
          </button>
        </div>
        <p className="font-mono text-xs text-paper-dim">{t.weightUnit.hint}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.sex.label}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSexChange('femenino')}
            className={sex === 'femenino' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.sex.femenino}
          </button>
          <button
            type="button"
            onClick={() => handleSexChange('masculino')}
            className={sex === 'masculino' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.sex.masculino}
          </button>
          <button
            type="button"
            onClick={() => handleSexChange(null)}
            className={sex === null ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'}
          >
            {t.sex.unspecified}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.trainingLevel.label}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('principiante')}
            className={
              trainingLevel === 'principiante' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.trainingLevel.principiante}
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('intermedio')}
            className={
              trainingLevel === 'intermedio' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.trainingLevel.intermedio}
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('avanzado')}
            className={
              trainingLevel === 'avanzado' ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.trainingLevel.avanzado}
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange(null)}
            className={
              trainingLevel === null ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm'
            }
          >
            {t.trainingLevel.unspecified}
          </button>
        </div>
        <p className="font-mono text-xs text-paper-dim">{t.trainingLevel.hint}</p>
      </div>

      {routineExpired && (
        <div className="card-brutal border-acid">
          <p className="font-mono text-sm text-paper">{t.routineExpired}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => handleTrainerToggle(!isTrainer)}
        aria-pressed={isTrainer}
        className={
          isTrainer
            ? 'btn-brutal-sm self-start pill-selected'
            : 'btn-brutal-sm self-start'
        }
      >
        {isTrainer ? t.trainer.toggleOn : t.trainer.toggleOff}
      </button>

      {isTrainer && (
        <div className="card-brutal flex flex-col gap-4">
          <p className="label-brutal text-acid">{t.trainer.sectionTitle}</p>
          <MapPicker
            center={trainerPin ?? DEFAULT_MAP_CENTER}
            draggableMarker={trainerPin ?? DEFAULT_MAP_CENTER}
            onDraggableMarkerMove={(lat, lng) => setTrainerPin([lat, lng])}
            height={220}
          />
          <p className="font-mono text-xs text-paper-dim">{t.trainer.dragPinHint}</p>
          <button
            type="button"
            onClick={() => setTrainerVisible(!trainerVisible)}
            aria-pressed={trainerVisible}
            className={
              trainerVisible
                ? 'btn-brutal-sm self-start pill-selected'
                : 'btn-brutal-sm self-start'
            }
          >
            {trainerVisible ? t.trainer.visibleOn : t.trainer.visibleOff}
          </button>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleTrainerDiscipline(d.id)}
                className={
                  trainerDisciplines.includes(d.id)
                    ? 'btn-brutal-sm pill-selected'
                    : 'btn-brutal-sm'
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="label-brutal">{t.trainer.bio}</span>
            <textarea
              value={trainerBio}
              onChange={(e) => setTrainerBio(e.target.value)}
              rows={3}
              className="input-brutal"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-2">
              <span className="label-brutal">{t.trainer.amount}</span>
              <input
                type="number"
                value={trainerRateAmount}
                onChange={(e) => setTrainerRateAmount(e.target.value)}
                min={0}
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">{t.trainer.currency}</span>
              <input
                type="text"
                value={trainerRateCurrency}
                onChange={(e) => setTrainerRateCurrency(e.target.value)}
                placeholder="MXN"
                className="input-brutal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-brutal">{t.trainer.period}</span>
              <select
                value={trainerRatePeriod}
                onChange={(e) => setTrainerRatePeriod(e.target.value as 'clase' | 'mes' | 'hora')}
                className="input-brutal"
              >
                <option value="clase">{t.trainer.periodClass}</option>
                <option value="mes">{t.trainer.periodMonth}</option>
                <option value="hora">{t.trainer.periodHour}</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveTrainerProfile}
            disabled={savingTrainerProfile}
            className="btn-brutal-sm self-start"
          >
            {savingTrainerProfile ? t.trainer.saving : t.trainer.save}
          </button>
          {error && <p className="font-mono text-xs text-blood">{error}</p>}
          {savedMessage && <p className="font-mono text-xs text-acid">{savedMessage}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="label-brutal">{t.displayName}</span>
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

        {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        {savedMessage && (
          <p className="border-l border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
        )}

        <button type="submit" disabled={saving} className="btn-brutal self-start">
          {saving ? t.saving : t.save}
        </button>
      </form>

      <button
        type="button"
        onClick={handleLogout}
        className="self-start rounded-control border border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
      >
        {t.logout}
      </button>

      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={deletingAccount}
        className="self-start rounded-control border border-blood bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95 disabled:opacity-50"
      >
        {deletingAccount ? t.deleteAccount.deleting : t.deleteAccount.button}
      </button>
      {deleteError && (
        <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{deleteError}</p>
      )}
    </div>
  );
}
