
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const mockTopResellers = [
    { id: 'reseller-1', name: 'John Doe', avatar: 'https://picsum.photos/seed/john/40', sales: 152, commission: 450.75 },
    { id: 'reseller-2', name: 'Jane Smith', avatar: 'https://picsum.photos/seed/jane/40', sales: 121, commission: 380.50 },
    { id: 'reseller-3', name: 'Mike Williams', avatar: 'https://picsum.photos/seed/mike/40', sales: 98, commission: 290.00 },
    { id: 'reseller-4', name: 'Sarah B.', avatar: 'https://picsum.photos/seed/sarah/40', sales: 85, commission: 250.00 },
    { id: 'reseller-5', name: 'Chris G.', avatar: 'https://picsum.photos/seed/chris/40', sales: 72, commission: 210.20 },
    { id: 'reseller-6', name: 'Emily White', avatar: 'https://picsum.photos/seed/emily/40', sales: 65, commission: 195.50 },
    { id: 'reseller-7', name: 'David Kim', avatar: 'https://picsum.photos/seed/david/40', sales: 58, commission: 175.00 },
];

export default function ResellerLeaderboardPage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
                           <Trophy className="text-primary h-8 w-8" />
                           Top Reseller Leaderboard
                        </CardTitle>
                        <CardDescription>
                            See how you rank against other resellers on the platform. Keep sharing to climb to the top!
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rank</TableHead>
                                    <TableHead>Reseller</TableHead>
                                    <TableHead className="text-center">Sales Made</TableHead>
                                    <TableHead className="text-right">Commission Earned (USD)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockTopResellers.map((reseller, index) => (
                                    <TableRow key={reseller.id}>
                                        <TableCell className="font-bold text-lg">
                                            {index === 0 && <Badge className="bg-yellow-500 mr-2">
                                                <Trophy className="h-4 w-4" />
                                            </Badge>}
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={reseller.avatar} />
                                                    <AvatarFallback>{reseller.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{reseller.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                                        <TableCell className="text-right font-semibold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
