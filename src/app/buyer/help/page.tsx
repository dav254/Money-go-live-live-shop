
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileQuestion, Search } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { HelpArticle } from '@/lib/types';
import { useMemo } from 'react';

export default function BuyerHelpCenterPage() {
    const firestore = useFirestore();

    const helpArticlesQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'helpArticles'), where('audience', 'array-contains', 'buyer'));
    }, [firestore]);

    const { data: articles, isLoading } = useCollection<HelpArticle>(helpArticlesQuery);

    const articlesByCategory = useMemo(() => {
        if (!articles) return {};
        return articles.reduce((acc, article) => {
            const category = article.category || 'General';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(article);
            return acc;
        }, {} as Record<string, HelpArticle[]>);
    }, [articles]);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                 <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Help Center
                    </h1>
                 </div>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileQuestion />
                            Knowledge Base
                        </CardTitle>
                        <CardDescription>Find answers to common buyer questions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search questions..." className="pl-9" />
                        </div>
                        {isLoading ? <p>Loading articles...</p> :
                        <Accordion type="single" collapsible className="w-full">
                            {Object.entries(articlesByCategory).map(([category, articles]) => (
                                <AccordionItem key={category} value={category}>
                                    <AccordionTrigger className="font-semibold">{category}</AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="space-y-4 pl-4">
                                        {articles.map(qa => (
                                           <li key={qa.id}>
                                                <p className="font-bold">{qa.question}</p>
                                                <p className="text-muted-foreground">{qa.answer}</p>
                                           </li>
                                        ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                        }
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
}
