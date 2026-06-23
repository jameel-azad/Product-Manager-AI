'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface BurndownPoint {
  day: string | number;
  ideal: number;
  actual: number;
  [key: string]: unknown;
}

interface BurndownChartProps {
  sprintId: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

const CURSOR_STYLE = { stroke: '#334155' };

export default function BurndownChart({ sprintId }: BurndownChartProps) {
  const [data, setData] = useState<BurndownPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive whether actual is ahead or behind ideal at the last data point
  const lastPoint = data[data.length - 1];
  const actualColor =
    !lastPoint || lastPoint.actual <= lastPoint.ideal ? '#10b981' : '#ef4444';

  useEffect(() => {
    analyticsApi
      .getBurndown(sprintId)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : res.data?.points ?? [];
        setData(raw);
      })
      .catch(() => setError('Failed to load burndown data'))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (loading) {
    return (
      <div className="h-[250px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[250px] flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center">
        <p className="text-sm text-slate-500">No burndown data available.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1e293b"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={CURSOR_STYLE}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
        />
        {/* Ideal burndown â€” dashed blue */}
        <Line
          type="linear"
          dataKey="ideal"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          name="Ideal"
        />
        {/* Actual burndown â€” solid green or red based on progress */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke={actualColor}
          strokeWidth={2}
          dot={{ r: 3, fill: actualColor, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          name="Actual"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

