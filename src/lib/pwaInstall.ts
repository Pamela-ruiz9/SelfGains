import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_KEY = 'selfgains-pwa-installed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ en modo "escritorio" se identifica como Mac con soporte táctil.
  const isIPadOSDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOSDesktopMode;
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(INSTALLED_KEY) === 'true' || isStandalone();
    } catch {
      return isStandalone();
    }
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice] = useState(() => isIOS());

  useEffect(() => {
    function onBeforeInstallPrompt(ev: Event) {
      ev.preventDefault();
      setDeferredPrompt(ev as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      try {
        localStorage.setItem(INSTALLED_KEY, 'true');
      } catch {
        // localStorage puede fallar en modo privado — no es crítico acá.
      }
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      try {
        localStorage.setItem(INSTALLED_KEY, 'true');
      } catch {
        // idem arriba.
      }
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  return {
    installed,
    canInstall: deferredPrompt !== null,
    isIOSDevice,
    promptInstall,
  };
}
