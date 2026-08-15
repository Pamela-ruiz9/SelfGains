import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ForgotPasswordForm() {
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
        <p className="font-mono text-sm text-paper">
          Si existe una cuenta con ese correo, te enviamos un link para restablecer tu
          contraseña. Revisa tu bandeja de entrada.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Email</span>
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
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={loading} className="btn-brutal">
        {loading ? 'Enviando...' : 'Enviar link de recuperación'}
      </button>
    </form>
  );
}
