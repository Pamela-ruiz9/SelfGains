import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Dictionary } from '../../../i18n';

export default function ForgotPasswordForm({ t }: { t: Dictionary['auth']['forgotPassword'] }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}restablecer-contrasena/`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card-brutal max-w-sm border-acid">
        <p className="font-mono text-sm text-paper">{t.sentMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">{t.email}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          required
          autoComplete="email"
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
