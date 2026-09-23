# App bilingüe ES/EN — infraestructura + traducción de interfaz — diseño

Pedido directo de Pam: hacer SelfGains bilingüe. Este proyecto se decidió explícitamente dividir en dos rondas independientes durante el brainstorm (ver discusión previa): esta primera ronda cubre **infraestructura i18n + traducción de la interfaz** (nav, botones, formularios, mensajes — todo el "chrome" de la app). La traducción del **contenido** (nombres/instrucciones de los 86 ejercicios y planes de rutina) queda para una segunda ronda, con su propio brainstorm, porque depende de que esta infraestructura ya exista.

## Por qué se dividió así

Sin la infraestructura de ruteo/diccionario, no hay dónde mostrar contenido traducido. Con la infraestructura sola (sin traducir contenido todavía), la app ya es útil en inglés — la interfaz responde en inglés, aunque los nombres de ejercicios sigan en español hasta la ronda 2. Este estado intermedio es aceptado a propósito, no un bug.

## 1. Ruteo (`astro.config.mjs`)

Astro trae soporte i18n nativo — se usa en vez de una librería externa (`i18next`, etc.), que sería sobre-ingeniería para el tamaño de este proyecto:

```js
i18n: {
  defaultLocale: 'es',
  locales: ['es', 'en'],
  routing: { prefixDefaultLocale: false },
}
```

Español sigue viviendo en `/SelfGains/...` exactamente como hoy — ninguna URL existente cambia, no se rompe la PWA ya instalada de nadie ni links compartidos viejos. Inglés pasa a vivir en `/SelfGains/en/...`. El prefijo de idioma se compone con el `base: '/SelfGains/'` que ya existe para GitHub Pages sin conflicto (el base es el prefijo de despliegue, el locale es un prefijo de ruta por encima).

## 2. Diccionario de textos (`src/i18n/`)

- `src/i18n/es.ts` exporta un objeto anidado por pantalla/sección (`nav`, `perfil`, `rutinas`, `registrar`, `progreso`, `ejercicios`, `auth`, etc.) con todos los textos de UI actuales — nav, botones, labels de formulario, mensajes de error/éxito, textos de estado vacío, aria-labels.
- `src/i18n/en.ts` exporta un objeto del mismo tipo TypeScript exacto (`satisfies typeof es` o un type compartido) — si falta una clave o el tipo no calza, el build falla. Esto hace imposible que un string quede sin traducir en silencio.
- Sin librería de i18n, sin Context de React: cada página `.astro` calcula `const dict = Astro.currentLocale === 'en' ? en : es;` y pasa la porción correspondiente (`dict.nav`, `dict.perfil`, etc.) como prop a sus islands de React — mismo patrón que la app ya usa para pasar datos (`activities`, `plans`) de Astro a React, no se introduce un mecanismo nuevo.
- El contenido de `src/content/activities/*.md` y `src/content/plans/*.md` (nombres, instrucciones) **no** pasa por este diccionario — sigue viniendo directo del content collection, en español, hasta la ronda 2.

## 3. Selector de idioma

Dos superficies (confirmado con mockup durante el brainstorm — opción "los dos combinados"):

1. Un toggle chico ES/EN en `Nav.astro`, siempre visible, un tap cambia de idioma sin perder la pantalla actual (recalcula la URL equivalente en el otro locale).
2. La misma elección reflejada en Perfil, junto a Apariencia — mismo lugar donde ya viven tema/acento.

Persistencia: local (`localStorage`, mismo patrón que tema/acento) y, si hay sesión activa, también en el perfil de Supabase — mismo patrón dual que ya usa `theme`/`accent_color` hoy (local para el primer paint antes de cargar el perfil, Supabase como fuente de verdad entre dispositivos). Esto implica una columna nueva en `profiles` (`locale text not null default 'es'`) y su lectura/escritura en `src/lib/profile.ts`, igual que las columnas existentes.

