
'use client';

import * as React from 'react';
import type { Seller, Review, UserProfile } from '@/lib/types';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Star, StarHalf } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';

const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5 text-yellow-400">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="h-4 w-4 fill-current" />
      ))}
      {halfStar && <StarHalf key="half" className="h-4 w-4 fill-current" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="h-4 w-4 text-muted-foreground" />
      ))}
    </div>
  );
};

const ReviewCardSkeleton = () => (
    <div className="flex gap-4 border-b py-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
            <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full" />
        </div>
    </div>
);

const ReviewCard = ({ review }: { review: Review }) => {
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => {
    return doc(firestore, 'userProfiles', review.buyerId);
  }, [firestore, review.buyerId]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

  return (
    <div className="flex gap-4 border-b border-neutral-800 py-4 last:border-b-0">
      <Avatar>
        <AvatarImage src={userProfile?.profilePictureUrl} alt={userProfile?.fullName || 'User avatar'} />
        <AvatarFallback>{userProfile?.fullName?.charAt(0) || 'A'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{userProfile?.fullName || 'Anonymous'}</p>
          <p className="text-xs text-neutral-400">{review.createdAt.toDate().toLocaleDateString()}</p>
        </div>
        <div className="my-1">
          <StarRating rating={review.rating} />
        </div>
        <p className="text-sm text-neutral-300">{review.comment}</p>
      </div>
    </div>
  );
};

export function SellerReviews({ seller }: { seller: Seller }) {
  const firestore = useFirestore();

  const reviewsQuery = useMemoFirebase(() => {
    return query(collectionGroup(firestore, 'reviews'), where('sellerId', '==', seller.id));
  }, [firestore, seller.id]);

  const { data: reviews, isLoading } = useCollection<Review>(reviewsQuery);
  
  const averageRating = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return total / reviews.length;
  }, [reviews]);


  return (
    <Card className="bg-neutral-900 border-neutral-800 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Ratings & Reviews</CardTitle>
         <div className="flex items-center gap-2 pt-2">
            <p className="text-4xl font-bold">{averageRating.toFixed(1)}</p>
            <div>
                <StarRating rating={averageRating} />
                <p className="text-sm text-neutral-400">Based on {reviews?.length || 0} reviews</p>
            </div>
         </div>
      </CardHeader>
      <Separator className="bg-neutral-800" />
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
          </div>
        ) : reviews && reviews.length > 0 ? (
          reviews.map(review => <ReviewCard key={review.id} review={review} />)
        ) : (
          <div className="flex h-32 items-center justify-center">
            <p className="text-neutral-400">This seller has no reviews yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    