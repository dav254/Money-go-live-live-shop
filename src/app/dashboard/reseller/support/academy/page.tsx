
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Bot, Film, TrendingUp, Sparkles, Trophy, Clock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { HelpArticle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const upcomingCourses = [
  { icon: TrendingUp, title: "Viral Marketing 101", description: "Learn to sell effectively on WhatsApp, TikTok, and Instagram." },
  { icon: BookOpen, title: "Product Selection", description: "How to choose trending products with the highest commission rates." },
  { icon: Film, title: "Content is King", description: "Master the art of creating short-form videos that lead to sales." },
  { icon: Sparkles, title: "AI Masterclass", description: "Advanced tips for using the AI Toolkit to maximize your earnings." },
];

export default function ResellerAcademyPage() {
    const firestore = useFirestore();

    const tutorialsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'helpArticles'),
            where('audience', 'array-contains', 'reseller'),
            limit(10)
        );
    }, [firestore]);

    const { data: tutorials, isLoading } = useCollection<HelpArticle>(tutorialsQuery);

    return (
      <ResellerLayout>
        <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Go Earn Academy
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
                                    Active Courses & Guides
                                </CardTitle>
                                <CardDescription>Impactful lessons to boost your sales game.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid sm:grid-cols-2 gap-4">
                                {isLoading ? (
                                    <>
                                        <Skeleton className="h-40 w-full" />
                                        <Skeleton className="h-40 w-full" />
                                    </>
                                ) : tutorials && tutorials.length > 0 ? (
                                    tutorials.map(item => (
                                    <div key={item.id} className="relative group overflow-hidden rounded-lg border bg-card p-4 flex flex-col justify-between hover:shadow-primary/20 hover:border-primary/50 transition-all border-primary/10">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <PlayCircle className="h-8 w-8 text-primary" />
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold">{item.category}</Badge>
                                            </div>
                                            <h3 className="font-headline font-bold text-lg leading-tight mb-2">{item.question}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{item.answer}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground mt-6 pt-4 border-t border-primary/5">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Course</span>
                                            <Button size="sm" variant="outline" className="h-8 font-bold text-xs" asChild>
                                                <Link href="/dashboard/reseller/support/help-center">Start Lesson</Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))) : (
                                    <p className="text-muted-foreground col-span-2 text-center py-12 border-2 border-dashed rounded-xl">No courses available yet. Check back soon!</p>
                                )}
                            </CardContent>
                        </Card>

                         {/* AI Growth Tools */}
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <Sparkles className="animate-pulse" />
                                    AI Growth Tools
                                </CardTitle>
                                <CardDescription>Let our AI help you make smarter decisions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                                    <div>
                                        <h3 className="font-bold">AI Caption Generator</h3>
                                        <p className="text-sm text-muted-foreground">Create viral captions for social media to boost engagement.</p>
                                    </div>
                                    <Button asChild className="font-bold">
                                        <Link href="/dashboard/reseller/ai-tools/caption-generator">Use Tool</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Upcoming Courses */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <Clock />
                                    Upcoming Courses
                                </CardTitle>
                                <CardDescription>A sneak peek at the new skills you'll be able to learn soon.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {upcomingCourses.map((course) => (
                                <div key={course.title} className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                                    <div className="flex items-center gap-4">
                                        <course.icon className="h-6 w-6 text-muted-foreground" />
                                        <div>
                                            <h3 className="font-semibold">{course.title}</h3>
                                            <p className="text-sm text-muted-foreground">{course.description}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline">Coming Soon</Badge>
                                </div>
                                ))}
                            </CardContent>
                        </Card>

                    </div>

                    <div className="space-y-8">
                        {/* Certifications */}
                        <Card className="sticky top-24">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="text-yellow-500" />
                                    Your Achievements
                                </CardTitle>
                                <CardDescription>Complete courses to earn badges and unlock benefits.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 text-center">
                                <div className="flex justify-center gap-4">
                                     <div className="flex flex-col items-center gap-1">
                                        <Badge className="text-lg bg-yellow-700/20 text-yellow-700 border-yellow-700/50 h-12 w-12 rounded-full p-0 flex items-center justify-center grayscale">B</Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Bronze</span>
                                     </div>
                                     <div className="flex flex-col items-center gap-1">
                                        <Badge className="text-lg bg-gray-400/20 text-gray-400 border-gray-400/50 h-12 w-12 rounded-full p-0 flex items-center justify-center grayscale">S</Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Silver</span>
                                     </div>
                                     <div className="flex flex-col items-center gap-1">
                                        <Badge className="text-lg bg-yellow-400/20 text-yellow-400 border-yellow-400/50 h-12 w-12 rounded-full p-0 flex items-center justify-center grayscale">G</Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Gold</span>
                                     </div>
                                </div>
                                <p className="text-sm text-muted-foreground pt-2 italic">
                                    "Your journey to top reseller starts with your first lesson."
                                </p>
                                <Button variant="secondary" className="w-full font-bold uppercase tracking-widest text-xs" disabled>
                                    View Leaderboard
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
      </ResellerLayout>
    );
}
