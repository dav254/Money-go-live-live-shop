'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, AlertCircle, Server } from 'lucide-react';

interface ServiceStatus {
    name: string;
    status: 'Operational' | 'Degraded' | 'Outage';
}

interface SystemHealthProps {
    services: ServiceStatus[];
    lastChecked: string;
    isLoading: boolean;
}

const statusIcons = {
    Operational: <CheckCircle className="h-4 w-4 text-green-500" />,
    Degraded: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    Outage: <AlertCircle className="h-4 w-4 text-red-500" />,
};

const statusColors = {
    Operational: 'text-green-500',
    Degraded: 'text-yellow-500',
    Outage: 'text-red-500',
}

export const SystemHealth = ({ services, lastChecked, isLoading }: SystemHealthProps) => {
    if (isLoading) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                             <div key={i} className="flex flex-col items-center space-y-2">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }
    
    const isAllOperational = services.every(s => s.status === 'Operational');

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> System Health</CardTitle>
                 <CardDescription>
                    {isAllOperational ? 'All systems are operational.' : 'Some systems are experiencing issues.'}
                    <span className="text-xs text-muted-foreground ml-2">Last checked: {lastChecked}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 text-center">
                    {services.map(service => (
                        <div key={service.name} className="flex flex-col items-center">
                            <dt className="text-sm font-medium text-muted-foreground">{service.name}</dt>
                             <dd className={`flex items-center gap-1 text-sm font-semibold ${statusColors[service.status]}`}>
                                {statusIcons[service.status]}
                                {service.status}
                            </dd>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
