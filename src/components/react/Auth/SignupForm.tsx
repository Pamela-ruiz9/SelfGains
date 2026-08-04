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

  if (done) {
    return (
      <p>
        Cuenta creada. Revisa tu correo para confirmar la cuenta y luego{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          inicia sesión
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          required
          autoComplete="email"
          disabled={loading}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          required
          minLength={6}
          autoComplete="new-password"
          disabled={loading}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  );
}
