import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout, getSessionsForWorkout } from '../../../lib/workouts';
import { getMyMeasurements } from '../../../lib/measurements';
import { getMyProfile } from '../../../lib/profile';
import { estimateBodyFatPercent } from '../../../lib/bodyComposition';
import {
  calculatePRs,
  groupPRsByMuscle,
  progressForExercise,
  calculateCardioPRs,
  groupCardioPRsByDiscipline,
  progressForCardioActivity,
  progressForMeasurement,
  summarizeByDiscipline,
  mostRecentPR,
  weightTrend,
  topDiscipline,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import { weekAdherence } from '../../../lib/adherence';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import { getFitbitConnectionStatus, getFitbitDailyData, type FitbitDailyData } from '../../../lib/fitbit';
import { localDateStr } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import type { Measurement } from '../../../types/db';
import DisciplineSummary from './DisciplineSummary';
import FitbitActivitySummary, { formatMinutes } from './FitbitActivitySummary';
import MeasurementsSummary, { MEASUREMENT_DISPLAY_FIELDS } from './MeasurementsSummary';
import MeasurementsChart from './MeasurementsChart';
import PRGrid from './PRGrid';
import ProgressChart from './ProgressChart';
import CardioPRGrid from './CardioPRGrid';
import CardioProgressChart from './CardioProgressChart';
import ProgressSectionGrid, { type SectionKey } from './ProgressSectionGrid';
import ProgressSummaryStrip from './ProgressSummaryStrip';
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
  musclesT: Dictionary['muscles'];
}

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

