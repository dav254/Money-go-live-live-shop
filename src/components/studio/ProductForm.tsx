
'use client';

import { useRouter } from 'next/navigation';

export default function ProductForm() {
  const router = useRouter();

  function handleNext() {
    // In a real app, you would save this data.
    // For this frontend-only example, we just navigate to the next page.
    router.push('/seller/studio/preview');
  }

  function handleSaveDraft() {
    // In a real app, you would save this data as a draft.
    alert('Product saved as a draft!');
  }

  return (
    <form className="space-y-4">
      <input placeholder="Product Name" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <input placeholder="Category" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <textarea placeholder="Description / Features" className="w-full p-2 rounded-lg bg-gray-800 text-white"></textarea>

      <input placeholder="Tags (#summer,#fashion)" className="w-full p-2 rounded-lg bg-gray-800 text-white" />

      <h3 className="text-lg font-bold">Pricing & Inventory</h3>
      <input type="number" placeholder="Price USD" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <input type="number" placeholder="Sale Price USD" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <input type="number" placeholder="Stock Quantity" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <input type="number" placeholder="Shipping USD" className="w-full p-2 rounded-lg bg-gray-800 text-white" />

      <h3 className="text-lg font-bold">Logistics</h3>
      <input placeholder="Location" className="w-full p-2 rounded-lg bg-gray-800 text-white" />
      <input placeholder="Delivery Options" className="w-full p-2 rounded-lg bg-gray-800 text-white" />

      <div className="flex gap-2">
        <button type="button" onClick={handleSaveDraft} className="bg-gray-700 px-4 py-2 rounded-lg text-white">Save Draft</button>
        <button type="button" onClick={handleNext} className="bg-red-600 px-4 py-2 rounded-lg text-white">Next</button>
      </div>
    </form>
  );
}
