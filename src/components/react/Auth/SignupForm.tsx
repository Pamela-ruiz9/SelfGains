import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}registro/nuevo/` },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  }

  if (done) {
    return (
      <div className="card-brutal max-w-sm border-acid">
        <p className="font-mono text-sm text-paper">
          Cuenta creada. Revisa tu correo para confirmar la cuenta y luego{' '}
          <a
            href={`${import.meta.env.BASE_URL}login/`}
            className="text-acid underline underline-offset-4 hover:text-paper"
          >
            inicia sesión
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-5">
      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={loading}
        className="btn-brutal-outline flex items-center justify-center gap-3"
      >
        <GoogleIcon />
        Continuar con Google
      </button>
      <div className="flex items-center gap-3 text-paper-dim">
        <div className="h-px flex-1 bg-paper-dim/30" />
        <span className="font-mono text-xs">O</span>
        <div className="h-px flex-1 bg-paper-dim/30" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            required
            autoComplete="email"
            disabled={loading}
            className="input-brutal"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
            className="input-brutal"
          />
        </label>
        {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
        <button type="submit" disabled={loading} className="btn-brutal">
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