export default function ProgressList({
  exerciseNames,
  exercises,
  activities,
  t,
  registrarT,
  disciplinesT,
  musclesT,
}: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [sex, setSex] = useState<'femenino' | 'masculino' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedCardioActivityId, setSelectedCardioActivityId] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [weightUnit] = useState(() => getWeightUnit());
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitData, setFitbitData] = useState<FitbitDailyData | null>(null);
  const [fitbitError, setFitbitError] = useState<string | null>(null);
  // Ninguna tarjeta arranca activa — el usuario elige cuál abrir, nada se
  // le impone expandido de entrada. Tocar la misma tarjeta activa la cierra.
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  function toggleSection(section: SectionKey) {
    setActiveSection((prev) => (prev === section ? null : section));
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
      const [, , profile] = await Promise.all([
        loadWorkouts(),
        getMyMeasurements().then(setMeasurements),
        getMyProfile().catch(() => null),
      ]);
      setSex(profile?.sex ?? null);
    });
  }, []);

  useEffect(() => {
    function onSyncComplete() {
      loadWorkouts();
    }
    window.addEventListener('selfgains:sync-complete', onSyncComplete);
    return () => window.removeEventListener('selfgains:sync-complete', onSyncComplete);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    getFitbitConnectionStatus()
      .then(async (status) => {
        setFitbitConnected(status.connected);
        if (!status.connected) return;
        try {
          const data = await getFitbitDailyData(localDateStr());
          if (data === null) {
            setFitbitError(t.fitbitActivity.disconnectedError);
          } else {
            setFitbitData(data);
          }
        } catch {
          setFitbitError(t.fitbitActivity.loadError);
        }
      })
      .catch(() => {
        // No se pudo ni chequear el estado de conexión — se trata igual
        // que "no conectado", el resto de Progreso sigue funcionando.
      });
  }, [isLoggedIn]);

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

  const trainedDates = new Set(workouts.map((w) => w.date));
  const adherence = weekAdherence(trainedDates);

  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
  const activityNameById = new Map(activities.map((a) => [a.id, a.name]));
  const recentPR = mostRecentPR(
    prs,
    cardioPrs,
    exerciseNameById,
    activityNameById,
    weightUnit,
    kgToDisplay
  );
  const disciplineCount = disciplineSummaries.length;
  const bodyFatPercent = estimateBodyFatPercent({
    sex,
    neckCm: latestMeasurement?.neck_cm ?? null,
    waistCm: latestMeasurement?.waist_cm ?? null,
    hipCm: latestMeasurement?.hip_cm ?? null,
    heightCm: latestMeasurement?.height_cm ?? null,
  });

  const weightTrendResult = weightTrend(measurements);
  const weightTrendKg = weightTrendResult?.deltaKg ?? null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = localDateStr(sevenDaysAgo);
  const recentWorkouts = workouts.filter((w) => w.date >= sevenDaysAgoStr);
  const weekTopDiscipline = topDiscipline(summarizeByDiscipline(recentWorkouts, activities));
  const allTimeTopDiscipline = topDiscipline(disciplineSummaries);
  const leadingDisciplineInfo = weekTopDiscipline
    ? { discipline: weekTopDiscipline.discipline, sessionCount: weekTopDiscipline.sessionCount, isThisWeek: true }
    : allTimeTopDiscipline
      ? { discipline: allTimeTopDiscipline.discipline, sessionCount: allTimeTopDiscipline.sessionCount, isThisWeek: false }
      : null;

  const mostRecentWorkoutDate =
    workouts.length > 0 ? workouts.reduce((max, w) => (w.date > max ? w.date : max), workouts[0].date) : null;

  const activityPreview =
    !fitbitConnected || !fitbitData
      ? null
      : fitbitData.caloriesOut !== null
        ? { value: `${Math.round(fitbitData.caloriesOut)} kcal`, sub: t.sectionGrid.caloriesSub }
        : fitbitData.activeMinutes !== null
          ? { value: formatMinutes(Math.round(fitbitData.activeMinutes)), sub: t.sectionGrid.activeMinutesSub }
          : fitbitData.restingHeartRate !== null
            ? { value: `${fitbitData.restingHeartRate} bpm`, sub: t.sectionGrid.heartRateSub }
            : null;
  const showActivityCard = fitbitConnected;

  const panels: Record<SectionKey, ReactNode> = {
    medidas: (
      <>
        <MeasurementsSummary
          latest={latestMeasurement}
          sex={sex}
          selected={selectedMeasurement}
          onSelect={setSelectedMeasurement}
          t={t.measurementsSummary}
        />
        {selectedMeasurement === 'body_fat_percent' ? (
          <MeasurementsChart
            label={t.measurementsSummary.fields.bodyFat}
            unit="%"
            points={measurements
              .map((m) => ({
                date: m.date,
                value: estimateBodyFatPercent({
                  sex,
                  neckCm: m.neck_cm,
                  waistCm: m.waist_cm,
                  hipCm: m.hip_cm,
                  heightCm: m.height_cm,
                }),
              }))
              .filter((p): p is { date: string; value: number } => p.value !== null)}
          />
        ) : (
          selectedMeasurementField && (
            <MeasurementsChart
              label={t.measurementsSummary.fields[selectedMeasurementField.labelKey]}
              unit={selectedMeasurementField.unit}
              points={progressForMeasurement(measurements, selectedMeasurementField.key)}
            />
          )
        )}
      </>
    ),
    disciplina: (
      <>
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
            muscleLabels={musclesT}
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
      </>
    ),
    entrenamientos: (
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
    ),
    actividad: fitbitError ? (
      <p className="border-l border-blood pl-3 font-mono text-sm text-blood">{fitbitError}</p>
    ) : fitbitData ? (
      <FitbitActivitySummary data={fitbitData} t={t.fitbitActivity} />
    ) : (
      <p className="font-mono text-sm text-paper-dim">{t.list.loading}</p>
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <ProgressSummaryStrip
        daysTrained={adherence.daysTrained}
        daysElapsed={adherence.daysElapsed}
        lastWeightKg={latestMeasurement?.weight_kg ?? null}
        weightUnit={weightUnit}
        kgToDisplay={kgToDisplay}
        recentPRLabel={recentPR ? `${recentPR.label} — ${recentPR.display}` : null}
        totalWorkouts={workouts.length}
        disciplineCount={disciplineCount}
        bodyFatPercent={bodyFatPercent}
        stepsToday={fitbitData?.steps ?? null}
        t={t.summary}
      />
      <ProgressSectionGrid
        active={activeSection}
        onSelect={toggleSection}
        weightTrendKg={weightTrendKg}
        measurementsCount={measurements.length}
        leadingDiscipline={leadingDisciplineInfo}
        mostRecentWorkoutDate={mostRecentWorkoutDate}
        activityPreview={activityPreview}
        showActivityCard={showActivityCard}
        panels={panels}
        disciplinesT={disciplinesT}
        disciplineSummaryT={t.disciplineSummary}
        sectionsT={t.list.sections}
        activityTitle={t.fitbitActivity.title}
        t={t.sectionGrid}
      />
    </div>
  );
}
