import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface HealthChartsProps {
  stepsRecords: any[];
  heartRateChartData: any[];
  sleepSessions: any[];
}

export const HealthCharts: React.FC<HealthChartsProps> = ({
  stepsRecords,
  heartRateChartData,
  sleepSessions,
}) => {
  // Format date for steps chart (e.g., "Jun 11")
  const formattedStepsData = stepsRecords.map((r) => ({
    ...r,
    label: new Date(r.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }));

  // Format sleep data (convert duration to hours)
  const formattedSleepData = sleepSessions.map((s) => ({
    ...s,
    durationHours: Number((s.duration / 60).toFixed(1)),
    label: new Date(s.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-8">
      {/* Steps & Active Time Chart */}
      {formattedStepsData.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-900">Steps & Active Minutes</h3>
            <p className="text-xs text-neutral-500 font-medium">Daily step counts and active exercise duration</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedStepsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: '500' }} />
                <Bar yAxisId="left" dataKey="count" name="Steps" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="activeTime" name="Active Time (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heart Rate Area Chart */}
      {heartRateChartData.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-900">Heart Rate Trend</h3>
            <p className="text-xs text-neutral-500 font-medium">Downsampled heart rate readings (LTTB optimized)</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={heartRateChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="dateLabel" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis stroke="#f43f5e" domain={['dataMin - 10', 'dataMax + 10']} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                />
                <Area type="monotone" dataKey="bpm" name="Heart Rate" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorBpm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sleep Duration & Efficiency Chart */}
      {formattedSleepData.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-900">Sleep Analysis</h3>
            <p className="text-xs text-neutral-500 font-medium">Sleep duration and efficiency over time</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedSleepData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#4f46e5" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: '500' }} />
                <Bar yAxisId="left" dataKey="durationHours" name="Sleep Duration (hrs)" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="efficiency" name="Sleep Efficiency (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};