export type ThemeMode = 'light' | 'dark';

export type AccentGradientId = 'f1' | 'f2' | 'f3';

interface AccentGradientPreset {
  gradient: string;
  solid: string;
  onAccent: string;
}

// 3 presets curados con mockups durante el brainstorm de modernización
// (2026-09-22) — conviven con la opción de color sólido libre que ya
// existía (el <input type="color"> en ProfileForm), no la reemplazan.
// `solid` es el color representativo usado para texto/bordes (--color-acid,
// que no puede llevar un degradado — solo background-image sí). `onAccent`
// varía por preset porque F2 (magenta) necesita texto claro para contraste,
// a diferencia de los otros dos.
// NOTA: Esta tabla está duplicada manualmente en src/layouts/BaseLayout.astro
// (en un script is:inline que corre antes del first paint) — si añades/cambias un
// preset aquí, espéjalo también en BaseLayout.astro para mantenerlo sincronizado.
export const ACCENT_GRADIENTS: Record<AccentGradientId, AccentGradientPreset> = {
  f1: { gradient: 'linear-gradient(135deg, #4f9dfe, #9b5cf6)', solid: '#8fb4fb', onAccent: '#0c0c0a' },
  f2: { gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)', solid: '#c98cf0', onAccent: '#ffffff' },
  f3: { gradient: 'linear-gradient(135deg, #22d3ee, #3b82f6)', solid: '#67d8f0', onAccent: '#0c0c0a' },
};

export const DEFAULT_ACCENT: AccentGradientId = 'f3';
export const THEME_STORAGE_KEY = 'selfgains-theme';
export const ACCENT_STORAGE_KEY = 'selfgains-accent';

function isAccentGradientId(value: string): value is AccentGradientId {
  return value === 'f1' || value === 'f2' || value === 'f3';
}

// El acento guardado es o bien uno de los 3 ids de degradado curados
// ("f1"/"f2"/"f3") o un hex sólido elegido libremente por el usuario con el
// selector de color nativo (compatibilidad con lo que ya se guardaba antes
// de que existieran los degradados — no hace falta migrar datos
// existentes, se distingue por la forma del string). Aplica siempre las
// tres variables juntas: --color-acid (sólido, para texto/borde),
// --gradient-acid (para los rellenos que la soportan, "none" en modo
// sólido) y --color-on-accent (texto legible arriba del relleno).
export function applyTheme(theme: ThemeMode, accent: string): void {
  document.documentElement.dataset.theme = theme;
  const root = document.documentElement.style;
  if (isAccentGradientId(accent)) {
    const preset = ACCENT_GRADIENTS[accent];
    root.setProperty('--color-acid', preset.solid);
    root.setProperty('--gradient-acid', preset.gradient);
    root.setProperty('--color-on-accent', preset.onAccent);
  } else {
    root.setProperty('--color-acid', accent);
    root.setProperty('--gradient-acid', 'none');
    root.setProperty('--color-on-accent', '#0c0c0a');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // the theme still applies for this page load, it just won't persist.
  }
}
