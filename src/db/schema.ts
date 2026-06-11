import Dexie, { type Table } from 'dexie';

// ==========================================
// 1. TypeScript Interfaces for Health Data
// ==========================================

export interface StepCount {
  id: string;          // Typically the date (YYYY-MM-DD) or UUID
  date: string;        // YYYY-MM-DD format for easy daily grouping
  count: number;       // Number of steps
  calories: number;    // Calories burned (kcal)
  distance: number;    // Distance in meters
  activeTime: number;  // Active duration in milliseconds
}

export interface HeartRateRecord {
  id: string;          // Unique identifier (UUID or timestamp-based)
  timestamp: number;   // Epoch milliseconds
  bpm: number;         // Beats per minute
}

export interface SleepStage {
  stage: 'awake' | 'light' | 'deep' | 'rem';
  startTime: number;   // Epoch milliseconds
  endTime: number;     // Epoch milliseconds
}

export interface SleepSession {
  id: string;          // Unique identifier from Samsung Health
  startTime: number;   // Epoch milliseconds
  endTime: number;     // Epoch milliseconds
  duration: number;    // Total duration in minutes
  efficiency: number;  // Sleep efficiency percentage (0-100)
  stages: SleepStage[]; // Detailed sleep stages (nested array)
}

export interface Workout {
  id: string;          // Unique identifier
  type: string;        // e.g., 'running', 'walking', 'cycling', 'swimming'
  startTime: number;   // Epoch milliseconds
  endTime: number;     // Epoch milliseconds
  duration: number;    // Duration in milliseconds
  calories: number;    // Calories burned (kcal)
  distance?: number;   // Distance in meters (optional, e.g., not for yoga)
  avgHeartRate?: number; // Average heart rate (bpm)
  maxHeartRate?: number; // Maximum heart rate (bpm)
}

// ==========================================
// 2. Dexie Database Definition
// ==========================================

export class HealthDatabase extends Dexie {
  // Declare implicit table properties with types
  steps!: Table<StepCount, string>;
  heartRate!: Table<HeartRateRecord, string>;
  sleep!: Table<SleepSession, string>;
  workouts!: Table<Workout, string>;

  constructor() {
    super('SamsungHealthDatabase');

    // Define tables and indexes.
    // CRITICAL: We only define fields we want to INDEX (query or sort by).
    // Non-indexed fields (like sleep stages or distance) can still be stored,
    // but they don't need to be declared in the schema string.
    this.version(1).stores({
      steps: 'id, date',
      heartRate: 'id, timestamp',
      sleep: 'id, startTime, endTime',
      workouts: 'id, startTime, type',
    });
  }
}

// Export a single, global database instance
export const db = new HealthDatabase();

// ==========================================
// 3. Database Utility Helpers
// ==========================================

/**
 * Clears all health data from the database.
 * Useful for resetting the dashboard or preparing for a clean import.
 */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', [db.steps, db.heartRate, db.sleep, db.workouts], async () => {
    await Promise.all([
      db.steps.clear(),
      db.heartRate.clear(),
      db.sleep.clear(),
      db.workouts.clear(),
    ]);
  });
}

/**
 * Returns a summary of the current record counts in the database.
 */
export async function getDatabaseStats() {
  const [stepsCount, hrCount, sleepCount, workoutsCount] = await Promise.all([
    db.steps.count(),
    db.heartRate.count(),
    db.sleep.count(),
    db.workouts.count(),
  ]);

  return {
    steps: stepsCount,
    heartRate: hrCount,
    sleep: sleepCount,
    workouts: workoutsCount,
    hasData: stepsCount > 0 || hrCount > 0 || sleepCount > 0 || workoutsCount > 0,
  };
}