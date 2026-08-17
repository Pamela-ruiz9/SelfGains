import { useState } from 'react';
import { usePwaInstall } from '../../../lib/pwaInstall';

const BANNER_DISMISSED_KEY = 'selfgains-pwa-banner-dismissed';

interface Props {
  variant: 'card' | 'banner';
}

export default function InstallPrompt({ variant }: Props) {
  const { installed, canInstall, isIOSDevice, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    if (variant !== 'banner' || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (installed) return null;
  if (variant === 'banner' && dismissed) return null;
  if (!canInstall && !isIOSDevice) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch {
      // localStorage puede fallar en modo privado — el banner solo no
      // persistirá el dismiss entre visitas, no es crítico.
    }
  }

  const action = isIOSDevice ? (
    <p className="font-mono text-sm text-paper">
      Tocá <strong className="text-acid">Compartir</strong> y después{' '}
      <strong className="text-acid">"Agregar a inicio"</strong>.
    </p>
  ) : (
    <button type="button" onClick={promptInstall} className="btn-brutal-sm">
      Instalar app
    </button>
  );

  if (variant === 'card') {
    return (
      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">Instalar SelfGains</p>
        {action}
      </div>
    );
  }

  return (
    <div className="reveal mb-6 flex items-center justify-between gap-3 border-2 border-acid bg-surface px-4 py-3">
      {action}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 font-mono text-lg text-paper-dim hover:text-paper"
      >
        ✕
      </button>
    </div>
  );
}
