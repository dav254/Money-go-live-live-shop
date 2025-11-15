
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    DollarSign, 
    Users, 
    ShoppingBag, 
    BarChart, 
    ShieldCheck, 
    Video, 
    CircleDollarSign,
    Clock,
    Package,
    ShieldAlert
} from 'lucide-react';

const stats = [
    { title: 'Total Buyers', value: '12,345', icon: Users },
    { title: 'Total Sellers', value: '1,234', icon: Users },
    { title: 'Total Resellers', value: '5,678', icon: Users },
    { title: 'Total Products', value: '54,321', icon: ShoppingBag },
    { title: 'Live Users Online', value: '1,890', icon: Video, color: 'text-red-500' },
    { title: 'Today\'s Revenue', value: 'KES 89,210', icon: DollarSign, color: 'text-green-500' },
    { title: 'Commission Paid', value: 'KES 22,500', icon: CircleDollarSign, color: 'text-green-500' },
    { title: 'Pending Payouts', value: 'KES 45,120', icon: Clock, color: 'text-yellow-500' },
    { title: 'Daily Orders', value: '1,203', icon: Package },
    { title: 'Flagged Issues', value: '12', icon: ShieldAlert, color: 'text-red-500' },
]


export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {stats.map(stat => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {stat.title}
                        </CardTitle>
                        <stat.icon className={`h-4 w-4 text-muted-foreground ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Sales Graph</CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">Sales graph will be displayed here.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Server Status</CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">Server status will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
