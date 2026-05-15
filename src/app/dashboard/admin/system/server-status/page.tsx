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
  Cpu,
  Zap,
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
  'API Gateway (Go Earn)': Zap,
  'Database (Firebase Firestore)': Database,
  'AI Core (Google Gemini)': BrainCircuit,
  'Live Stream Signals (VideoSDK)': Radio,
  'Payment Flow (Paystack/PayPal)': DollarSign,
  default: Server,
}

const chartConfig = {
  responseTime: {
    label: 'Latency (ms)',
    color: 'hsl(var(--primary))',
  },
};

const StatusIndicator = ({ status }: { status: Status }) => {
  const config = {
    checking: { icon: Loader2, color: 'text-muted-foreground', text: 'Pinging...', animate: true },
    operational: { icon: CheckCircle2, color: 'text-green-500', text: 'Operational' },
    degraded: { icon: Activity, color: 'text-yellow-500', text: 'Degraded' },
    outage: { icon: XCircle, color: 'text-destructive', text: 'Offline' },
  };

  const current = config[status];
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', current.color, current.animate && 'animate-spin')} />
      <span className={cn('text-xs font-black uppercase tracking-widest', current.color)}>{current.text}</span>
    </div>
  );
};

export default function AdminServerStatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [chartData, setChartData] = useState<{ time: string, responseTime: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/system-status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();

      setServices(data.services);

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
      setServices(prev => prev.map(s => ({ ...s, status: 'outage' })));
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); 
    return () => clearInterval(interval);
  }, [fetchStatus]);


  return (
    <AdminLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
            <div>
                 <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                    Platform Pulse
                </h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1">
                    {lastChecked ? `Heartbeat Sync: ${lastChecked.toLocaleTimeString()}` : 'Initializing health checks...'}
                </p>
            </div>
            <Button variant="outline" onClick={fetchStatus} disabled={isLoading} className="rounded-xl font-black uppercase tracking-widest text-[10px] h-10 border-white/5 bg-neutral-900 shadow-xl">
                <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} />
                PING SERVICES
            </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map(service => {
            const Icon = serviceIcons[service.name] || serviceIcons.default;
            return (
              <Card key={service.name} className="bg-neutral-900 border-white/5 rounded-[1.5rem] shadow-2xl overflow-hidden relative group transition-all hover:border-primary/20">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-black uppercase tracking-tighter text-[11px] text-white/90">{service.name}</span>
                  </div>
                  <StatusIndicator status={service.status} />
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="bg-neutral-950 border-white/5 rounded-[2rem] shadow-2xl overflow-hidden">
            <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> API Latency Dashboard
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-1">Real-time performance metrics in milliseconds</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <ChartContainer config={chartConfig} className="h-80 w-full">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} stroke="rgba(255,255,255,0.3)" />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${value}ms`} fontSize={10} stroke="rgba(255,255,255,0.3)" />
                         <ChartTooltip
                            cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
                            content={<ChartTooltipContent indicator="line" />}
                        />
                        <Line
                            dataKey="responseTime"
                            type="monotone"
                            stroke="hsl(var(--primary))"
                            strokeWidth={3}
                            dot={false}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
