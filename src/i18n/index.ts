import { es } from './es';
import { en } from './en';
import type { Dictionary } from './es';

export type { Dictionary };

export function getDictionary(locale: string | undefined): Dictionary {
  return locale === 'en' ? en : es;
}

// Arma un href para "path" (relativo, sin barra inicial, ej. "rutinas/") en
// el locale dado. Español no lleva prefijo (prefixDefaultLocale: false),
// inglés vive bajo "/en/".
export function localePath(locale: string, base: string, path: string): string {
  return locale === 'en' ? `${base}en/${path}` : `${base}${path}`;
}

// Dado el pathname actual completo (con base incluido, ej.
// "/SelfGains/en/rutinas/"), arma el path a la misma pantalla en el otro
// idioma — usado por el selector de idioma para no perder la pantalla
// actual al cambiar de locale.
export function otherLocaleHref(pathname: string, base: string): string {
  const isEnglish = pathname.startsWith(`${base}en/`);
  const neutral = isEnglish ? pathname.slice(`${base}en/`.length) : pathname.slice(base.length);
  return isEnglish ? `${base}${neutral}` : `${base}en/${neutral}`;
}
