import type { Dictionary } from '../i18n/es';

export type Locale = 'es' | 'en';

// Solo lo que el helper necesita del diccionario — así los tests le pasan un
// objeto chico y no hay que importar es.ts/en.ts.
type Vocab = Pick<Dictionary, 'equipment' | 'planLevels' | 'groups'>;

// Formas estructurales (no CollectionEntry) para que el helper no dependa de
// `astro:content` y se pueda ejecutar en los tests con node.
interface ActivityEntryLike {
  id: string;
  body?: string;
  data: {
    name: string;
    name_en: string;
    instructions_en: string;
    discipline: 'gym' | 'running' | 'natacion' | 'combate';
    metricType: 'sets' | 'session';
    group?: string;
    muscles?: string[];
    equipment?: string;
    image?: string;
  };
}

interface PlanEntryLike<Days> {
  id: string;
  data: {
    name: string;
    name_en: string;
    goal: string;
    goal_en: string;
    level: string;
    sex?: 'femenino' | 'masculino';
    days: Days;
  };
}

// Las claves de los vocabularios son los valores en español tal como están en
// los .md; un valor sin entrada se muestra tal cual.
function lookup(map: object, key: string): string {
  return (map as Record<string, string>)[key] ?? key;
}

export function localizeActivity(entry: ActivityEntryLike, locale: Locale, vocab: Vocab) {
  const d = entry.data;
  const en = locale === 'en';
  return {
    id: entry.id,
    name: en ? d.name_en : d.name,
    description: en ? d.instructions_en : (entry.body?.trim() ?? ''),
    discipline: d.discipline,
    metricType: d.metricType,
    group: d.group,
    groupLabel: d.group ? lookup(vocab.groups, d.group) : undefined,
    equipment: d.equipment ? lookup(vocab.equipment, d.equipment) : undefined,
    muscles: d.muscles,
    image: d.image,
  };
}

export function localizePlan<Days>(entry: PlanEntryLike<Days>, locale: Locale, vocab: Vocab) {
  const d = entry.data;
  const en = locale === 'en';
  return {
    id: entry.id,
    name: en ? d.name_en : d.name,
    goal: en ? d.goal_en : d.goal,
    // `level` queda en español a propósito: es la clave que compara
    // isRecommendedGymPlan con el nivel del perfil. `levelLabel` es solo
    // para mostrar.
    level: d.level,
    levelLabel: lookup(vocab.planLevels, d.level),
    sex: d.sex,
    days: d.days,
  };
}
