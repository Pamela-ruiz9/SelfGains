import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout, getSessionsForWorkout } from '../../../lib/workouts';
import { getMyMeasurements } from '../../../lib/measurements';
import {
  calculatePRs,
  groupPRsByMuscle,
  progressForExercise,
  calculateCardioPRs,
  groupCardioPRsByDiscipline,
  progressForCardioActivity,
  progressForMeasurement,
  summarizeByDiscipline,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import type { Measurement } from '../../../types/db';
import CollapsibleSection from '../Shared/CollapsibleSection';
import DisciplineSummary from './DisciplineSummary';
import MeasurementsSummary, { MEASUREMENT_DISPLAY_FIELDS } from './MeasurementsSummary';
import MeasurementsChart from './MeasurementsChart';
import PRGrid from './PRGrid';
import ProgressChart from './ProgressChart';
import CardioPRGrid from './CardioPRGrid';
import CardioProgressChart from './CardioProgressChart';
import WorkoutHistory from './WorkoutHistory';
import type { Dictionary } from '../../../i18n/es';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  exerciseNames: Record<string, string>;
  exercises: ExerciseInfo[];
  activities: ActivityOption[];
  t: Dictionary['progreso'];
  registrarT: Dictionary['registrar']['logger'];
  disciplinesT: Dictionary['disciplines'];
}

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

export default function ProgressList({
  exerciseNames,
  exercises,
  activities,
  t,
  registrarT,
  disciplinesT,
}: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedCardioActivityId, setSelectedCardioActivityId] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  // Todas arrancan cerradas al entrar a la pestaña — el usuario elige qué
  // abrir, nada se le impone expandido de entrada.
  const [openSection, setOpenSection] = useState<'medidas' | 'disciplina' | 'entrenamientos' | null>(null);

  function toggleSection(section: 'medidas' | 'disciplina' | 'entrenamientos') {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  async function loadWorkouts() {
    try {
      const list = await getWorkoutsForCurrentUser();
      const withLogs = await Promise.all(
        list.map(async (w) => ({
          ...w,
          sets: await getSetsForWorkout(w.id),
          sessions: await getSessionsForWorkout(w.id),
        }))
      );
      setWorkouts(withLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.list.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      await Promise.all([loadWorkouts(), getMyMeasurements().then(setMeasurements)]);
    });
  }, []);

  useEffect(() => {
    function onSyncComplete() {
      loadWorkouts();
    }
    window.addEventListener('selfgains:sync-complete', onSyncComplete);
    return () => window.removeEventListener('selfgains:sync-complete', onSyncComplete);
  }, []);

  const prs = calculatePRs(workouts);
  const muscleGroups = groupPRsByMuscle(prs, exercises);

  const cardioPrs = calculateCardioPRs(workouts);
  const disciplineSummaries = summarizeByDiscipline(workouts, activities);

  // Scoped to whichever discipline card is selected, so drilling into
  // "Running" or "Natación" shows only that discipline's records/activities
  // instead of both cardio disciplines at once.
  const cardioPrsForSelected = selectedDiscipline
    ? cardioPrs.filter(
        (pr) => activities.find((a) => a.id === pr.activityId)?.discipline === selectedDiscipline
      )
    : [];
  const cardioActivitiesForSelected = selectedDiscipline
    ? activities.filter((a) => a.discipline === selectedDiscipline)
    : [];
  const cardioGroupsForSelected = groupCardioPRsByDiscipline(cardioPrsForSelected, activities);

  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  useEffect(() => {
    if (selectedExerciseId === null && muscleGroups.length > 0) {
      setSelectedExerciseId(muscleGroups[0].entries[0].exerciseId);
    }
  }, [muscleGroups.length, selectedExerciseId]);

  useEffect(() => {
    setSelectedCardioActivityId(
      cardioGroupsForSelected.length > 0 ? cardioGroupsForSelected[0].entries[0].activityId : null
    );
  }, [selectedDiscipline]);

  if (!authChecked || loading) {
    return <p className="font-mono text-sm text-paper-dim">{t.list.loading}</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.list.notLoggedIn.prefix}{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          {t.list.notLoggedIn.link}
        </a>{' '}
        {t.list.notLoggedIn.suffix}
      </p>
    );
  }

  if (error) {
    return <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
  }

  if (workouts.length === 0 && measurements.length === 0) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        {t.list.empty}
      </p>
    );
  }

  const selectedMeasurementField = MEASUREMENT_DISPLAY_FIELDS.find((f) => f.key === selectedMeasurement);

  return (
    <div className="flex flex-col gap-6">
      <CollapsibleSection
        title={t.list.sections.measurements}
        open={openSection === 'medidas'}
        onToggle={() => toggleSection('medidas')}
      >
        <MeasurementsSummary
          latest={latestMeasurement}
          selected={selectedMeasurement}
          onSelect={setSelectedMeasurement}
          t={t.measurementsSummary}
        />
        {selectedMeasurementField && (
          <MeasurementsChart
            label={t.measurementsSummary.fields[selectedMeasurementField.labelKey]}
            unit={selectedMeasurementField.unit}
            points={progressForMeasurement(measurements, selectedMeasurementField.key)}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t.list.sections.discipline}
        open={openSection === 'disciplina'}
        onToggle={() => toggleSection('disciplina')}
      >
        <DisciplineSummary
          summaries={disciplineSummaries}
          selected={selectedDiscipline}
          onSelect={setSelectedDiscipline}
          t={t.disciplineSummary}
          disciplinesT={disciplinesT}
        />

        {selectedDiscipline === 'gym' && (
          <PRGrid
            prs={prs}
            exercises={exercises}
            onSelectExercise={setSelectedExerciseId}
            selectedExerciseId={selectedExerciseId}
            t={t.prGrid}
            chart={
              selectedExerciseId && (
                <ProgressChart
                  exerciseId={selectedExerciseId}
                  points={progressForExercise(workouts, selectedExerciseId)}
                  exercises={exercises}
                  onSelectExercise={setSelectedExerciseId}
                  t={t.progressChart}
                />
              )
            }
          />
        )}

        {(selectedDiscipline === 'running' || selectedDiscipline === 'natacion') && (
          <CardioPRGrid
            prs={cardioPrsForSelected}
            activities={cardioActivitiesForSelected}
            onSelectActivity={setSelectedCardioActivityId}
            selectedActivityId={selectedCardioActivityId}
            t={t.cardioPrGrid}
            disciplinesT={disciplinesT}
            chart={
              selectedCardioActivityId && (
                <CardioProgressChart
                  activityId={selectedCardioActivityId}
                  points={progressForCardioActivity(workouts, selectedCardioActivityId)}
                  activities={cardioActivitiesForSelected}
                  onSelectActivity={setSelectedCardioActivityId}
                  t={t.cardioProgressChart}
                />
              )
            }
          />
        )}

        {selectedDiscipline === 'combate' && (
          <p className="font-mono text-sm text-paper-dim">{t.list.combateNoRecords}</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t.list.sections.workouts}
        open={openSection === 'entrenamientos'}
        onToggle={() => toggleSection('entrenamientos')}
      >
        <WorkoutHistory
          workouts={workouts}
          exerciseNames={exerciseNames}
          activities={activities}
          onChanged={loadWorkouts}
          filterDiscipline={selectedDiscipline}
          t={t.workoutHistory}
          registrarT={registrarT}
          disciplinesT={disciplinesT}
        />
      </CollapsibleSection>
    </div>
  );
}
