import React, { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts';
import { Brain, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';

interface CorrelationEngineProps {
  stepsRecords: any[];
  sleepSessions: any[];
  heartRateRecords: any[];
}

/**
 * Calculates the Pearson Correlation Coefficient between two arrays of numbers.
 * Returns a value between -1 (perfect negative correlation) and 1 (perfect positive correlation).
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);

  const sumXSq = x.reduce((a, b) => a + b * b, 0);
  const sumYSq = y.reduce((a, b) => a + b * b, 0);

  const pSum = x.map((val, i) => val * y[i]).reduce((a, b) => a + b, 0);

  const num = pSum - (sumX * sumY) / n;
  const den = Math.sqrt((sumXSq - (sumX * sumX) / n) * (sumYSq - (sumY * sumY) / n));

  if (den === 0) return 0;
  return num / den;
}

export const CorrelationEngine: React.FC<CorrelationEngineProps> = ({
  stepsRecords,
  sleepSessions,
  heartRateRecords,
}) => {
  // ==========================================
  // 1. Align Data by Date for Correlation
  // ==========================================
  const correlationData = useMemo(() => {
    if (stepsRecords.length === 0 || sleepSessions.length === 0) return [];

    // Create maps for quick lookup
    const stepsMap = new Map(stepsRecords.map(r => [r.date, r.count]));
    
    // Group sleep by date (using end date of sleep session)
    const sleepMap = new Map<string, { duration: number; efficiency: number }>();
    for (const session of sleepSessions) {
      const dateStr = new Date(session.endTime).toISOString().split('T')[0];
      sleepMap.set(dateStr, {
        duration: session.duration / 60, // hours
        efficiency: session.efficiency,
      });
    }

    // Group heart rate daily average
    const hrMap = new Map<string, number>();
    const hrByDate = new Map<string, { sum: number; count: number }>();
    for (const record of heartRateRecords) {
      const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
      const current = hrByDate.get(dateStr) || { sum: 0, count: 0 };
      hrByDate.set(dateStr, {
        sum: current.sum + record.bpm,
        count: current.count + 1,
      });
    }
    for (const [date, val] of hrByDate.entries()) {
      hrMap.set(date, Math.round(val.sum / val.count));
    }

    // Merge datasets on matching dates
    const merged: Array<{
      date: string;
      steps: number;
      sleepDuration: number;
      sleepEfficiency: number;
      avgHeartRate?: number;
    }> = [];

    for (const [date, steps] of stepsMap.entries()) {
      const sleep = sleepMap.get(date);
      if (sleep) {
        merged.push({
          date,
          steps,
          sleepDuration: sleep.duration,
          sleepEfficiency: sleep.efficiency,
          avgHeartRate: hrMap.get(date),
        });
      }
    }

    return merged;
  }, [stepsRecords, sleepSessions, heartRateRecords]);

  // ==========================================
  // 2. Calculate Pearson Coefficients
  // ==========================================
  const correlations = useMemo(() => {
    if (correlationData.length < 3) return null;

    const steps = correlationData.map(d => d.steps);
    const sleepDur = correlationData.map(d => d.sleepDuration);
    const sleepEff = correlationData.map(d => d.sleepEfficiency);
    
    const stepsVsSleepDur = calculatePearsonCorrelation(steps, sleepDur);
    const stepsVsSleepEff = calculatePearsonCorrelation(steps, sleepEff);

    // Heart rate correlations if available
    const validHrData = correlationData.filter(d => d.avgHeartRate !== undefined);
    let stepsVsHr = 0;
    if (validHrData.length >= 3) {
      stepsVsHr = calculatePearsonCorrelation(
        validHrData.map(d => d.steps),
        validHrData.map(d => d.avgHeartRate!)
      );
    }

    return {
      stepsVsSleepDur,
      stepsVsSleepEff,
      stepsVsHr,
    };
  }, [correlationData]);

  // ==========================================
  // 3. Generate Automated Insights
  // ==========================================
  const insights = useMemo(() => {
    if (!correlations || correlationData.length < 3) return [];

    const list: Array<{ type: 'positive' | 'negative' | 'neutral'; text: string }> = [];

    // Steps vs Sleep Duration Insight
    const stepsSleep = correlations.stepsVsSleepDur;
    if (stepsSleep > 0.3) {
      list.push({
        type: 'positive',
        text: `There is a strong positive correlation (${stepsSleep.toFixed(2)}) between your steps and sleep duration. On days you walk more, you tend to sleep longer!`,
      });
    } else if (stepsSleep < -0.3) {
      list.push({
        type: 'negative',
        text: `There is a negative correlation (${stepsSleep.toFixed(2)}) between your steps and sleep duration. High activity days might be cutting into your sleep time.`,
      });
    }

    // Steps vs Sleep Efficiency Insight
    const stepsEff = correlations.stepsVsSleepEff;
    if (stepsEff > 0.3) {
      list.push({
        type: 'positive',
        text: `Your daily steps and sleep efficiency have a positive correlation of ${stepsEff.toFixed(2)}. Walking more is strongly associated with higher quality, more restful sleep.`,
      });
    }

    // Steps vs Heart Rate Insight
    const hrCorr = correlations.stepsVsHr;
    if (hrCorr < -0.3) {
      list.push({
        type: 'positive', // Lower resting HR is positive health-wise
        text: `Excellent! There is a negative correlation (${hrCorr.toFixed(2)}) between your daily steps and average heart rate. More activity is associated with a lower, healthier average heart rate.`,
      });
    }

    if (list.length === 0) {
      list.push({
        type: 'neutral',
        text: "We need a bit more varied data to find strong correlations. Keep importing your data regularly to unlock deeper insights!",
      });
    }

    return list;
  }, [correlations, correlationData]);

  // Helper to interpret Pearson coefficient strength
  const getCorrelationStrength = (val: number) => {
    const abs = Math.abs(val);
    if (abs < 0.1) return 'No correlation';
    if (abs < 0.3) return 'Weak correlation';
    if (abs < 0.5) return 'Moderate correlation';
    return 'Strong correlation';
  };

  if (correlationData.length < 3) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center max-w-xl mx-auto">
        <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-neutral-900">Insufficient Data for Correlation</h3>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          We need at least 3 days of overlapping Steps and Sleep data to calculate correlations. Keep walking and recording your sleep, then import your updated ZIP!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Insights Panel */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-600" />
          <h3 className="text-lg font-bold text-violet-900">Automated Health Insights</h3>
        </div>
        <div className="space-y-3">
          {insights.map((insight, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-white border border-violet-100 p-4 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-700 font-medium leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter Plots and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Steps vs Sleep Duration Scatter Plot */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="mb-4">
            <h4 className="text-md font-bold text-neutral-900">Steps vs. Sleep Duration</h4>
            <p className="text-xs text-neutral-500 font-medium">
              Correlation: <strong>{correlations?.stepsVsSleepDur.toFixed(2)}</strong> ({getCorrelationStrength(correlations?.stepsVsSleepDur || 0)})
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" dataKey="steps" name="Steps" stroke="#888888" fontSize={11} unit=" steps" />
                <YAxis type="number" dataKey="sleepDuration" name="Sleep" stroke="#888888" fontSize={11} unit=" hrs" />
                <ZAxis type="number" range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Days" data={correlationData} fill="#6366f1" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Steps vs Sleep Efficiency Scatter Plot */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="mb-4">
            <h4 className="text-md font-bold text-neutral-900">Steps vs. Sleep Efficiency</h4>
            <p className="text-xs text-neutral-500 font-medium">
              Correlation: <strong>{correlations?.stepsVsSleepEff.toFixed(2)}</strong> ({getCorrelationStrength(correlations?.stepsVsSleepEff || 0)})
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" dataKey="steps" name="Steps" stroke="#888888" fontSize={11} unit=" steps" />
                <YAxis type="number" dataKey="sleepEfficiency" name="Efficiency" stroke="#888888" fontSize={11} unit="%" />
                <ZAxis type="number" range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Days" data={correlationData} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};