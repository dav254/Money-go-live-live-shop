'use client';

import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { get as idbGet } from '@/lib/idb';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function PublishButton() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const [isPublishing, setIsPublishing] = useState(false);

  async function uploadToFirebase(blob: Blob): Promise<string> {
    if (!user) throw new Error('User not found.');
    const filename = `products/${user.uid}/studio_${Date.now()}.webm`;
    const storageRef = ref(storage, filename);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        null,
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  }

  async function handlePublish() {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'You must be logged in to publish.' });
      return;
    }

    const productId = localStorage.getItem('selectedProductId');

    if (!productId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Product data is missing. Please restart the process.' });
      return;
    }

    setIsPublishing(true);
    toast({ title: 'Publishing...', description: 'Uploading your video to your catalog.' });

    try {
      // Get the blob from IndexedDB
      const videoBlob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
      
      if (!videoBlob) {
          throw new Error('Could not find the recorded video to upload.');
      }

      // Upload to Firebase Storage
      const permanentUrl = await uploadToFirebase(videoBlob);

      // Update the product document in Firestore
      const productRef = doc(firestore, 'products', productId);
      await updateDoc(productRef, {
        videoUrls: arrayUnion(permanentUrl),
        videoUrl: permanentUrl,
        hasVideo: true,
        updatedAt: serverTimestamp(),
      });

      toast({ title: 'Published!', description: 'Your video has been added to the product.' });
      
      // Cleanup localStorage
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
