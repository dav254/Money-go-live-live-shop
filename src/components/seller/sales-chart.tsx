
'use client';

import * as React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
import { ChartConfig } from '@/components/ui/chart';

interface SalesChartProps {
  chartData: any[];
  chartConfig: ChartConfig;
}

export function SalesChart({ chartData, chartConfig }: SalesChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <RechartsBarChart data={chartData}>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          tickFormatter={(value) =>
            new Date(value).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `$${value}`}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
      </RechartsBarChart>
    </ChartContainer>
  );
}
