
'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function PublishButton() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isPublishing, setIsPublishing] = useState(false);

  async function uploadToCloudinary(blob: Blob): Promise<string> {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'product_videos';
    const paramsToSign = { timestamp, folder };

    const signatureResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paramsToSign),
    });

    if (!signatureResponse.ok) {
      throw new Error('Failed to get upload signature.');
    }
    const { signature } = await signatureResponse.json();

    const formData = new FormData();
    formData.append('file', blob, 'recorded-video.webm');
    formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error.message || 'Video upload failed.');
    }

    const uploadedData = await uploadResponse.json();
    return uploadedData.secure_url;
  }

  async function handlePublish() {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'You must be logged in to publish.' });
      return;
    }

    const videoUrl = localStorage.getItem('videoUrl');
    const productId = localStorage.getItem('selectedProductId');

    if (!videoUrl || !productId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Video or product data is missing. Please restart the process.' });
      return;
    }

    setIsPublishing(true);
    toast({ title: 'Publishing...', description: 'Uploading your video. This may take a moment.' });

    try {
      // Fetch the blob from the local URL
      const videoBlob = await fetch(videoUrl).then(res => res.blob());

      // Upload to Cloudinary
      const permanentUrl = await uploadToCloudinary(videoBlob);

      // Update the product document in Firestore
      const productRef = doc(firestore, 'products', productId);
      await updateDoc(productRef, {
        videoUrls: arrayUnion(permanentUrl),
      });

      toast({ title: 'Published!', description: 'Your video has been added to the product.' });
      
      // Cleanup localStorage
      localStorage.removeItem('videoUrl');
      localStorage.removeItem('selectedProductId');

      router.push('/dashboard/seller'); // Redirect to seller dashboard

    } catch (error: any) {
      console.error('Publishing error:', error);
      toast({ variant: 'destructive', title: 'Publish Failed', description: error.message || 'Could not publish your video.' });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <button onClick={handlePublish} disabled={isPublishing} className="bg-red-600 w-full py-3 rounded-lg text-white font-bold flex items-center justify-center">
      {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isPublishing ? 'Publishing...' : 'Publish'}
    </button>
  );
}
