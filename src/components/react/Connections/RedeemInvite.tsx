import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { redeemInviteCode } from '../../../lib/connections';
import { es } from '../../../i18n/es';
import type { Dictionary } from '../../../i18n/es';

type Status = 'checking' | 'needs-login' | 'redeeming' | 'error' | 'done';

interface Props {
  // Optional: this component is rendered from src/pages/c.astro, which
  // doesn't resolve a locale yet, so it falls back to Spanish there until
  // that page gets its own translation pass.
  t?: Dictionary['conexiones']['redeemInvite'];
}

export default function RedeemInvite({ t = es.conexiones.redeemInvite }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = window.location.hash.slice(1);
    if (!code) {
      setStatus('error');
      setError(t.invalidCode);
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
        setError(err instanceof Error ? err.message : t.processError);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking' || status === 'redeeming' || status === 'done') {
    return <p className="font-mono text-sm text-paper-dim">{t.connecting}</p>;
  }

  if (status === 'needs-login') {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.needsLoginText}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.loginLink}
        </a>
      </p>
    );
  }

  return <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
}
