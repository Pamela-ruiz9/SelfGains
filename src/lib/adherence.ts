import { localDateStr } from './weekdays';

export interface WeekAdherence {
  daysElapsed: number; // days from Monday..today that have already happened
  daysTrained: number; // of those, how many have a logged workout
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Training days for the current calendar week (Monday..today only) — future
// days haven't happened yet, so they shouldn't count against you. Counts any
// day with a logged workout, regardless of what (if anything) the active
// routine scheduled for that day — this is "days trained this week", not
// "adherence to the routine's own schedule" (that distinction was an
// explicit product decision, not the original behavior).
export function weekAdherence(workoutDates: Set<string>): WeekAdherence {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = mondayOf(today);

  let daysElapsed = 0;
  let daysTrained = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > today) break;
    daysElapsed++;
    if (workoutDates.has(localDateStr(d))) daysTrained++;
  }
  return { daysElapsed, daysTrained };
}
