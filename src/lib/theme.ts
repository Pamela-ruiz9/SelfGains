export type ThemeMode = 'light' | 'dark';

export const DEFAULT_ACCENT = '#d7ff3f';
export const THEME_STORAGE_KEY = 'selfgains-theme';
export const ACCENT_STORAGE_KEY = 'selfgains-accent';

// Applies the theme/accent to the current page immediately (so a change in
// the profile picker previews live) and caches it in localStorage so the
// inline head script in BaseLayout can paint the right theme on the very
// next page load before any component has fetched the Supabase profile.
export function applyTheme(theme: ThemeMode, accentColor: string): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--color-acid', accentColor);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // the theme still applies for this page load, it just won't persist.
  }
}
