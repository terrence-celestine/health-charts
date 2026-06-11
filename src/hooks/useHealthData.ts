import { useLiveQuery } from 'dexie-react-hooks';
import { db, type StepCount, type HeartRateRecord, type SleepSession, type Workout } from '../db/schema';
import { downsampleLTTB } from '../utils/downsample';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Helper to get start and end of day in timestamps
const getDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
};

/**
 * Hook to query and aggregate step count data within a date range.
 */
export function useSteps(range: DateRange) {
  const startStr = range.startDate.toISOString().split('0')[0]; // Format: YYYY-MM-DD
  const endStr = range.endDate.toISOString().split('0')[0];

  return useLiveQuery(async () => {
    // Query steps table between two dates (inclusive)
    const records = await db.steps
      .where('date')
      .between(
        range.startDate.toISOString().split('T')[0],
        range.endDate.toISOString().split('T')[0],
        true,
        true
      )
      .sortBy('date');

    const totalSteps = records.reduce((sum, r) => sum + r.count, 0);
    const totalCalories = records.reduce((sum, r) => sum + r.calories, 0);
    const totalDistance = records.reduce((sum, r) => sum + r.distance, 0);
    const totalActiveTime = records.reduce((sum, r) => sum + r.activeTime, 0);

    return {
      records,
      summary: {
        totalSteps,
        avgSteps: records.length ? Math.round(totalSteps / records.length) : 0,
        totalCalories,
        totalDistanceKm: Number((totalDistance / 1000).toFixed(2)),
        avgActiveMinutes: records.length 
          ? Math.round((totalActiveTime / records.length) / (1000 * 60)) 
          : 0,
      }
    };
  }, [range.startDate.getTime(), range.endDate.getTime()]);
}

/**
 * Hook to query and downsample heart rate data within a date range.
 */
export function useHeartRate(range: DateRange, chartPointsThreshold = 600) {
  const startMs = range.startDate.getTime();
  const endMs = range.endDate.getTime();

  return useLiveQuery(async () => {
    // Query heart rate records within timestamp range
    const records = await db.heartRate
      .where('timestamp')
      .between(startMs, endMs, true, true)
      .sortBy('timestamp');

    if (records.length === 0) {
      return { records: [], chartData: [], summary: { min: 0, max: 0, avg: 0 } };
    }

    // Calculate summary statistics on raw records
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const r of records) {
      sum += r.bpm;
      if (r.bpm < min) min = r.bpm;
      if (r.bpm > max) max = r.bpm;
    }
    const avg = Math.round(sum / records.length);

    // Map to { x, y } for LTTB downsampling
    const lttbInput = records.map(r => ({
      x: r.timestamp,
      y: r.bpm,
      original: r,
    }));

    // Downsample high-frequency data for smooth chart rendering
    const downsampled = downsampleLTTB(lttbInput, chartPointsThreshold);

    // Map back to chart-friendly format
    const chartData = downsampled.map(pt => ({
      timestamp: pt.x,
      bpm: Math.round(pt.y),
      timeLabel: new Date(pt.x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: new Date(pt.x).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    }));

    return {
      records,
      chartData,
      summary: { min, max, avg },
    };
  }, [startMs, endMs, chartPointsThreshold]);
}

/**
 * Hook to query sleep sessions within a date range.
 */
export function useSleep(range: DateRange) {
  const startMs = range.startDate.getTime();
  const endMs = range.endDate.getTime();

  return useLiveQuery(async () => {
    const sessions = await db.sleep
      .where('startTime')
      .between(startMs, endMs, true, true)
      .sortBy('startTime');

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = sessions.length ? totalDuration / sessions.length : 0;
    const avgEfficiency = sessions.length 
      ? Math.round(sessions.reduce((sum, s) => sum + s.efficiency, 0) / sessions.length) 
      : 0;

    return {
      sessions,
      summary: {
        totalSessions: sessions.length,
        avgDurationHours: Number((avgDuration / 60).toFixed(1)),
        avgEfficiency,
      }
    };
  }, [startMs, endMs]);
}

/**
 * Hook to query workouts within a date range.
 */
export function useWorkouts(range: DateRange) {
  const startMs = range.startDate.getTime();
  const endMs = range.endDate.getTime();

  return useLiveQuery(async () => {
    const workouts = await db.workouts
      .where('startTime')
      .between(startMs, endMs, true, true)
      .sortBy('startTime');

    const totalCalories = workouts.reduce((sum, w) => sum + w.calories, 0);
    const totalDurationMs = workouts.reduce((sum, w) => sum + w.duration, 0);

    return {
      workouts,
      summary: {
        totalWorkouts: workouts.length,
        totalCalories,
        totalDurationMinutes: Math.round(totalDurationMs / (1000 * 60)),
      }
    };
  }, [startMs, endMs]);
}