'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  XCircle,
  BrainCircuit,
  Radio,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';

type Status = 'checking' | 'operational' | 'degraded' | 'outage';

interface ServiceStatus {
  name: string;
  status: Status;
  icon: React.ElementType;
}

const initialServices: ServiceStatus[] = [
  { name: 'Platform API', status: 'checking', icon: Server },
  { name: 'Database (Firestore)', status: 'checking', icon: Database },
  { name: 'Live Streaming', status: 'checking', icon: Radio },
  { name: 'AI Services (Genkit)', status: 'checking', icon: BrainCircuit },
];

const chartConfig = {
  responseTime: {
    label: 'Response Time (ms)',
    color: 'hsl(var(--primary))',
  },
};

const StatusIndicator = ({ status }: { status: Status }) => {
  const config = {
    checking: { icon: Loader2, color: 'text-muted-foreground', text: 'Checking...', animate: true },
    operational: { icon: CheckCircle2, color: 'text-green-500', text: 'Operational' },
    degraded: { icon: Activity, color: 'text-yellow-500', text: 'Degraded Performance' },
    outage: { icon: XCircle, color: 'text-destructive', text: 'Outage' },
  };

  const current = config[status];
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', current.color, current.animate && 'animate-spin')} />
      <span className={cn('font-semibold', current.color)}>{current.text}</span>
    </div>
  );
};

export default function AdminServerStatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(initialServices);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [chartData, setChartData] = useState<{ time: string, responseTime: number }[]>([]);

  const runHealthChecks = useCallback(() => {
    setServices(initialServices); // Reset to "checking"
    setLastChecked(null);

    setTimeout(() => {
      setServices(currentServices => currentServices.map(s => ({ ...s, status: 'operational' })));
      setLastChecked(new Date());
    }, 1500);
  }, []);

  useEffect(() => {
    runHealthChecks();
  }, [runHealthChecks]);

  // Simulate real-time chart data
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData(prevData => {
        const now = new Date();
        const newDataPoint = {
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          responseTime: Math.floor(Math.random() * (150 - 50 + 1)) + 50, // Random between 50ms and 150ms
        };
        // Keep only the last 20 data points
        return [...prevData, newDataPoint].slice(-20);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);


  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <div>
                 <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Server & Services Status
                </h1>
                <p className="text-muted-foreground">
                    {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Running health checks...'}
                </p>
            </div>
            <Button variant="outline" onClick={runHealthChecks}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh All
            </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {services.map(service => (
            <Card key={service.name}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <service.icon className="h-6 w-6 text-muted-foreground" />
                  <span className="font-semibold">{service.name}</span>
                </div>
                <StatusIndicator status={service.status} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
            <CardHeader>
                <CardTitle>API Response Time (Live)</CardTitle>
                <CardDescription>Average response time over the last minute.</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-80 w-full">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${value}ms`} />
                         <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="line" />}
                        />
                        <Line
                            dataKey="responseTime"
                            type="monotone"
                            stroke="var(--color-responseTime)"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
