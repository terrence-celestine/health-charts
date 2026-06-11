import JSZip from 'jszip';
import Papa from 'papaparse';
import { db, type StepCount, type HeartRateRecord, type SleepSession, type SleepStage, type Workout } from '../db/schema';

// ==========================================
// 1. Worker Message Types
// ==========================================

export type WorkerStatus = 'idle' | 'extracting' | 'parsing' | 'saving' | 'completed' | 'error';

export interface WorkerProgress {
  status: WorkerStatus;
  progress: number; // 0 to 100
  message: string;
  stats?: {
    steps: number;
    heartRate: number;
    sleep: number;
    workouts: number;
  };
}

// ==========================================
// 2. Helper to Clean and Parse CSV
// ==========================================

function parseSamsungCSV<T>(csvText: string): T[] {
  const lines = csvText.split('\n');
  
  // Filter out comments (starting with '#') and the table name metadata line
  const cleanLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') {
      return false;
    }
    
    // Skip the Samsung table name metadata line (e.g. "com.samsung.shealth.tracker.pedometer_day_summary,6320001,7")
    // This line typically starts with "com.samsung." and has very few columns (e.g. less than 5)
    if (trimmed.startsWith('com.samsung.') && trimmed.split(',').length < 5) {
      console.log("Worker: Skipping Samsung metadata header line:", trimmed);
      return false;
    }
    
    return true;
  });
  
  const cleanCsv = cleanLines.join('\n');

  const parsed = Papa.parse<T>(cleanCsv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  return parsed.data;
}

// ==========================================
// 3. Web Worker Message Handler
// ==========================================

