import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { redeemInviteCode } from '../../../lib/connections';

type Status = 'checking' | 'needs-login' | 'redeeming' | 'error' | 'done';

export default function RedeemInvite() {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = window.location.hash.slice(1);
    if (!code) {
      setStatus('error');
      setError('Este link no trae un código válido.');
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setStatus('needs-login');
        return;
      }
      setStatus('redeeming');
      try {
        await redeemInviteCode(code);
        setStatus('done');
        window.location.href = `${import.meta.env.BASE_URL}conexiones/`;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'No se pudo procesar la invitación.');
      }
    });
  }, []);

  if (status === 'checking' || status === 'redeeming' || status === 'done') {
    return <p className="font-mono text-sm text-paper-dim">Conectando...</p>;
  }

  if (status === 'needs-login') {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Inicia sesión y vuelve a abrir este link para conectarte.{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          Iniciar sesión
        </a>
      </p>
    );
  }

  return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
}
