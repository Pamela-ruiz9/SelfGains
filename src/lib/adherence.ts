import { getTodayWeekday, type RoutineDays } from './weekdays';

export interface WeekAdherence {
  scheduledDays: number; // routine days from Monday..today that have already happened
  completedDays: number; // of those, how many have a logged workout
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Local calendar date as "YYYY-MM-DD" — deliberately not toISOString(),
// which converts to UTC first and can shift the date near midnight.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Adherence for the current calendar week (Monday..today only) — future
// scheduled days haven't happened yet, so they shouldn't count against you.
export function weekAdherence(routineDays: RoutineDays, workoutDates: Set<string>): WeekAdherence {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = mondayOf(today);

  let scheduledDays = 0;
  let completedDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > today) break;
    const weekday = getTodayWeekday(d);
    if (routineDays[weekday].length === 0) continue;
    scheduledDays++;
    if (workoutDates.has(localDateStr(d))) completedDays++;
  }
  return { scheduledDays, completedDays };
}