## 4. Detección en la primera visita

El sitio es 100% estático (GitHub Pages, `output: 'static'`) — no hay servidor que pueda inspeccionar el header `Accept-Language` antes de responder. La detección es client-side: el mismo script inline en `BaseLayout.astro` que ya aplica tema/acento antes del primer paint (evita el flash) se extiende para, **solo si no hay preferencia de idioma guardada todavía** (primera visita real, no una visita siguiente), leer `navigator.language` y, si empieza con `"en"`, redirigir una vez a la URL equivalente bajo `/en/`. Cualquier visita posterior respeta la preferencia ya guardada, sin volver a chequear el navegador.

## 5. Páginas en inglés (`src/pages/en/*.astro`)

Un archivo espejo por cada una de las 13 páginas actuales (`index`, `login`, `registro-cuenta`, `olvide-contrasena`, `restablecer-contrasena`, `perfil`, `ejercicios`, `rutinas`, `registro/nuevo`, `progreso`, `sincronizacion`, `conexiones`, `c` — redención de invitación). Cada archivo espejo es una capa fina: importa el mismo `BaseLayout`/componentes que ya existen, la única diferencia es que usa `en` en vez de `es` como diccionario. No se duplica lógica de negocio, ni layout, ni componentes — solo el archivo de ruteo en sí. Ninguna de estas páginas es "solo contenido" — todas tienen interfaz (formularios, botones, nav) que sí se traduce, aunque el contenido que puedan mostrar (ejercicios dentro de Ejercicios, por ejemplo) siga en español.

## 6. Qué NO incluye esta ronda (a propósito)

- **Contenido de ejercicios/rutinas** (nombres, instrucciones de los 86 archivos) — sigue en español aunque la interfaz esté en inglés. Es la ronda 2, con su propio brainstorm.
  - Nota de una discusión durante este brainstorm: cuando llegue la ronda 2, las imágenes ya curadas (`public/exercises/*.webp`) se van a poder seguir usando tal cual para la versión en inglés de cada ejercicio, sin volver a curar nada — una foto no tiene idioma, y el campo `image` queda atado al ejercicio, no al idioma de su contenido. Se evaluó la alternativa de curar imágenes por separado por idioma como técnica de control de calidad y se descartó por ahora (duplica el trabajo de curación y genera una inconsistencia visual — el mismo ejercicio mostraría fotos distintas según el idioma). Si en algún momento se quiere auditar la curación existente, es más barato pedir una re-revisión de lo ya curado que duplicar el trabajo entero — eso se puede hacer en cualquier momento, sin depender de esta feature.
- Templates de email de Supabase (confirmación de cuenta, recuperar contraseña) — no viven en este repo, se configuran en el dashboard de Supabase, fuera de este alcance.
- Traducir el manifest de la PWA (nombre/descripción que se ve al instalar la app) — detalle menor, no bloqueante, se puede sumar después.
- Precachear la versión en inglés en el service worker para uso offline — el shell cacheado hoy es mínimo (`/`, favicon, manifest); sumar `/en/` ahí es un cambio chico y aislado que se puede hacer en cualquier momento después, no bloquea esta ronda.

## Verificación

Sin suite automatizada, por convención del proyecto. `npm run build && npx tsc --noEmit` limpios (el chequeo de tipos del diccionario `en.ts` contra `es.ts` es la primera línea de defensa contra strings sin traducir). Recorrido visual con Playwright: navegar el sitio completo en `/en/` confirmando que cada pantalla muestra texto en inglés (nav, botones, formularios, mensajes de error simulados), cambiar de idioma desde el toggle del Nav y desde Perfil, confirmar persistencia tras recargar y tras cerrar/abrir sesión, y confirmar que el contenido de ejercicios (nombres/instrucciones) sigue en español en ambos idiomas — ese es el comportamiento esperado de esta ronda, no un bug a corregir.
