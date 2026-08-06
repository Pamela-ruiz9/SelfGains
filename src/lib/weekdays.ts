export const WEEKDAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type RoutineDays = Record<Weekday, string[]>;

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

export function getTodayWeekday(date: Date = new Date()): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
