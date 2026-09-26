import { useEffect, useState } from 'react';
import {
  buildFitbitAuthorizeUrl,
  disconnectFitbit,
  getFitbitConnectionStatus,
} from '../../../lib/fitbit';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  t: Dictionary['perfil']['fitbit'];
}

export default function FitbitConnection({ t }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFitbitConnectionStatus()
      .then((status) => setConnected(status.connected))
      .catch(() => setError(t.loadError));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectFitbit();
      setConnected(false);
    } catch {
      setError(t.disconnectError);
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    const clientId = import.meta.env.PUBLIC_FITBIT_CLIENT_ID;
    const base = import.meta.env.BASE_URL;
    window.location.href = buildFitbitAuthorizeUrl(clientId, base);
  }

  if (connected === null) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.label}</p>
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      {connected ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-paper-dim">{t.connected}</span>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-brutal-sm"
          >
            {disconnecting ? t.disconnecting : t.disconnect}
          </button>
        </div>
      ) : (
        <button type="button" onClick={handleConnect} className="btn-brutal-sm">
          {t.connect}
        </button>
      )}
    </div>
  );
}
