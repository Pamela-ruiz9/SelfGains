import { useState } from 'react';
import { usePwaInstall } from '../../../lib/pwaInstall';
import type { Dictionary } from '../../../i18n/es';

const BANNER_DISMISSED_KEY = 'selfgains-pwa-banner-dismissed';

interface Props {
  variant: 'card' | 'banner';
  t: Dictionary['sync']['installPrompt'];
}

export default function InstallPrompt({ variant, t }: Props) {
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
      {t.iosPrefix} <strong className="text-acid">{t.iosShare}</strong> {t.iosMiddle}{' '}
      <strong className="text-acid">{t.iosAddHome}</strong>.
    </p>
  ) : (
    <button type="button" onClick={promptInstall} className="btn-brutal-sm">
      {t.install}
    </button>
  );

  if (variant === 'card') {
    return (
      <div className="card-brutal flex flex-col gap-3">
        <p className="label-brutal text-acid">{t.cardTitle}</p>
        {action}
      </div>
    );
  }

  return (
    <div className="reveal mb-6 flex items-center justify-between gap-3 rounded-card border border-acid bg-surface px-4 py-3">
      {action}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.closeAriaLabel}
        className="shrink-0 font-mono text-lg text-paper-dim hover:text-paper"
      >
        ✕
      </button>
    </div>
  );
}