self.onmessage = async (event: MessageEvent<File>) => {
  const zipFile = event.data;
  console.log("Worker: Received file for processing:", zipFile.name, "Size:", zipFile.size, "bytes");

  try {
    postProgress('extracting', 10, 'Extracting Samsung Health export ZIP...');

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);
    const files = Object.keys(loadedZip.files);
    console.log("Worker: ZIP loaded successfully. Total files inside:", files.length);
    
    // Match only the main day summary CSV (e.g. com.samsung.shealth.tracker.pedometer_day_summary.20260604163364.csv)
    const dailyStepsKey = files.find(f => {
      const filename = f.split('/').pop() || '';
      return filename.startsWith('com.samsung.shealth.tracker.pedometer_day_summary.') && 
             filename.match(/^com\.samsung\.shealth\.tracker\.pedometer_day_summary\.\d+\.csv$/);
    });

    // Match only the main heart rate CSV (e.g. com.samsung.health.heart_rate.20260604163364.csv or com.samsung.shealth.tracker.heart_rate.20260604163364.csv)
    const hrFileKey = files.find(f => {
      const filename = f.split('/').pop() || '';
      return (filename.startsWith('com.samsung.health.heart_rate.') || filename.startsWith('com.samsung.shealth.tracker.heart_rate.')) && 
             filename.match(/^(com\.samsung\.health\.heart_rate|com\.samsung\.shealth\.tracker\.heart_rate)\.\d+\.csv$/);
    });

    // Match only the main sleep CSV (e.g. com.samsung.shealth.sleep.20260604163364.csv or com.samsung.health.sleep.20260604163364.csv)
    const sleepFileKey = files.find(f => {
      const filename = f.split('/').pop() || '';
      return (filename.startsWith('com.samsung.shealth.sleep.') || filename.startsWith('com.samsung.health.sleep.')) && 
             filename.match(/^(com\.samsung\.shealth\.sleep|com\.samsung\.health\.sleep)\.\d+\.csv$/);
    });

    // Match only the main exercise/workout CSV (e.g. com.samsung.shealth.exercise.20260604163364.csv or com.samsung.health.exercise.20260604163364.csv)
    const workoutFileKey = files.find(f => {
      const filename = f.split('/').pop() || '';
      return (filename.startsWith('com.samsung.shealth.exercise.') || filename.startsWith('com.samsung.health.exercise.')) && 
             filename.match(/^(com\.samsung\.shealth\.exercise|com\.samsung\.health\.exercise)\.\d+\.csv$/);
    });

    console.log("Worker: Match result for dailyStepsKey:", dailyStepsKey);
    console.log("Worker: Match result for hrFileKey:", hrFileKey);
    console.log("Worker: Match result for sleepFileKey:", sleepFileKey);
    console.log("Worker: Match result for workoutFileKey:", workoutFileKey);

    if (!dailyStepsKey) {
      throw new Error('Could not find pedometer day summary CSV file in the ZIP export. Ensure this is a valid Samsung Health export.');
    }

    // Clear existing database records before importing to avoid duplicates/conflicts
    postProgress('saving', 30, 'Clearing existing database...');
    console.log("Worker: Clearing existing steps, heart rate, sleep, and workouts in IndexedDB...");
    await db.transaction('rw', [db.steps, db.heartRate, db.sleep, db.workouts], async () => {
      await Promise.all([db.steps.clear(), db.heartRate.clear(), db.sleep.clear(), db.workouts.clear()]);
    });
    console.log("Worker: Database cleared successfully.");

    // ------------------------------------------
    // Parse & Save Step Count Data
    // ------------------------------------------
    postProgress('parsing', 50, 'Parsing Step Count data...');
    const stepsCsvText = await loadedZip.files[dailyStepsKey].async('text');
    console.log("Worker: Steps CSV text retrieved. Length:", stepsCsvText.length, "characters");
    
    const rawSteps = parseSamsungCSV<any>(stepsCsvText);
    console.log("Worker: Raw CSV rows parsed by PapaParse:", rawSteps.length);
    if (rawSteps.length > 0) {
      console.log("Worker: Sample raw row from CSV:", rawSteps[0]);
    }

    const normalizedSteps: StepCount[] = [];
    for (const row of rawSteps) {
      let date = '';
      const rawDayTime = row.day_time || row['com.samsung.health.pedometer_day_summary.day_time'];
      const rawCreateTime = row.create_time || row['com.samsung.health.pedometer_day_summary.create_time'];
      const datauuid = row.datauuid || row['com.samsung.health.pedometer_day_summary.datauuid'];

      if (rawDayTime) {
        // Convert epoch ms (e.g. 1734393600000) to YYYY-MM-DD
        const d = new Date(Number(rawDayTime));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        date = `${year}-${month}-${day}`;
      } else if (rawCreateTime) {
        date = String(rawCreateTime).split(' ')[0];
      }

      if (!date) continue;

      // Map columns robustly (handling both prefixed and non-prefixed columns)
      const count = Number(row.step_count || row.count || row['com.samsung.health.pedometer_day_summary.step_count'] || 0);
      const calories = Number(row.calorie || row.calories || row['com.samsung.health.pedometer_day_summary.calorie'] || 0);
      const distance = Number(row.distance || row['com.samsung.health.pedometer_day_summary.distance'] || 0);
      const activeTime = Number(row.active_time || row.activeTime || row['com.samsung.health.pedometer_day_summary.active_time'] || 0);

      normalizedSteps.push({
        id: datauuid || date,
        date,
        count,
        calories,
        distance,
        activeTime,
      });
    }

    console.log("Worker: Total normalized step records to save:", normalizedSteps.length);
    if (normalizedSteps.length > 0) {
      console.log("Worker: Sample normalized step record:", normalizedSteps[0]);
    }

    postProgress('saving', 75, `Saving ${normalizedSteps.length} step records...`);
    // Batch write steps in chunks of 500
    for (let i = 0; i < normalizedSteps.length; i += 500) {
      const chunk = normalizedSteps.slice(i, i + 500);
      console.log(`Worker: Writing chunk of ${chunk.length} records to IndexedDB...`);
      await db.steps.bulkPut(chunk);
    }
    console.log("Worker: All step records written to IndexedDB successfully!");

    // ------------------------------------------
    // Parse & Save Heart Rate Data (High-Frequency)
    // ------------------------------------------
    let heartRateCount = 0;
    if (hrFileKey) {
      postProgress('parsing', 80, 'Parsing Heart Rate records...');
      console.log("Worker: Loading Heart Rate CSV...");
      const hrCsvText = await loadedZip.files[hrFileKey].async('text');
      const rawHR = parseSamsungCSV<any>(hrCsvText);
      console.log("Worker: Heart Rate CSV rows parsed:", rawHR.length);
      
      const hrRecords: HeartRateRecord[] = [];

      for (const row of rawHR) {
        const rawStartTime = row.start_time || row['com.samsung.health.heart_rate.start_time'];
        const rawHeartRate = row.heart_rate || row['com.samsung.health.heart_rate.heart_rate'] || row.bpm;
        const datauuid = row.datauuid || row['com.samsung.health.heart_rate.datauuid'];
        const binningData = row.binning_data || row['com.samsung.health.heart_rate.binning_data'];

        const summaryTime = rawStartTime ? new Date(rawStartTime).getTime() : null;
        if (summaryTime && rawHeartRate) {
          hrRecords.push({
            id: datauuid || `hr_${summaryTime}`,
            timestamp: summaryTime,
            bpm: Number(rawHeartRate),
          });
        }

        // Check for high-frequency binning data (JSON file)
        const jsonPath = binningData;
        if (jsonPath && typeof jsonPath === 'string') {
          const normalizedPath = jsonPath.startsWith('/') ? jsonPath.substring(1) : jsonPath;
          const jsonFile = files.find(f => f.endsWith(normalizedPath));

          if (jsonFile) {
            try {
              const jsonText = await loadedZip.files[jsonFile].async('text');
              const rawBinning = JSON.parse(jsonText);

              if (Array.isArray(rawBinning)) {
                for (const hrPoint of rawBinning) {
                  const timestamp = hrPoint.time || hrPoint.start_time;
                  if (timestamp && hrPoint.heart_rate) {
                    hrRecords.push({
                      id: `hr_detail_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
                      timestamp: Number(timestamp),
                      bpm: Number(hrPoint.heart_rate),
                    });
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to parse heart rate binning JSON at ${jsonPath}:`, e);
            }
          }
        }
      }

      console.log("Worker: Total heart rate records to save (including high-frequency details):", hrRecords.length);
      postProgress('saving', 90, `Saving ${hrRecords.length} heart rate records...`);
      
      // Batch write heart rate in chunks of 5000
      for (let i = 0; i < hrRecords.length; i += 5000) {
        const chunk = hrRecords.slice(i, i + 5000);
        console.log(`Worker: Writing chunk of ${chunk.length} heart rate records to IndexedDB...`);
        await db.heartRate.bulkPut(chunk);
      }
      console.log("Worker: All heart rate records written to IndexedDB successfully!");
      heartRateCount = hrRecords.length;
    }

    // ------------------------------------------
    // Parse & Save Sleep Data (with detailed stages)
    // ------------------------------------------
    let sleepCount = 0;
    if (sleepFileKey) {
      postProgress('parsing', 92, 'Parsing Sleep sessions...');
      console.log("Worker: Loading Sleep CSV...");
      const sleepCsvText = await loadedZip.files[sleepFileKey].async('text');
      const rawSleep = parseSamsungCSV<any>(sleepCsvText);
      console.log("Worker: Sleep CSV rows parsed:", rawSleep.length);
      
      const normalizedSleep: SleepSession[] = [];
      for (const row of rawSleep) {
        const rawStartTime = row.start_time || row['com.samsung.health.sleep.start_time'];
        const rawEndTime = row.end_time || row['com.samsung.health.sleep.end_time'];
        const rawEfficiency = row.efficiency || row['com.samsung.health.sleep.efficiency'];
        const datauuid = row.datauuid || row['com.samsung.health.sleep.datauuid'];

        const startTime = rawStartTime ? new Date(rawStartTime).getTime() : null;
        const endTime = rawEndTime ? new Date(rawEndTime).getTime() : null;
        if (!startTime || !endTime) continue;

        let stages: SleepStage[] = [];

        // Resolve detailed sleep stage JSON files
        const jsonPath = row.custom_data_file || row['com.samsung.health.sleep.custom_data_file'] || row.device_uuid;
        if (jsonPath && typeof jsonPath === 'string') {
          const normalizedPath = jsonPath.startsWith('/') ? jsonPath.substring(1) : jsonPath;
          const jsonFile = files.find(f => f.endsWith(normalizedPath));
          
          if (jsonFile) {
            try {
              const jsonText = await loadedZip.files[jsonFile].async('text');
              const rawStages = JSON.parse(jsonText);
              
              if (Array.isArray(rawStages)) {
                stages = rawStages.map((s: any) => {
                  let stageName: 'awake' | 'light' | 'deep' | 'rem' = 'light';
                  if (s.stage === 70001 || s.stage === 0) stageName = 'awake';
                  else if (s.stage === 70002 || s.stage === 1) stageName = 'light';
                  else if (s.stage === 70003 || s.stage === 2) stageName = 'deep';
                  else if (s.stage === 70004 || s.stage === 3) stageName = 'rem';

                  return {
                    stage: stageName,
                    startTime: Number(s.start_time || s.startTime),
                    endTime: Number(s.end_time || s.endTime),
                  };
                });
              }
            } catch (e) {
              console.warn(`Failed to parse sleep stage JSON at ${jsonPath}:`, e);
            }
          }
        }

        const durationMs = endTime - startTime;
        const durationMin = durationMs / (1000 * 60);
        
        normalizedSleep.push({
          id: datauuid || `sleep_${startTime}`,
          startTime,
          endTime,
          duration: durationMin,
          efficiency: rawEfficiency ? Number(rawEfficiency) : 100,
          stages,
        });
      }

      console.log("Worker: Total sleep sessions to save:", normalizedSleep.length);
      postProgress('saving', 96, `Saving ${normalizedSleep.length} sleep sessions...`);
      await db.sleep.bulkPut(normalizedSleep);
      console.log("Worker: All sleep sessions written to IndexedDB successfully!");
      sleepCount = normalizedSleep.length;
    }

    // ------------------------------------------
    // Parse & Save Workouts Data
    // ------------------------------------------
    let workoutsCount = 0;
    if (workoutFileKey) {
      postProgress('parsing', 97, 'Parsing Workouts data...');
      console.log("Worker: Loading Workouts CSV...");
      const workoutCsvText = await loadedZip.files[workoutFileKey].async('text');
      const rawWorkouts = parseSamsungCSV<any>(workoutCsvText);
      console.log("Worker: Workouts CSV rows parsed:", rawWorkouts.length);
      
      const normalizedWorkouts: Workout[] = [];
      for (const row of rawWorkouts) {
        const rawStartTime = row.start_time || row['com.samsung.health.exercise.start_time'];
        const rawEndTime = row.end_time || row['com.samsung.health.exercise.end_time'];
        const rawWorkoutType = row.workout_type || row.exercise_type || row['com.samsung.health.exercise.exercise_type'];
        const rawDuration = row.duration || row['com.samsung.health.exercise.duration'];
        const rawCalorie = row.calorie || row['com.samsung.health.exercise.calorie'];
        const rawDistance = row.distance || row['com.samsung.health.exercise.distance'];
        const rawMeanHeartRate = row.mean_heart_rate || row.avg_heart_rate || row['com.samsung.health.exercise.mean_heart_rate'];
        const rawMaxHeartRate = row.max_heart_rate || row['com.samsung.health.exercise.max_heart_rate'];
        const datauuid = row.datauuid || row['com.samsung.health.exercise.datauuid'];

        const startTime = rawStartTime ? new Date(rawStartTime).getTime() : null;
        const endTime = rawEndTime ? new Date(rawEndTime).getTime() : null;
        if (!startTime || !endTime) continue;

        // Map Samsung workout type IDs to readable strings
        let type = 'workout';
        if (rawWorkoutType === 1001 || rawWorkoutType === 13001) type = 'walking';
        else if (rawWorkoutType === 1002) type = 'running';
        else if (rawWorkoutType === 11007) type = 'cycling';
        else if (rawWorkoutType === 14001) type = 'swimming';
        else if (rawWorkoutType === 15006) type = 'hiking';

        normalizedWorkouts.push({
          id: datauuid || `workout_${startTime}`,
          type,
          startTime,
          endTime,
          duration: Number(rawDuration || (endTime - startTime)),
          calories: Number(rawCalorie || 0),
          distance: rawDistance ? Number(rawDistance) : undefined,
          avgHeartRate: rawMeanHeartRate ? Number(rawMeanHeartRate) : undefined,
          maxHeartRate: rawMaxHeartRate ? Number(rawMaxHeartRate) : undefined,
        });
      }

      console.log("Worker: Total workouts to save:", normalizedWorkouts.length);
      postProgress('saving', 99, `Saving ${normalizedWorkouts.length} workouts...`);
      await db.workouts.bulkPut(normalizedWorkouts);
      console.log("Worker: All workouts written to IndexedDB successfully!");
      workoutsCount = normalizedWorkouts.length;
    }

    // ------------------------------------------
    // Complete Import
    // ------------------------------------------
    postProgress('completed', 100, 'Import completed successfully!', {
      steps: normalizedSteps.length,
      heartRate: heartRateCount,
      sleep: sleepCount,
      workouts: workoutsCount,
    });

  } catch (error: any) {
    console.error('Worker: Critical error during processing:', error);
    self.postMessage({
      status: 'error',
      progress: 0,
      message: error.message || 'An unknown error occurred during parsing.'
    });
  }
};

function postProgress(status: WorkerStatus, progress: number, message: string, stats?: WorkerProgress['stats']) {
  self.postMessage({ status, progress, message, stats });
}