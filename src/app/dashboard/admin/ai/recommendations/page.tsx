
'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { BrainCircuit, SlidersHorizontal, Power, CalendarClock, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminAIRecommendationsPage() {
    const { toast } = useToast();
    // Component state to simulate backend settings
    const [isEngineActive, setIsEngineActive] = useState(true);
    const [model, setModel] = useState('hybrid');
    const [retrainingSchedule, setRetrainingSchedule] = useState('daily');
    const [newnessWeight, setNewnessWeight] = useState(60);
    const [serendipityWeight, setSerendipityWeight] = useState(25);

    const handleSaveChanges = () => {
        // In a real app, this would save the state to a Firestore document
        console.log({
            isEngineActive,
            model,
            retrainingSchedule,
            newnessWeight,
            serendipityWeight
        });
        toast({
            title: 'Settings Saved',
            description: 'Recommendation engine settings have been updated.',
        });
    };

    return (
        <AdminLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                 <h1 className="font-headline text-3xl font-bold tracking-tight">
                    AI Recommendation Engine
                </h1>
                <Button onClick={handleSaveChanges}>Save Changes</Button>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">

                {/* Engine Status & Model Selection */}
                <div className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Power className="text-primary"/> Engine Status</CardTitle>
                             <CardDescription>
                                Globally enable or disable product recommendations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center justify-between rounded-lg border p-4">
                                <Label htmlFor="engine-status">Recommendation Engine Active</Label>
                                <Switch id="engine-status" checked={isEngineActive} onCheckedChange={setIsEngineActive} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Bot className="text-primary"/> Active Model</CardTitle>
                             <CardDescription>
                                Choose the AI model that powers recommendations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup value={model} onValueChange={setModel}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="content" id="r1" />
                                    <Label htmlFor="r1">Content-Based Filtering (similar products)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="collaborative" id="r2" />
                                    <Label htmlFor="r2">Collaborative Filtering (user behavior)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="hybrid" id="r3" />
                                    <Label htmlFor="r3">Hybrid Model (recommended)</Label>
                                </div>
                            </RadioGroup>
                        </CardContent>
                    </Card>
                </div>

                {/* Tuning Parameters */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="text-primary"/> Tuning Parameters</CardTitle>
                        <CardDescription>
                            Fine-tune the recommendation algorithm. Changes will apply after the next model retraining cycle.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div>
                            <div className="flex justify-between mb-2">
                                <Label>Newness vs. Popularity</Label>
                                <span className="text-sm text-muted-foreground">{newnessWeight}% Newness</span>
                            </div>
                            <Slider
                                value={[newnessWeight]}
                                onValueChange={(value) => setNewnessWeight(value[0])}
                                max={100}
                                step={5}
                            />
                             <p className="text-xs text-muted-foreground mt-2">
                                Higher values favor newly added products over popular best-sellers.
                            </p>
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <Label>Personalization vs. Serendipity</Label>
                                <span className="text-sm text-muted-foreground">{serendipityWeight}% Serendipity</span>
                            </div>
                            <Slider
                                value={[serendipityWeight]}
                                onValueChange={(value) => setSerendipityWeight(value[0])}
                                max={100}
                                step={5}
                            />
                             <p className="text-xs text-muted-foreground mt-2">
                                Higher values recommend more unexpected and diverse items outside a user's direct interest.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Card className="w-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><CalendarClock /> Retraining Schedule</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup value={retrainingSchedule} onValueChange={setRetrainingSchedule}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="daily" id="s1" />
                                        <Label htmlFor="s1">Daily</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="weekly" id="s2" />
                                        <Label htmlFor="s2">Weekly</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="manual" id="s3" />
                                        <Label htmlFor="s3">Manual Trigger Only</Label>
                                    </div>
                                </RadioGroup>
                                <Button variant="secondary" className="mt-4">Trigger Retraining Now</Button>
                            </CardContent>
                        </Card>
                    </CardFooter>
                </Card>
            </div>
        </div>
        </AdminLayout>
    );
}
