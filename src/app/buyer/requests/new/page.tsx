'use client';

import * as React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from 'next/navigation';
import { createRequest } from '@/lib/requests/client';
import type { CreateRequestInput } from '@/lib/requests/types';
import { REQUEST_CATEGORIES } from '@/lib/requests/types';
import {
  MarketplaceMediaUploader,
  type AttachedMedia,
} from '@/components/marketplace/media-uploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Loader2, Sparkles, MapPin, CalendarDays } from 'lucide-react';

/**
 * WHAT DO YOU NEED? (spec §24) — the customer request brief:
 * title, description, category, quantity, budget, location, deadline,
 * plus photos / a short video, posted to the Vidnov matching engine.
 */

export default function NewRequestPage() {
  const { user, isLoading: authLoading } = useUser();
  const { userProfile, isLoading: profileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  // Auth gate: requests are always tied to a signed-in customer — and only
  // customers post. Businesses respond with offers instead.
  React.useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      router.replace('/login?returnTo=/buyer/requests/new');
    } else if (userProfile?.userRole === 'seller') {
      router.replace('/requests');
    }
  }, [authLoading, profileLoading, user, userProfile, router]);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<string>('');
  const [quantity, setQuantity] = React.useState('1');
  const [budgetMin, setBudgetMin] = React.useState('');
  const [budgetMax, setBudgetMax] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [deadline, setDeadline] = React.useState('');
  const [images, setImages] = React.useState<AttachedMedia[]>([]);
  const [videos, setVideos] = React.useState<AttachedMedia[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit =
    !!user && title.trim().length >= 5 && description.trim().length >= 20 && !!category && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!user) {
      setError('You must be signed in to post a request.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateRequestInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        quantity: Number(quantity) || 1,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        location: location.trim() || undefined,
        deadline: deadline || null,
        mediaIds: [...images, ...videos].map((m) => m.mediaId),
      };
      const request = await createRequest(user, input);
      router.push(`/requests/${request.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <BuyerLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </BuyerLayout>
    );
  }

  if (!user) {
    return (
      <BuyerLayout>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="font-grotesk text-2xl font-black uppercase">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need an account to post a request. Redirecting you to sign in…
          </p>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <header className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
            Request Marketplace
          </p>
          <h1 className="font-grotesk text-3xl font-black uppercase tracking-tight md:text-4xl">
            What do you need?
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Describe it once — Vidnov matches your request with the right businesses, and they
            come to you with offers.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Custom 7-seater sofa for my living room"
                  maxLength={120}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell businesses exactly what you need — dimensions, materials, style, any specifics…"
                  rows={5}
                  className="rounded-xl"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  {description.trim().length < 20
                    ? `${20 - description.trim().length} more characters needed`
                    : 'Looks good'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">Budget min (KES)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    min={0}
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="Optional"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMax">Budget max (KES)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    min={0}
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="Optional"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Location
                  </Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Nairobi"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" /> Deadline
                  </Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest">Media</h2>
              </div>
              <MarketplaceMediaUploader
                user={user}
                images={images}
                videos={videos}
                onChange={(next) => {
                  setImages(next.images);
                  setVideos(next.videos);
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional — a description alone works too. Reference photos, fabric swatches, room
                shots or a short video help businesses quote accurately. Media is private: only
                businesses matched to your request can view it.
              </p>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              className="rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide shadow-lg shadow-primary/25"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Post Request
            </Button>
          </div>
        </form>
      </div>
    </BuyerLayout>
  );
}
