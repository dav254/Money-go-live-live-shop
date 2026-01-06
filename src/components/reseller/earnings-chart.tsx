
'use client';

import * as React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { ChartConfig } from '@/components/ui/chart';

interface EarningsChartProps {
  chartData: any[];
  chartConfig: ChartConfig;
}

export function EarningsChart({ chartData, chartConfig }: EarningsChartProps) {
  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <BarChart accessibilityLayer data={chartData}>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <RechartsTooltip
          cursor={{ fill: 'hsla(var(--muted))' }}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
          }}
        />
        <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
