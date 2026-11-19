'use client';

import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { BookingsTrend } from '@/types';

const SERIES = [
  { key: 'pending', label: 'Pending', color: '#c08a2e' },
  { key: 'confirmed', label: 'Confirmed', color: '#2f7d5b' },
  { key: 'completed', label: 'Completed', color: '#55524d' },
  { key: 'cancelled', label: 'Cancelled', color: '#a23b3b' },
] as const;

interface TrendChartProps {
  trend: BookingsTrend | undefined;
  failed?: boolean;
  onRetry?: () => void;
}

export function TrendChart({ trend, failed = false, onRetry }: TrendChartProps) {
  const total = trend?.points.reduce((sum, point) => sum + point.total, 0) ?? 0;
  const data = (trend?.points ?? []).map(point => ({
    ...point,
    label: format(parseISO(point.date), 'd MMM'),
  }));

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Booking activity</h2>
        <p className="mt-1 text-sm text-ink-600">
          Requests created and decided over the last {trend?.days ?? 14} days.
        </p>
      </CardHeader>
      <CardBody>
        {failed && !trend ? (
          <ErrorState
            title="The chart could not be loaded"
            onRetry={onRetry}
            className="border-0 py-8"
          />
        ) : !trend ? (
          <Skeleton className="h-64 w-full" />
        ) : total === 0 ? (
          <p className="py-16 text-center text-sm text-ink-600">
            No booking activity in this period yet.
          </p>
        ) : (
          <>
            <div
              role="img"
              aria-label={`Stacked bar chart of booking activity over the last ${trend.days} days, ${total} events in total. A table with the same figures follows.`}
              className="h-64 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke="#e5dfd3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#6b6660' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#6b6660' }}
                  />
                  <Tooltip cursor={{ fill: 'rgba(184,151,90,0.12)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map(series => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="a"
                      fill={series.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sr-only">
              <table>
                <caption>Booking activity by day</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    {SERIES.map(series => (
                      <th key={series.key} scope="col">
                        {series.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(point => (
                    <tr key={point.date}>
                      <th scope="row">{point.label}</th>
                      {SERIES.map(series => (
                        <td key={series.key}>{point[series.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
