import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ResetPasswordForm() {
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
      setError('Las contraseñas no coinciden.');
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
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (done) {
    return (
      <div className="card-brutal max-w-sm border-acid">
        <p className="font-mono text-sm text-paper">
          Contraseña actualizada. Ya puedes{' '}
          <a
            href={`${import.meta.env.BASE_URL}login/`}
            className="text-acid underline underline-offset-4 hover:text-paper"
          >
            iniciar sesión
          </a>
          .
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Este link no es válido o ya venció. Solicita uno nuevo desde{' '}
        <a
          href={`${import.meta.env.BASE_URL}olvide-contrasena/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          recuperar contraseña
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Nueva contraseña</span>
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
        <span className="label-brutal">Confirmar contraseña</span>
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
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={loading} className="btn-brutal">
        {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}
