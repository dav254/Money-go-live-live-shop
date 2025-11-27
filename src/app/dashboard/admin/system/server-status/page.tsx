
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
  Cloud,
  Users,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';

type Status = 'checking' | 'operational' | 'degraded' | 'outage';

export interface ServiceStatus {
  name: string;
  status: Status;
}

const serviceIcons: { [key: string]: React.ElementType } = {
  'API: Payments': DollarSign,
  'API: User Follows': Users,
  'API: Image Uploads': Cloud,
  'Database (Firestore)': Database,
  'Live Streaming (Mux)': Radio,
  'AI Services (Genkit)': BrainCircuit,
  default: Server,
}

const initialServices: ServiceStatus[] = [
  { name: 'API: Payments', status: 'checking' },
  { name: 'API: User Follows', status: 'checking' },
  { name: 'API: Image Uploads', status: 'checking' },
  { name: 'Database (Firestore)', status: 'checking' },
  { name: 'Live Streaming (Mux)', status: 'checking' },
  { name: 'AI Services (Genkit)', status: 'checking' },
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
    degraded: { icon: Activity, color: 'text-yellow-500', text: 'Degraded' },
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
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/system-status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();

      setServices(data.services); // Directly set the services from the API response

      setChartData(prevData => {
        const now = new Date();
        const newDataPoint = {
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          responseTime: data.apiResponseTime,
        };
        return [...prevData, newDataPoint].slice(-20);
      });

      setLastChecked(new Date());
    } catch (error) {
      console.error("Error fetching server status:", error);
      // set all services to outage on error
      setServices(prev => prev.map(s => ({ ...s, status: 'outage' })));
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Initial fetch and periodic polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);


  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <div>
                 <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Server & Services Status
                </h1>
                <p className="text-muted-foreground">
                    {lastChecked ? `Last updated: ${lastChecked.toLocaleTimeString()}` : 'Running health checks...'}
                </p>
            </div>
            <Button variant="outline" onClick={fetchStatus} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Refresh All
            </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {services.map(service => {
            const Icon = serviceIcons[service.name] || serviceIcons.default;
            return (
              <Card key={service.name}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                    <span className="font-semibold">{service.name}</span>
                  </div>
                  <StatusIndicator status={service.status} />
                </CardContent>
              </Card>
            )
          })}
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
