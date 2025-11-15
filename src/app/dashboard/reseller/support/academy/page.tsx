
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Bot, Film, TrendingUp, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';

const tutorials = [
    { title: "How to Make Daily Sales", duration: "7 min video", icon: Film },
    { title: "How to Use AI to Resell Faster", duration: "5 min video", icon: Bot },
    { title: "WhatsApp Sales Mastery", duration: "10 min course", icon: BookOpen },
    { title: "How to Pick Winning Products", duration: "6 min video", icon: TrendingUp },
];

const aiTools = [
    { title: "AI Sales Coach", description: "Get personalized tips on what to sell and how to say it." },
    { title: "AI Product Picker", description: "Our AI analyzes trends to show you what's hot right now." },
    { title: "AI Success Score", description: "Analyzes your activity and gives you a score with tips to improve." },
];

export default function ResellerAcademyPage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        MoneyGo Academy
                    </h1>
                    <p className="text-lg text-muted-foreground">Your training center for becoming a top reseller.</p>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Video Tutorials */}
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Film />
                                    Video Tutorials & Courses
                                </CardTitle>
                                <CardDescription>Short, impactful lessons to boost your sales game.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid sm:grid-cols-2 gap-4">
                                {tutorials.map(item => (
                                    <div key={item.title} className="relative group overflow-hidden rounded-lg border bg-background p-4 flex flex-col justify-between hover:shadow-primary/20 hover:border-primary/50 transition-all">
                                        <div>
                                            <item.icon className="h-8 w-8 text-primary mb-4" />
                                            <h3 className="font-headline font-semibold mb-2">{item.title}</h3>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
                                            <span>{item.duration}</span>
                                            <Button size="sm" variant="link" className="p-0 h-auto">Start</Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                         {/* AI Growth Tools */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <Sparkles />
                                    AI Growth Tools
                                </CardTitle>
                                <CardDescription>Let our AI help you make smarter decisions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {aiTools.map(tool => (
                                    <div key={tool.title} className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <h3 className="font-semibold">{tool.title}</h3>
                                            <p className="text-sm text-muted-foreground">{tool.description}</p>
                                        </div>
                                        <Button>Use Tool</Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        {/* Certifications */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy />
                                    Certifications
                                </CardTitle>
                                <CardDescription>Complete courses to earn badges and unlock benefits.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-center">
                                <div className="flex justify-center gap-4">
                                     <Badge className="text-lg bg-yellow-700/80">Bronze</Badge>
                                     <Badge className="text-lg bg-gray-400/80">Silver</Badge>
                                     <Badge className="text-lg bg-yellow-400/80 text-black">Gold</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground pt-2">
                                    You have not earned any certifications yet. Start a course to begin!
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ResellerLayout>
    );
}
