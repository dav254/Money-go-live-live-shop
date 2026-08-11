'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export interface PlatformActivityData {
  date: string;
  Users: number;
  Sellers: number;
  Orders: number;
  Revenue: number;
  'Video Uploads': number;
}

interface PlatformActivityChartProps {
  data: PlatformActivityData[];
  isLoading: boolean;
}

export const PlatformActivityChart = ({ data, isLoading }: PlatformActivityChartProps) => {
  if (isLoading) {
      return (
        <Card className="w-full lg:col-span-2">
            <CardHeader>
                <CardTitle>Platform Activity</CardTitle>
                <CardDescription>Loading data...</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[350px] w-full bg-muted animate-pulse rounded-lg" />
            </CardContent>
        </Card>
      )
  }

  return (
    <Card className="w-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Platform Activity</CardTitle>
            <CardDescription>Key platform metrics over the last 7 days.</CardDescription>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
            Last 7 Days <ChevronDown className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
            <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
            />
            <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `${value}`}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))'
                }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="Users" stroke="#8884d8" strokeWidth={2} />
            <Line type="monotone" dataKey="Sellers" stroke="#82ca9d" strokeWidth={2} />
            <Line type="monotone" dataKey="Orders" stroke="#ffc658" strokeWidth={2} />
            <Line type="monotone" dataKey="Revenue" stroke="#ff7300" strokeWidth={2} />
            <Line type="monotone" dataKey="Video Uploads" stroke="#00C49F" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};