import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Dictionary } from '../../../i18n';

export default function ResetPasswordForm({ t }: { t: Dictionary['auth']['resetPassword'] }) {
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Clicking the recovery link lands here with a Supabase session already
    // established from the URL hash (detectSessionInUrl). We also listen for
    // PASSWORD_RECOVERY in case that event fires after this effect subscribes.
    supabase.auth.getSession().then(({ data }) => {
      setReady(data.session !== null);
      setChecked(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setChecked(true);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (!checked) {
    return <p className="font-mono text-sm text-paper-dim">{t.loading}</p>;
  }

  if (done) {
    return (
      <div className="card-brutal max-w-sm border-acid">
        <p className="font-mono text-sm text-paper">
          {t.doneText}{' '}
          <a
            href={`${import.meta.env.BASE_URL}login/`}
            className="text-acid underline underline-offset-4 hover:text-paper"
          >
            {t.doneLoginLink}
          </a>
          .
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.invalidLinkText}{' '}
        <a
          href={`${import.meta.env.BASE_URL}olvide-contrasena/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.invalidLinkLink}
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{t.newPassword}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={loading}
          className="input-brutal"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{t.confirmPassword}</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError(null);
          }}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={loading}
          className="input-brutal"
        />
      </label>
      {error && <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={loading} className="btn-brutal">
        {loading ? t.submitting : t.submit}
      </button>
    </form>
  );
}
