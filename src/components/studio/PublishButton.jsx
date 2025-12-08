'use client';

import { useRouter } from 'next/navigation';

export default function PublishButton() {
  const router = useRouter();

  function handlePublish() {
    alert('Your product is now live!');
    router.push('/dashboard/seller'); // Redirect to seller dashboard
  }

  return (
    <button onClick={handlePublish} className="bg-red-600 w-full py-3 rounded-lg text-white">
      Publish
    </button>
  );
}
