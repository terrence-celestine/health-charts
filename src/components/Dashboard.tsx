import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Flame, 
  Heart, 
  Moon, 
  UploadCloud, 
  Trash2, 
  Calendar, 
  RefreshCw, 
  TrendingUp 
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { clearDatabase, getDatabaseStats } from '../db/schema';
import { useSteps, useSleep, useHeartRate, useWorkouts } from '../hooks/useHealthData';
import ParserWorker from '../worker/parser.worker?worker';
import { HealthCharts } from '../components/HealthCharts';
import { CorrelationEngine } from '../components/CorrelationEngine';

export const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'charts' | 'correlation'>('charts');
  // ==========================================
  // 1. State Management
  // ==========================================
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
    endDate: new Date(),
  });

  const [dbStats, setDbStats] = useState({
    steps: 0,
    heartRate: 0,
    sleep: 0,
    workouts: 0,
    hasData: false,
  });

  const [importProgress, setImportProgress] = useState<{
    status: 'idle' | 'extracting' | 'parsing' | 'saving' | 'completed' | 'error';
    progress: number;
    message: string;
    stats?: typeof dbStats;
  } | null>(null);

  // ==========================================
  // 2. Load Database Statistics
  // ==========================================
  const loadStats = async () => {
    const stats = await getDatabaseStats();
    setDbStats(stats);
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Update date range based on preset selection
  useEffect(() => {
    const end = new Date();
    let start = new Date();

    if (datePreset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (datePreset === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (datePreset === 'all') {
      // Default to 1 year ago if "all" is selected
      start.setFullYear(end.getFullYear() - 1);
    }

    setDateRange({ startDate: start, endDate: end });
  }, [datePreset]);

  // ==========================================
  // 3. Query Health Data (Reactive Hooks)
  // ==========================================
  const stepsData = useSteps(dateRange);
  const sleepData = useSleep(dateRange);
  const hrData = useHeartRate(dateRange);
  const workoutsData = useWorkouts(dateRange);

  // ==========================================
  // 4. File Upload & Web Worker Execution
  // ==========================================
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("Dashboard: No file selected.");
      return;
    }

    console.log("Dashboard: Selected file for upload:", file.name, "Size:", file.size, "bytes");

    setImportProgress({
      status: 'extracting',
      progress: 0,
      message: 'Starting Web Worker background import...',
    });

    // Instantiate Vite Web Worker
    console.log("Dashboard: Instantiating Web Worker...");
    const worker = new ParserWorker();

    // Send the ZIP file to the Web Worker
    console.log("Dashboard: Posting message to Web Worker...");
    worker.postMessage(file);

    // Listen for progress/completion messages
    worker.onmessage = (e) => {
      const { status, progress, message, stats } = e.data;
      console.log(`Dashboard: Received message from worker. Status: "${status}", Progress: ${progress}%, Message: "${message}"`);
      if (stats) {
        console.log("Dashboard: Worker reported stats:", stats);
      }

      setImportProgress({ status, progress, message, stats });

      if (status === 'completed') {
        console.log("Dashboard: Import completed successfully! Loading stats...");
        loadStats();
        // Clear progress after 3 seconds
        setTimeout(() => setImportProgress(null), 3000);
        worker.terminate(); // Clean up worker thread
      } else if (status === 'error') {
        console.error("Dashboard: Worker reported an error:", message);
        worker.terminate(); // Clean up worker thread on error
      }
    };

    worker.onerror = (err) => {
      console.error('Dashboard: Critical worker error event received:', err);
      setImportProgress({
        status: 'error',
        progress: 0,
        message: 'A critical worker error occurred. Please check the console.',
      });
      worker.terminate();
    };
  };

  const handleClearDatabase = async () => {
    if (window.confirm('Are you sure you want to delete all health data from your browser? This action cannot be undone.')) {
      await clearDatabase();
      await loadStats();
    }
  };

  // ==========================================
  // 5. Computed Metric Values
  // ==========================================
  const avgSteps = stepsData?.summary.avgSteps || 0;
  const totalCalories = stepsData?.summary.totalCalories || 0;
  const avgSleepDuration = sleepData?.summary.avgDurationHours || 0;
  const avgSleepEfficiency = sleepData?.summary.avgEfficiency || 0;
  const avgHeartRate = hrData?.summary.avg || 0;
  const workoutCount = workoutsData?.summary.totalWorkouts || 0;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 py-5 px-8 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 text-white p-2 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Samsung Health Dashboard</h1>
              <p className="text-xs text-neutral-500 font-medium">Secure, private, local-first analytics</p>
            </div>
          </div>

          {/* Date Range Selector */}
          {dbStats.hasData && (
            <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg self-start sm:self-auto">
              {(['today', '7days', '30days', 'all'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    datePreset === preset
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {preset === '7days' ? '7 Days' : preset === '30days' ? '30 Days' : preset}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-8">
        {/* Import Progress Overlay */}
        {importProgress && (
          <div className="mb-8 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-5 h-5 text-violet-600 ${importProgress.status !== 'completed' && importProgress.status !== 'error' ? 'animate-spin' : ''}`} />
                <span className="font-semibold text-neutral-900">{importProgress.message}</span>
              </div>
              <span className="text-sm font-bold text-violet-600">{importProgress.progress}%</span>
            </div>
            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-violet-600 h-full transition-all duration-300"
                style={{ width: `${importProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty State / Upload Dropzone */}
        {!dbStats.hasData ? (
          <div className="max-w-xl mx-auto mt-12 bg-white border border-neutral-200 rounded-2xl p-10 text-center">
            <div className="mx-auto w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mb-6">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Import your Samsung Health Data</h2>
            <p className="text-sm text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
              Export your data inside the Samsung Health app (Settings &gt; Download personal data), and drag the resulting ZIP file here. Your data never leaves your computer.
            </p>
            <label className="mt-6 inline-flex items-center justify-center px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors shadow-sm">
              <span>Select ZIP File</span>
              <input 
                type="file" 
                accept=".zip" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          /* Dashboard Content */
          <div className="space-y-8">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Average Steps"
                value={avgSteps.toLocaleString()}
                unit="/ day"
                icon={TrendingUp}
                colorClass="bg-emerald-50 text-emerald-600"
                description={`Total steps: ${(stepsData?.summary.totalSteps || 0).toLocaleString()}`}
              />
              <MetricCard
                title="Sleep Duration"
                value={avgSleepDuration}
                unit="hrs"
                icon={Moon}
                colorClass="bg-indigo-50 text-indigo-600"
                description={`Efficiency: ${avgSleepEfficiency}% average`}
              />
              <MetricCard
                title="Average Heart Rate"
                value={avgHeartRate}
                unit="bpm"
                icon={Heart}
                colorClass="bg-rose-50 text-rose-600"
                description={`Range: ${hrData?.summary.min || 0} - ${hrData?.summary.max || 0} bpm`}
              />
              <MetricCard
                title="Workouts Completed"
                value={workoutCount}
                unit="sessions"
                icon={Flame}
                colorClass="bg-amber-50 text-orange-600"
                description={`Calories burned: ${(workoutsData?.summary.totalCalories || 0).toLocaleString()} kcal`}
              />
            </div>

                        {/* Tab Navigation */}
                        <div className="border-b border-neutral-200 flex items-center gap-6">
              <button
                onClick={() => setActiveTab('charts')}
                className={`pb-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'charts'
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Dashboard Charts
              </button>
              <button
                onClick={() => setActiveTab('correlation')}
                className={`pb-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'correlation'
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Correlation & Insights
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'charts' ? (
              <HealthCharts
                stepsRecords={stepsData?.records || []}
                heartRateChartData={hrData?.chartData || []}
                sleepSessions={sleepData?.sessions || []}
              />
            ) : (
              <CorrelationEngine
                stepsRecords={stepsData?.records || []}
                sleepSessions={sleepData?.sessions || []}
                heartRateRecords={hrData?.records || []}
              />
            )}

            {/* Footer / Database Stats */}
            <div className="border-t border-neutral-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500 font-medium">
                <span>Steps: <strong>{dbStats.steps.toLocaleString()}</strong></span>
                <span>Heart Rate: <strong>{dbStats.heartRate.toLocaleString()}</strong></span>
                <span>Sleep Sessions: <strong>{dbStats.sleep.toLocaleString()}</strong></span>
                <span>Workouts: <strong>{dbStats.workouts.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                  <UploadCloud className="w-4 h-4" />
                  <span>Import New ZIP</span>
                  <input 
                    type="file" 
                    accept=".zip" 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                </label>
                <button
                  onClick={handleClearDatabase}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Database</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};