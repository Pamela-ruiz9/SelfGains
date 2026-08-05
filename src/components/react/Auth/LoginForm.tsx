import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = `${import.meta.env.BASE_URL}registro/nuevo/`;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
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
          autoComplete="current-password"
          disabled={loading}
          className="input-brutal"
        />
      </label>
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={loading} className="btn-brutal">
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
